#!/bin/bash
# =============================================================================
# Deploy kube-vip
# =============================================================================
# Deploys kube-vip DaemonSet (API VIP) and cloud controller (Service LB).
# Must run after cluster init but before any LoadBalancer services.
#
# Usage: ./deploy-kube-vip.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

log_info "Deploying kube-vip..."

# Apply kube-vip manifests
kubectl apply -k "$K8S_DIR/infrastructure/kube-vip"

# Wait for kube-vip pods
log_info "Waiting for kube-vip pods..."
kubectl rollout status daemonset/kube-vip -n kube-system --timeout=60s

log_info "Waiting for kube-vip cloud provider..."
kubectl rollout status deployment/kube-vip-cloud-provider -n kube-system --timeout=60s

# Verify VIP
VIP="${VIP:-10.10.0.20}"
log_info "Verifying API VIP at ${VIP}..."
if timeout 5 bash -c "echo > /dev/tcp/${VIP}/6443" 2>/dev/null; then
    echo -e "${GREEN}[PASS]${NC} API VIP ${VIP} is reachable on port 6443"
else
    echo -e "${RED}[WARN]${NC} API VIP ${VIP} not yet reachable — may need a moment to start"
fi

log_info "kube-vip deployment complete"
