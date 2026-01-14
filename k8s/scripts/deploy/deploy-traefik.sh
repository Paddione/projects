#!/bin/bash
# =============================================================================
# Deploy Traefik
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

echo "Deploying Traefik..."

# Install Traefik CRDs if not present
log_info "Installing Traefik CRDs..."
kubectl apply -f https://raw.githubusercontent.com/traefik/traefik/v3.0/docs/content/reference/dynamic-configuration/kubernetes-crd-definition-v1.yml 2>/dev/null || \
    log_warn "Traefik CRDs might already be installed"

# Apply Traefik manifests
kubectl apply -f "$K8S_DIR/infrastructure/traefik/"

# Wait for Traefik to be ready
log_info "Waiting for Traefik to be ready..."
kubectl wait --for=condition=ready pod -l app=traefik \
    -n korczewski-infra --timeout=120s 2>/dev/null || {
    log_warn "Timeout waiting for Traefik. Checking status..."
    kubectl get pods -l app=traefik -n korczewski-infra
    kubectl logs -l app=traefik -n korczewski-infra --tail=20
    exit 1
}

# Verify Traefik health
log_info "Verifying Traefik health..."
kubectl exec -it deployment/traefik -n korczewski-infra -- \
    wget -q -O- http://localhost:8080/ping 2>/dev/null && echo " OK" || {
    log_warn "Traefik ping check failed"
}

log_info "Traefik deployed successfully!"
kubectl get pods -l app=traefik -n korczewski-infra
kubectl get svc traefik -n korczewski-infra
