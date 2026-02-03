#!/bin/bash
# =============================================================================
# Deploy PostgreSQL
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

echo "Deploying PostgreSQL..."

# Apply PostgreSQL manifests
kubectl apply -k "$K8S_DIR/infrastructure/postgres/"

# Apply alias services separately (spans multiple namespaces)
kubectl apply -f "$K8S_DIR/infrastructure/postgres/alias-services.yaml"

# Wait for StatefulSet to be ready
log_info "Waiting for PostgreSQL to be ready..."
kubectl wait --for=condition=ready pod -l app=postgres \
    -n korczewski-infra --timeout=300s 2>/dev/null || {
    log_warn "Timeout waiting for PostgreSQL. Checking status..."
    kubectl get pods -l app=postgres -n korczewski-infra
    kubectl describe pod -l app=postgres -n korczewski-infra | tail -20
    exit 1
}

# Verify PostgreSQL is accepting connections
log_info "Verifying PostgreSQL connection..."
kubectl exec statefulset/postgres -n korczewski-infra -- \
    pg_isready -U postgres || {
    log_warn "PostgreSQL not ready for connections"
    exit 1
}

log_info "PostgreSQL deployed successfully!"
kubectl get pods -l app=postgres -n korczewski-infra
