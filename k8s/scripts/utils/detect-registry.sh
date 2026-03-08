#!/bin/bash
# =============================================================================
# Registry Auto-Detection Helper
# =============================================================================
# Source this file in deploy scripts to auto-detect which registry to push to.
#
# On k3d clusters: pushes to localhost:5000 (the k3d-managed local registry)
# On production:   pushes to registry.korczewski.de (external registry)
#
# Both map to the same image ref: registry.local:5000/korczewski/<svc>
# because k3d mirrors "registry.local:5000" → its local registry, and
# production mirrors it via k3s registries.yaml.
#
# Usage (in deploy scripts):
#   source "$(dirname "$0")/../utils/detect-registry.sh"
#   detect_registry     # sets REGISTRY variable
#   # Then use: docker build -t "$REGISTRY/<svc>:latest" ...
#   #           docker push "$REGISTRY/<svc>:latest"
#   #           push_to_k3d_if_needed "<svc>"  # tags + pushes for k3d
# =============================================================================

PROD_REGISTRY="registry.korczewski.de/korczewski"
K3D_REGISTRY="localhost:5000/korczewski"

# Detect whether current kubectl context is a k3d cluster
detect_registry() {
    local context
    context=$(kubectl config current-context 2>/dev/null || echo "")

    if [[ "$context" == k3d-* ]]; then
        # Check if k3d registry is actually running
        if docker ps --filter "name=k3d-registry.local" --format '{{.Names}}' 2>/dev/null | grep -q registry; then
            REGISTRY="$K3D_REGISTRY"
            IS_K3D=true
            log_info "Detected k3d cluster ($context) — using local registry at localhost:5000"
        else
            log_warn "k3d cluster detected but no local registry found"
            log_warn "Recreate cluster with: ./k8s/scripts/cluster/k3d-create.sh"
            log_warn "Falling back to production registry"
            REGISTRY="$PROD_REGISTRY"
            IS_K3D=false
        fi
    else
        REGISTRY="$PROD_REGISTRY"
        IS_K3D=false
    fi

    export REGISTRY IS_K3D
}

# For k3d, also tag with the production registry name so the same image
# can be used if you later push to production
push_to_k3d_if_needed() {
    local svc="$1"
    if [ "${IS_K3D:-false}" = true ]; then
        # k3d local registry is at localhost:5000, already pushed there
        # Also tag with production name for convenience
        docker tag "$K3D_REGISTRY/${svc}:latest" "$PROD_REGISTRY/${svc}:latest" 2>/dev/null || true
    fi
}
