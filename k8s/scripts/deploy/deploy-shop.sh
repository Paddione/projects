#!/bin/bash
# =============================================================================
# Deploy Shop Service
# =============================================================================
# Builds Docker image, pushes to registry, applies manifests, and restarts.
#
# Usage: ./deploy-shop.sh [--manifests-only] [--no-health-check]
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

log_step "Deploying Shop Service"

# Build and push image
if [ "$MANIFESTS_ONLY" = false ]; then
    log_info "Building shop..."
    docker build -t "$REGISTRY/shop:latest" -f "$PROJECT_ROOT/shop/Dockerfile" "$PROJECT_ROOT"

    log_info "Pushing shop..."
    docker push "$REGISTRY/shop:latest"
fi

# Apply manifests
log_info "Applying Shop manifests..."
kubectl apply -k "$K8S_DIR/services/shop/"

# Restart deployment to pull new image
if [ "$MANIFESTS_ONLY" = false ]; then
    kubectl rollout restart deployment/shop -n "$NAMESPACE"
fi

# Wait for rollout
log_info "Waiting for Shop rollout..."
kubectl rollout status deployment/shop -n "$NAMESPACE" --timeout=180s

# Health check
if [ "$HEALTH_CHECK" = true ]; then
    SHOP_POD=$(kubectl get pods -n "$NAMESPACE" -l app=shop \
        -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    if [ -n "$SHOP_POD" ]; then
        HEALTH=$(kubectl exec "$SHOP_POD" -n "$NAMESPACE" -- \
            wget -q -O- http://localhost:3000/ 2>/dev/null || echo "")
        if [ -n "$HEALTH" ]; then
            log_info "Shop health: OK"
        else
            log_warn "Shop health endpoint not responding (may still be starting)"
        fi
    fi
fi

# Record deployment SHA
if [ -x "$TRACKER" ]; then
    "$TRACKER" set shop
fi

log_info "Shop service deployed successfully!"
kubectl get pods -l app=shop -n "$NAMESPACE"
