#!/bin/bash
# =============================================================================
# Deploy PgBouncer
# =============================================================================
# Deploys PgBouncer connection pooler and updates alias services.
# Must run AFTER deploy-postgres.sh (PgBouncer connects to PostgreSQL).
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

echo "Deploying PgBouncer..."

# Apply PgBouncer manifests
kubectl apply -k "$K8S_DIR/infrastructure/pgbouncer/"

# Update alias services to route through PgBouncer
log_info "Updating shared-postgres aliases to route through PgBouncer..."
kubectl apply -f "$K8S_DIR/infrastructure/postgres/alias-services.yaml"

# Wait for PgBouncer to be ready
log_info "Waiting for PgBouncer to be ready..."
kubectl rollout status deployment/pgbouncer -n korczewski-infra --timeout=120s || {
    log_warn "Timeout waiting for PgBouncer. Checking status..."
    kubectl get pods -l app=pgbouncer -n korczewski-infra
    kubectl describe pod -l app=pgbouncer -n korczewski-infra | tail -30
    exit 1
}

# Verify PgBouncer is accepting connections
log_info "Verifying PgBouncer is listening..."
kubectl exec deployment/pgbouncer -n korczewski-infra -- \
    sh -c 'nc -z localhost 5432' 2>/dev/null || {
    log_warn "PgBouncer port check failed — may need a moment to start"
}

log_info "PgBouncer deployed successfully!"
kubectl get pods -l app=pgbouncer -n korczewski-infra
