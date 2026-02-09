#!/bin/bash
# =============================================================================
# Deploy Private Docker Registry
# =============================================================================
# Applies registry manifests. Called by setup-registry.sh or standalone.
#
# Usage: ./deploy-registry.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Colors
GREEN='\033[0;32m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }

log_info "Deploying private Docker registry..."
kubectl apply -k "$K8S_DIR/infrastructure/registry"

log_info "Waiting for registry pod..."
kubectl rollout status deployment/registry -n korczewski-infra --timeout=120s

log_info "Registry deployed"
kubectl get svc registry -n korczewski-infra
