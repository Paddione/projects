#!/bin/bash
# =============================================================================
# PostgreSQL Backup Script
# =============================================================================
# Creates backups of all databases in the PostgreSQL cluster.
#
# Usage: ./backup-postgres.sh [BACKUP_DIR]
# =============================================================================

set -euo pipefail

BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
NAMESPACE="korczewski-infra"
POD_LABEL="app=postgres"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Get pod name
POD=$(kubectl get pods -n "$NAMESPACE" -l "$POD_LABEL" -o jsonpath='{.items[0].metadata.name}')

if [ -z "$POD" ]; then
    echo "Error: PostgreSQL pod not found"
    exit 1
fi

log_info "Backing up databases from pod: $POD"

# Databases to backup
DATABASES=("auth_db" "l2p_db" "shop_db" "videovault_db")

for db in "${DATABASES[@]}"; do
    BACKUP_FILE="$BACKUP_DIR/${db}_${TIMESTAMP}.sql.gz"
    log_info "Backing up $db to $BACKUP_FILE..."

    kubectl exec "$POD" -n "$NAMESPACE" -- \
        pg_dump -U postgres "$db" | gzip > "$BACKUP_FILE"

    SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
    log_info "  Completed: $SIZE"
done

# Full cluster backup
FULL_BACKUP="$BACKUP_DIR/full_cluster_${TIMESTAMP}.sql.gz"
log_info "Creating full cluster backup..."
kubectl exec "$POD" -n "$NAMESPACE" -- \
    pg_dumpall -U postgres | gzip > "$FULL_BACKUP"

log_info "Backup complete!"
echo ""
echo "Backup files:"
ls -lh "$BACKUP_DIR"/*_${TIMESTAMP}* 2>/dev/null || echo "  No files found"
echo ""
echo "Restore commands:"
echo "  Single DB:  gunzip -c backup.sql.gz | kubectl exec -i \$POD -n $NAMESPACE -- psql -U postgres -d dbname"
echo "  Full:       gunzip -c full_cluster.sql.gz | kubectl exec -i \$POD -n $NAMESPACE -- psql -U postgres"
