#!/bin/bash
# =============================================================================
# Deploy All Services
# =============================================================================
# Orchestrates full deployment in correct dependency order.
# Run this after cluster is ready and secrets are generated.
#
# Usage: ./deploy-all.sh [--skip-secrets]
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "\n${BLUE}========================================${NC}"; echo -e "${BLUE}$1${NC}"; echo -e "${BLUE}========================================${NC}"; }

# Parse arguments
SKIP_SECRETS=false
SKIP_INFRA=false

for arg in "$@"; do
    case $arg in
        --skip-secrets) SKIP_SECRETS=true ;;
        --skip-infra) SKIP_INFRA=true ;;
    esac
done

# Pre-flight checks
preflight_checks() {
    log_step "Pre-flight Checks"

    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl not found"
        exit 1
    fi

    # Check cluster connection
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        log_error "Please ensure cluster is running and kubeconfig is set"
        exit 1
    fi

    log_info "Cluster connection verified"
    kubectl get nodes
}

# Deploy namespaces
deploy_namespaces() {
    log_step "Step 1: Deploying Namespaces"
    kubectl apply -f "$K8S_DIR/base/namespaces.yaml"
    log_info "Namespaces created"
}

# Deploy secrets
deploy_secrets() {
    log_step "Step 2: Deploying Secrets"

    if [ "$SKIP_SECRETS" = true ]; then
        log_warn "Skipping secrets deployment (--skip-secrets)"
        return
    fi

    SECRETS_DIR="$K8S_DIR/secrets"

    if [ ! -d "$SECRETS_DIR" ] || [ -z "$(ls -A "$SECRETS_DIR" 2>/dev/null | grep -v README)" ]; then
        log_warn "No secrets found. Generating from .env..."
        "$SCRIPT_DIR/../utils/generate-secrets.sh"
    fi

    # Apply all secret files
    for secret_file in "$SECRETS_DIR"/*.yaml; do
        if [ -f "$secret_file" ]; then
            log_info "Applying $(basename "$secret_file")..."
            kubectl apply -f "$secret_file"
        fi
    done

    log_info "Secrets deployed"
}

# Deploy infrastructure
deploy_infrastructure() {
    if [ "$SKIP_INFRA" = true ]; then
        log_warn "Skipping infrastructure deployment (--skip-infra)"
        return
    fi

    # PostgreSQL
    log_step "Step 3: Deploying PostgreSQL"
    "$SCRIPT_DIR/deploy-postgres.sh"

    # Traefik
    log_step "Step 4: Deploying Traefik"
    "$SCRIPT_DIR/deploy-traefik.sh"
}

# Deploy services
deploy_services() {
    log_step "Step 5: Deploying Auth Service"
    "$SCRIPT_DIR/deploy-auth.sh"

    log_step "Step 6: Deploying L2P Services"
    "$SCRIPT_DIR/deploy-l2p.sh"

    log_step "Step 7: Deploying Shop Service"
    "$SCRIPT_DIR/deploy-shop.sh"

    log_step "Step 8: Deploying VideoVault"
    "$SCRIPT_DIR/deploy-videovault.sh"
}

# Print summary
print_summary() {
    log_step "Deployment Complete!"

    echo ""
    echo "Pods Status:"
    kubectl get pods -A -l app.kubernetes.io/part-of=korczewski

    echo ""
    echo "Services:"
    kubectl get svc -A -l app.kubernetes.io/part-of=korczewski

    echo ""
    echo "IngressRoutes:"
    kubectl get ingressroutes -A 2>/dev/null || echo "No IngressRoutes found"

    echo ""
    echo "=========================================="
    echo "Access URLs (ensure DNS is configured):"
    echo "=========================================="
    echo "  - https://l2p.korczewski.de"
    echo "  - https://auth.korczewski.de"
    echo "  - https://shop.korczewski.de"
    echo "  - https://videovault.korczewski.de"
    echo "  - https://traefik.korczewski.de (dashboard)"
    echo ""
    echo "Run validation:"
    echo "  $SCRIPT_DIR/../utils/validate-cluster.sh"
    echo ""
}

# Main execution
main() {
    echo "=========================================="
    echo "Korczewski K8s Full Deployment"
    echo "=========================================="

    preflight_checks
    deploy_namespaces
    deploy_secrets
    deploy_infrastructure
    deploy_services
    print_summary
}

main "$@"
