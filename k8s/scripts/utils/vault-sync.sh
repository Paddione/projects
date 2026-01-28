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

# We'll group secrets by service based on prefixes or specific names
# For simplicity, we'll push all to secret/korczewski/global for now,
# but a better way is to split them.

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

# Source .env but keep it in a subshell to avoid polluting script env
# We'll extract variables and format them for vault kv put
# Format: KEY=VALUE

# Define groups
POSTGRES=()
AUTH=()
L2P=()
PAYMENT=()
VIDEOVAULT=()
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
        L2P+=("$entry")
    elif [[ "$key" =~ ^PAYMENT_ ]] || [[ "$key" =~ ^STRIPE_ ]] || [[ "$key" =~ ^NEXT_PUBLIC_STRIPE_ ]]; then
        PAYMENT+=("$entry")
    elif [[ "$key" =~ ^VIDEO_ ]] || [[ "$key" =~ ^VIDEOVAULT_ ]]; then
        VIDEOVAULT+=("$entry")
    else
        GLOBAL+=("$entry")
    fi
done < "$ENV_FILE"

push_to_vault "postgres" "${POSTGRES[@]}"
push_to_vault "auth" "${AUTH[@]}"
push_to_vault "l2p" "${L2P[@]}"
push_to_vault "payment" "${PAYMENT[@]}"
push_to_vault "videovault" "${VIDEOVAULT[@]}"
push_to_vault "global" "${GLOBAL[@]}"

log_info "Vault sync complete!"
