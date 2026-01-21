#!/bin/bash
# =============================================================================
# Generate Kubernetes Secrets from Environment Variables
# =============================================================================
# Reads the root .env file and generates Kubernetes Secret manifests.
# Secrets are saved to k8s/secrets/ directory (gitignored).
#
# Usage: ./generate-secrets.sh [ENV_FILE]
#
# Example:
#   ./generate-secrets.sh                    # Uses ../../.env
#   ./generate-secrets.sh /path/to/.env      # Custom .env file
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
SECRETS_DIR="$K8S_DIR/secrets"

# Default to root .env
ENV_FILE="${1:-$K8S_DIR/../.env}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check .env file exists
if [ ! -f "$ENV_FILE" ]; then
    log_error "Environment file not found: $ENV_FILE"
    log_error "Please create .env file with required variables"
    exit 1
fi

log_info "Reading environment from: $ENV_FILE"

# Source the .env file (handle exports and quotes)
set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

# Create secrets directory
mkdir -p "$SECRETS_DIR"

# Helper function to get env var with fallback
get_env() {
    local var_name="$1"
    local default="${2:-}"
    local value="${!var_name:-$default}"
    echo "$value"
}

# K8s service DNS for database connections
PG_HOST="postgres.korczewski-infra.svc.cluster.local"

log_info "Generating secrets..."

# =============================================================================
# PostgreSQL Credentials Secret
# =============================================================================
cat > "$SECRETS_DIR/postgres-secret.yaml" <<EOF
---
apiVersion: v1
kind: Secret
metadata:
  name: postgres-credentials
  namespace: korczewski-infra
  labels:
    app: postgres
type: Opaque
stringData:
  POSTGRES_USER: "$(get_env POSTGRES_USER postgres)"
  POSTGRES_PASSWORD: "$(get_env POSTGRES_PASSWORD)"
  POSTGRES_DB: "$(get_env POSTGRES_DB postgres)"
  AUTH_DB_PASSWORD: "$(get_env AUTH_DB_PASSWORD)"
  L2P_DB_PASSWORD: "$(get_env L2P_DB_PASSWORD)"
  PAYMENT_DB_PASSWORD: "$(get_env PAYMENT_DB_PASSWORD)"
  VIDEOVAULT_DB_PASSWORD: "$(get_env VIDEOVAULT_DB_PASSWORD)"
EOF
log_info "Created postgres-secret.yaml"

# =============================================================================
# Auth Service Secret
# =============================================================================
AUTH_DB_URL="postgresql://$(get_env AUTH_DB_USER auth_user):$(get_env AUTH_DB_PASSWORD)@${PG_HOST}:5432/auth_db"

cat > "$SECRETS_DIR/auth-secret.yaml" <<EOF
---
apiVersion: v1
kind: Secret
metadata:
  name: auth-credentials
  namespace: korczewski-services
  labels:
    app: auth
type: Opaque
stringData:
  DATABASE_URL: "${AUTH_DB_URL}"
  JWT_SECRET: "$(get_env AUTH_JWT_SECRET)"
  JWT_REFRESH_SECRET: "$(get_env AUTH_JWT_REFRESH_SECRET)"
  SESSION_SECRET: "$(get_env AUTH_SESSION_SECRET)"
  GOOGLE_CLIENT_ID: "$(get_env AUTH_GOOGLE_CLIENT_ID)"
  GOOGLE_CLIENT_SECRET: "$(get_env AUTH_GOOGLE_CLIENT_SECRET)"
  SMTP_USER: "$(get_env SMTP_USER)"
  SMTP_PASS: "$(get_env SMTP_PASS)"
  SMTP_FROM: "$(get_env SMTP_FROM)"
EOF
log_info "Created auth-secret.yaml"

# =============================================================================
# L2P Backend Secret
# =============================================================================
L2P_DB_URL="postgresql://$(get_env L2P_DB_USER l2p_user):$(get_env L2P_DB_PASSWORD)@${PG_HOST}:5432/l2p_db"

cat > "$SECRETS_DIR/l2p-backend-secret.yaml" <<EOF
---
apiVersion: v1
kind: Secret
metadata:
  name: l2p-backend-credentials
  namespace: korczewski-services
  labels:
    app: l2p-backend
type: Opaque
stringData:
  DATABASE_URL: "${L2P_DB_URL}"
  JWT_SECRET: "$(get_env L2P_JWT_SECRET)"
  JWT_REFRESH_SECRET: "$(get_env L2P_JWT_REFRESH_SECRET)"
  SMTP_USER: "$(get_env SMTP_USER)"
  SMTP_PASS: "$(get_env SMTP_PASS)"
  SMTP_FROM: "$(get_env SMTP_FROM)"
EOF
log_info "Created l2p-backend-secret.yaml"

# =============================================================================
# Payment Service Secret
# =============================================================================
PAYMENT_DB_URL="postgresql://$(get_env PAYMENT_DB_USER payment_user):$(get_env PAYMENT_DB_PASSWORD)@${PG_HOST}:5432/payment_db?schema=public"

cat > "$SECRETS_DIR/payment-secret.yaml" <<EOF
---
apiVersion: v1
kind: Secret
metadata:
  name: payment-credentials
  namespace: korczewski-services
  labels:
    app: payment
type: Opaque
stringData:
  DATABASE_URL: "${PAYMENT_DB_URL}"
  NEXTAUTH_SECRET: "$(get_env PAYMENT_NEXTAUTH_SECRET)"
  AUTH_SECRET: "$(get_env PAYMENT_AUTH_SECRET)"
  AUTH_GOOGLE_ID: "$(get_env PAYMENT_AUTH_GOOGLE_ID)"
  AUTH_GOOGLE_SECRET: "$(get_env PAYMENT_AUTH_GOOGLE_SECRET)"
  STRIPE_SECRET_KEY: "$(get_env STRIPE_SECRET_KEY)"
  STRIPE_WEBHOOK_SECRET: "$(get_env STRIPE_WEBHOOK_SECRET)"
  STRIPE_PUBLISHABLE_KEY: "$(get_env NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)"
EOF
log_info "Created payment-secret.yaml"

# =============================================================================
# VideoVault Service Secret
# =============================================================================
VIDEOVAULT_DB_URL="postgresql://$(get_env VIDEOVAULT_DB_USER videovault_user):$(get_env VIDEOVAULT_DB_PASSWORD)@${PG_HOST}:5432/videovault_db"

cat > "$SECRETS_DIR/videovault-secret.yaml" <<EOF
---
apiVersion: v1
kind: Secret
metadata:
  name: videovault-credentials
  namespace: korczewski-services
  labels:
    app: videovault
type: Opaque
stringData:
  DATABASE_URL: "${VIDEOVAULT_DB_URL}"
  SESSION_SECRET: "$(get_env VIDEO_SESSION_SECRET)"
  ADMIN_USER: "$(get_env VIDEO_ADMIN_USER admin)"
  ADMIN_PASS: "$(get_env VIDEO_ADMIN_PASS)"
EOF
log_info "Created videovault-secret.yaml"

# =============================================================================
# Traefik Dashboard Auth Secret
# =============================================================================
TRAEFIK_USER="$(get_env TRAEFIK_DASHBOARD_USER admin)"
TRAEFIK_PASS_HASH="$(get_env TRAEFIK_DASHBOARD_PASSWORD_HASH)"

if [ -z "$TRAEFIK_PASS_HASH" ]; then
    log_warn "TRAEFIK_DASHBOARD_PASSWORD_HASH not set"
    log_warn "Generate with: htpasswd -nb admin yourpassword"
    TRAEFIK_PASS_HASH='$apr1$placeholder$placeholder'
fi

cat > "$SECRETS_DIR/traefik-secret.yaml" <<EOF
---
apiVersion: v1
kind: Secret
metadata:
  name: traefik-dashboard-auth
  namespace: korczewski-infra
  labels:
    app: traefik
type: Opaque
stringData:
  users: "${TRAEFIK_USER}:${TRAEFIK_PASS_HASH}"
EOF
log_info "Created traefik-secret.yaml"

cat > "$SECRETS_DIR/ipv64-secret.yaml" <<EOF
---
apiVersion: v1
kind: Secret
metadata:
  name: ipv64-credentials
  namespace: korczewski-infra
type: Opaque
stringData:
  IPV64_API_KEY: "$(get_env IPV64_API_KEY)"
EOF
log_info "Created ipv64-secret.yaml"

# =============================================================================
# SMB Credentials Secret
# =============================================================================
cat > "$SECRETS_DIR/smb-secret.yaml" <<EOF
---
apiVersion: v1
kind: Secret
metadata:
  name: smbcreds
  namespace: korczewski-infra
type: Opaque
stringData:
  username: "$(get_env SMB_USER)"
  password: "$(get_env SMB_PASSWORD)"
---
apiVersion: v1
kind: Secret
metadata:
  name: smbcreds
  namespace: korczewski-services
type: Opaque
stringData:
  username: "$(get_env SMB_USER)"
  password: "$(get_env SMB_PASSWORD)"
EOF
log_info "Created smb-secret.yaml"

# =============================================================================
# TLS Certificate Secret (placeholder)
# =============================================================================
TLS_CERT_FILE="${TLS_CERT_FILE:-/etc/ssl/korczewski.de/fullchain.pem}"
TLS_KEY_FILE="${TLS_KEY_FILE:-/etc/ssl/korczewski.de/privkey.pem}"

if [ -f "$TLS_CERT_FILE" ] && [ -f "$TLS_KEY_FILE" ]; then
    log_info "Creating TLS secret from certificates..."
    kubectl create secret tls korczewski-tls \
        --cert="$TLS_CERT_FILE" \
        --key="$TLS_KEY_FILE" \
        -n korczewski-infra \
        --dry-run=client -o yaml > "$SECRETS_DIR/tls-secret.yaml"
    log_info "Created tls-secret.yaml"
else
    log_warn "TLS certificate files not found at:"
    log_warn "  Cert: $TLS_CERT_FILE"
    log_warn "  Key:  $TLS_KEY_FILE"
    log_warn "Skipping TLS secret generation"
    log_warn "Create manually with: kubectl create secret tls korczewski-tls --cert=... --key=... -n korczewski-infra"
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
echo "=========================================="
log_info "Secrets generated successfully!"
echo "=========================================="
echo ""
echo "Generated files in $SECRETS_DIR:"
ls -la "$SECRETS_DIR"/*.yaml 2>/dev/null || echo "  (no files)"
echo ""
echo "Apply secrets with:"
echo "  kubectl apply -f $SECRETS_DIR/"
echo ""
echo "IMPORTANT: These files contain sensitive data."
echo "           Do NOT commit them to version control!"
echo ""
