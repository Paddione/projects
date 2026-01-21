#!/bin/bash
# =============================================================================
# K3d E2E Test Runner
# =============================================================================
# Runs health and connectivity tests against the k3d cluster.
#
# Usage: ./scripts/test/run-e2e.sh [--skip-validation] [--headed]
#
# Options:
#   --skip-validation  Skip the cluster validation step
#   --headed           Run tests in headed browser mode
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_pass() { echo -e "${GREEN}[PASS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_fail() { echo -e "${RED}[FAIL]${NC} $1"; }

# Parse arguments
SKIP_VALIDATION=false
HEADED=""
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-validation)
            SKIP_VALIDATION=true
            shift
            ;;
        --headed)
            HEADED="--headed"
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo ""
echo "=========================================="
echo "K3d E2E Test Runner"
echo "=========================================="
echo ""

# Check prerequisites
log_info "Checking prerequisites..."

if ! command -v kubectl &> /dev/null; then
    log_fail "kubectl is not installed"
    exit 1
fi

if ! kubectl cluster-info &>/dev/null; then
    log_fail "kubectl not connected to cluster"
    echo ""
    echo "Make sure your k3d cluster is running:"
    echo "  k3d cluster list"
    echo "  k3d kubeconfig merge <cluster-name>"
    exit 1
fi
log_pass "kubectl connected to cluster"

# Run cluster validation (optional)
if [ "$SKIP_VALIDATION" = false ]; then
    echo ""
    log_info "Running cluster validation..."
    if [ -f "$K8S_ROOT/scripts/utils/validate-cluster.sh" ]; then
        if "$K8S_ROOT/scripts/utils/validate-cluster.sh"; then
            log_pass "Cluster validation passed"
        else
            log_warn "Cluster validation found issues (continuing anyway)"
        fi
    else
        log_warn "Validation script not found, skipping"
    fi
fi

# Install dependencies if needed
echo ""
log_info "Checking test dependencies..."
cd "$K8S_ROOT"

if [ ! -d "node_modules" ] || [ ! -f "node_modules/.package-lock.json" ]; then
    log_info "Installing dependencies..."
    npm install --silent
fi
log_pass "Dependencies ready"

# Run E2E tests
echo ""
echo "=========================================="
log_info "Running E2E tests..."
echo "=========================================="
echo ""

if npm run test:e2e -- $HEADED; then
    echo ""
    log_pass "All E2E tests passed!"
else
    echo ""
    log_fail "Some E2E tests failed"
    echo ""
    echo "View detailed report:"
    echo "  npm run test:e2e:report"
    exit 1
fi

echo ""
echo "=========================================="
echo "Test Results"
echo "=========================================="
echo ""
echo "HTML Report: $K8S_ROOT/test-results/playwright-report/index.html"
echo "JSON Results: $K8S_ROOT/test-results/results.json"
echo ""
echo "To view the report in browser:"
echo "  cd $K8S_ROOT && npm run test:e2e:report"
echo ""
