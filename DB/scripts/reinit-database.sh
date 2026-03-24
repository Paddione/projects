#!/bin/bash
# =============================================================================
# Reinitialize PostgreSQL Database from Scratch
# =============================================================================
# Drops all service databases and recreates them with full schema.
# Then seeds the admin user (Paddione) in all databases.
#
# Usage:
#   ./reinit-database.sh                  # Interactive (asks for confirmation)
#   ./reinit-database.sh --force          # Skip confirmation
#   ./reinit-database.sh --dry-run        # Show what would happen
#
# Prerequisites:
#   - kubectl access to the k3s cluster
#   - postgres pod running in korczewski-infra namespace
#   - postgres-credentials secret exists
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
NAMESPACE="korczewski-infra"
POD_LABEL="app=postgres"
FORCE=false
DRY_RUN=false

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()  { echo -e "${CYAN}[STEP]${NC} $1"; }

# Parse arguments
for arg in "$@"; do
    case $arg in
        --force) FORCE=true ;;
        --dry-run) DRY_RUN=true ;;
        *) echo "Unknown argument: $arg"; exit 1 ;;
    esac
done

# Get the postgres pod name
get_pod() {
    kubectl get pods -n "$NAMESPACE" -l "$POD_LABEL" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null
}

# Execute SQL against a specific database via kubectl exec
exec_sql() {
    local db="$1"
    local sql="$2"
    kubectl exec -n "$NAMESPACE" "$(get_pod)" -- \
        psql -U postgres -d "$db" -c "$sql" 2>&1
}

# Execute a SQL file against a specific database
exec_sql_file() {
    local db="$1"
    local file="$2"
    kubectl cp "$file" "$NAMESPACE/$(get_pod):/tmp/$(basename "$file")"
    kubectl exec -n "$NAMESPACE" "$(get_pod)" -- \
        psql -U postgres -d "$db" -f "/tmp/$(basename "$file")" 2>&1
}

# Execute a shell script inside the postgres pod
exec_script() {
    local script="$1"
    kubectl cp "$script" "$NAMESPACE/$(get_pod):/tmp/$(basename "$script")"
    kubectl exec -n "$NAMESPACE" "$(get_pod)" -- bash "/tmp/$(basename "$script")" 2>&1
}

# Check postgres is ready
log_step "Checking PostgreSQL availability..."
POD=$(get_pod)
if [ -z "$POD" ]; then
    log_error "No postgres pod found in namespace $NAMESPACE"
    exit 1
fi

kubectl exec -n "$NAMESPACE" "$POD" -- pg_isready -U postgres -h localhost >/dev/null 2>&1 || {
    log_error "PostgreSQL is not ready"
    exit 1
}
log_info "PostgreSQL is running on pod: $POD"

# Confirmation
if [ "$DRY_RUN" = true ]; then
    echo ""
    log_warn "=== DRY RUN MODE ==="
    echo "Would perform the following actions:"
    echo "  1. Drop databases: auth_db, l2p_db, arena_db, shop_db, videovault_db"
    echo "  2. Drop users: auth_user, l2p_user, arena_user, shop_user, videovault_user"
    echo "  3. Recreate databases and users from DB/init/00-create-databases.sh"
    echo "  4. Apply schemas:"
    echo "     - DB/init/01-auth-schema.sql    -> auth_db"
    echo "     - DB/init/02-l2p-schema.sql     -> l2p_db"
    echo "     - DB/init/03-arena-schema.sql   -> arena_db"
    echo "     - DB/init/04-shop-schema.sql    -> shop_db"
    echo "     - DB/init/05-videovault-schema.sql -> videovault_db"
    echo "  5. Seed admin user (Paddione) via DB/init/06-seed-admin.sh"
    exit 0
fi

if [ "$FORCE" != true ]; then
    echo ""
    log_warn "============================================"
    log_warn "  THIS WILL DESTROY ALL DATABASE DATA"
    log_warn "============================================"
    echo ""
    echo "All 5 databases will be dropped and recreated:"
    echo "  auth_db, l2p_db, arena_db, shop_db, videovault_db"
    echo ""
    read -p "Type 'REINIT' to confirm: " confirmation
    if [ "$confirmation" != "REINIT" ]; then
        log_info "Aborted"
        exit 0
    fi
fi

echo ""
log_step "=== Starting database reinitialization ==="
START_TIME=$(date +%s)

# Step 1: Terminate all connections and drop databases
log_step "1/5 Dropping existing databases and users..."

DATABASES="auth_db l2p_db arena_db shop_db videovault_db"
USERS="auth_user l2p_user arena_user shop_user videovault_user"

for db in $DATABASES; do
    log_info "  Dropping $db..."
    exec_sql "postgres" "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$db' AND pid <> pg_backend_pid();" >/dev/null 2>&1 || true
    exec_sql "postgres" "DROP DATABASE IF EXISTS $db;" 2>/dev/null || true
done

for user in $USERS; do
    log_info "  Dropping user $user..."
    exec_sql "postgres" "DROP USER IF EXISTS $user;" 2>/dev/null || true
done

# Step 2: Create databases and users
log_step "2/5 Creating databases and users..."
kubectl cp "$DB_DIR/init/00-create-databases.sh" "$NAMESPACE/$POD:/tmp/00-create-databases.sh"
kubectl exec -n "$NAMESPACE" "$POD" -- bash /tmp/00-create-databases.sh

# Step 3: Apply per-database schemas
log_step "3/5 Applying database schemas..."

declare -A SCHEMA_MAP=(
    ["auth_db"]="01-auth-schema.sql"
    ["l2p_db"]="02-l2p-schema.sql"
    ["arena_db"]="03-arena-schema.sql"
    ["shop_db"]="04-shop-schema.sql"
    ["videovault_db"]="05-videovault-schema.sql"
)

for db in "${!SCHEMA_MAP[@]}"; do
    schema="${SCHEMA_MAP[$db]}"
    log_info "  Applying $schema to $db..."
    exec_sql_file "$db" "$DB_DIR/init/$schema"
done

# Step 4: Seed admin user
log_step "4/5 Seeding admin user (Paddione)..."
kubectl cp "$DB_DIR/init/06-seed-admin.sh" "$NAMESPACE/$POD:/tmp/06-seed-admin.sh"
kubectl exec -n "$NAMESPACE" "$POD" -- bash /tmp/06-seed-admin.sh

# Step 5: Verify
log_step "5/5 Verifying databases..."
for db in $DATABASES; do
    TABLE_COUNT=$(exec_sql "$db" "SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema');" | sed -n '3p' | tr -d ' ')
    log_info "  $db: $TABLE_COUNT tables"
done

# Cleanup temp files
kubectl exec -n "$NAMESPACE" "$POD" -- rm -f /tmp/00-create-databases.sh /tmp/01-auth-schema.sql /tmp/02-l2p-schema.sql /tmp/03-arena-schema.sql /tmp/04-shop-schema.sql /tmp/05-videovault-schema.sql /tmp/06-seed-admin.sh 2>/dev/null || true

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
log_info "=== Reinitialization complete in ${DURATION}s ==="
log_info "Admin user: Paddione (patrick@korczewski.de)"
log_info "All 5 databases recreated with full schema"
