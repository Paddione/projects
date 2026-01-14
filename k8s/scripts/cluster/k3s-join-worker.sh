#!/bin/bash
# =============================================================================
# k3s Worker Node Join Script
# =============================================================================
# Joins a worker (agent) node to an existing k3s cluster.
#
# Usage: ./k3s-join-worker.sh MASTER_IP TOKEN
#
# Example:
#   ./k3s-join-worker.sh 192.168.1.100 'K10abc123...'
# =============================================================================

set -euo pipefail

# Arguments
MASTER_IP="${1:?Error: Master IP required. Usage: $0 MASTER_IP TOKEN}"
TOKEN="${2:?Error: Join token required. Usage: $0 MASTER_IP TOKEN}"
K3S_VERSION="${K3S_VERSION:-v1.29.0+k3s1}"

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
            /usr/local/bin/k3s-agent-uninstall.sh 2>/dev/null || /usr/local/bin/k3s-uninstall.sh 2>/dev/null || true
        else
            exit 1
        fi
    fi

    # Check connectivity to master
    log_info "Testing connectivity to master at ${MASTER_IP}:6443..."
    if ! timeout 5 bash -c "echo > /dev/tcp/${MASTER_IP}/6443" 2>/dev/null; then
        log_error "Cannot connect to master at ${MASTER_IP}:6443"
        log_error "Please check:"
        log_error "  - Master IP is correct"
        log_error "  - Master k3s server is running"
        log_error "  - Firewall allows port 6443"
        exit 1
    fi

    log_info "Pre-flight checks passed"
}

# Install k3s agent
install_k3s_agent() {
    log_info "Installing k3s agent ${K3S_VERSION}..."
    log_info "Joining cluster at ${MASTER_IP}..."

    curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION="${K3S_VERSION}" \
        K3S_URL="https://${MASTER_IP}:6443" \
        K3S_TOKEN="${TOKEN}" \
        sh -s - agent \
        --kubelet-arg "max-pods=110"

    log_info "k3s agent installation complete"
}

# Wait for node to be ready
wait_for_node() {
    log_info "Waiting for node to register with cluster..."

    local retries=30
    local count=0
    local hostname=$(hostname)

    while [ $count -lt $retries ]; do
        # Check if k3s-agent service is running
        if systemctl is-active --quiet k3s-agent; then
            log_info "k3s-agent service is running"
            break
        fi
        count=$((count + 1))
        log_info "Waiting for k3s-agent... ($count/$retries)"
        sleep 5
    done

    if [ $count -eq $retries ]; then
        log_error "k3s-agent failed to start"
        log_error "Check logs with: journalctl -u k3s-agent -f"
        exit 1
    fi

    log_info "Worker node joined successfully!"
}

# Print summary
print_summary() {
    echo ""
    echo "=========================================="
    echo -e "${GREEN}Worker Node Joined Successfully${NC}"
    echo "=========================================="
    echo ""
    echo "Master: ${MASTER_IP}"
    echo "Worker: $(hostname) ($(hostname -I | awk '{print $1}'))"
    echo ""
    echo "To verify on the master node, run:"
    echo "  kubectl get nodes"
    echo ""
    echo "To check agent logs:"
    echo "  journalctl -u k3s-agent -f"
    echo ""
}

# Main execution
main() {
    echo "=========================================="
    echo "k3s Worker Node Join"
    echo "=========================================="
    echo ""

    preflight_checks
    install_k3s_agent
    wait_for_node
    print_summary
}

main "$@"
