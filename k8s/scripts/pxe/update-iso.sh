#!/bin/bash
# =============================================================================
# Download Ubuntu 24.04 ISOs and extract kernel/initrd for PXE boot.
# Run on the PXE server (10.10.0.4).
# =============================================================================
set -euo pipefail

ISO_DIR="/srv/pxe/http/ubuntu"
TFTP_DIR="/srv/pxe/tftp"
MOUNT_DIR="/mnt/iso"

AMD64_ISO="ubuntu-24.04.4-live-server-amd64.iso"
ARM64_ISO="ubuntu-24.04.4-live-server-arm64.iso"
AMD64_URL="https://releases.ubuntu.com/24.04/${AMD64_ISO}"
ARM64_URL="https://cdimage.ubuntu.com/releases/24.04/release/${ARM64_ISO}"

echo "=== Downloading Ubuntu 24.04 ISOs ==="

if [ ! -f "${ISO_DIR}/amd64/${AMD64_ISO}" ]; then
    echo "Downloading amd64 ISO (~2.6GB)..."
    wget -q --show-progress -O "${ISO_DIR}/amd64/${AMD64_ISO}" "${AMD64_URL}"
else
    echo "amd64 ISO already exists, skipping download"
fi

if [ ! -f "${ISO_DIR}/arm64/${ARM64_ISO}" ]; then
    echo "Downloading arm64 ISO (~2.3GB)..."
    wget -q --show-progress -O "${ISO_DIR}/arm64/${ARM64_ISO}" "${ARM64_URL}"
else
    echo "arm64 ISO already exists, skipping download"
fi

echo "=== Extracting boot artifacts ==="

sudo mkdir -p "${MOUNT_DIR}"

echo "Extracting amd64 kernel/initrd..."
sudo mount -o loop,ro "${ISO_DIR}/amd64/${AMD64_ISO}" "${MOUNT_DIR}"
cp "${MOUNT_DIR}/casper/vmlinuz" "${TFTP_DIR}/amd64/vmlinuz"
cp "${MOUNT_DIR}/casper/initrd" "${TFTP_DIR}/amd64/initrd"
sudo umount "${MOUNT_DIR}"

echo "Extracting arm64 kernel/initrd..."
sudo mount -o loop,ro "${ISO_DIR}/arm64/${ARM64_ISO}" "${MOUNT_DIR}"
cp "${MOUNT_DIR}/casper/vmlinuz" "${TFTP_DIR}/arm64/vmlinuz"
cp "${MOUNT_DIR}/casper/initrd" "${TFTP_DIR}/arm64/initrd"
sudo umount "${MOUNT_DIR}"

sudo rmdir "${MOUNT_DIR}"

echo "=== Done ==="
echo "amd64: ${TFTP_DIR}/amd64/vmlinuz, ${TFTP_DIR}/amd64/initrd"
echo "arm64: ${TFTP_DIR}/arm64/vmlinuz, ${TFTP_DIR}/arm64/initrd"
ls -lh "${TFTP_DIR}/amd64/" "${TFTP_DIR}/arm64/"
