#!/bin/bash
# =============================================================================
# Deploy Auth Service
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

GREEN='\033[0;32m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }

echo "Deploying Auth Service..."

# Apply manifests
kubectl apply -f "$K8S_DIR/services/auth/"

# Wait for deployment
log_info "Waiting for Auth service to be ready..."
kubectl wait --for=condition=ready pod -l app=auth \
    -n korczewski-services --timeout=180s

log_info "Auth service deployed successfully!"
kubectl get pods -l app=auth -n korczewski-services
