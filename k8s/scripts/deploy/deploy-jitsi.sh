#!/bin/bash
# =============================================================================
# Deploy Jitsi Meet Service
# =============================================================================
# Applies manifests and restarts deployments. No image build needed —
# uses official Jitsi Docker images.
#
# Usage: ./deploy-jitsi.sh [--manifests-only] [--no-health-check]
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
PROJECT_ROOT="$(dirname "$K8S_DIR")"
TRACKER="$SCRIPT_DIR/../utils/deploy-tracker.sh"

NAMESPACE="korczewski-jitsi"

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

log_step "Deploying Jitsi Meet Service"

# Preflight: check that Secret exists
if ! kubectl get secret jitsi-secrets -n "$NAMESPACE" &>/dev/null; then
    echo -e "${YELLOW}[ERROR]${NC} Secret 'jitsi-secrets' not found in $NAMESPACE."
    echo "Create it with these keys:"
    echo "  JICOFO_AUTH_PASSWORD, JICOFO_COMPONENT_SECRET, JVB_AUTH_PASSWORD"
    echo "  JWT_APP_SECRET (shared with auth service JITSI_JWT_SECRET)"
    echo "  TURN_CREDENTIAL, TURN_CREDENTIALS (both needed - Prosody uses plural form)"
    exit 1
fi

# Migration cleanup: delete stale JVB LoadBalancer service if it exists
if kubectl get svc jvb -n "$NAMESPACE" --no-headers 2>/dev/null | grep -q LoadBalancer; then
    log_warn "Deleting stale JVB LoadBalancer service (conflicts with Traefik on 10.10.0.40)..."
    kubectl delete svc jvb -n "$NAMESPACE"
fi

# Apply manifests
log_info "Applying Jitsi manifests..."
kubectl apply -k "$PROJECT_ROOT/jitsi/"

# Restart deployments
if [ "$MANIFESTS_ONLY" = false ]; then
    log_info "Restarting Jitsi deployments..."
    kubectl rollout restart deployment/prosody -n "$NAMESPACE"
    kubectl rollout restart deployment/jicofo -n "$NAMESPACE"
    kubectl rollout restart deployment/jvb -n "$NAMESPACE"
    kubectl rollout restart deployment/jitsi-web -n "$NAMESPACE"
    kubectl rollout restart deployment/coturn -n "$NAMESPACE"
fi

# Wait for rollouts
if [ "$MANIFESTS_ONLY" = false ]; then
    log_info "Waiting for Prosody..."
    kubectl rollout status deployment/prosody -n "$NAMESPACE" --timeout=120s

    log_info "Waiting for Jicofo..."
    kubectl rollout status deployment/jicofo -n "$NAMESPACE" --timeout=120s

    log_info "Waiting for JVB..."
    kubectl rollout status deployment/jvb -n "$NAMESPACE" --timeout=120s

    log_info "Waiting for Jitsi Web..."
    kubectl rollout status deployment/jitsi-web -n "$NAMESPACE" --timeout=120s

    log_info "Waiting for Coturn..."
    kubectl rollout status deployment/coturn -n "$NAMESPACE" --timeout=120s
fi

# Health check
if [ "$HEALTH_CHECK" = true ] && [ "$MANIFESTS_ONLY" = false ]; then
    # Check JVB health
    JVB_POD=$(kubectl get pods -n "$NAMESPACE" -l app=jvb \
        -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    if [ -n "$JVB_POD" ]; then
        HEALTH=$(kubectl exec "$JVB_POD" -n "$NAMESPACE" -- \
            wget -q -O- http://localhost:8080/about/health 2>/dev/null || echo "")
        if [ -n "$HEALTH" ]; then
            log_info "JVB health: OK"
        else
            log_warn "JVB health endpoint not responding (may still be starting)"
        fi

        # Verify init container resolved IP
        JVB_IP=$(kubectl exec "$JVB_POD" -n "$NAMESPACE" -- cat /shared/public-ip 2>/dev/null || echo "unknown")
        log_info "JVB advertising public IP: $JVB_IP"
    fi
fi

# Record deployment SHA
if [ -x "$TRACKER" ]; then
    "$TRACKER" set jitsi
fi

log_info "Jitsi Meet deployed successfully!"
kubectl get pods -n "$NAMESPACE"
