#!/bin/bash
# =============================================================================
# Deployment SHA Tracker
# =============================================================================
# Tracks which git SHA is deployed per service using a ConfigMap in the
# korczewski-infra namespace. Enables detection of committed-but-undeployed
# changes.
#
# Usage:
#   deploy-tracker.sh get <service>        Get last deployed SHA
#   deploy-tracker.sh set <service> [sha]  Record deployment (defaults to HEAD)
#   deploy-tracker.sh list                 Show all deployed SHAs
#   deploy-tracker.sh diff <service>       Show commits since last deploy
#   deploy-tracker.sh status               Overview with undeployed commit counts
# =============================================================================

set -euo pipefail

NAMESPACE="korczewski-infra"
CONFIGMAP="deploy-state"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# All known services
ALL_SERVICES=(auth l2p shop videovault)

# Service to directory mapping (for git log paths)
declare -A SERVICE_DIRS=(
    ["auth"]="auth"
    ["l2p"]="l2p"
    ["shop"]="shop"
    ["videovault"]="VideoVault"
)

# Ensure the ConfigMap exists
ensure_configmap() {
    if ! kubectl get configmap "$CONFIGMAP" -n "$NAMESPACE" &>/dev/null; then
        log_info "Creating $CONFIGMAP ConfigMap in $NAMESPACE..."
        kubectl create configmap "$CONFIGMAP" -n "$NAMESPACE" \
            --from-literal=initialized="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    fi
}

# Get the deployed SHA for a service
cmd_get() {
    local service="${1:?Usage: deploy-tracker.sh get <service>}"
    ensure_configmap

    local sha
    sha=$(kubectl get configmap "$CONFIGMAP" -n "$NAMESPACE" \
        -o jsonpath="{.data.${service}}" 2>/dev/null || echo "")

    if [ -z "$sha" ]; then
        log_warn "No deployment recorded for '$service'"
        return 1
    fi

    echo "$sha"
}

# Record a deployment SHA for a service
cmd_set() {
    local service="${1:?Usage: deploy-tracker.sh set <service> [sha]}"
    local sha="${2:-$(cd "$PROJECT_ROOT" && git rev-parse HEAD)}"
    local timestamp
    timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

    ensure_configmap

    kubectl patch configmap "$CONFIGMAP" -n "$NAMESPACE" \
        --type merge \
        -p "{\"data\":{\"${service}\":\"${sha}\",\"${service}-time\":\"${timestamp}\"}}" \
        &>/dev/null

    log_info "Recorded $service deploy: ${sha:0:12} at $timestamp"
}

# List all deployed SHAs
cmd_list() {
    ensure_configmap

    echo -e "${BLUE}Deployment State ($NAMESPACE/$CONFIGMAP)${NC}"
    echo "─────────────────────────────────────────────────────────────"
    printf "%-14s %-14s %s\n" "SERVICE" "SHA" "DEPLOYED AT"
    echo "─────────────────────────────────────────────────────────────"

    for service in "${ALL_SERVICES[@]}"; do
        local sha timestamp
        sha=$(kubectl get configmap "$CONFIGMAP" -n "$NAMESPACE" \
            -o jsonpath="{.data.${service}}" 2>/dev/null || echo "")
        timestamp=$(kubectl get configmap "$CONFIGMAP" -n "$NAMESPACE" \
            -o jsonpath="{.data.${service}-time}" 2>/dev/null || echo "")

        if [ -n "$sha" ]; then
            printf "%-14s %-14s %s\n" "$service" "${sha:0:12}" "$timestamp"
        else
            printf "%-14s %-14s %s\n" "$service" "(not tracked)" ""
        fi
    done
}

# Show commits since last deploy for a service
cmd_diff() {
    local service="${1:?Usage: deploy-tracker.sh diff <service>}"
    local service_dir="${SERVICE_DIRS[$service]:-}"

    if [ -z "$service_dir" ]; then
        log_error "Unknown service: $service"
        return 1
    fi

    local sha
    sha=$(cmd_get "$service" 2>/dev/null) || {
        log_warn "No deployment recorded for '$service' — showing last 10 commits"
        cd "$PROJECT_ROOT" && git log --oneline -10 -- "$service_dir/"
        return 0
    }

    echo -e "${CYAN}Commits since last deploy of $service (${sha:0:12}):${NC}"
    cd "$PROJECT_ROOT" && git log --oneline "${sha}..HEAD" -- "$service_dir/"
}

# Status overview with undeployed commit counts
cmd_status() {
    ensure_configmap

    local head_sha
    head_sha=$(cd "$PROJECT_ROOT" && git rev-parse HEAD)

    echo -e "${BLUE}Deployment Status Overview${NC}"
    echo "═══════════════════════════════════════════════════════════════"
    printf "%-14s %-14s %-12s %s\n" "SERVICE" "DEPLOYED SHA" "UNDEPLOYED" "STATUS"
    echo "───────────────────────────────────────────────────────────────"

    for service in "${ALL_SERVICES[@]}"; do
        local sha service_dir count status_icon
        sha=$(kubectl get configmap "$CONFIGMAP" -n "$NAMESPACE" \
            -o jsonpath="{.data.${service}}" 2>/dev/null || echo "")
        service_dir="${SERVICE_DIRS[$service]}"

        if [ -z "$sha" ]; then
            printf "%-14s %-14s %-12s %s\n" "$service" "(not tracked)" "?" "⚠ untracked"
            continue
        fi

        count=$(cd "$PROJECT_ROOT" && git rev-list --count "${sha}..HEAD" -- "$service_dir/" 2>/dev/null || echo "?")

        if [ "$count" = "0" ]; then
            status_icon="${GREEN}✓ up to date${NC}"
        else
            status_icon="${YELLOW}● $count commit(s) behind${NC}"
        fi

        printf "%-14s %-14s %-12s " "$service" "${sha:0:12}" "$count"
        echo -e "$status_icon"
    done

    echo "───────────────────────────────────────────────────────────────"
    echo -e "HEAD: ${head_sha:0:12}"
}

# Print usage
usage() {
    echo "Usage: $(basename "$0") <command> [args]"
    echo ""
    echo "Commands:"
    echo "  get <service>        Get last deployed SHA"
    echo "  set <service> [sha]  Record deployment (defaults to HEAD)"
    echo "  list                 Show all deployed SHAs"
    echo "  diff <service>       Show commits since last deploy"
    echo "  status               Overview with undeployed commit counts"
    echo ""
    echo "Services: ${ALL_SERVICES[*]}"
}

# Main dispatch
case "${1:-}" in
    get)    shift; cmd_get "$@" ;;
    set)    shift; cmd_set "$@" ;;
    list)   cmd_list ;;
    diff)   shift; cmd_diff "$@" ;;
    status) cmd_status ;;
    -h|--help|help) usage ;;
    *)
        log_error "Unknown command: ${1:-}"
        usage
        exit 1
        ;;
esac
