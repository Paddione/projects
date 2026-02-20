#!/bin/bash
# =============================================================================
# Deploy Only Changed Services
# =============================================================================
# Detects which services have changes and rebuilds only those, leaving
# everything else running as is.
#
# Two detection modes:
#   Default:     Detects uncommitted changes via git status
#   --committed: Detects committed-but-undeployed changes via deploy-tracker
#
# Usage: ./deploy-changed.sh [--dry-run] [--include-staged] [--committed]
#                             [--no-health-check]
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
PROJECT_ROOT="$(dirname "$K8S_DIR")"
TRACKER="$SCRIPT_DIR/../utils/deploy-tracker.sh"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "\n${BLUE}========================================${NC}"; echo -e "${BLUE}$1${NC}"; echo -e "${BLUE}========================================${NC}"; }
log_service() { echo -e "${CYAN}▶${NC} $1"; }

# Parse arguments
DRY_RUN=false
INCLUDE_STAGED=false
COMMITTED_MODE=false
HEALTH_CHECK=true

for arg in "$@"; do
    case $arg in
        --dry-run) DRY_RUN=true ;;
        --include-staged) INCLUDE_STAGED=true ;;
        --committed) COMMITTED_MODE=true ;;
        --no-health-check) HEALTH_CHECK=false ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --dry-run          Show what would be deployed without deploying"
            echo "  --include-staged   Include staged changes in detection (default mode)"
            echo "  --committed        Detect committed-but-undeployed changes via deploy-tracker"
            echo "  --no-health-check  Skip post-deploy health checks"
            echo "  --help             Show this help message"
            echo ""
            echo "Default mode detects uncommitted changes via git status."
            echo "Committed mode compares HEAD against last deployed SHA from deploy-tracker."
            exit 0
            ;;
    esac
done

# Service to directory mapping
declare -A SERVICE_DIRS=(
    ["auth"]="auth"
    ["l2p"]="l2p"
    ["shop"]="shop"
    ["videovault"]="VideoVault"
)

# Service to Skaffold profile mapping
declare -A SERVICE_PROFILES=(
    ["auth"]="auth"
    ["l2p"]="l2p"
    ["shop"]="shop"
    ["videovault"]="videovault"
)

# Health check endpoints (selector|port|path)
declare -A SERVICE_HEALTH=(
    ["auth"]="app=auth|5500|/health"
    ["l2p-backend"]="app=l2p-backend|3001|/api/health"
    ["l2p-frontend"]="app=l2p-frontend|80|/"
    ["shop"]="app=shop|3000|/"
    ["videovault"]="app=videovault|5000|/api/health"
)

# Detect changed services via uncommitted changes
detect_uncommitted_changes() {
    log_step "Detecting Uncommitted Changes" >&2

    cd "$PROJECT_ROOT"

    local git_status_flags="--short"
    if [ "$INCLUDE_STAGED" = false ]; then
        git_status_flags="--short --untracked-files=no"
    fi

    local changed_files
    changed_files=$(git status $git_status_flags | awk '{print $2}')

    if [ -z "$changed_files" ]; then
        log_info "No changes detected in any service" >&2
        return 0
    fi

    echo -e "\n${CYAN}Changed files:${NC}" >&2
    echo "$changed_files" | sed 's/^/  /' >&2

    local changed_services=()

    for service in "${!SERVICE_DIRS[@]}"; do
        local service_dir="${SERVICE_DIRS[$service]}"
        if echo "$changed_files" | grep -q "^${service_dir}/"; then
            changed_services+=("$service")
            log_service "Detected changes in: $service" >&2
        fi
    done

    printf '%s\n' "${changed_services[@]}"
}

# Detect changed services via committed-but-undeployed changes
detect_committed_changes() {
    log_step "Detecting Committed-but-Undeployed Changes" >&2

    if [ ! -x "$TRACKER" ]; then
        log_error "deploy-tracker.sh not found at $TRACKER" >&2
        exit 1
    fi

    cd "$PROJECT_ROOT"

    local changed_services=()

    for service in "${!SERVICE_DIRS[@]}"; do
        local service_dir="${SERVICE_DIRS[$service]}"
        local sha

        sha=$("$TRACKER" get "$service" 2>/dev/null) || {
            log_warn "$service: no deployment recorded — treating as changed" >&2
            changed_services+=("$service")
            continue
        }

        local count
        count=$(git rev-list --count "${sha}..HEAD" -- "$service_dir/" 2>/dev/null || echo "0")

        if [ "$count" -gt 0 ]; then
            changed_services+=("$service")
            log_service "$service: $count commit(s) since last deploy (${sha:0:12})" >&2
        else
            log_info "$service: up to date (${sha:0:12})" >&2
        fi
    done

    printf '%s\n' "${changed_services[@]}"
}

# Health check a service after deployment
health_check_service() {
    local service=$1

    if [ "$HEALTH_CHECK" = false ] || [ "$DRY_RUN" = true ]; then
        return 0
    fi

    # Determine which health targets to check
    local targets=()
    if [ "$service" = "l2p" ]; then
        targets=("l2p-backend" "l2p-frontend")
    else
        targets=("$service")
    fi

    for target in "${targets[@]}"; do
        local health_spec="${SERVICE_HEALTH[$target]:-}"
        if [ -z "$health_spec" ]; then
            continue
        fi

        IFS='|' read -r selector port path <<< "$health_spec"

        echo -n "  Health check $target: "

        local pod
        pod=$(kubectl get pods -n korczewski-services -l "$selector" \
            -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")

        if [ -z "$pod" ]; then
            echo -e "${YELLOW}no pod found${NC}"
            continue
        fi

        # Check pod readiness
        local ready
        ready=$(kubectl get pod "$pod" -n korczewski-services \
            -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "")

        if [ "$ready" != "True" ]; then
            echo -e "${YELLOW}pod not ready yet${NC}"
            continue
        fi

        # Try health endpoint via exec
        local health
        health=$(kubectl exec "$pod" -n korczewski-services -- \
            wget -q -O- "http://localhost:${port}${path}" 2>/dev/null || \
            kubectl exec "$pod" -n korczewski-services -- \
            curl -sf "http://localhost:${port}${path}" 2>/dev/null || echo "")

        if [ -n "$health" ]; then
            echo -e "${GREEN}healthy${NC}"
        else
            echo -e "${YELLOW}health endpoint not responding (may still be starting)${NC}"
        fi
    done
}

# Deploy a single service using Skaffold
deploy_service() {
    local service=$1
    local profile="${SERVICE_PROFILES[$service]}"

    log_step "Deploying: $service"

    cd "$K8S_DIR"

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would run: skaffold run -p $profile"
        return 0
    fi

    log_info "Running: skaffold run -p $profile"

    if skaffold run -p "$profile"; then
        log_info "✓ Successfully deployed $service"

        # Record deployment SHA
        if [ -x "$TRACKER" ]; then
            "$TRACKER" set "$service"
        fi

        return 0
    else
        log_error "✗ Failed to deploy $service"
        return 1
    fi
}

# Wait for service to be ready
wait_for_service() {
    local service=$1

    if [ "$DRY_RUN" = true ]; then
        return 0
    fi

    log_info "Waiting for $service to be ready..."

    local app_label=""
    case $service in
        auth)
            app_label="app=auth"
            ;;
        l2p)
            app_label="app in (l2p-backend, l2p-frontend)"
            ;;
        shop)
            app_label="app=shop"
            ;;
        videovault)
            app_label="app=videovault"
            ;;
    esac

    if [ -n "$app_label" ]; then
        kubectl wait --for=condition=ready pod \
            -l "$app_label" \
            -n korczewski-services \
            --timeout=180s 2>/dev/null || log_warn "Timeout waiting for $service (may still be starting)"
    fi
}

# Print summary
print_summary() {
    local deployed_services=("$@")

    log_step "Deployment Summary"

    if [ ${#deployed_services[@]} -eq 0 ]; then
        log_info "No services were deployed"
        return 0
    fi

    echo -e "\n${GREEN}Deployed services:${NC}"
    for service in "${deployed_services[@]}"; do
        echo -e "  ✓ $service"
    done

    if [ "$DRY_RUN" = false ]; then
        echo -e "\n${CYAN}Pod status:${NC}"
        for service in "${deployed_services[@]}"; do
            case $service in
                auth)
                    kubectl get pods -l app=auth -n korczewski-services 2>/dev/null || true
                    ;;
                l2p)
                    kubectl get pods -l 'app in (l2p-backend, l2p-frontend)' -n korczewski-services 2>/dev/null || true
                    ;;
                shop)
                    kubectl get pods -l app=shop -n korczewski-services 2>/dev/null || true
                    ;;
                videovault)
                    kubectl get pods -l app=videovault -n korczewski-services 2>/dev/null || true
                    ;;
            esac
        done
    fi
}

# Main execution
main() {
    echo "=========================================="
    echo "Deploy Changed Services"
    echo "=========================================="

    if [ "$DRY_RUN" = true ]; then
        log_warn "DRY RUN MODE - No changes will be made"
    fi

    if [ "$COMMITTED_MODE" = true ]; then
        log_info "Mode: committed-but-undeployed (via deploy-tracker)"
    else
        log_info "Mode: uncommitted changes (via git status)"
    fi

    # Detect changed services
    local changed_services
    if [ "$COMMITTED_MODE" = true ]; then
        changed_services=($(detect_committed_changes))
    else
        changed_services=($(detect_uncommitted_changes))
    fi

    if [ ${#changed_services[@]} -eq 0 ]; then
        log_info "Nothing to deploy!"
        exit 0
    fi

    echo -e "\n${YELLOW}Services to deploy:${NC}"
    for service in "${changed_services[@]}"; do
        echo -e "  • $service"
    done

    if [ "$DRY_RUN" = false ]; then
        echo -e "\n${YELLOW}Press Enter to continue or Ctrl+C to cancel...${NC}"
        read -r
    fi

    # Deploy each changed service
    local deployed_services=()
    local failed_services=()

    for service in "${changed_services[@]}"; do
        if deploy_service "$service"; then
            deployed_services+=("$service")
            wait_for_service "$service"
            health_check_service "$service"
        else
            failed_services+=("$service")
        fi
    done

    # Print summary
    print_summary "${deployed_services[@]}"

    # Report failures
    if [ ${#failed_services[@]} -gt 0 ]; then
        echo -e "\n${RED}Failed deployments:${NC}"
        for service in "${failed_services[@]}"; do
            echo -e "  ✗ $service"
        done
        exit 1
    fi

    log_info "All changed services deployed successfully!"
}

main "$@"
