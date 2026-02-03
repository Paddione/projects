#!/bin/bash
# =============================================================================
# Deploy L2P Services (Backend + Frontend)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

GREEN='\033[0;32m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }

echo "Deploying L2P Backend..."
kubectl apply -k "$K8S_DIR/services/l2p-backend/"

echo "Deploying L2P Frontend..."
kubectl apply -k "$K8S_DIR/services/l2p-frontend/"

# Wait for deployments
log_info "Waiting for L2P Backend to be ready..."
kubectl wait --for=condition=ready pod -l app=l2p-backend \
    -n korczewski-services --timeout=180s

log_info "Waiting for L2P Frontend to be ready..."
kubectl wait --for=condition=ready pod -l app=l2p-frontend \
    -n korczewski-services --timeout=120s

log_info "L2P services deployed successfully!"
kubectl get pods -l 'app in (l2p-backend, l2p-frontend)' -n korczewski-services
