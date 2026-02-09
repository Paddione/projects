#!/bin/bash
# =============================================================================
# Node Prerequisites Script
# =============================================================================
# Prepares an Ubuntu 24.04 node for k3s installation.
# Run on EACH node (control plane and worker) before cluster setup.
#
# Usage: sudo ./node-prerequisites.sh
#
# What it does:
#   - Installs required packages (cifs-utils, open-iscsi)
#   - Disables swap
#   - Loads kernel modules (overlay, br_netfilter)
#   - Sets sysctl networking parameters
#   - Opens firewall ports
#   - Tests NAS SMB connectivity
# =============================================================================

set -euo pipefail

# Configuration
NAS_IP="${NAS_IP:-10.10.0.3}"
NAS_SHARE="${NAS_SHARE:-//10.10.0.3/k8s-storage}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check root
if [ "$EUID" -ne 0 ]; then
    log_error "This script must be run as root (sudo)"
    exit 1
fi

echo "=========================================="
echo "Node Prerequisites for k3s"
echo "=========================================="
echo ""

# =============================================================================
# Step 1: Install packages
# =============================================================================
log_info "Step 1: Installing required packages..."
apt-get update -qq
apt-get install -y -qq \
    cifs-utils \
    open-iscsi \
    nfs-common \
    curl \
    apt-transport-https \
    ca-certificates \
    jq
log_info "Packages installed"

# =============================================================================
# Step 2: Disable swap
# =============================================================================
log_info "Step 2: Disabling swap..."
swapoff -a
# Remove swap entries from fstab
sed -i '/\sswap\s/d' /etc/fstab
log_info "Swap disabled"

# =============================================================================
# Step 3: Load kernel modules
# =============================================================================
log_info "Step 3: Loading kernel modules..."

cat > /etc/modules-load.d/k3s.conf <<EOF
overlay
br_netfilter
EOF

modprobe overlay
modprobe br_netfilter
log_info "Kernel modules loaded (overlay, br_netfilter)"

# =============================================================================
# Step 4: Set sysctl parameters
# =============================================================================
log_info "Step 4: Setting sysctl parameters..."

cat > /etc/sysctl.d/99-k3s.conf <<EOF
net.ipv4.ip_forward = 1
net.bridge.bridge-nf-call-iptables = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.conf.all.forwarding = 1
EOF

sysctl --system > /dev/null 2>&1
log_info "Sysctl parameters applied"

# =============================================================================
# Step 5: Configure firewall (if ufw is active)
# =============================================================================
if command -v ufw &> /dev/null && ufw status | grep -q "Status: active"; then
    log_info "Step 5: Configuring UFW firewall..."

    # k3s API server
    ufw allow 6443/tcp comment "k3s API server"

    # etcd
    ufw allow 2379:2380/tcp comment "etcd"

    # kubelet
    ufw allow 10250/tcp comment "kubelet"

    # Flannel VXLAN
    ufw allow 8472/udp comment "Flannel VXLAN"

    # WireGuard (Flannel backend)
    ufw allow 51820/udp comment "WireGuard"

    # NodePort range
    ufw allow 30000:32767/tcp comment "NodePort services"

    # Metrics server
    ufw allow 10251/tcp comment "kube-scheduler"
    ufw allow 10252/tcp comment "kube-controller-manager"

    ufw reload
    log_info "Firewall configured"
else
    log_info "Step 5: UFW not active, skipping firewall configuration"
fi

# =============================================================================
# Step 6: Test NAS SMB connectivity
# =============================================================================
log_info "Step 6: Testing NAS connectivity to ${NAS_IP}..."

if ping -c 2 -W 3 "$NAS_IP" > /dev/null 2>&1; then
    log_info "NAS reachable at ${NAS_IP}"
else
    log_warn "Cannot reach NAS at ${NAS_IP} — SMB storage may not work"
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
echo "=========================================="
echo -e "${GREEN}Node Prerequisites Complete${NC}"
echo "=========================================="
echo ""
echo "Verified:"
echo "  [x] Packages installed (cifs-utils, open-iscsi)"
echo "  [x] Swap disabled"
echo "  [x] Kernel modules loaded (overlay, br_netfilter)"
echo "  [x] Sysctl parameters set (ip_forward, bridge-nf-call)"
echo "  [x] Firewall configured (if active)"
echo "  [x] NAS connectivity tested"
echo ""
echo "Next: Run k3s-init-master.sh on the first control plane node"
echo ""
