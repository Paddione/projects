#!/bin/bash
# =============================================================================
# Cluster Health Validation Script
# =============================================================================
# Validates cluster health and service status.
# Run after deployment to verify everything is working.
#
# Usage: ./validate-cluster.sh
# =============================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_pass() { echo -e "${GREEN}[PASS]${NC} $1"; }
log_fail() { echo -e "${RED}[FAIL]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }

ERRORS=0
PORT_FORWARD_LOG="/tmp/korczewski-port-forward.log"

get_free_port() {
    if command -v python3 >/dev/null 2>&1; then
        python3 - <<'PY'
import socket
s = socket.socket()
s.bind(('', 0))
print(s.getsockname()[1])
s.close()
PY
        return
    fi

    if command -v python >/dev/null 2>&1; then
        python - <<'PY'
import socket
s = socket.socket()
s.bind(('', 0))
print(s.getsockname()[1])
s.close()
PY
        return
    fi

    echo "18080"
}

echo "=========================================="
echo "Cluster Health Validation"
echo "=========================================="
echo ""

# =============================================================================
# Node Status
# =============================================================================
echo "1. Node Status"
echo "----------------------------------------"
if kubectl get nodes &> /dev/null; then
    kubectl get nodes -o wide
    NOT_READY=$(kubectl get nodes --no-headers | awk '$2 != "Ready" {count++} END {print count+0}')
    if [ "$NOT_READY" -eq 0 ]; then
        log_pass "All nodes are Ready"
    else
        log_fail "$NOT_READY node(s) not Ready"
        ERRORS=$((ERRORS + 1))
    fi
else
    log_fail "Cannot get nodes"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# =============================================================================
# Pod Status
# =============================================================================
echo "2. Pod Status"
echo "----------------------------------------"
kubectl get pods -A -l app.kubernetes.io/part-of=korczewski 2>/dev/null || \
kubectl get pods -A 2>/dev/null || echo "No pods found"

# Check for non-running pods
NOT_RUNNING=$(kubectl get pods -A --no-headers 2>/dev/null | awk '$4 != "Running" && $4 != "Completed" {count++} END {print count+0}')
if [ "$NOT_RUNNING" -eq 0 ]; then
    log_pass "All pods are Running"
else
    log_warn "$NOT_RUNNING pod(s) not in Running state"
    kubectl get pods -A --no-headers | grep -v "Running\|Completed" || true
fi
echo ""

# =============================================================================
# Service Health Checks
# =============================================================================
echo "3. Service Health Checks"
echo "----------------------------------------"

check_service() {
    local name="$1"
    local namespace="$2"
    local selector="$3"
    local port="$4"
    local path="$5"

    echo -n "   $name: "

    # Check if pod exists
    POD=$(kubectl get pods -n "$namespace" -l "$selector" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    if [ -z "$POD" ]; then
        log_fail "No pod found"
        ERRORS=$((ERRORS + 1))
        return
    fi

    # Check pod ready
    READY=$(kubectl get pod "$POD" -n "$namespace" -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null)
    if [ "$READY" != "True" ]; then
        log_fail "Pod not ready"
        ERRORS=$((ERRORS + 1))
        return
    fi

    # Check health endpoint
    HEALTH=$(kubectl exec "$POD" -n "$namespace" -- wget -q -O- "http://localhost:${port}${path}" 2>/dev/null || \
             kubectl exec "$POD" -n "$namespace" -- curl -sf "http://localhost:${port}${path}" 2>/dev/null || echo "")
    if [ -z "$HEALTH" ] && command -v curl >/dev/null 2>&1; then
        local local_port
        local_port="$(get_free_port)"
        kubectl port-forward -n "$namespace" "$POD" "${local_port}:${port}" >"$PORT_FORWARD_LOG" 2>&1 &
        local pf_pid=$!

        for _ in {1..10}; do
            if curl -sf "http://127.0.0.1:${local_port}${path}" >/dev/null 2>&1; then
                HEALTH="ok"
                break
            fi
            sleep 0.5
        done

        kill "$pf_pid" >/dev/null 2>&1 || true
        wait "$pf_pid" >/dev/null 2>&1 || true
    fi

    if [ -n "$HEALTH" ]; then
        log_pass "Healthy"
    else
        log_warn "Health check failed (may not have health endpoint)"
    fi
}

# For PostgreSQL, use pg_isready instead
echo -n "   PostgreSQL (pg_isready): "
if kubectl exec statefulset/postgres -n korczewski-infra -- pg_isready -U postgres &>/dev/null; then
    log_pass "Ready"
else
    log_fail "Not ready"
    ERRORS=$((ERRORS + 1))
fi

check_service "Auth" "korczewski-services" "app=auth" "5500" "/health"
check_service "L2P Backend" "korczewski-services" "app=l2p-backend" "3001" "/api/health"
check_service "L2P Frontend" "korczewski-services" "app=l2p-frontend" "80" "/"
check_service "Payment" "korczewski-services" "app=payment" "3000" "/"
check_service "VideoVault" "korczewski-services" "app=videovault" "5000" "/api/health"
echo ""

# =============================================================================
# Ingress Status
# =============================================================================
echo "4. IngressRoutes"
echo "----------------------------------------"
kubectl get ingressroutes -A 2>/dev/null || echo "No IngressRoutes found"
echo ""

# =============================================================================
# PVC Status
# =============================================================================
echo "5. Persistent Volume Claims"
echo "----------------------------------------"
kubectl get pvc -A 2>/dev/null || echo "No PVCs found"
UNBOUND=$(kubectl get pvc -A --no-headers 2>/dev/null | awk '$3 != "Bound" {count++} END {print count+0}')
if [ "$UNBOUND" -gt 0 ]; then
    log_warn "$UNBOUND PVC(s) not bound"
fi
echo ""

# =============================================================================
# Services and Endpoints
# =============================================================================
echo "6. Services"
echo "----------------------------------------"
kubectl get svc -A -l app.kubernetes.io/part-of=korczewski 2>/dev/null || \
kubectl get svc -A 2>/dev/null || echo "No services found"
echo ""

# =============================================================================
# Summary
# =============================================================================
echo "=========================================="
if [ "$ERRORS" -eq 0 ]; then
    log_pass "Validation Complete - All checks passed!"
else
    log_fail "Validation Complete - $ERRORS error(s) found"
fi
echo "=========================================="
echo ""
echo "External access URLs:"
echo "  https://l2p.korczewski.de"
echo "  https://auth.korczewski.de"
echo "  https://payment.korczewski.de"
echo "  https://videovault.korczewski.de"
echo "  https://traefik.korczewski.de (dashboard)"
echo ""

exit $ERRORS
