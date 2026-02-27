#!/bin/bash
# =============================================================================
# Deploy L2P Services (Backend + Frontend)
# =============================================================================
# Builds Docker images, pushes to registry, applies manifests, and restarts.
#
# Usage: ./deploy-l2p.sh [--manifests-only] [--no-health-check]
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

log_step "Deploying L2P Services"

# Build and push images
if [ "$MANIFESTS_ONLY" = false ]; then
    log_info "Building l2p-backend..."
    docker build -t "$REGISTRY/l2p-backend:latest" -f "$PROJECT_ROOT/l2p/backend/Dockerfile" "$PROJECT_ROOT"

    log_info "Building l2p-frontend..."
    docker build -t "$REGISTRY/l2p-frontend:latest" -f "$PROJECT_ROOT/l2p/frontend/Dockerfile" "$PROJECT_ROOT"

    log_info "Pushing l2p-backend..."
    docker push "$REGISTRY/l2p-backend:latest"

    log_info "Pushing l2p-frontend..."
    docker push "$REGISTRY/l2p-frontend:latest"
fi

# Apply manifests
log_info "Applying L2P Backend manifests..."
kubectl apply -k "$K8S_DIR/services/l2p-backend/"

log_info "Applying L2P Frontend manifests..."
kubectl apply -k "$K8S_DIR/services/l2p-frontend/"

# Restart deployments to pull new images
if [ "$MANIFESTS_ONLY" = false ]; then
    kubectl rollout restart deployment/l2p-backend -n "$NAMESPACE"
    kubectl rollout restart deployment/l2p-frontend -n "$NAMESPACE"
fi

# Wait for rollouts
log_info "Waiting for L2P Backend rollout..."
kubectl rollout status deployment/l2p-backend -n "$NAMESPACE" --timeout=180s

log_info "Waiting for L2P Frontend rollout..."
kubectl rollout status deployment/l2p-frontend -n "$NAMESPACE" --timeout=120s

# Health checks
if [ "$HEALTH_CHECK" = true ]; then
    log_info "Running health checks..."

    BACKEND_POD=$(kubectl get pods -n "$NAMESPACE" -l app=l2p-backend \
        -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    if [ -n "$BACKEND_POD" ]; then
        HEALTH=$(kubectl exec "$BACKEND_POD" -n "$NAMESPACE" -- \
            wget -q -O- http://localhost:3001/api/health 2>/dev/null || echo "")
        if [ -n "$HEALTH" ]; then
            log_info "Backend health: OK"
        else
            log_warn "Backend health endpoint not responding (may still be starting)"
        fi
    fi
fi

# Record deployment SHA
if [ -x "$TRACKER" ]; then
    "$TRACKER" set l2p
    "$TRACKER" set l2p-frontend
fi

log_info "L2P services deployed successfully!"
kubectl get pods -l 'app in (l2p-backend, l2p-frontend)' -n "$NAMESPACE"
