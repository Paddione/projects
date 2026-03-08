#!/bin/bash
# =============================================================================
# PXE Boot Server Setup Script
# =============================================================================
# Sets up a multi-arch PXE boot server for automated Ubuntu 24.04 installation.
# Run ON the PXE server (10.10.0.4) or via SSH.
#
# Usage: sudo ./setup-pxe.sh
#
# Idempotent — safe to re-run.
# =============================================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

if [ "$EUID" -ne 0 ]; then
    log_error "Run as root: sudo ./setup-pxe.sh"
    exit 1
fi

echo "=========================================="
echo "PXE Boot Server Setup"
echo "=========================================="

# Step 1: Install packages
log_info "Step 1: Installing packages..."
apt-get update -qq
apt-get install -y -qq \
    dnsmasq nginx wget \
    pxelinux syslinux-common \
    grub-efi-amd64-signed shim-signed grub-common
apt-get install -y -qq grub-efi-arm64-signed 2>/dev/null || \
    log_warn "grub-efi-arm64-signed not available (arm64 PXE may need manual setup)"

# Step 2: Create directory structure
log_info "Step 2: Creating directory structure..."
mkdir -p /srv/pxe/tftp/{grub,pxelinux.cfg,amd64,arm64}
mkdir -p /srv/pxe/http/{ubuntu/amd64,ubuntu/arm64,autoinstall,secrets,keys,hostnames}
mkdir -p /srv/pxe/scripts

# Step 3: Copy bootloader files
log_info "Step 3: Copying bootloader files..."
cp -f /usr/lib/PXELINUX/pxelinux.0 /srv/pxe/tftp/ 2>/dev/null || log_warn "pxelinux.0 not found"
cp -f /usr/lib/syslinux/modules/bios/ldlinux.c32 /srv/pxe/tftp/ 2>/dev/null || true
cp -f /usr/lib/syslinux/modules/bios/menu.c32 /srv/pxe/tftp/ 2>/dev/null || true
cp -f /usr/lib/syslinux/modules/bios/libutil.c32 /srv/pxe/tftp/ 2>/dev/null || true

if [ -f /usr/lib/grub/x86_64-efi-signed/grubnetx64.efi.signed ]; then
    cp -f /usr/lib/grub/x86_64-efi-signed/grubnetx64.efi.signed /srv/pxe/tftp/grubnetx64.efi
    log_info "amd64 GRUB EFI: OK"
else
    log_warn "grubnetx64.efi.signed not found"
fi

if [ -f /usr/lib/grub/arm64-efi-signed/grubnetaa64.efi.signed ]; then
    cp -f /usr/lib/grub/arm64-efi-signed/grubnetaa64.efi.signed /srv/pxe/tftp/grubnetaa64.efi
    log_info "arm64 GRUB EFI: OK"
elif [ -f /usr/lib/grub/arm64-efi/grubaa64.efi ]; then
    cp -f /usr/lib/grub/arm64-efi/grubaa64.efi /srv/pxe/tftp/grubnetaa64.efi
    log_info "arm64 GRUB EFI (unsigned): OK"
else
    log_warn "arm64 GRUB EFI not found — arm64 PXE boot won't work"
fi

# Step 4: Configure dnsmasq
log_info "Step 4: Configuring dnsmasq..."
systemctl stop dnsmasq 2>/dev/null || true
mkdir -p /etc/systemd/system/dnsmasq.service.d
cat > /etc/systemd/system/dnsmasq.service.d/override.conf << 'EOF'
[Service]
Type=simple
ExecStartPre=
ExecStart=
ExecStart=/usr/sbin/dnsmasq -k -C /srv/pxe/dnsmasq.conf
ExecStartPost=
ExecStop=
ExecReload=/bin/kill -HUP $MAINPID
PIDFile=
EOF
systemctl daemon-reload

# Step 5: Configure nginx
log_info "Step 5: Configuring nginx..."
rm -f /etc/nginx/sites-enabled/default
ln -sf /srv/pxe/nginx-pxe.conf /etc/nginx/sites-enabled/pxe

# Step 6: Set ownership
log_info "Step 6: Setting ownership..."
chown -R patrick:patrick /srv/pxe

# Step 7: Enable and start services
log_info "Step 7: Starting services..."
systemctl enable dnsmasq nginx
systemctl restart dnsmasq nginx

# Step 8: Verify
log_info "Step 8: Verifying..."
echo ""
PASS=true

if systemctl is-active --quiet dnsmasq; then
    log_info "  dnsmasq: running"
else
    log_error "  dnsmasq: FAILED"
    PASS=false
fi

if systemctl is-active --quiet nginx; then
    log_info "  nginx: running"
else
    log_error "  nginx: FAILED"
    PASS=false
fi

if curl -sf http://10.10.0.4:8080/health > /dev/null 2>&1; then
    log_info "  HTTP health: OK"
else
    log_warn "  HTTP health: not responding (may need config files deployed)"
fi

# Check boot files
for f in grubnetx64.efi pxelinux.0; do
    if [ -f "/srv/pxe/tftp/${f}" ]; then
        log_info "  TFTP ${f}: present"
    else
        log_warn "  TFTP ${f}: missing"
    fi
done

echo ""
echo "=========================================="
if [ "${PASS}" = true ]; then
    echo -e "${GREEN}PXE Server Setup Complete${NC}"
else
    echo -e "${RED}PXE Server Setup Completed with Errors${NC}"
fi
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Download ISOs:    /srv/pxe/scripts/update-iso.sh"
echo "  2. Sync secrets:     (from dev machine) ./k8s/scripts/pxe/sync-secrets.sh"
echo "  3. Set DHCP reservations on FritzBox for new nodes"
echo "  4. Boot new machine with PXE/network boot enabled"
echo ""
