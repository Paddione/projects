#!/bin/bash
# =============================================================================
# Deploy Payment Service
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

GREEN='\033[0;32m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }

echo "Deploying Payment Service..."

# Apply manifests
kubectl apply -f "$K8S_DIR/services/payment/"

# Wait for deployment
log_info "Waiting for Payment service to be ready..."
kubectl wait --for=condition=ready pod -l app=payment \
    -n korczewski-services --timeout=180s

log_info "Payment service deployed successfully!"
kubectl get pods -l app=payment -n korczewski-services
