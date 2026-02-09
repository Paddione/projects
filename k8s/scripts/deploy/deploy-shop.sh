#!/bin/bash
# =============================================================================
# Deploy Shop Service
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

GREEN='\033[0;32m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }

echo "Deploying Shop Service..."

# Apply manifests
kubectl apply -k "$K8S_DIR/services/shop/"

# Wait for deployment
log_info "Waiting for Shop service to be ready..."
kubectl wait --for=condition=ready pod -l app=shop \
    -n korczewski-services --timeout=180s

log_info "Shop service deployed successfully!"
kubectl get pods -l app=shop -n korczewski-services
