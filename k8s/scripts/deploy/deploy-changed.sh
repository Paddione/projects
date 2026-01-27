#!/bin/bash
# =============================================================================
# Deploy Only Changed Services
# =============================================================================
# Detects which services have uncommitted changes and rebuilds only those,
# leaving everything else running as is.
#
# Usage: ./deploy-changed.sh [--dry-run] [--include-staged]
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
PROJECT_ROOT="$(dirname "$K8S_DIR")"

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

for arg in "$@"; do
    case $arg in
        --dry-run) DRY_RUN=true ;;
        --include-staged) INCLUDE_STAGED=true ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --dry-run          Show what would be deployed without deploying"
            echo "  --include-staged   Include staged changes in detection"
            echo "  --help             Show this help message"
            echo ""
            echo "This script detects which services have changes and rebuilds only those."
            exit 0
            ;;
    esac
done

# Service to directory mapping
declare -A SERVICE_DIRS=(
    ["auth"]="auth"
    ["l2p"]="l2p"
    ["payment"]="payment"
    ["videovault"]="VideoVault"
    ["dashboard"]="dashboard"
)

# Service to Skaffold profile mapping
declare -A SERVICE_PROFILES=(
    ["auth"]="auth"
    ["l2p"]="l2p"
    ["payment"]="payment"
    ["videovault"]="videovault"
    ["dashboard"]="dashboard"
)

# Detect changed services
detect_changed_services() {
    log_step "Detecting Changed Services" >&2
    
    cd "$PROJECT_ROOT"
    
    local git_status_flags="--short"
    if [ "$INCLUDE_STAGED" = false ]; then
        # Only show unstaged changes
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
    
    # Check each service directory for changes
    for service in "${!SERVICE_DIRS[@]}"; do
        local service_dir="${SERVICE_DIRS[$service]}"
        
        # Check if any changed file is in this service's directory
        if echo "$changed_files" | grep -q "^${service_dir}/"; then
            changed_services+=("$service")
            log_service "Detected changes in: $service" >&2
        fi
    done
    
    # Return the list of changed services
    printf '%s\n' "${changed_services[@]}"
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
    
    # Run skaffold with the specific profile
    if skaffold run -p "$profile"; then
        log_info "✓ Successfully deployed $service"
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
    
    # Determine the app label based on service
    local app_label=""
    case $service in
        auth)
            app_label="app=auth"
            ;;
        l2p)
            app_label="app in (l2p-backend, l2p-frontend)"
            ;;
        payment)
            app_label="app=payment"
            ;;
        videovault)
            app_label="app=videovault"
            ;;
        dashboard)
            app_label="app=dashboard"
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
                payment)
                    kubectl get pods -l app=payment -n korczewski-services 2>/dev/null || true
                    ;;
                videovault)
                    kubectl get pods -l app=videovault -n korczewski-services 2>/dev/null || true
                    ;;
                dashboard)
                    kubectl get pods -l app=dashboard -n korczewski-services 2>/dev/null || true
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
    
    # Detect changed services
    local changed_services
    changed_services=($(detect_changed_services))
    
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
