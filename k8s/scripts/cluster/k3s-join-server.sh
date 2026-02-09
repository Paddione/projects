#!/bin/bash
# =============================================================================
# k3s Server Node Join Script (HA)
# =============================================================================
# Joins an additional server (control plane) node to an existing k3s cluster
# for high availability. Requires at least 3 server nodes for etcd quorum.
#
# Usage: ./k3s-join-server.sh MASTER_IP TOKEN [EXTERNAL_IP]
#
# Example:
#   ./k3s-join-server.sh 192.168.1.100 'K10abc123...'
#   ./k3s-join-server.sh 192.168.1.100 'K10abc123...' 192.168.1.102
# =============================================================================

set -euo pipefail

# Arguments
MASTER_IP="${1:?Error: Master IP required. Usage: $0 MASTER_IP TOKEN [EXTERNAL_IP]}"
TOKEN="${2:?Error: Join token required. Usage: $0 MASTER_IP TOKEN [EXTERNAL_IP]}"
EXTERNAL_IP="${3:-$(hostname -I | awk '{print $1}')}"
K3S_VERSION="${K3S_VERSION:-v1.29.0+k3s1}"
VIP="${VIP:-10.10.0.20}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

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
        log_warn "k3s is already installed."
        read -p "Uninstall and reinstall? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            log_info "Uninstalling existing k3s..."
            /usr/local/bin/k3s-uninstall.sh 2>/dev/null || true
        else
            exit 1
        fi
    fi

    # Check connectivity to master
    log_info "Testing connectivity to master at ${MASTER_IP}:6443..."
    if ! timeout 5 bash -c "echo > /dev/tcp/${MASTER_IP}/6443" 2>/dev/null; then
        log_error "Cannot connect to master at ${MASTER_IP}:6443"
        exit 1
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

# Install k3s server
install_k3s_server() {
    log_info "Installing k3s server ${K3S_VERSION}..."
    log_info "Joining cluster at ${MASTER_IP} as additional server..."

    curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION="${K3S_VERSION}" \
        K3S_URL="https://${MASTER_IP}:6443" \
        K3S_TOKEN="${TOKEN}" \
        sh -s - server \
        --disable traefik \
        --disable servicelb \
        --disable local-storage \
        --tls-san "${EXTERNAL_IP}" \
        --tls-san "${VIP}" \
        --node-external-ip "${EXTERNAL_IP}" \
        --write-kubeconfig-mode 644 \
        --kubelet-arg "max-pods=110"

    log_info "k3s server installation complete"
}

# Wait for node to be ready
wait_for_node() {
    log_info "Waiting for server node to be ready..."

    local retries=30
    local count=0

    while [ $count -lt $retries ]; do
        if kubectl get nodes &> /dev/null; then
            log_info "k3s server is ready!"
            return 0
        fi
        count=$((count + 1))
        log_info "Waiting for k3s... ($count/$retries)"
        sleep 5
    done

    log_error "k3s server failed to start"
    exit 1
}

# Setup kubeconfig
setup_kubeconfig() {
    log_info "Setting up kubeconfig..."

    SUDO_USER_HOME=$(eval echo ~${SUDO_USER:-$USER})

    mkdir -p "${SUDO_USER_HOME}/.kube"
    cp /etc/rancher/k3s/k3s.yaml "${SUDO_USER_HOME}/.kube/config"
    sed -i "s/127.0.0.1/${VIP}/g" "${SUDO_USER_HOME}/.kube/config"

    if [ -n "${SUDO_USER:-}" ]; then
        chown -R "${SUDO_USER}:${SUDO_USER}" "${SUDO_USER_HOME}/.kube"
    fi
}

# Print summary
print_summary() {
    echo ""
    echo "=========================================="
    echo -e "${GREEN}Server Node Joined Successfully${NC}"
    echo "=========================================="
    echo ""
    echo "Original Master: ${MASTER_IP}"
    echo "This Server: ${EXTERNAL_IP}"
    echo ""
    echo "Cluster Nodes:"
    kubectl get nodes -o wide
    echo ""
    echo "For HA, you need at least 3 server nodes."
    echo "Current server count: $(kubectl get nodes --selector='node-role.kubernetes.io/control-plane' --no-headers | wc -l)"
    echo ""
}

# Main execution
main() {
    echo "=========================================="
    echo "k3s Server Node Join (HA)"
    echo "=========================================="
    echo ""

    preflight_checks
    install_k3s_server
    wait_for_node
    setup_kubeconfig
    print_summary
}

main "$@"
