#!/bin/bash
# =============================================================================
# Deploy SOS (Taschentherapeut) Service
# =============================================================================
# Builds Docker image, pushes to registry, applies manifests, and restarts.
#
# Usage: ./deploy-sos.sh [--manifests-only] [--no-health-check]
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
PROJECT_ROOT="$(dirname "$K8S_DIR")"
TRACKER="$SCRIPT_DIR/../utils/deploy-tracker.sh"

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

log_step "Deploying SOS (Taschentherapeut) Service"

# Auto-detect registry (k3d local vs production)
source "$SCRIPT_DIR/../utils/detect-registry.sh"
detect_registry

# Build and push image
if [ "$MANIFESTS_ONLY" = false ]; then
    log_info "Building sos..."
    docker build -t "$REGISTRY/sos:latest" -f "$PROJECT_ROOT/SOS/Dockerfile" "$PROJECT_ROOT"

    log_info "Pushing sos..."
    docker push "$REGISTRY/sos:latest"
fi

# Apply manifests
log_info "Applying SOS manifests..."
kubectl apply -k "$K8S_DIR/services/sos/"

# Restart deployment to pull new image
if [ "$MANIFESTS_ONLY" = false ]; then
    kubectl rollout restart deployment/sos -n "$NAMESPACE"
fi

# Wait for rollout
log_info "Waiting for SOS rollout..."
kubectl rollout status deployment/sos -n "$NAMESPACE" --timeout=180s

# Health check
if [ "$HEALTH_CHECK" = true ]; then
    SOS_POD=$(kubectl get pods -n "$NAMESPACE" -l app=sos \
        -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    if [ -n "$SOS_POD" ]; then
        HEALTH=$(kubectl exec "$SOS_POD" -n "$NAMESPACE" -- \
            node -e "fetch('http://localhost:3005/health').then(r=>r.json()).then(d=>console.log(JSON.stringify(d)))" 2>/dev/null || echo "")
        if [ -n "$HEALTH" ]; then
            log_info "SOS health: OK"
        else
            log_warn "SOS health endpoint not responding (may still be starting)"
        fi
    fi
fi

# Record deployment SHA
if [ -x "$TRACKER" ]; then
    "$TRACKER" set sos
fi

log_info "SOS service deployed successfully!"
kubectl get pods -l app=sos -n "$NAMESPACE"
