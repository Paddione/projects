#!/bin/bash
# =============================================================================
# Vault Secret Sync Script
# =============================================================================
# Reads the root .env file and pushes secrets to Vault KV engine.
#
# Usage: ./vault-sync.sh [ENV_FILE]
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
ENV_FILE="${1:-$K8S_DIR/../.env}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

if [ ! -f "$ENV_FILE" ]; then
    log_error "Environment file not found: $ENV_FILE"
    exit 1
fi

# Check if vault CLI is installed
if ! command -v vault &> /dev/null; then
    log_error "Vault CLI not found. Please install it first."
    exit 1
fi

# Ensure VAULT_ADDR is set
export VAULT_ADDR="${VAULT_ADDR:-http://localhost:8200}"

# Check if logged in
if ! vault token lookup &> /dev/null; then
    log_warn "Not logged into Vault. Please run 'vault login' or set VAULT_TOKEN."
    exit 1
fi

log_info "Enabling KV secrets engine (if not enabled)..."
vault secrets enable -path=secret kv-v2 || true

log_info "Syncing secrets from $ENV_FILE to Vault..."

# Function to push to a specific path
push_to_vault() {
    local path="$1"
    shift
    local args=("$@")

    if [ ${#args[@]} -gt 0 ]; then
        log_info "Pushing to secret/$path..."
        vault kv put "secret/$path" "${args[@]}"
    fi
}

# Define groups
POSTGRES=()
AUTH=()
L2P=()
SHOP=()
VIDEOVAULT=()
ARENA=()
ASSETGENERATOR=()
TRAEFIK=()
REGISTRY=()
SMB=()
IPV64=()
GLOBAL=()

while IFS='=' read -r key value || [ -n "$key" ]; do
    # Skip comments and empty lines
    [[ "$key" =~ ^#.* ]] && continue
    [[ -z "$key" ]] && continue

    # Trim quotes from value
    value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")

    entry="$key=$value"

    if [[ "$key" =~ ^POSTGRES_ ]] || [[ "$key" =~ _DB_PASSWORD$ ]]; then
        POSTGRES+=("$entry")
    elif [[ "$key" =~ ^AUTH_ ]] || [[ "$key" =~ ^GOOGLE_ ]] || [[ "$key" =~ ^SMTP_ ]]; then
        AUTH+=("$entry")
    elif [[ "$key" =~ ^L2P_ ]]; then
        stripped="${key#L2P_}"
        L2P+=("$stripped=$value")
    elif [[ "$key" =~ ^SHOP_ ]] || [[ "$key" =~ ^STRIPE_ ]] || [[ "$key" =~ ^NEXT_PUBLIC_STRIPE_ ]]; then
        SHOP+=("$entry")
    elif [[ "$key" =~ ^VIDEO_ ]] || [[ "$key" =~ ^VIDEOVAULT_ ]]; then
        VIDEOVAULT+=("$entry")
    elif [[ "$key" =~ ^ARENA_ ]]; then
        stripped="${key#ARENA_}"
        ARENA+=("$stripped=$value")
    elif [[ "$key" =~ ^ASSETGENERATOR_ ]]; then
        stripped="${key#ASSETGENERATOR_}"
        ASSETGENERATOR+=("$stripped=$value")
    elif [[ "$key" =~ ^GEMINI_ ]] || [[ "$key" =~ ^SILICONFLOW_ ]] || [[ "$key" =~ ^SUNO_ ]]; then
        ASSETGENERATOR+=("$entry")
    elif [[ "$key" =~ ^TRAEFIK_ ]]; then
        TRAEFIK+=("$entry")
    elif [[ "$key" =~ ^REGISTRY_ ]]; then
        REGISTRY+=("$entry")
    elif [[ "$key" =~ ^SMB_ ]]; then
        SMB+=("$entry")
    elif [[ "$key" =~ ^IPV64_ ]]; then
        IPV64+=("$entry")
    else
        GLOBAL+=("$entry")
    fi
done < "$ENV_FILE"

push_to_vault "postgres" "${POSTGRES[@]}"
push_to_vault "auth" "${AUTH[@]}"
push_to_vault "l2p" "${L2P[@]}"
push_to_vault "shop" "${SHOP[@]}"
push_to_vault "videovault" "${VIDEOVAULT[@]}"
push_to_vault "arena" "${ARENA[@]}"
push_to_vault "assetgenerator" "${ASSETGENERATOR[@]}"
push_to_vault "traefik" "${TRAEFIK[@]}"
push_to_vault "registry" "${REGISTRY[@]}"
push_to_vault "smb" "${SMB[@]}"
push_to_vault "ipv64" "${IPV64[@]}"
push_to_vault "global" "${GLOBAL[@]}"

log_info "Vault sync complete!"

echo ""
log_info "=================================================="
log_info "  ESO will pick up changes within 1 hour."
log_info "  To force immediate sync:"
log_info "    kubectl annotate externalsecret <name> -n <namespace> \\"
log_info "      force-sync=\$(date +%s) --overwrite"
log_info "    (namespace: korczewski-services for app secrets,"
log_info "     korczewski-infra for infra: postgres/traefik/registry/tls/pgbouncer/smb/ipv64)"
log_info ""
log_info "  To verify a secret was updated:"
log_info "    kubectl get secret <name> -n <namespace> \\"
log_info "      -o jsonpath='{.data}' | base64 -d"
log_info ""
log_info "  Stakater Reloader will auto-restart pods when"
log_info "  secrets change (if installed)."
log_info "=================================================="
