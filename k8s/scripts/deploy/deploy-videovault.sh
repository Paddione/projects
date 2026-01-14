#!/bin/bash
# =============================================================================
# Deploy VideoVault Service
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

echo "Deploying VideoVault Service..."

# Apply manifests
kubectl apply -f "$K8S_DIR/services/videovault/"

# Wait for PVCs to be bound (may take time for NFS provisioning)
log_info "Waiting for PVCs to be bound..."
kubectl wait --for=jsonpath='{.status.phase}'=Bound pvc/videovault-media \
    -n korczewski-services --timeout=120s 2>/dev/null || \
    log_warn "PVC videovault-media not bound yet (may need NFS provisioner)"

kubectl wait --for=jsonpath='{.status.phase}'=Bound pvc/videovault-thumbnails \
    -n korczewski-services --timeout=120s 2>/dev/null || \
    log_warn "PVC videovault-thumbnails not bound yet"

# Wait for deployment
log_info "Waiting for VideoVault service to be ready..."
kubectl wait --for=condition=ready pod -l app=videovault \
    -n korczewski-services --timeout=180s 2>/dev/null || {
    log_warn "Timeout waiting for VideoVault. Checking status..."
    kubectl get pods -l app=videovault -n korczewski-services
    kubectl describe pod -l app=videovault -n korczewski-services | tail -30
}

log_info "VideoVault service deployed!"
kubectl get pods -l app=videovault -n korczewski-services
kubectl get pvc -l app=videovault -n korczewski-services
