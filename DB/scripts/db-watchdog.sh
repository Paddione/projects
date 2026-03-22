#!/bin/bash
# =============================================================================
# Database Watchdog - Health Monitor with Auto-Reinit
# =============================================================================
# Monitors the k3s production PostgreSQL instance.
# If the database is unavailable for more than 60 minutes continuously,
# triggers a full reinitialization with all schemas and admin user.
#
# Usage:
#   ./db-watchdog.sh              # Run once (check + reinit if needed)
#   ./db-watchdog.sh --daemon     # Run continuously (check every 60s)
#   ./db-watchdog.sh --status     # Show current status
#
# State file: /tmp/db-watchdog-state (tracks downtime start)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
NAMESPACE="korczewski-infra"
POD_LABEL="app=postgres"
STATE_FILE="/tmp/db-watchdog-state"
DOWNTIME_THRESHOLD=3600  # 60 minutes in seconds
CHECK_INTERVAL=60        # Check every 60 seconds in daemon mode

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info()  { echo -e "$(date '+%Y-%m-%d %H:%M:%S') ${GREEN}[OK]${NC} $1"; }
log_warn()  { echo -e "$(date '+%Y-%m-%d %H:%M:%S') ${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "$(date '+%Y-%m-%d %H:%M:%S') ${RED}[DOWN]${NC} $1"; }

# Check if PostgreSQL is reachable and all databases exist
check_health() {
    local pod
    pod=$(kubectl get pods -n "$NAMESPACE" -l "$POD_LABEL" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null) || return 1

    # Check pg_isready
    kubectl exec -n "$NAMESPACE" "$pod" -- pg_isready -U postgres -h localhost >/dev/null 2>&1 || return 1

    # Verify all 5 databases exist
    local db_count
    db_count=$(kubectl exec -n "$NAMESPACE" "$pod" -- psql -U postgres -t -A \
        -c "SELECT count(*) FROM pg_database WHERE datname IN ('auth_db','l2p_db','arena_db','shop_db','videovault_db');" 2>/dev/null) || return 1

    [ "$db_count" -eq 5 ] || return 1

    return 0
}

# Get downtime duration in seconds (0 if healthy)
get_downtime() {
    if [ ! -f "$STATE_FILE" ]; then
        echo 0
        return
    fi

    local down_since
    down_since=$(cat "$STATE_FILE" 2>/dev/null)
    if [ -z "$down_since" ]; then
        echo 0
        return
    fi

    local now
    now=$(date +%s)
    echo $((now - down_since))
}

# Format seconds as human-readable
format_duration() {
    local secs=$1
    local hours=$((secs / 3600))
    local mins=$(((secs % 3600) / 60))
    local s=$((secs % 60))
    printf "%02d:%02d:%02d" "$hours" "$mins" "$s"
}

# Mark database as down
mark_down() {
    if [ ! -f "$STATE_FILE" ]; then
        date +%s > "$STATE_FILE"
        log_error "Database went DOWN. Tracking downtime from now."
    fi
}

# Mark database as up
mark_up() {
    if [ -f "$STATE_FILE" ]; then
        local downtime
        downtime=$(get_downtime)
        rm -f "$STATE_FILE"
        log_info "Database is back UP (was down for $(format_duration "$downtime"))"
    fi
}

# Status command
show_status() {
    echo "=== Database Watchdog Status ==="
    echo ""

    if check_health; then
        echo -e "Health:    ${GREEN}HEALTHY${NC}"
        echo "Downtime:  0s"
    else
        local downtime
        downtime=$(get_downtime)
        echo -e "Health:    ${RED}DOWN${NC}"
        echo "Downtime:  $(format_duration "$downtime") ($downtime seconds)"
        echo "Threshold: $(format_duration "$DOWNTIME_THRESHOLD") ($DOWNTIME_THRESHOLD seconds)"

        local remaining=$((DOWNTIME_THRESHOLD - downtime))
        if [ "$remaining" -gt 0 ]; then
            echo "Reinit in: $(format_duration "$remaining")"
        else
            echo -e "Reinit:    ${RED}OVERDUE (reinit will trigger on next check)${NC}"
        fi
    fi

    echo ""
    echo "State file: $STATE_FILE"
    echo "Namespace:  $NAMESPACE"
    echo ""
}

# Single health check cycle
run_check() {
    if check_health; then
        mark_up
        log_info "PostgreSQL healthy (5/5 databases present)"
        return 0
    fi

    # Database is down
    mark_down
    local downtime
    downtime=$(get_downtime)

    if [ "$downtime" -ge "$DOWNTIME_THRESHOLD" ]; then
        log_error "Database has been down for $(format_duration "$downtime") (threshold: $(format_duration "$DOWNTIME_THRESHOLD"))"
        log_warn "=== TRIGGERING AUTOMATIC REINITIALIZATION ==="

        # Ensure the secret exists before reinit
        "$SCRIPT_DIR/ensure-secret.sh"

        # Run reinit
        "$SCRIPT_DIR/reinit-database.sh" --force

        # Clear downtime tracking
        rm -f "$STATE_FILE"
        log_info "Reinitialization complete. Downtime counter reset."
    else
        local remaining=$((DOWNTIME_THRESHOLD - downtime))
        log_error "Database down for $(format_duration "$downtime"). Reinit in $(format_duration "$remaining")."
    fi
}

# Main
case "${1:-}" in
    --status)
        show_status
        ;;
    --daemon)
        log_info "Starting watchdog daemon (checking every ${CHECK_INTERVAL}s, reinit after ${DOWNTIME_THRESHOLD}s downtime)"
        while true; do
            run_check || true
            sleep "$CHECK_INTERVAL"
        done
        ;;
    *)
        run_check
        ;;
esac
