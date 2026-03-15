#!/bin/bash
# Health check for k3d/k8s ingress-based deployments.

set -euo pipefail

echo "🏥 Health Check - Kubernetes Stack"
echo "================================================"
echo ""

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl not found on PATH"
    exit 1
fi

if ! kubectl cluster-info &> /dev/null; then
    echo "❌ Cannot connect to Kubernetes cluster"
    exit 1
fi

echo "✅ Cluster connection OK"
echo ""

if [ -x "$ROOT_DIR/k8s/scripts/utils/validate-cluster.sh" ]; then
    "$ROOT_DIR/k8s/scripts/utils/validate-cluster.sh" || true
fi

echo "External URL checks:"
check_http() {
    local name=$1
    local url=$2
    local ok_codes=${3:-"200|302"}
    local status
    status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null || echo "000")

    if [[ "$status" =~ ^(${ok_codes})$ ]]; then
        echo "✅ $name - OK ($status)"
    else
        echo "❌ $name - FAILED ($status)"
    fi
}

check_http "Auth" "https://auth.korczewski.de/health"
check_http "L2P" "https://l2p.korczewski.de/api/health"
check_http "Shop" "https://shop.korczewski.de/" "200|302|401"
check_http "VideoVault" "https://videovault.korczewski.de/api/health"
check_http "SOS" "https://sos.korczewski.de/health"
check_http "Arena" "https://arena.korczewski.de/api/health"
echo ""
