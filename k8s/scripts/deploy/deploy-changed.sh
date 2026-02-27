#!/bin/bash
# =============================================================================
# Deploy Only Changed Services
# =============================================================================
# Detects which services have changes, builds and pushes Docker images, then
# restarts the deployments to pick up the new images.
#
# Two detection modes:
#   Default:     Detects uncommitted changes via git status
#   --committed: Detects committed-but-undeployed changes via deploy-tracker
#
# Usage: ./deploy-changed.sh [--dry-run] [--include-staged] [--committed]
#                             [--no-health-check] [--manifests-only]
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
PROJECT_ROOT="$(dirname "$K8S_DIR")"
TRACKER="$SCRIPT_DIR/../utils/deploy-tracker.sh"

REGISTRY="registry.korczewski.de/korczewski"
NAMESPACE="korczewski-services"

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
MANIFESTS_ONLY=false

for arg in "$@"; do
    case $arg in
        --dry-run) DRY_RUN=true ;;
        --include-staged) INCLUDE_STAGED=true ;;
        --committed) COMMITTED_MODE=true ;;
        --no-health-check) HEALTH_CHECK=false ;;
        --manifests-only) MANIFESTS_ONLY=true ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --dry-run          Show what would be deployed without deploying"
            echo "  --include-staged   Include staged changes in detection (default mode)"
            echo "  --committed        Detect committed-but-undeployed changes via deploy-tracker"
            echo "  --no-health-check  Skip post-deploy health checks"
            echo "  --manifests-only   Only apply k8s manifests (no image build/push)"
            echo "  --help             Show this help message"
            echo ""
            echo "Default mode detects uncommitted changes via git status."
            echo "Committed mode compares HEAD against last deployed SHA from deploy-tracker."
            exit 0
            ;;
    esac
done

# Service to source directory mapping (for change detection)
declare -A SERVICE_DIRS=(
    ["auth"]="auth"
    ["l2p"]="l2p"
    ["shop"]="shop"
    ["videovault"]="VideoVault"
)

# Service to Dockerfile mapping (relative to PROJECT_ROOT)
declare -A SERVICE_DOCKERFILES=(
    ["auth"]="auth/Dockerfile"
    ["l2p-backend"]="l2p/backend/Dockerfile"
    ["l2p-frontend"]="l2p/frontend/Dockerfile"
    ["shop"]="shop/Dockerfile"
    ["videovault"]="VideoVault/Dockerfile.prod"
)

# Service to k8s manifest paths
declare -A SERVICE_MANIFESTS=(
    ["auth"]="services/auth"
    ["l2p-backend"]="services/l2p-backend"
    ["l2p-frontend"]="services/l2p-frontend"
    ["shop"]="services/shop"
    ["videovault"]="services/videovault"
)

# Service to deployment names (for rollout restart)
declare -A SERVICE_DEPLOYMENTS=(
    ["auth"]="auth"
    ["l2p-backend"]="l2p-backend"
    ["l2p-frontend"]="l2p-frontend"
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

# Map a top-level service to its image targets
# (l2p produces two images; all others produce one)
get_image_targets() {
    local service=$1
    case $service in
        l2p) echo "l2p-backend l2p-frontend" ;;
        *)   echo "$service" ;;
    esac
}

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

    # Check shared-infrastructure changes (affects l2p)
    if echo "$changed_files" | grep -q "^shared-infrastructure/"; then
        if [[ ! " ${changed_services[*]} " =~ " l2p " ]]; then
            changed_services+=("l2p")
            log_service "Detected changes in: l2p (shared-infrastructure)" >&2
        fi
    fi

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

# Build and push a single image
build_and_push_image() {
    local target=$1
    local dockerfile="${SERVICE_DOCKERFILES[$target]}"
    local image="${REGISTRY}/${target}:latest"

    log_info "Building $target..."
    if ! docker build -t "$image" -f "$PROJECT_ROOT/$dockerfile" "$PROJECT_ROOT"; then
        log_error "Failed to build $target"
        return 1
    fi

    log_info "Pushing $target..."
    if ! docker push "$image"; then
        log_error "Failed to push $target"
        return 1
    fi

    log_info "✓ $target image pushed"
}

# Apply k8s manifests for a target
apply_manifests() {
    local target=$1
    local manifest_path="${SERVICE_MANIFESTS[$target]}"

    log_info "Applying manifests for $target..."
    kubectl apply -k "$K8S_DIR/$manifest_path/"
}

# Restart deployment to pull new image
restart_deployment() {
    local target=$1
    local deployment="${SERVICE_DEPLOYMENTS[$target]}"

    log_info "Restarting deployment/$deployment..."
    kubectl rollout restart "deployment/$deployment" -n "$NAMESPACE"
}

# Wait for rollout to complete
wait_for_rollout() {
    local target=$1
    local deployment="${SERVICE_DEPLOYMENTS[$target]}"

    log_info "Waiting for $deployment rollout..."
    kubectl rollout status "deployment/$deployment" -n "$NAMESPACE" --timeout=180s 2>/dev/null || {
        log_warn "Timeout waiting for $deployment rollout"
        return 1
    }
}

# Health check a target after deployment
health_check_target() {
    local target=$1

    if [ "$HEALTH_CHECK" = false ] || [ "$DRY_RUN" = true ]; then
        return 0
    fi

    local health_spec="${SERVICE_HEALTH[$target]:-}"
    if [ -z "$health_spec" ]; then
        return 0
    fi

    IFS='|' read -r selector port path <<< "$health_spec"

    echo -n "  Health check $target: "

    local pod
    pod=$(kubectl get pods -n "$NAMESPACE" -l "$selector" \
        -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")

    if [ -z "$pod" ]; then
        echo -e "${YELLOW}no pod found${NC}"
        return 0
    fi

    local ready
    ready=$(kubectl get pod "$pod" -n "$NAMESPACE" \
        -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "")

    if [ "$ready" != "True" ]; then
        echo -e "${YELLOW}pod not ready yet${NC}"
        return 0
    fi

    local health
    health=$(kubectl exec "$pod" -n "$NAMESPACE" -- \
        wget -q -O- "http://localhost:${port}${path}" 2>/dev/null || \
        kubectl exec "$pod" -n "$NAMESPACE" -- \
        curl -sf "http://localhost:${port}${path}" 2>/dev/null || echo "")

    if [ -n "$health" ]; then
        echo -e "${GREEN}healthy${NC}"
    else
        echo -e "${YELLOW}health endpoint not responding (may still be starting)${NC}"
    fi
}

# Deploy a single service (build + push + manifests + restart + health)
deploy_service() {
    local service=$1
    local targets
    targets=$(get_image_targets "$service")

    log_step "Deploying: $service"

    if [ "$DRY_RUN" = true ]; then
        for target in $targets; do
            log_info "[DRY RUN] Would build and push: ${REGISTRY}/${target}:latest"
            log_info "[DRY RUN] Would apply manifests: ${SERVICE_MANIFESTS[$target]}"
            log_info "[DRY RUN] Would restart: deployment/${SERVICE_DEPLOYMENTS[$target]}"
        done
        return 0
    fi

    # Build and push images (unless manifests-only)
    if [ "$MANIFESTS_ONLY" = false ]; then
        for target in $targets; do
            if ! build_and_push_image "$target"; then
                return 1
            fi
        done
    fi

    # Apply manifests
    for target in $targets; do
        apply_manifests "$target"
    done

    # Restart deployments (unless manifests-only — manifests changes are picked up by apply)
    if [ "$MANIFESTS_ONLY" = false ]; then
        for target in $targets; do
            restart_deployment "$target"
        done
    fi

    # Wait for rollouts
    for target in $targets; do
        wait_for_rollout "$target"
    done

    # Health checks
    for target in $targets; do
        health_check_target "$target"
    done

    # Record deployment SHA
    if [ -x "$TRACKER" ]; then
        "$TRACKER" set "$service"
        # Also track l2p-frontend separately for the tracker
        if [ "$service" = "l2p" ]; then
            "$TRACKER" set "l2p-frontend"
        fi
    fi

    log_info "✓ Successfully deployed $service"
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
            local targets
            targets=$(get_image_targets "$service")
            for target in $targets; do
                local selector="${SERVICE_HEALTH[$target]%%|*}"
                kubectl get pods -l "$selector" -n "$NAMESPACE" 2>/dev/null || true
            done
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

    if [ "$MANIFESTS_ONLY" = true ]; then
        log_info "Manifests-only mode (no image build/push)"
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
        local targets
        targets=$(get_image_targets "$service")
        echo -e "  • $service → images: $targets"
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
