#!/bin/bash
# =============================================================================
# Deploy Assetgenerator Service
# =============================================================================
# Builds Docker image, pushes to registry, applies manifests, and restarts.
#
# Usage: ./deploy-assetgenerator.sh [--manifests-only] [--no-health-check]
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

log_step "Deploying Assetgenerator Service"

# Auto-detect registry (k3d local vs production)
source "$SCRIPT_DIR/../utils/detect-registry.sh"
detect_registry

# Build and push image
if [ "$MANIFESTS_ONLY" = false ]; then
    log_info "Building assetgenerator..."
    docker build -t "$REGISTRY/assetgenerator:latest" -f "$PROJECT_ROOT/Assetgenerator/Dockerfile" "$PROJECT_ROOT/Assetgenerator"

    log_info "Pushing assetgenerator..."
    docker push "$REGISTRY/assetgenerator:latest"

    log_info "Building gpu-waker..."
    docker build -t "$REGISTRY/gpu-waker:latest" -f "$PROJECT_ROOT/Assetgenerator/waker/Dockerfile" "$PROJECT_ROOT/Assetgenerator/waker"

    log_info "Pushing gpu-waker..."
    docker push "$REGISTRY/gpu-waker:latest"
fi

# Apply manifests
log_info "Applying Assetgenerator manifests..."
kubectl apply -k "$K8S_DIR/services/assetgenerator/"

# Restart deployment to pull new image
if [ "$MANIFESTS_ONLY" = false ]; then
    kubectl rollout restart deployment/assetgenerator -n "$NAMESPACE"
fi

# Wait for rollout
log_info "Waiting for Assetgenerator rollout..."
kubectl rollout status deployment/assetgenerator -n "$NAMESPACE" --timeout=180s

# Health check
if [ "$HEALTH_CHECK" = true ]; then
    AG_POD=$(kubectl get pods -n "$NAMESPACE" -l app=assetgenerator \
        -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    if [ -n "$AG_POD" ]; then
        HEALTH=$(kubectl exec "$AG_POD" -n "$NAMESPACE" -- \
            node -e "fetch('http://localhost:5200/health').then(r=>r.json()).then(d=>console.log(JSON.stringify(d)))" 2>/dev/null || echo "")
        if [ -n "$HEALTH" ]; then
            log_info "Assetgenerator health: OK"
        else
            log_warn "Assetgenerator health endpoint not responding (may still be starting)"
        fi
    fi
fi

# Record deployment SHA
if [ -x "$TRACKER" ]; then
    "$TRACKER" set assetgenerator
fi

log_info "Assetgenerator service deployed successfully!"
kubectl get pods -l app=assetgenerator -n "$NAMESPACE"
