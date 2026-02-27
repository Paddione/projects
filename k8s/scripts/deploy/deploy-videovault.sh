#!/bin/bash
# =============================================================================
# Deploy VideoVault Service
# =============================================================================
# Builds Docker image, pushes to registry, applies manifests, and restarts.
#
# Usage: ./deploy-videovault.sh [--manifests-only] [--no-health-check]
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
PROJECT_ROOT="$(dirname "$K8S_DIR")"
TRACKER="$SCRIPT_DIR/../utils/deploy-tracker.sh"

REGISTRY="registry.korczewski.de/korczewski"
NAMESPACE="korczewski-services"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_step() { echo -e "\n${BLUE}========================================${NC}"; echo -e "${BLUE}$1${NC}"; echo -e "${BLUE}========================================${NC}"; }

MANIFESTS_ONLY=false
HEALTH_CHECK=true

for arg in "$@"; do
    case $arg in
        --manifests-only) MANIFESTS_ONLY=true ;;
        --no-health-check) HEALTH_CHECK=false ;;
    esac
done

log_step "Deploying VideoVault Service"

# Build and push image
if [ "$MANIFESTS_ONLY" = false ]; then
    log_info "Building videovault..."
    docker build -t "$REGISTRY/videovault:latest" -f "$PROJECT_ROOT/VideoVault/Dockerfile.prod" "$PROJECT_ROOT"

    log_info "Pushing videovault..."
    docker push "$REGISTRY/videovault:latest"
fi

# Apply manifests
log_info "Applying VideoVault manifests..."
kubectl apply -k "$K8S_DIR/services/videovault/"

# Wait for PVCs
log_info "Waiting for PVCs to be bound..."
for pvc in videovault-media videovault-thumbnails videovault-movies videovault-audiobooks videovault-ebooks; do
    kubectl wait --for=jsonpath='{.status.phase}'=Bound "pvc/$pvc" \
        -n "$NAMESPACE" --timeout=120s 2>/dev/null || \
        log_warn "PVC $pvc not bound yet (may need SMB-CSI driver)"
done

# Restart deployment to pull new image
if [ "$MANIFESTS_ONLY" = false ]; then
    kubectl rollout restart deployment/videovault -n "$NAMESPACE"
fi

# Wait for rollout
log_info "Waiting for VideoVault rollout..."
kubectl rollout status deployment/videovault -n "$NAMESPACE" --timeout=180s 2>/dev/null || {
    log_warn "Timeout waiting for VideoVault. Checking status..."
    kubectl get pods -l app=videovault -n "$NAMESPACE"
    kubectl describe pod -l app=videovault -n "$NAMESPACE" | tail -30
}

# Health check
if [ "$HEALTH_CHECK" = true ]; then
    VV_POD=$(kubectl get pods -n "$NAMESPACE" -l app=videovault \
        -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    if [ -n "$VV_POD" ]; then
        HEALTH=$(kubectl exec "$VV_POD" -n "$NAMESPACE" -- \
            wget -q -O- http://localhost:5000/api/health 2>/dev/null || echo "")
        if [ -n "$HEALTH" ]; then
            log_info "VideoVault health: OK"
        else
            log_warn "VideoVault health endpoint not responding (may still be starting)"
        fi
    fi
fi

# Record deployment SHA
if [ -x "$TRACKER" ]; then
    "$TRACKER" set videovault
fi

log_info "VideoVault service deployed!"
kubectl get pods -l app=videovault -n "$NAMESPACE"
kubectl get pvc -l app=videovault -n "$NAMESPACE"
