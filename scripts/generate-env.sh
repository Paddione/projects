#!/bin/bash
# =============================================================================
# Generate .env from .env.example with auto-generated secrets
# =============================================================================
# Creates a production-ready .env by replacing all GENERATE_ME placeholders
# with cryptographically random values.
#
# Usage:
#   ./scripts/generate-env.sh              # Generate .env (won't overwrite existing)
#   ./scripts/generate-env.sh --force      # Overwrite existing .env
#   ./scripts/generate-env.sh --print      # Print what would be generated (dry run)
#
# After generating .env:
#   1. Fill in non-secret values (Google OAuth IDs, Stripe keys, SMTP, etc.)
#   2. Run: ./k8s/scripts/utils/generate-secrets.sh   (creates K8s Secret YAMLs)
#   3. Run: kubectl apply -f k8s/secrets/              (apply to cluster)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
EXAMPLE_FILE="$ROOT_DIR/.env.example"
OUTPUT_FILE="$ROOT_DIR/.env"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()  { echo -e "${CYAN}[STEP]${NC}  $1"; }

# ── Helpers ──────────────────────────────────────────────────────────────────

# 64-char hex string (32 bytes = 256 bits) — for JWT, session, auth secrets
gen_hex_64() {
    openssl rand -hex 32
}

# 32-char alphanumeric string — for DB passwords (no special chars)
gen_alphanum_32() {
    openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c 32
}

# 16-char alphanumeric string — for admin passwords
gen_alphanum_16() {
    openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 16
}

# ── Parse args ───────────────────────────────────────────────────────────────

FORCE=false
DRY_RUN=false

for arg in "$@"; do
    case "$arg" in
        --force) FORCE=true ;;
        --print|--dry-run) DRY_RUN=true ;;
        --help|-h)
            echo "Usage: $0 [--force] [--print]"
            echo ""
            echo "  --force   Overwrite existing .env"
            echo "  --print   Dry run — print generated output without writing"
            exit 0
            ;;
        *)
            log_error "Unknown option: $arg"
            exit 1
            ;;
    esac
done

# ── Checks ───────────────────────────────────────────────────────────────────

if [ ! -f "$EXAMPLE_FILE" ]; then
    log_error ".env.example not found at: $EXAMPLE_FILE"
    exit 1
fi

if [ -f "$OUTPUT_FILE" ] && [ "$FORCE" = false ] && [ "$DRY_RUN" = false ]; then
    log_error ".env already exists at: $OUTPUT_FILE"
    log_error "Use --force to overwrite, or --print for dry run."
    exit 1
fi

if ! command -v openssl &>/dev/null; then
    log_error "openssl is required but not found in PATH"
    exit 1
fi

# ── Generate secrets ─────────────────────────────────────────────────────────

log_step "Reading .env.example..."

# Pre-generate all secrets so the same password is used in both DATABASE_URL and DB_PASSWORD
POSTGRES_PW="$(gen_alphanum_32)"
AUTH_DB_PW="$(gen_alphanum_32)"
L2P_DB_PW="$(gen_alphanum_32)"
SHOP_DB_PW="$(gen_alphanum_32)"
VV_DB_PW="$(gen_alphanum_32)"
ARENA_DB_PW="$(gen_alphanum_32)"

AUTH_JWT="$(gen_hex_64)"
AUTH_JWT_REFRESH="$(gen_hex_64)"
AUTH_SESSION="$(gen_hex_64)"

L2P_JWT="$(gen_hex_64)"
L2P_JWT_REFRESH="$(gen_hex_64)"
L2P_OAUTH_SECRET="$(gen_alphanum_32)"

SHOP_NEXTAUTH="$(gen_hex_64)"
SHOP_AUTH="$(gen_hex_64)"

VIDEO_SESSION="$(gen_hex_64)"
VIDEO_ADMIN="$(gen_alphanum_16)"

REGISTRY_PW="$(gen_alphanum_32)"
RATE_LIMIT_KEY="$(gen_hex_64)"

log_step "Replacing placeholders with generated secrets..."

# Process the template line by line
OUTPUT=""
while IFS= read -r line || [[ -n "$line" ]]; do
    # ── Postgres superuser ──
    if [[ "$line" == "POSTGRES_PASSWORD=GENERATE_ME"* ]]; then
        line="POSTGRES_PASSWORD=$POSTGRES_PW"

    # ── Auth DB ──
    elif [[ "$line" == "AUTH_DATABASE_URL="* && "$line" == *"GENERATE_ME"* ]]; then
        line="AUTH_DATABASE_URL=postgresql://auth_user:${AUTH_DB_PW}@shared-postgres:5432/auth_db"
    elif [[ "$line" == "AUTH_DB_PASSWORD=GENERATE_ME"* ]]; then
        line="AUTH_DB_PASSWORD=$AUTH_DB_PW"
    elif [[ "$line" == "AUTH_JWT_SECRET=GENERATE_ME"* ]]; then
        line="AUTH_JWT_SECRET=$AUTH_JWT"
    elif [[ "$line" == "AUTH_JWT_REFRESH_SECRET=GENERATE_ME"* ]]; then
        line="AUTH_JWT_REFRESH_SECRET=$AUTH_JWT_REFRESH"
    elif [[ "$line" == "AUTH_SESSION_SECRET=GENERATE_ME"* ]]; then
        line="AUTH_SESSION_SECRET=$AUTH_SESSION"

    # ── Shop DB ──
    elif [[ "$line" == 'SHOP_DATABASE_URL='* && "$line" == *"GENERATE_ME"* ]]; then
        line='SHOP_DATABASE_URL="postgresql://shop_user:'"${SHOP_DB_PW}"'@shared-postgres:5432/shop_db?schema=public"'
    elif [[ "$line" == "SHOP_DB_PASSWORD=GENERATE_ME"* ]]; then
        line="SHOP_DB_PASSWORD=$SHOP_DB_PW"
    elif [[ "$line" == "SHOP_NEXTAUTH_SECRET=GENERATE_ME"* ]]; then
        line="SHOP_NEXTAUTH_SECRET=$SHOP_NEXTAUTH"
    elif [[ "$line" == "SHOP_AUTH_SECRET=GENERATE_ME"* ]]; then
        line="SHOP_AUTH_SECRET=$SHOP_AUTH"

    # ── L2P DB ──
    elif [[ "$line" == "L2P_DATABASE_URL="* && "$line" == *"GENERATE_ME"* ]]; then
        line="L2P_DATABASE_URL=postgresql://l2p_user:${L2P_DB_PW}@shared-postgres:5432/l2p_db"
    elif [[ "$line" == "L2P_DB_PASSWORD=GENERATE_ME"* ]]; then
        line="L2P_DB_PASSWORD=$L2P_DB_PW"
    elif [[ "$line" == "L2P_JWT_SECRET=GENERATE_ME"* ]]; then
        line="L2P_JWT_SECRET=$L2P_JWT"
    elif [[ "$line" == "L2P_JWT_REFRESH_SECRET=GENERATE_ME"* ]]; then
        line="L2P_JWT_REFRESH_SECRET=$L2P_JWT_REFRESH"
    elif [[ "$line" == "L2P_OAUTH_CLIENT_SECRET=GENERATE_ME"* ]]; then
        line="L2P_OAUTH_CLIENT_SECRET=$L2P_OAUTH_SECRET"

    # ── VideoVault DB ──
    elif [[ "$line" == "VIDEO_DATABASE_URL="* && "$line" == *"GENERATE_ME"* ]]; then
        line="VIDEO_DATABASE_URL=postgresql://videovault_user:${VV_DB_PW}@shared-postgres:5432/videovault_db"
    elif [[ "$line" == "VIDEOVAULT_DB_PASSWORD=GENERATE_ME"* ]]; then
        line="VIDEOVAULT_DB_PASSWORD=$VV_DB_PW"
    elif [[ "$line" == "VIDEO_SESSION_SECRET=GENERATE_ME"* ]]; then
        line="VIDEO_SESSION_SECRET=$VIDEO_SESSION"
    elif [[ "$line" == "VIDEO_ADMIN_PASS=GENERATE_ME"* ]]; then
        line="VIDEO_ADMIN_PASS=$VIDEO_ADMIN"

    # ── Arena DB ──
    elif [[ "$line" == "ARENA_DB_PASSWORD=GENERATE_ME"* ]]; then
        line="ARENA_DB_PASSWORD=$ARENA_DB_PW"

    # ── Registry ──
    elif [[ "$line" == "REGISTRY_PASSWORD=GENERATE_ME"* ]]; then
        line="REGISTRY_PASSWORD=$REGISTRY_PW"

    # ── Rate Limit ──
    elif [[ "$line" == "RATE_LIMIT_BYPASS_KEY=" ]]; then
        line="RATE_LIMIT_BYPASS_KEY=$RATE_LIMIT_KEY"
    fi

    OUTPUT+="$line"$'\n'
done < "$EXAMPLE_FILE"

# ── Output ───────────────────────────────────────────────────────────────────

if [ "$DRY_RUN" = true ]; then
    echo ""
    log_info "DRY RUN — would generate:"
    echo "────────────────────────────────────────"
    echo "$OUTPUT"
    echo "────────────────────────────────────────"
    exit 0
fi

echo "$OUTPUT" > "$OUTPUT_FILE"

# ── Summary ──────────────────────────────────────────────────────────────────

echo ""
echo "=========================================="
log_info ".env generated successfully!"
echo "=========================================="
echo ""
echo "Auto-generated secrets for:"
echo "  - PostgreSQL superuser password"
echo "  - 5 service DB passwords (auth, l2p, shop, videovault, arena)"
echo "  - 5 JWT/session secrets (auth×3, l2p×2)"
echo "  - 3 app secrets (shop×2, videovault session)"
echo "  - Admin passwords (videovault)"
echo "  - Registry password"
echo "  - Rate limit bypass key"
echo ""
echo -e "${YELLOW}YOU STILL NEED TO FILL IN:${NC}"
echo "  - SMTP_USER / SMTP_PASS / SMTP_FROM (Gmail app password)"
echo "  - AUTH_GOOGLE_CLIENT_ID / AUTH_GOOGLE_CLIENT_SECRET"
echo "  - SHOP_AUTH_GOOGLE_ID / SHOP_AUTH_GOOGLE_SECRET"
echo "  - STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET / NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"
echo "  - TRAEFIK_DASHBOARD_PASSWORD_HASH (htpasswd -nb admin yourpassword)"
echo "  - REGISTRY_PASSWORD_HASH (htpasswd -Bn registry)"
echo "  - IPV64_API_KEY"
echo "  - SMB_USER / SMB_PASSWORD"
echo "  - ELEVENLABS_API_KEY (optional)"
echo "  - GEMINI_API_KEY / SILICONFLOW_API_KEY / SUNO_API_KEY (optional)"
echo "  - VIDEO_MEDIA_ROOT (path to your media library)"
echo "  - Production URLs (COOKIE_DOMAIN, AUTH_SERVICE_URL, redirect URIs, etc.)"
echo ""
echo "Next steps:"
echo "  1. Edit .env and fill in the values above"
echo "  2. Run: ./k8s/scripts/utils/generate-secrets.sh"
echo "  3. Run: kubectl apply -f k8s/secrets/"
echo ""
