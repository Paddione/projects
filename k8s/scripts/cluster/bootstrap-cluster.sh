#!/bin/bash
# =============================================================================
# Multi-Node k3s Cluster Bootstrap
# =============================================================================
# Top-level orchestration script run from the dev machine.
# SSHes into all 6 nodes to set up a production k3s cluster.
#
# Usage:
#   ./bootstrap-cluster.sh                  # Full run (all 6 nodes)
#   ./bootstrap-cluster.sh --cp-only        # Control plane only (3 nodes, skip workers)
#   ./bootstrap-cluster.sh --start-from=5   # Resume from step 5
#   ./bootstrap-cluster.sh --dry-run        # Show steps without executing
#
# Prerequisites:
#   - SSH key auth to all nodes (ssh-copy-id patrick@<ip>)
#   - CP nodes: Ubuntu 24.04 (amd64)
#   - Worker nodes: Debian/Ubuntu (arm64 Raspberry Pi supported)
#   - Network connectivity between all nodes
#   - Windows host SMB firewall rules (TCP 445, ICMP from 10.0.0.0/8)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
DEPLOY_DIR="$K8S_DIR/scripts/deploy"

# =============================================================================
# Node Configuration — edit these for your environment
# =============================================================================
CP1="10.0.3.1"
CP2="10.0.3.2"
CP3="10.0.3.3"
W1="10.0.31.1"
W2="10.0.31.2"
W3="10.0.31.3"
VIP="10.10.0.20"

ALL_NODES="$CP1 $CP2 $CP3 $W1 $W2 $W3"
CP_NODES="$CP1 $CP2 $CP3"
WORKER_NODES="$W1 $W2 $W3"

SSH_USER="${SSH_USER:-patrick}"
K3S_VERSION="${K3S_VERSION:-v1.29.0+k3s1}"

# =============================================================================
# Parse arguments
# =============================================================================
START_FROM=1
DRY_RUN=false
CP_ONLY=false

for arg in "$@"; do
    case $arg in
        --start-from=*) START_FROM="${arg#*=}" ;;
        --dry-run) DRY_RUN=true ;;
        --cp-only) CP_ONLY=true ;;
    esac
done

# When --cp-only, scope everything to control plane nodes
if [ "$CP_ONLY" = true ]; then
    ALL_NODES="$CP_NODES"
    WORKER_NODES=""
    EXPECTED_NODES=3
else
    EXPECTED_NODES=6
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() {
    local step=$1
    local desc=$2
    echo ""
    echo -e "${BLUE}=========================================${NC}"
    echo -e "${BLUE} Step ${step}: ${desc}${NC}"
    echo -e "${BLUE}=========================================${NC}"
}

SSH_OPTS=(-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10 -o LogLevel=ERROR)

ssh_cmd() {
    local host=$1
    shift
    ssh "${SSH_OPTS[@]}" "${SSH_USER}@${host}" "$@"
}

scp_cmd() {
    scp "${SSH_OPTS[@]}" "$@"
}

run_step() {
    local step=$1
    local desc=$2
    shift 2

    if [ "$step" -lt "$START_FROM" ]; then
        echo -e "${YELLOW}[SKIP]${NC} Step ${step}: ${desc} (--start-from=${START_FROM})"
        return
    fi

    log_step "$step" "$desc"

    if [ "$DRY_RUN" = true ]; then
        echo "  [DRY RUN] Would execute: $*"
        return
    fi

    "$@"
}

# =============================================================================
# Steps
# =============================================================================

step_1_prerequisites() {
    log_info "Running prerequisites on all nodes..."
    for NODE in $ALL_NODES; do
        log_info "  Node: ${NODE}"
        scp_cmd "$SCRIPT_DIR/node-prerequisites.sh" "${SSH_USER}@${NODE}:/tmp/node-prerequisites.sh"
        ssh_cmd "$NODE" "chmod +x /tmp/node-prerequisites.sh && sudo /tmp/node-prerequisites.sh"
    done
}

step_2_init_master() {
    log_info "Initializing first control plane node (${CP1})..."
    scp_cmd "$SCRIPT_DIR/k3s-init-master.sh" "${SSH_USER}@${CP1}:/tmp/k3s-init-master.sh"
    ssh_cmd "$CP1" "chmod +x /tmp/k3s-init-master.sh && sudo VIP=${VIP} K3S_VERSION=${K3S_VERSION} /tmp/k3s-init-master.sh ${CP1}"

    # Get join token
    log_info "Retrieving join token..."
    JOIN_TOKEN=$(ssh_cmd "$CP1" "sudo cat /var/lib/rancher/k3s/server/node-token")
    log_info "Join token retrieved"

    # Copy kubeconfig to dev machine
    log_info "Copying kubeconfig to dev machine..."
    mkdir -p "$HOME/.kube"
    ssh_cmd "$CP1" "sudo cat /etc/rancher/k3s/k3s.yaml" > "$HOME/.kube/config-k3s"
    # Use CP1 directly during bootstrap; switch to VIP after kube-vip is deployed
    sed -i "s/127.0.0.1/${CP1}/g" "$HOME/.kube/config-k3s"
    log_info "Kubeconfig saved to ~/.kube/config-k3s"
    log_info "To use: export KUBECONFIG=$HOME/.kube/config-k3s"
}

step_3_join_servers() {
    if [ -z "${JOIN_TOKEN:-}" ]; then
        log_info "Retrieving join token from ${CP1}..."
        JOIN_TOKEN=$(ssh_cmd "$CP1" "sudo cat /var/lib/rancher/k3s/server/node-token")
    fi

    for NODE in $CP2 $CP3; do
        log_info "Joining server node ${NODE}..."
        scp_cmd "$SCRIPT_DIR/k3s-join-server.sh" "${SSH_USER}@${NODE}:/tmp/k3s-join-server.sh"
        ssh_cmd "$NODE" "chmod +x /tmp/k3s-join-server.sh && sudo VIP=${VIP} K3S_VERSION=${K3S_VERSION} /tmp/k3s-join-server.sh ${CP1} '${JOIN_TOKEN}' ${NODE}"
    done
}

step_4_join_workers() {
    if [ "$CP_ONLY" = true ]; then
        log_info "Skipping worker join (--cp-only mode)"
    else
        if [ -z "${JOIN_TOKEN:-}" ]; then
            log_info "Retrieving join token from ${CP1}..."
            JOIN_TOKEN=$(ssh_cmd "$CP1" "sudo cat /var/lib/rancher/k3s/server/node-token")
        fi

        for NODE in $WORKER_NODES; do
            log_info "Joining worker node ${NODE}..."
            ssh_cmd "$NODE" "curl -sfL https://get.k3s.io | sudo INSTALL_K3S_VERSION=${K3S_VERSION} K3S_URL=https://${CP1}:6443 K3S_TOKEN='${JOIN_TOKEN}' sh -s - agent --node-external-ip ${NODE}"
        done
    fi

    # Wait for expected nodes
    log_info "Waiting for ${EXPECTED_NODES} node(s) to be Ready..."
    export KUBECONFIG="$HOME/.kube/config-k3s"
    local retries=30
    local count=0
    while [ $count -lt $retries ]; do
        READY_COUNT=$(kubectl get nodes --no-headers 2>/dev/null | grep -c " Ready" || true)
        if [ "$READY_COUNT" -ge "$EXPECTED_NODES" ]; then
            log_info "All ${EXPECTED_NODES} node(s) are Ready!"
            kubectl get nodes -o wide
            break
        fi
        count=$((count + 1))
        log_info "Nodes ready: ${READY_COUNT}/${EXPECTED_NODES} ($count/$retries)"
        sleep 10
    done
}

step_5_kube_vip() {
    export KUBECONFIG="$HOME/.kube/config-k3s"
    log_info "Deploying kube-vip..."
    "$DEPLOY_DIR/deploy-kube-vip.sh"

    # Now switch kubeconfig to use VIP
    log_info "Switching kubeconfig to VIP (${VIP})..."
    sed -i "s/${CP1}/${VIP}/g" "$HOME/.kube/config-k3s"
}

step_6_smb_csi() {
    export KUBECONFIG="$HOME/.kube/config-k3s"
    log_info "Deploying SMB-CSI driver..."
    "$DEPLOY_DIR/deploy-smb-csi.sh"
}

step_7_namespaces() {
    export KUBECONFIG="$HOME/.kube/config-k3s"
    log_info "Creating namespaces..."
    kubectl apply -f "$K8S_DIR/base/namespaces.yaml"
}

step_8_registry() {
    export KUBECONFIG="$HOME/.kube/config-k3s"
    log_info "Setting up private registry..."
    NODES="$ALL_NODES" SSH_USER="$SSH_USER" "$SCRIPT_DIR/setup-registry.sh"
}

step_9_deploy_all() {
    export KUBECONFIG="$HOME/.kube/config-k3s"
    log_info "Deploying all services..."
    "$DEPLOY_DIR/deploy-all.sh" --skip-secrets
    # Secrets were already deployed; infra scripts are idempotent
}

step_10_validate() {
    export KUBECONFIG="$HOME/.kube/config-k3s"
    log_info "Running cluster validation..."
    "$K8S_DIR/scripts/utils/validate-cluster.sh"
}

# =============================================================================
# Main
# =============================================================================
echo "=========================================="
echo "k3s Multi-Node Cluster Bootstrap"
echo "=========================================="
echo ""
echo "Nodes:"
echo "  Control Plane: ${CP1}, ${CP2}, ${CP3}"
if [ "$CP_ONLY" = true ]; then
    echo "  Workers:       (skipped — --cp-only mode)"
else
    echo "  Workers:       ${W1}, ${W2}, ${W3}"
fi
echo "  API VIP:       ${VIP}"
echo ""
if [ "$CP_ONLY" = true ]; then
    echo "*** CP-ONLY MODE — workers can be added later ***"
    echo ""
fi
if [ "$DRY_RUN" = true ]; then
    echo "*** DRY RUN MODE — no changes will be made ***"
    echo ""
fi
if [ "$START_FROM" -gt 1 ]; then
    echo "Resuming from step ${START_FROM}"
    echo ""
fi

# Verify SSH connectivity
if [ "$DRY_RUN" = false ] && [ "$START_FROM" -le 1 ]; then
    log_info "Verifying SSH connectivity..."
    for NODE in $ALL_NODES; do
        if ! ssh_cmd "$NODE" "echo ok" > /dev/null 2>&1; then
            log_error "Cannot SSH to ${NODE}. Fix SSH access first."
            exit 1
        fi
        echo -e "  ${GREEN}[OK]${NC} ${NODE}"
    done
    echo ""
fi

run_step 1  "Node Prerequisites"          step_1_prerequisites
run_step 2  "Init First Control Plane"   step_2_init_master
run_step 3  "Join Additional Servers"    step_3_join_servers
run_step 4  "Join Worker Nodes"          step_4_join_workers
run_step 5  "Deploy kube-vip"            step_5_kube_vip
run_step 6  "Deploy SMB-CSI Driver"      step_6_smb_csi
run_step 7  "Create Namespaces"          step_7_namespaces
run_step 8  "Setup Private Registry"     step_8_registry
run_step 9  "Deploy All Services"        step_9_deploy_all
run_step 10 "Validate Cluster"           step_10_validate

echo ""
echo "=========================================="
echo -e "${GREEN}Bootstrap Complete!${NC}"
echo "=========================================="
echo ""
echo "Kubeconfig: export KUBECONFIG=$HOME/.kube/config-k3s"
echo ""
echo "Next steps:"
echo "  1. Add to /etc/hosts: <registry-lb-ip> registry.local"
echo "  2. Point *.korczewski.de DNS to Traefik LB IP"
echo "  3. Build & push images with buildx (insecure registry):"
echo "     docker buildx build --builder insecure-builder --platform linux/amd64 --push \\"
echo "       -t 10.10.0.40:5000/korczewski/<service>:latest -f <Dockerfile> ."
echo "  4. Apply manifests: kubectl apply -k k8s/services/<service>"
if [ "$CP_ONLY" = true ]; then
    echo ""
    echo "To add workers later:"
    echo "  1. Run prerequisites on each worker node:"
    echo "     scp scripts/cluster/node-prerequisites.sh root@<worker-ip>:/tmp/"
    echo "     ssh root@<worker-ip> 'chmod +x /tmp/node-prerequisites.sh && /tmp/node-prerequisites.sh'"
    echo "  2. Get the join token:"
    echo "     ssh root@${CP1} 'cat /var/lib/rancher/k3s/server/node-token'"
    echo "  3. Join each worker:"
    echo "     ssh root@<worker-ip> \"curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=${K3S_VERSION} K3S_URL=https://${CP1}:6443 K3S_TOKEN='<token>' sh -s - agent --node-external-ip <worker-ip>\""
    echo "  4. Distribute registry config to workers:"
    echo "     scp /etc/rancher/k3s/registries.yaml root@<worker-ip>:/etc/rancher/k3s/registries.yaml"
    echo "     ssh root@<worker-ip> 'systemctl restart k3s-agent'"
fi
echo ""
