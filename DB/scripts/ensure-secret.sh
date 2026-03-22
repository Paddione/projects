#!/bin/bash
# =============================================================================
# Ensure postgres-credentials secret exists in k8s
# =============================================================================
# Checks for the existing secret. If not found, creates it with the
# passwords from the committed secret file or generates new ones.
# =============================================================================

set -euo pipefail

NAMESPACE="korczewski-infra"
SECRET_NAME="postgres-credentials"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$(cd "$SCRIPT_DIR/../../k8s" && pwd)"
SECRET_FILE="$K8S_DIR/secrets/postgres-secret.yaml"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Generate alphanumeric password (per project convention)
gen_password() {
    openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 32
}

# Check if secret exists
if kubectl get secret "$SECRET_NAME" -n "$NAMESPACE" &>/dev/null; then
    log_info "Secret '$SECRET_NAME' already exists in namespace '$NAMESPACE'"

    # Verify it has all required keys (including arena)
    REQUIRED_KEYS="POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB AUTH_DB_PASSWORD L2P_DB_PASSWORD ARENA_DB_PASSWORD SHOP_DB_PASSWORD VIDEOVAULT_DB_PASSWORD"
    MISSING=""
    for key in $REQUIRED_KEYS; do
        if ! kubectl get secret "$SECRET_NAME" -n "$NAMESPACE" -o jsonpath="{.data.$key}" &>/dev/null || \
           [ -z "$(kubectl get secret "$SECRET_NAME" -n "$NAMESPACE" -o jsonpath="{.data.$key}" 2>/dev/null)" ]; then
            MISSING="$MISSING $key"
        fi
    done

    if [ -n "$MISSING" ]; then
        log_warn "Secret exists but is missing keys:$MISSING"
        log_warn "Patching secret with missing keys..."

        for key in $MISSING; do
            VALUE=$(gen_password)
            kubectl patch secret "$SECRET_NAME" -n "$NAMESPACE" \
                -p "{\"stringData\":{\"$key\":\"$VALUE\"}}" 2>/dev/null || true
            log_info "  Added $key"
        done
    fi

    log_info "Secret verification complete"
    exit 0
fi

# Secret does not exist -- create it
log_warn "Secret '$SECRET_NAME' not found. Creating..."

# Try to use existing secret file first
if [ -f "$SECRET_FILE" ]; then
    log_info "Applying secret from $SECRET_FILE"
    kubectl apply -f "$SECRET_FILE"

    # Check if arena password is missing (it was not in original secret)
    if ! kubectl get secret "$SECRET_NAME" -n "$NAMESPACE" -o jsonpath="{.data.ARENA_DB_PASSWORD}" &>/dev/null || \
       [ -z "$(kubectl get secret "$SECRET_NAME" -n "$NAMESPACE" -o jsonpath="{.data.ARENA_DB_PASSWORD}" 2>/dev/null)" ]; then
        ARENA_PW=$(gen_password)
        kubectl patch secret "$SECRET_NAME" -n "$NAMESPACE" \
            -p "{\"stringData\":{\"ARENA_DB_PASSWORD\":\"$ARENA_PW\"}}"
        log_info "Added missing ARENA_DB_PASSWORD to secret"
    fi
else
    log_warn "No secret file found at $SECRET_FILE, generating fresh credentials..."
    kubectl create secret generic "$SECRET_NAME" -n "$NAMESPACE" \
        --from-literal=POSTGRES_USER=postgres \
        --from-literal=POSTGRES_PASSWORD="$(gen_password)" \
        --from-literal=POSTGRES_DB=postgres \
        --from-literal=AUTH_DB_PASSWORD="$(gen_password)" \
        --from-literal=L2P_DB_PASSWORD="$(gen_password)" \
        --from-literal=ARENA_DB_PASSWORD="$(gen_password)" \
        --from-literal=SHOP_DB_PASSWORD="$(gen_password)" \
        --from-literal=VIDEOVAULT_DB_PASSWORD="$(gen_password)"
    log_info "Fresh secret created with generated passwords"
fi

log_info "Secret '$SECRET_NAME' ready in namespace '$NAMESPACE'"
