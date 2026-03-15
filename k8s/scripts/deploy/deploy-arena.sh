#!/bin/bash
# =============================================================================
# Deploy Arena Service
# =============================================================================
# Builds Docker images (backend + frontend), pushes to registry, applies
# manifests, and restarts deployments.
#
# Usage: ./deploy-arena.sh [--manifests-only] [--no-health-check]
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

log_step "Deploying Arena Service"

# Auto-detect registry (k3d local vs production)
source "$SCRIPT_DIR/../utils/detect-registry.sh"
detect_registry

# Build and push images
if [ "$MANIFESTS_ONLY" = false ]; then
    # Resolve audio symlinks for Docker build context (Docker can't follow symlinks outside context)
    AUDIO_SFX="$PROJECT_ROOT/arena/frontend/public/assets/sfx"
    AUDIO_MUSIC="$PROJECT_ROOT/arena/frontend/public/assets/music"
    RESOLVED_SYMLINKS=false

    if [ -L "$AUDIO_SFX" ] || [ -L "$AUDIO_MUSIC" ]; then
        log_info "Resolving audio symlinks for Docker build..."
        RESOLVED_SYMLINKS=true
        SFX_TARGET=$(readlink "$AUDIO_SFX" 2>/dev/null || true)
        MUSIC_TARGET=$(readlink "$AUDIO_MUSIC" 2>/dev/null || true)

        if [ -L "$AUDIO_SFX" ] && [ -d "$SFX_TARGET" ]; then
            rm "$AUDIO_SFX"
            cp -r "$SFX_TARGET" "$AUDIO_SFX"
        fi
        if [ -L "$AUDIO_MUSIC" ] && [ -d "$MUSIC_TARGET" ]; then
            rm "$AUDIO_MUSIC"
            cp -r "$MUSIC_TARGET" "$AUDIO_MUSIC"
        fi
    fi

    log_info "Building arena-backend..."
    docker build -t "$REGISTRY/arena-backend:latest" -f "$PROJECT_ROOT/arena/backend/Dockerfile" "$PROJECT_ROOT"

    log_info "Building arena-frontend..."
    docker build -t "$REGISTRY/arena-frontend:latest" -f "$PROJECT_ROOT/arena/frontend/Dockerfile" "$PROJECT_ROOT"

    # Restore symlinks after build
    if [ "$RESOLVED_SYMLINKS" = true ]; then
        log_info "Restoring audio symlinks..."
        if [ -n "$SFX_TARGET" ]; then
            rm -rf "$AUDIO_SFX"
            ln -s "$SFX_TARGET" "$AUDIO_SFX"
        fi
        if [ -n "$MUSIC_TARGET" ]; then
            rm -rf "$AUDIO_MUSIC"
            ln -s "$MUSIC_TARGET" "$AUDIO_MUSIC"
        fi
    fi

    log_info "Pushing arena-backend..."
    docker push "$REGISTRY/arena-backend:latest"

    log_info "Pushing arena-frontend..."
    docker push "$REGISTRY/arena-frontend:latest"
fi

# Apply manifests
log_info "Applying Arena backend manifests..."
kubectl apply -k "$K8S_DIR/services/arena-backend/"

log_info "Applying Arena frontend manifests..."
kubectl apply -k "$K8S_DIR/services/arena-frontend/"

# Restart deployments to pull new images
if [ "$MANIFESTS_ONLY" = false ]; then
    kubectl rollout restart deployment/arena-backend -n "$NAMESPACE"
    kubectl rollout restart deployment/arena-frontend -n "$NAMESPACE"
fi

# Wait for rollouts
log_info "Waiting for Arena backend rollout..."
kubectl rollout status deployment/arena-backend -n "$NAMESPACE" --timeout=180s

log_info "Waiting for Arena frontend rollout..."
kubectl rollout status deployment/arena-frontend -n "$NAMESPACE" --timeout=180s

# Health check
if [ "$HEALTH_CHECK" = true ]; then
    BACKEND_POD=$(kubectl get pods -n "$NAMESPACE" -l app=arena-backend \
        -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    if [ -n "$BACKEND_POD" ]; then
        HEALTH=$(kubectl exec "$BACKEND_POD" -n "$NAMESPACE" -- \
            wget -q -O- http://localhost:3003/api/health 2>/dev/null || echo "")
        if [ -n "$HEALTH" ]; then
            log_info "Arena backend health: OK"
        else
            log_warn "Arena backend health endpoint not responding (may still be starting)"
        fi
    fi
fi

# Record deployment SHA
if [ -x "$TRACKER" ]; then
    "$TRACKER" set arena
fi

log_info "Arena service deployed successfully!"
kubectl get pods -l "app in (arena-backend, arena-frontend)" -n "$NAMESPACE"
