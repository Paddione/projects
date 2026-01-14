#!/bin/bash
# =============================================================================
# NFS Client Setup Script
# =============================================================================
# Sets up NFS client on worker nodes to connect to the NFS server.
# Run this on each worker node after setting up the NFS server.
#
# Usage: sudo ./setup-nfs-client.sh NFS_SERVER_IP [NFS_PATH]
#
# Example:
#   sudo ./setup-nfs-client.sh 192.168.1.100
#   sudo ./setup-nfs-client.sh 192.168.1.100 /srv/nfs/k8s-data
# =============================================================================

set -euo pipefail

# Configuration
NFS_SERVER="${1:?Error: NFS server IP required. Usage: $0 NFS_SERVER_IP [NFS_PATH]}"
NFS_PATH="${2:-/srv/nfs/k8s-data}"
MOUNT_POINT="/mnt/nfs-k8s"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "This script must be run as root (sudo)"
        exit 1
    fi
}

# Install NFS client
install_nfs_client() {
    log_info "Installing NFS client utilities..."

    if [ -f /etc/debian_version ]; then
        apt-get update
        apt-get install -y nfs-common
    elif [ -f /etc/redhat-release ]; then
        yum install -y nfs-utils
    elif [ -f /etc/arch-release ]; then
        pacman -Sy --noconfirm nfs-utils
    else
        log_error "Unsupported OS. Please install NFS client manually."
        exit 1
    fi

    log_info "NFS client installed"
}

# Test connectivity
test_connectivity() {
    log_info "Testing connectivity to NFS server ${NFS_SERVER}..."

    # Test network connectivity
    if ! ping -c 1 -W 5 "${NFS_SERVER}" &> /dev/null; then
        log_error "Cannot ping NFS server at ${NFS_SERVER}"
        exit 1
    fi

    # Test NFS port
    if ! timeout 5 bash -c "echo > /dev/tcp/${NFS_SERVER}/2049" 2>/dev/null; then
        log_error "Cannot connect to NFS port (2049) on ${NFS_SERVER}"
        log_error "Please check:"
        log_error "  - NFS server is running"
        log_error "  - Firewall allows port 2049"
        exit 1
    fi

    log_info "Connectivity test passed"
}

# Show available exports
show_exports() {
    log_info "Available NFS exports from ${NFS_SERVER}:"
    showmount -e "${NFS_SERVER}" || {
        log_error "Failed to query NFS exports"
        log_error "Please check:"
        log_error "  - NFS server is properly configured"
        log_error "  - This client's network is allowed in exports"
        exit 1
    }
}

# Test mount
test_mount() {
    log_info "Testing NFS mount..."

    # Create mount point
    mkdir -p "${MOUNT_POINT}"

    # Attempt mount
    if mount -t nfs "${NFS_SERVER}:${NFS_PATH}" "${MOUNT_POINT}" -o soft,timeo=100,retrans=3; then
        log_info "Mount successful!"

        # Verify write access
        local test_file="${MOUNT_POINT}/.nfs_test_$$"
        if touch "${test_file}" 2>/dev/null; then
            rm -f "${test_file}"
            log_info "Write test passed"
        else
            log_warn "Cannot write to NFS mount (read-only or permission issue)"
        fi

        # Show mount info
        df -h "${MOUNT_POINT}"

        # Unmount test
        umount "${MOUNT_POINT}"
        log_info "Test mount unmounted"
    else
        log_error "Failed to mount NFS share"
        exit 1
    fi
}

# Add fstab entry (optional)
configure_fstab() {
    log_info "Configuring /etc/fstab for persistent mount..."

    # Remove any existing entry for this mount
    sed -i "\|${NFS_SERVER}:${NFS_PATH}|d" /etc/fstab

    # Note: For Kubernetes, we typically don't need fstab entries
    # The NFS provisioner handles dynamic mounting
    # But we can optionally add it for debugging

    read -p "Add persistent mount to /etc/fstab? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "${NFS_SERVER}:${NFS_PATH} ${MOUNT_POINT} nfs defaults,soft,timeo=100,retrans=3,_netdev 0 0" >> /etc/fstab
        log_info "Added to /etc/fstab"
        log_info "Mount with: sudo mount ${MOUNT_POINT}"
    else
        log_info "Skipped fstab configuration"
    fi
}

# Print summary
print_summary() {
    echo ""
    echo "=========================================="
    echo -e "${GREEN}NFS Client Setup Complete${NC}"
    echo "=========================================="
    echo ""
    echo "NFS Server: ${NFS_SERVER}"
    echo "NFS Path: ${NFS_PATH}"
    echo "Mount Point: ${MOUNT_POINT}"
    echo ""
    echo "Manual mount command:"
    echo "  sudo mount -t nfs ${NFS_SERVER}:${NFS_PATH} ${MOUNT_POINT}"
    echo ""
    echo "The Kubernetes NFS provisioner will handle dynamic mounting."
    echo "No permanent mount is required for k8s PVCs."
    echo ""
}

# Main execution
main() {
    echo "=========================================="
    echo "NFS Client Setup"
    echo "=========================================="
    echo ""

    check_root
    install_nfs_client
    test_connectivity
    show_exports
    test_mount
    configure_fstab
    print_summary
}

main "$@"
