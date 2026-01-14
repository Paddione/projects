#!/bin/bash
# =============================================================================
# k3s Master Node Initialization Script
# =============================================================================
# Initializes the first k3s server node (control plane) in a multi-node cluster.
# Run this on the machine that will be the primary control plane.
#
# Usage: ./k3s-init-master.sh [EXTERNAL_IP]
#
# Example:
#   ./k3s-init-master.sh 192.168.1.100
#   ./k3s-init-master.sh  # Uses auto-detected IP
# =============================================================================

set -euo pipefail

# Configuration
EXTERNAL_IP="${1:-$(hostname -I | awk '{print $1}')}"
K3S_VERSION="${K3S_VERSION:-v1.29.0+k3s1}"
CLUSTER_CIDR="${CLUSTER_CIDR:-10.42.0.0/16}"
SERVICE_CIDR="${SERVICE_CIDR:-10.43.0.0/16}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Pre-flight checks
preflight_checks() {
    log_info "Running pre-flight checks..."

    # Check if running as root
    if [ "$EUID" -ne 0 ]; then
        log_error "This script must be run as root (sudo)"
        exit 1
    fi

    # Check if k3s is already installed
    if command -v k3s &> /dev/null; then
        log_warn "k3s is already installed. Uninstall first with: /usr/local/bin/k3s-uninstall.sh"
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi

    # Check required ports
    for port in 6443 2379 2380 10250; do
        if ss -tlnp | grep -q ":$port "; then
            log_error "Port $port is already in use"
            exit 1
        fi
    done

    log_info "Pre-flight checks passed"
}

# Install k3s
install_k3s() {
    log_info "Installing k3s ${K3S_VERSION} on ${EXTERNAL_IP}..."

    curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION="${K3S_VERSION}" sh -s - server \
        --cluster-init \
        --disable traefik \
        --disable servicelb \
        --disable local-storage \
        --tls-san "${EXTERNAL_IP}" \
        --node-external-ip "${EXTERNAL_IP}" \
        --write-kubeconfig-mode 644 \
        --cluster-cidr "${CLUSTER_CIDR}" \
        --service-cidr "${SERVICE_CIDR}" \
        --kubelet-arg "max-pods=110" \
        --kube-apiserver-arg "default-not-ready-toleration-seconds=30" \
        --kube-apiserver-arg "default-unreachable-toleration-seconds=30"

    log_info "k3s installation complete"
}

# Wait for k3s to be ready
wait_for_k3s() {
    log_info "Waiting for k3s to be ready..."

    local retries=30
    local count=0

    while [ $count -lt $retries ]; do
        if kubectl get nodes &> /dev/null; then
            log_info "k3s is ready!"
            return 0
        fi
        count=$((count + 1))
        log_info "Waiting for k3s... ($count/$retries)"
        sleep 5
    done

    log_error "k3s failed to start within timeout"
    exit 1
}

# Setup kubeconfig for non-root user
setup_kubeconfig() {
    log_info "Setting up kubeconfig..."

    # Get the user who called sudo
    SUDO_USER_HOME=$(eval echo ~${SUDO_USER:-$USER})

    mkdir -p "${SUDO_USER_HOME}/.kube"
    cp /etc/rancher/k3s/k3s.yaml "${SUDO_USER_HOME}/.kube/config"

    # Replace localhost with external IP for remote access
    sed -i "s/127.0.0.1/${EXTERNAL_IP}/g" "${SUDO_USER_HOME}/.kube/config"

    if [ -n "${SUDO_USER:-}" ]; then
        chown -R "${SUDO_USER}:${SUDO_USER}" "${SUDO_USER_HOME}/.kube"
    fi

    log_info "Kubeconfig saved to ${SUDO_USER_HOME}/.kube/config"
}

# Get join token
get_join_token() {
    local token_path="/var/lib/rancher/k3s/server/node-token"

    if [ -f "$token_path" ]; then
        NODE_TOKEN=$(cat "$token_path")
    else
        log_error "Token file not found at $token_path"
        exit 1
    fi
}

# Print summary
print_summary() {
    echo ""
    echo "=========================================="
    echo -e "${GREEN}k3s Master Node Initialized Successfully${NC}"
    echo "=========================================="
    echo ""
    echo "Master IP: ${EXTERNAL_IP}"
    echo "K3s Version: ${K3S_VERSION}"
    echo ""
    echo "Node Status:"
    kubectl get nodes -o wide
    echo ""
    echo "=========================================="
    echo "To add worker nodes, run on each worker:"
    echo "=========================================="
    echo ""
    echo "  ./k3s-join-worker.sh ${EXTERNAL_IP} '${NODE_TOKEN}'"
    echo ""
    echo "Or manually:"
    echo ""
    echo "  curl -sfL https://get.k3s.io | K3S_URL=\"https://${EXTERNAL_IP}:6443\" \\"
    echo "    K3S_TOKEN=\"${NODE_TOKEN}\" sh -"
    echo ""
    echo "=========================================="
    echo "To add additional server nodes (HA):"
    echo "=========================================="
    echo ""
    echo "  ./k3s-join-server.sh ${EXTERNAL_IP} '${NODE_TOKEN}'"
    echo ""
    echo "=========================================="
    echo "Kubeconfig for remote access:"
    echo "=========================================="
    echo ""
    echo "  Copy ~/.kube/config to your local machine"
    echo "  Or use: export KUBECONFIG=/etc/rancher/k3s/k3s.yaml"
    echo ""
}

# Main execution
main() {
    echo "=========================================="
    echo "k3s Master Node Initialization"
    echo "=========================================="
    echo ""

    preflight_checks
    install_k3s
    wait_for_k3s
    setup_kubeconfig
    get_join_token
    print_summary
}

main "$@"
