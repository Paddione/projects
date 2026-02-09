#!/bin/bash
# =============================================================================
# Private Registry Setup Script
# =============================================================================
# Deploys the in-cluster Docker registry, waits for its LoadBalancer IP,
# generates registries.yaml from template, and copies it to all k3s nodes.
#
# Usage: ./setup-registry.sh
#
# Environment:
#   NODES       — space-separated list of node IPs (default: all 6 nodes)
#   SSH_USER    — SSH user for node access (default: root)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
DEPLOY_DIR="$K8S_DIR/scripts/deploy"

# Node IPs (all control plane + workers)
NODES="${NODES:-10.0.3.1 10.0.3.2 10.0.3.3 10.0.31.1 10.0.31.2 10.0.31.3}"
SSH_USER="${SSH_USER:-patrick}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo "=========================================="
echo "Private Registry Setup"
echo "=========================================="
echo ""

# =============================================================================
# Step 1: Deploy registry
# =============================================================================
log_info "Step 1: Deploying registry..."
"$DEPLOY_DIR/deploy-registry.sh"

# =============================================================================
# Step 2: Wait for LoadBalancer IP
# =============================================================================
log_info "Step 2: Waiting for registry LoadBalancer IP..."

REGISTRY_IP=""
RETRIES=30
COUNT=0

while [ $COUNT -lt $RETRIES ]; do
    REGISTRY_IP=$(kubectl get svc registry -n korczewski-infra -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
    if [ -n "$REGISTRY_IP" ] && [ "$REGISTRY_IP" != "<pending>" ]; then
        break
    fi
    COUNT=$((COUNT + 1))
    log_info "Waiting for LB IP... ($COUNT/$RETRIES)"
    sleep 5
done

if [ -z "$REGISTRY_IP" ]; then
    log_error "Failed to get registry LoadBalancer IP after ${RETRIES} attempts"
    log_error "Check: kubectl get svc registry -n korczewski-infra"
    exit 1
fi

log_info "Registry LoadBalancer IP: ${REGISTRY_IP}"

# =============================================================================
# Step 3: Generate registries.yaml
# =============================================================================
log_info "Step 3: Generating registries.yaml..."

TEMPLATE="$SCRIPT_DIR/registries.yaml.template"
GENERATED="/tmp/registries.yaml"

sed "s/REGISTRY_IP/${REGISTRY_IP}/g" "$TEMPLATE" > "$GENERATED"

log_info "Generated registries.yaml:"
cat "$GENERATED"
echo ""

# =============================================================================
# Step 4: Copy to all nodes and restart k3s
# =============================================================================
log_info "Step 4: Distributing registries.yaml to all nodes..."

for NODE in $NODES; do
    log_info "Copying to ${NODE}..."
    if scp -o StrictHostKeyChecking=no "$GENERATED" "${SSH_USER}@${NODE}:/tmp/registries.yaml" 2>/dev/null && \
       ssh -o StrictHostKeyChecking=no "${SSH_USER}@${NODE}" "sudo cp /tmp/registries.yaml /etc/rancher/k3s/registries.yaml" 2>/dev/null; then
        # Restart k3s on the node to pick up new registry config
        if ssh -o StrictHostKeyChecking=no "${SSH_USER}@${NODE}" "sudo systemctl restart k3s 2>/dev/null || sudo systemctl restart k3s-agent 2>/dev/null" 2>/dev/null; then
            log_info "  ${NODE}: registries.yaml applied, k3s restarted"
        else
            log_warn "  ${NODE}: registries.yaml applied, could not restart k3s (may need manual restart)"
        fi
    else
        log_warn "  ${NODE}: SSH copy failed — apply manually: scp ${GENERATED} ${SSH_USER}@${NODE}:/etc/rancher/k3s/registries.yaml"
    fi
done

# =============================================================================
# Step 5: Verify registry
# =============================================================================
log_info "Step 5: Verifying registry..."

if curl -sf "http://${REGISTRY_IP}:5000/v2/" > /dev/null 2>&1; then
    echo -e "${GREEN}[PASS]${NC} Registry accessible at http://${REGISTRY_IP}:5000"
else
    log_warn "Registry not yet responding — may need a moment after restart"
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
echo "=========================================="
echo -e "${GREEN}Registry Setup Complete${NC}"
echo "=========================================="
echo ""
echo "Registry IP: ${REGISTRY_IP}"
echo "Registry URL: http://${REGISTRY_IP}:5000"
echo ""
echo "Add to your dev machine /etc/hosts:"
echo "  ${REGISTRY_IP} registry.local"
echo ""
echo "Test: curl http://registry.local:5000/v2/_catalog"
echo ""

# Clean up
rm -f "$GENERATED"
