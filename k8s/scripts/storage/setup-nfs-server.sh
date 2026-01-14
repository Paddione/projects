#!/bin/bash
# =============================================================================
# NFS Server Setup Script
# =============================================================================
# Sets up an NFS server on the master node for shared Kubernetes storage.
# This provides persistent volumes accessible from all cluster nodes.
#
# Usage: sudo ./setup-nfs-server.sh [NFS_PATH] [ALLOWED_NETWORK]
#
# Example:
#   sudo ./setup-nfs-server.sh                                    # Defaults
#   sudo ./setup-nfs-server.sh /srv/nfs/k8s-data 10.0.0.0/8      # Custom
# =============================================================================

set -euo pipefail

# Configuration
NFS_PATH="${1:-/srv/nfs/k8s-data}"
ALLOWED_NETWORK="${2:-10.0.0.0/8,172.16.0.0/12,192.168.0.0/16}"

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

# Detect OS and install NFS server
install_nfs_server() {
    log_info "Installing NFS server..."

    if [ -f /etc/debian_version ]; then
        # Debian/Ubuntu
        apt-get update
        apt-get install -y nfs-kernel-server
    elif [ -f /etc/redhat-release ]; then
        # RHEL/CentOS/Fedora
        yum install -y nfs-utils
        systemctl enable nfs-server
    elif [ -f /etc/arch-release ]; then
        # Arch Linux
        pacman -Sy --noconfirm nfs-utils
    else
        log_error "Unsupported OS. Please install NFS server manually."
        exit 1
    fi

    log_info "NFS server installed"
}

# Create directories
create_directories() {
    log_info "Creating NFS directories..."

    # Create base directory
    mkdir -p "${NFS_PATH}"

    # Create subdirectories for each service
    mkdir -p "${NFS_PATH}/postgres"
    mkdir -p "${NFS_PATH}/media"
    mkdir -p "${NFS_PATH}/thumbnails"
    mkdir -p "${NFS_PATH}/backups"
    mkdir -p "${NFS_PATH}/logs"

    # Set permissions
    # Using nobody:nogroup for maximum compatibility
    chown -R nobody:nogroup "${NFS_PATH}"
    chmod -R 755 "${NFS_PATH}"

    # Postgres needs specific permissions
    chmod 700 "${NFS_PATH}/postgres"

    log_info "Directories created at ${NFS_PATH}"
}

# Configure exports
configure_exports() {
    log_info "Configuring NFS exports..."

    # Backup existing exports
    if [ -f /etc/exports ]; then
        cp /etc/exports /etc/exports.backup.$(date +%Y%m%d%H%M%S)
    fi

    # Remove any existing entry for this path
    if [ -f /etc/exports ]; then
        sed -i "\|^${NFS_PATH}|d" /etc/exports
    fi

    # Add new export entries
    # Split ALLOWED_NETWORK by comma and create entries
    IFS=',' read -ra NETWORKS <<< "$ALLOWED_NETWORK"
    for network in "${NETWORKS[@]}"; do
        network=$(echo "$network" | xargs)  # Trim whitespace
        echo "${NFS_PATH} ${network}(rw,sync,no_subtree_check,no_root_squash,crossmnt)" >> /etc/exports
    done

    log_info "NFS exports configured"
}

# Start NFS server
start_nfs_server() {
    log_info "Starting NFS server..."

    # Export the filesystem
    exportfs -ra

    # Enable and start the service
    if [ -f /etc/debian_version ]; then
        systemctl enable nfs-kernel-server
        systemctl restart nfs-kernel-server
    else
        systemctl enable nfs-server
        systemctl restart nfs-server
    fi

    log_info "NFS server started"
}

# Configure firewall
configure_firewall() {
    log_info "Configuring firewall..."

    # Check if ufw is active
    if command -v ufw &> /dev/null && ufw status | grep -q "Status: active"; then
        ufw allow 2049/tcp  # NFS
        ufw allow 111/tcp   # rpcbind
        ufw allow 111/udp
        log_info "UFW rules added"
    # Check if firewalld is active
    elif command -v firewall-cmd &> /dev/null && systemctl is-active --quiet firewalld; then
        firewall-cmd --permanent --add-service=nfs
        firewall-cmd --permanent --add-service=rpc-bind
        firewall-cmd --permanent --add-service=mountd
        firewall-cmd --reload
        log_info "Firewalld rules added"
    else
        log_warn "No active firewall detected. Please configure manually if needed."
    fi
}

# Verify NFS server
verify_nfs() {
    log_info "Verifying NFS configuration..."

    # Check exports
    echo ""
    echo "Active exports:"
    exportfs -v
    echo ""

    # Check NFS service
    if [ -f /etc/debian_version ]; then
        systemctl status nfs-kernel-server --no-pager
    else
        systemctl status nfs-server --no-pager
    fi
}

# Print summary
print_summary() {
    local server_ip=$(hostname -I | awk '{print $1}')

    echo ""
    echo "=========================================="
    echo -e "${GREEN}NFS Server Setup Complete${NC}"
    echo "=========================================="
    echo ""
    echo "NFS Server: ${server_ip}"
    echo "Export Path: ${NFS_PATH}"
    echo "Allowed Networks: ${ALLOWED_NETWORK}"
    echo ""
    echo "Directory Structure:"
    echo "  ${NFS_PATH}/"
    echo "    ├── postgres/      # PostgreSQL data"
    echo "    ├── media/         # VideoVault media"
    echo "    ├── thumbnails/    # VideoVault thumbnails"
    echo "    ├── backups/       # Database backups"
    echo "    └── logs/          # Application logs"
    echo ""
    echo "=========================================="
    echo "Next Steps:"
    echo "=========================================="
    echo ""
    echo "1. Run on each worker node:"
    echo "   ./setup-nfs-client.sh ${server_ip} ${NFS_PATH}"
    echo ""
    echo "2. Deploy NFS provisioner to Kubernetes:"
    echo "   Update NFS_SERVER_IP in infrastructure/nfs-provisioner/"
    echo "   kubectl apply -f infrastructure/nfs-provisioner/"
    echo ""
    echo "3. Test mount from worker:"
    echo "   sudo mount -t nfs ${server_ip}:${NFS_PATH} /mnt/test"
    echo ""
}

# Main execution
main() {
    echo "=========================================="
    echo "NFS Server Setup"
    echo "=========================================="
    echo ""

    check_root
    install_nfs_server
    create_directories
    configure_exports
    start_nfs_server
    configure_firewall
    verify_nfs
    print_summary
}

main "$@"
