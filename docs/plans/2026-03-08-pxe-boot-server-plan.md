# PXE Boot Server Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up a multi-arch PXE boot server on `10.10.0.4` (ubuntu-laptop) that network-boots new machines, auto-installs Ubuntu 24.04 with k3s prerequisites, formats extra drives as SMB shares, and produces cluster-ready nodes.

**Architecture:** dnsmasq (proxy DHCP + TFTP) + nginx (HTTP for ISOs, autoinstall, secrets) on `10.10.0.4`. Clients PXE boot, receive architecture-appropriate bootloader, kernel boots with cloud-init autoinstall from HTTP, then reboots into a fully provisioned node. Extra drives are auto-formatted and shared via Samba.

**Tech Stack:** dnsmasq, nginx, Ubuntu autoinstall (cloud-init), GRUB netboot, syslinux/pxelinux, Samba

**Reference:** Design doc at `docs/plans/2026-03-08-pxe-boot-server-design.md`

**PXE Server:** `10.10.0.4` (ubuntu-laptop, Ubuntu 24.04, 16GB RAM, 64GB free disk)
**SSH access:** `ssh patrick@10.10.0.4` (key-based, passwordless sudo)
**LAN interface:** `wlp1s0` (IP: `10.10.0.4/8`)

**SMB credentials (from .env):** `SMB_USER=patrick`, `SMB_PASSWORD=170591pk`
**SSH pubkey:** `ssh-ed25519 AAAAC3NzIFN75CnuOz7YXaJipTFxWMVDgm35heu64JKN1QL+Z84+ patrick@korczewski.de`
**User password hash (SHA-512):** `$6$htx9UQ4As7moxMzA$EUEAruo8AGbkV8m1BxpZ8cHFMakb6.vnZGws4ceRiAQz4YeQcciED59WO2vgSct05U3G60LrR/Ejb06QZJvLp.`

---

## Task 1: Create directory structure on PXE server

**Target:** `10.10.0.4` via SSH

**Step 1: Create the /srv/pxe directory tree**

```bash
ssh patrick@10.10.0.4 'sudo mkdir -p \
  /srv/pxe/tftp/grub \
  /srv/pxe/tftp/pxelinux.cfg \
  /srv/pxe/tftp/amd64 \
  /srv/pxe/tftp/arm64 \
  /srv/pxe/http/ubuntu/amd64 \
  /srv/pxe/http/ubuntu/arm64 \
  /srv/pxe/http/autoinstall \
  /srv/pxe/http/secrets \
  /srv/pxe/http/keys \
  /srv/pxe/scripts && \
  sudo chown -R patrick:patrick /srv/pxe'
```

**Step 2: Verify structure**

```bash
ssh patrick@10.10.0.4 'find /srv/pxe -type d | sort'
```

Expected: All directories listed above.

---

## Task 2: Install dnsmasq and nginx on PXE server

**Step 1: Install packages**

```bash
ssh patrick@10.10.0.4 'sudo apt-get update -qq && sudo apt-get install -y -qq \
  dnsmasq \
  nginx \
  pxelinux \
  syslinux-common \
  grub-efi-amd64-signed \
  grub-efi-arm64-signed \
  shim-signed \
  grub-common'
```

**Step 2: Stop default services (we'll configure before enabling)**

```bash
ssh patrick@10.10.0.4 'sudo systemctl stop dnsmasq nginx 2>/dev/null; sudo systemctl disable dnsmasq nginx 2>/dev/null; echo "stopped"'
```

**Step 3: Verify installation**

```bash
ssh patrick@10.10.0.4 'which dnsmasq && which nginx && dpkg -l | grep pxelinux'
```

Expected: Paths for dnsmasq, nginx, and pxelinux package listed.

---

## Task 3: Download Ubuntu 24.04 ISOs and extract boot artifacts

**Step 1: Create the ISO download script**

Write to: `k8s/scripts/pxe/update-iso.sh`

```bash
#!/bin/bash
# Downloads Ubuntu 24.04 server ISOs and extracts kernel/initrd for PXE boot.
# Run on the PXE server (10.10.0.4).
set -euo pipefail

ISO_DIR="/srv/pxe/http/ubuntu"
TFTP_DIR="/srv/pxe/tftp"
MOUNT_DIR="/mnt/iso"

AMD64_ISO="ubuntu-24.04.4-live-server-amd64.iso"
ARM64_ISO="ubuntu-24.04.4-live-server-arm64.iso"
AMD64_URL="https://releases.ubuntu.com/24.04/${AMD64_ISO}"
ARM64_URL="https://cdimage.ubuntu.com/releases/24.04/release/${ARM64_ISO}"

echo "=== Downloading Ubuntu 24.04 ISOs ==="

# Download amd64
if [ ! -f "${ISO_DIR}/amd64/${AMD64_ISO}" ]; then
    echo "Downloading amd64 ISO (~2.6GB)..."
    wget -q --show-progress -O "${ISO_DIR}/amd64/${AMD64_ISO}" "${AMD64_URL}"
else
    echo "amd64 ISO already exists, skipping download"
fi

# Download arm64
if [ ! -f "${ISO_DIR}/arm64/${ARM64_ISO}" ]; then
    echo "Downloading arm64 ISO (~2.3GB)..."
    wget -q --show-progress -O "${ISO_DIR}/arm64/${ARM64_ISO}" "${ARM64_URL}"
else
    echo "arm64 ISO already exists, skipping download"
fi

echo "=== Extracting boot artifacts ==="

sudo mkdir -p "${MOUNT_DIR}"

# Extract amd64 kernel + initrd
echo "Extracting amd64 kernel/initrd..."
sudo mount -o loop,ro "${ISO_DIR}/amd64/${AMD64_ISO}" "${MOUNT_DIR}"
cp "${MOUNT_DIR}/casper/vmlinuz" "${TFTP_DIR}/amd64/vmlinuz"
cp "${MOUNT_DIR}/casper/initrd" "${TFTP_DIR}/amd64/initrd"
sudo umount "${MOUNT_DIR}"

# Extract arm64 kernel + initrd
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
```

**Step 2: Copy script to PXE server and run**

```bash
scp k8s/scripts/pxe/update-iso.sh patrick@10.10.0.4:/srv/pxe/scripts/
ssh patrick@10.10.0.4 'chmod +x /srv/pxe/scripts/update-iso.sh && /srv/pxe/scripts/update-iso.sh'
```

This takes ~10 minutes depending on download speed.

**Step 3: Verify boot artifacts**

```bash
ssh patrick@10.10.0.4 'ls -lh /srv/pxe/tftp/amd64/ /srv/pxe/tftp/arm64/ && ls -lh /srv/pxe/http/ubuntu/amd64/*.iso /srv/pxe/http/ubuntu/arm64/*.iso'
```

Expected: vmlinuz (~14MB) and initrd (~60MB) in each arch directory, ISOs (~2.5GB each).

---

## Task 4: Copy GRUB and syslinux bootloader files

**Step 1: Copy bootloader binaries on PXE server**

```bash
ssh patrick@10.10.0.4 'bash -s' << 'REMOTE'
set -euo pipefail

TFTP="/srv/pxe/tftp"

# amd64 UEFI: signed GRUB
cp /usr/lib/grub/x86_64-efi-signed/grubnetx64.efi.signed "${TFTP}/grubnetx64.efi"

# arm64 UEFI: signed GRUB
if [ -f /usr/lib/grub/arm64-efi-signed/grubnetaa64.efi.signed ]; then
    cp /usr/lib/grub/arm64-efi-signed/grubnetaa64.efi.signed "${TFTP}/grubnetaa64.efi"
elif [ -f /usr/lib/grub/arm64-efi/grubaa64.efi ]; then
    cp /usr/lib/grub/arm64-efi/grubaa64.efi "${TFTP}/grubnetaa64.efi"
else
    echo "WARN: arm64 GRUB EFI not found — arm64 PXE boot won't work until installed"
fi

# BIOS: pxelinux
cp /usr/lib/PXELINUX/pxelinux.0 "${TFTP}/"
cp /usr/lib/syslinux/modules/bios/ldlinux.c32 "${TFTP}/"
cp /usr/lib/syslinux/modules/bios/libutil.c32 "${TFTP}/" 2>/dev/null || true
cp /usr/lib/syslinux/modules/bios/menu.c32 "${TFTP}/" 2>/dev/null || true

echo "Bootloader files:"
ls -lh "${TFTP}"/*.efi "${TFTP}"/pxelinux.0 "${TFTP}"/*.c32 2>/dev/null
REMOTE
```

Expected: `grubnetx64.efi`, `grubnetaa64.efi`, `pxelinux.0`, `ldlinux.c32` present.

---

## Task 5: Write dnsmasq configuration (proxy DHCP + TFTP)

**Step 1: Create dnsmasq config**

Write to: `k8s/scripts/pxe/dnsmasq.conf`

```ini
# =============================================================================
# dnsmasq PXE Boot Server Configuration
# =============================================================================
# Runs in PROXY mode — provides PXE boot options only, no IP assignment.
# FritzBox remains the sole DHCP/IP authority.
# =============================================================================

# Logging
log-dhcp
log-facility=/var/log/dnsmasq-pxe.log

# DHCP Proxy mode — no IP assignment, only PXE boot info
# The subnet must match your LAN. FritzBox handles actual DHCP.
port=0
dhcp-range=10.0.0.0,proxy,255.0.0.0

# Enable TFTP
enable-tftp
tftp-root=/srv/pxe/tftp

# Architecture-specific boot files (detected via DHCP option 93)
# 0x0007 = EFI x86_64 (standard UEFI PC)
# 0x000B = EFI ARM64 (Raspberry Pi with UEFI firmware)
# 0x0000 = BIOS x86 (legacy boot)
dhcp-match=set:efi-x86_64,option:client-arch,7
dhcp-match=set:efi-arm64,option:client-arch,11
dhcp-match=set:bios,option:client-arch,0

dhcp-boot=tag:efi-x86_64,grubnetx64.efi
dhcp-boot=tag:efi-arm64,grubnetaa64.efi
dhcp-boot=tag:bios,pxelinux.0

# Bind only to LAN interface (not tailscale, calico, etc.)
interface=wlp1s0
bind-interfaces
```

**Step 2: Deploy config to PXE server**

```bash
scp k8s/scripts/pxe/dnsmasq.conf patrick@10.10.0.4:/srv/pxe/dnsmasq.conf
```

**Step 3: Create systemd override for dnsmasq to use our config**

```bash
ssh patrick@10.10.0.4 'bash -s' << 'REMOTE'
sudo mkdir -p /etc/systemd/system/dnsmasq.service.d
cat << 'EOF' | sudo tee /etc/systemd/system/dnsmasq.service.d/override.conf
[Service]
ExecStart=
ExecStart=/usr/sbin/dnsmasq -k -C /srv/pxe/dnsmasq.conf
EOF
sudo systemctl daemon-reload
REMOTE
```

**Step 4: Test dnsmasq config (dry run)**

```bash
ssh patrick@10.10.0.4 'sudo dnsmasq --test -C /srv/pxe/dnsmasq.conf'
```

Expected: `dnsmasq: syntax check OK.`

---

## Task 6: Write GRUB and pxelinux boot menus

**Step 1: Create GRUB config (UEFI — amd64 + arm64)**

Write to: `k8s/scripts/pxe/grub.cfg`

```
# GRUB PXE Boot Menu — Ubuntu 24.04 Autoinstall
set timeout=5
set default=0

# Detect architecture
if [ "$grub_cpu" = "x86_64" ]; then
    set arch=amd64
elif [ "$grub_cpu" = "arm64" ]; then
    set arch=arm64
else
    set arch=amd64
fi

menuentry "Install Ubuntu 24.04 (${arch}) — Autoinstall" {
    linux ${arch}/vmlinuz autoinstall ip=dhcp ds=nocloud-net\;s=http://10.10.0.4:8080/autoinstall/ fsck.mode=skip ---
    initrd ${arch}/initrd
}

menuentry "Boot from local disk" {
    exit
}
```

**Step 2: Create pxelinux config (BIOS legacy)**

Write to: `k8s/scripts/pxe/pxelinux-default`

```
DEFAULT install
PROMPT 1
TIMEOUT 50
LABEL install
  MENU LABEL Install Ubuntu 24.04 (amd64) - Autoinstall
  KERNEL amd64/vmlinuz
  INITRD amd64/initrd
  APPEND autoinstall ip=dhcp ds=nocloud-net;s=http://10.10.0.4:8080/autoinstall/ fsck.mode=skip ---
LABEL local
  MENU LABEL Boot from local disk
  LOCALBOOT 0
```

**Step 3: Deploy boot menus**

```bash
scp k8s/scripts/pxe/grub.cfg patrick@10.10.0.4:/srv/pxe/tftp/grub/grub.cfg
scp k8s/scripts/pxe/pxelinux-default patrick@10.10.0.4:/srv/pxe/tftp/pxelinux.cfg/default
```

---

## Task 7: Write the cloud-init autoinstall user-data

This is the core config that provisions the entire OS. Write to: `k8s/scripts/pxe/user-data`

```yaml
#cloud-config
autoinstall:
  version: 1
  locale: en_US.UTF-8
  keyboard:
    layout: us
  refresh-installer:
    update: false

  # ── Storage: Install on first NVMe ──
  storage:
    config:
      - id: nvme-disk
        type: disk
        match:
          path: /dev/nvme*
        ptable: gpt
        wipe: superblock-recursive
        grub_device: false
      - id: efi-part
        type: partition
        device: nvme-disk
        size: 1G
        flag: boot
        grub_device: true
      - id: efi-format
        type: format
        volume: efi-part
        fstype: fat32
      - id: boot-part
        type: partition
        device: nvme-disk
        size: 2G
      - id: boot-format
        type: format
        volume: boot-part
        fstype: ext4
      - id: root-part
        type: partition
        device: nvme-disk
        size: -1
      - id: root-vg
        type: lvm_volgroup
        name: ubuntu-vg
        devices:
          - root-part
      - id: root-lv
        type: lvm_partition
        volgroup: root-vg
        name: ubuntu-lv
        size: -1
      - id: root-format
        type: format
        volume: root-lv
        fstype: ext4
      - id: mount-root
        type: mount
        device: root-format
        path: /
      - id: mount-boot
        type: mount
        device: boot-format
        path: /boot
      - id: mount-efi
        type: mount
        device: efi-format
        path: /boot/efi

  # ── Network: DHCP ──
  network:
    version: 2
    ethernets:
      id0:
        match:
          driver: "!veth"
        dhcp4: true

  # ── User ──
  identity:
    hostname: k3s-node
    username: patrick
    password: "$6$htx9UQ4As7moxMzA$EUEAruo8AGbkV8m1BxpZ8cHFMakb6.vnZGws4ceRiAQz4YeQcciED59WO2vgSct05U3G60LrR/Ejb06QZJvLp."

  # ── SSH ──
  ssh:
    install-server: true
    authorized-keys:
      - "ssh-ed25519 AAAAC3NzIFN75CnuOz7YXaJipTFxWMVDgm35heu64JKN1QL+Z84+ patrick@korczewski.de"
    allow-pw: true

  # ── Packages ──
  packages:
    - cifs-utils
    - open-iscsi
    - nfs-common
    - curl
    - jq
    - git
    - ca-certificates
    - apt-transport-https
    - samba
    - parted
    - gdisk
    - net-tools
    - vim

  # ── Late commands (run in target chroot) ──
  late-commands:
    # --- Passwordless sudo ---
    - echo 'patrick ALL=(ALL) NOPASSWD:ALL' > /target/etc/sudoers.d/patrick
    - chmod 440 /target/etc/sudoers.d/patrick

    # --- Groups ---
    - curtin in-target -- usermod -aG sudo,adm,plugdev,netdev,lxd patrick
    - curtin in-target -- groupadd -f docker
    - curtin in-target -- usermod -aG docker patrick
    - curtin in-target -- groupadd -f sambashare
    - curtin in-target -- usermod -aG sambashare patrick

    # --- Disable swap permanently ---
    - curtin in-target -- swapoff -a || true
    - sed -i '/\sswap\s/d' /target/etc/fstab

    # --- Kernel modules for k3s ---
    - |
      cat > /target/etc/modules-load.d/k3s.conf << 'KMOD'
      overlay
      br_netfilter
      KMOD

    # --- Sysctl for k3s ---
    - |
      cat > /target/etc/sysctl.d/99-k3s.conf << 'SYSCTL'
      net.ipv4.ip_forward = 1
      net.bridge.bridge-nf-call-iptables = 1
      net.bridge.bridge-nf-call-ip6tables = 1
      net.ipv4.conf.all.forwarding = 1
      SYSCTL

    # --- Clone git repository ---
    - curtin in-target -- git clone https://github.com/Paddione/projects.git /home/patrick/projects

    # --- Fetch secrets from PXE server ---
    - curtin in-target -- mkdir -p /home/patrick/projects/k8s/secrets
    - |
      for secret in postgres-secret.yaml auth-secret.yaml l2p-backend-secret.yaml shop-secret.yaml videovault-secret.yaml traefik-secret.yaml registry-secret.yaml ipv64-secret.yaml smb-secret.yaml tls-secret.yaml; do
        curl -sf "http://10.10.0.4:8080/secrets/${secret}" -o "/target/home/patrick/projects/k8s/secrets/${secret}" || true
      done

    # --- Fetch SSH deploy key ---
    - mkdir -p /target/home/patrick/.ssh
    - curl -sf http://10.10.0.4:8080/keys/deploy_key -o /target/home/patrick/.ssh/deploy_key
    - chmod 600 /target/home/patrick/.ssh/deploy_key
    - |
      cat > /target/home/patrick/.ssh/config << 'SSHCFG'
      Host github.com
        IdentityFile ~/.ssh/deploy_key
        IdentitiesOnly yes
      SSHCFG
    - chmod 600 /target/home/patrick/.ssh/config

    # --- Storage: format extra drives + SMB share ---
    - |
      cat > /target/usr/local/bin/storage-setup.sh << 'STORAGE'
      #!/bin/bash
      # Auto-detect non-boot drives, format ext4, share via SMB
      set -euo pipefail

      HOSTNAME=$(hostname)
      BOOT_DISK=$(lsblk -ndo PKNAME $(findmnt -n -o SOURCE /) 2>/dev/null | head -1)
      # Fallback: if LVM, find the PV's parent
      if [ -z "$BOOT_DISK" ]; then
          BOOT_DISK=$(pvs --noheadings -o pv_name 2>/dev/null | head -1 | xargs | sed 's|/dev/||' | sed 's/[0-9]*$//')
      fi
      echo "Boot disk: /dev/${BOOT_DISK}"

      SMB_PASS=$(curl -sf http://10.10.0.4:8080/secrets/smb-password.txt || echo "170591pk")

      # Configure samba global
      cat > /etc/samba/smb.conf << 'SMBCONF'
      [global]
         workgroup = KORCZEWSKI
         server string = %h k3s storage
         security = user
         map to guest = never
         min protocol = SMB3
         logging = systemd
         log level = 1
      SMBCONF

      # Create smbcluster user
      useradd -r -s /usr/sbin/nologin smbcluster 2>/dev/null || true
      echo -e "${SMB_PASS}\n${SMB_PASS}" | smbpasswd -a -s smbcluster

      FOUND=0
      for DEV in $(lsblk -dnpo NAME,TYPE | awk '$2=="disk"{print $1}'); do
          DEV_SHORT=$(basename "$DEV")

          # Skip boot disk
          if [ "$DEV_SHORT" = "$BOOT_DISK" ]; then
              echo "Skipping boot disk: $DEV"
              continue
          fi

          # Skip if currently mounted
          if findmnt -rn -S "$DEV" -S "${DEV}1" -S "${DEV}2" > /dev/null 2>&1; then
              echo "Skipping mounted device: $DEV"
              continue
          fi

          # Skip tiny drives (< 1GB, probably USB boot media)
          SIZE_BYTES=$(lsblk -bdno SIZE "$DEV" 2>/dev/null || echo 0)
          if [ "$SIZE_BYTES" -lt 1073741824 ]; then
              echo "Skipping small device: $DEV ($(numfmt --to=iec $SIZE_BYTES))"
              continue
          fi

          SIZE_HUMAN=$(lsblk -dno SIZE "$DEV" | tr -d ' ')
          SHARE_NAME="${HOSTNAME}-${DEV_SHORT}-${SIZE_HUMAN}"
          MOUNT_POINT="/srv/smb/${SHARE_NAME}"

          echo "Formatting: $DEV -> ${SHARE_NAME}"

          # Wipe and format
          wipefs --all --force "$DEV"
          sgdisk --zap-all "$DEV"
          mkfs.ext4 -F -L "${SHARE_NAME}" "$DEV"

          # Mount
          mkdir -p "$MOUNT_POINT"
          UUID=$(blkid -s UUID -o value "$DEV")
          echo "UUID=${UUID} ${MOUNT_POINT} ext4 defaults,nofail 0 2" >> /etc/fstab
          mount "$MOUNT_POINT"

          # Set permissions
          chown smbcluster:smbcluster "$MOUNT_POINT"
          chmod 775 "$MOUNT_POINT"

          # Add SMB share
          cat >> /etc/samba/smb.conf << SHARE

      [${SHARE_NAME}]
         path = ${MOUNT_POINT}
         browseable = yes
         read only = no
         valid users = smbcluster
         force user = smbcluster
         force group = smbcluster
         create mask = 0664
         directory mask = 0775
      SHARE

          FOUND=$((FOUND + 1))
          echo "Shared: //${HOSTNAME}/${SHARE_NAME}"
      done

      if [ $FOUND -gt 0 ]; then
          systemctl enable smbd nmbd
          systemctl restart smbd nmbd
          echo "SMB: ${FOUND} drive(s) shared"
          testparm -s 2>/dev/null | grep '^\[' || true
      else
          echo "No extra drives found to share"
      fi
      STORAGE
    - chmod +x /target/usr/local/bin/storage-setup.sh

    # --- Systemd service to run storage-setup on first boot ---
    - |
      cat > /target/etc/systemd/system/storage-setup.service << 'SVCUNIT'
      [Unit]
      Description=Auto-format and SMB-share extra drives
      After=network-online.target
      Wants=network-online.target
      ConditionPathExists=!/var/lib/storage-setup-done

      [Service]
      Type=oneshot
      ExecStart=/usr/local/bin/storage-setup.sh
      ExecStartPost=/usr/bin/touch /var/lib/storage-setup-done
      RemainAfterExit=true
      StandardOutput=journal+console

      [Install]
      WantedBy=multi-user.target
      SVCUNIT
    - curtin in-target -- systemctl enable storage-setup.service

    # --- Fix ownership ---
    - curtin in-target -- chown -R patrick:patrick /home/patrick
```

Also write the empty meta-data file. Write to: `k8s/scripts/pxe/meta-data`

```
{}
```

**Step 2: Deploy autoinstall files**

```bash
scp k8s/scripts/pxe/user-data patrick@10.10.0.4:/srv/pxe/http/autoinstall/user-data
scp k8s/scripts/pxe/meta-data patrick@10.10.0.4:/srv/pxe/http/autoinstall/meta-data
```

---

## Task 8: Write nginx configuration

**Step 1: Create nginx config for PXE HTTP server**

Write to: `k8s/scripts/pxe/nginx-pxe.conf`

```nginx
# PXE Boot HTTP Server — serves ISOs, autoinstall config, secrets, keys
# Binds ONLY to LAN interface (10.10.0.4), not 0.0.0.0
server {
    listen 10.10.0.4:8080;
    server_name _;

    # Autoinstall endpoint (cloud-init nocloud-net source)
    location /autoinstall/ {
        alias /srv/pxe/http/autoinstall/;
        autoindex off;
    }

    # Ubuntu ISOs (for casper live installer)
    location /ubuntu/ {
        alias /srv/pxe/http/ubuntu/;
        autoindex on;
    }

    # K8s secrets (LAN-only, no auth)
    location /secrets/ {
        alias /srv/pxe/http/secrets/;
        autoindex on;
    }

    # SSH deploy key
    location /keys/ {
        alias /srv/pxe/http/keys/;
        autoindex off;
    }

    # Health check
    location /health {
        return 200 'PXE server OK\n';
        add_header Content-Type text/plain;
    }

    # Deny everything else
    location / {
        return 404;
    }
}
```

**Step 2: Deploy nginx config**

```bash
scp k8s/scripts/pxe/nginx-pxe.conf patrick@10.10.0.4:/srv/pxe/nginx-pxe.conf
ssh patrick@10.10.0.4 'sudo rm -f /etc/nginx/sites-enabled/default && sudo ln -sf /srv/pxe/nginx-pxe.conf /etc/nginx/sites-enabled/pxe && sudo nginx -t'
```

Expected: `nginx: configuration file /etc/nginx/nginx.conf test is successful`

---

## Task 9: Sync secrets and deploy key to PXE server

**Step 1: Create the sync-secrets script**

Write to: `k8s/scripts/pxe/sync-secrets.sh`

```bash
#!/bin/bash
# Syncs k8s secrets and deploy key to the PXE server.
# Run from dev machine (where secrets are generated).
set -euo pipefail

PXE_HOST="patrick@10.10.0.4"
PXE_SECRETS="/srv/pxe/http/secrets"
PXE_KEYS="/srv/pxe/http/keys"
LOCAL_SECRETS="/home/patrick/projects/k8s/secrets"

echo "=== Syncing secrets to PXE server ==="

# Sync secret YAMLs
rsync -av --delete "${LOCAL_SECRETS}/" "${PXE_HOST}:${PXE_SECRETS}/"

# Write SMB password as a standalone file (used by storage-setup.sh)
SMB_PASS=$(grep SMB_PASSWORD /home/patrick/projects/.env | cut -d= -f2)
echo "${SMB_PASS}" | ssh "${PXE_HOST}" "cat > ${PXE_SECRETS}/smb-password.txt"

echo "=== Syncing deploy key ==="

# Generate deploy key if it doesn't exist locally
if [ ! -f /home/patrick/.ssh/github_deploy_key ]; then
    echo "No deploy key found at ~/.ssh/github_deploy_key"
    echo "Generate one with: ssh-keygen -t ed25519 -f ~/.ssh/github_deploy_key -N '' -C 'deploy@korczewski.de'"
    echo "Then add the public key as a deploy key on GitHub: https://github.com/Paddione/projects/settings/keys"
    exit 1
fi

scp /home/patrick/.ssh/github_deploy_key "${PXE_HOST}:${PXE_KEYS}/deploy_key"
ssh "${PXE_HOST}" "chmod 600 ${PXE_KEYS}/deploy_key"

echo "=== Done ==="
echo "Secrets: $(ssh ${PXE_HOST} ls ${PXE_SECRETS} | wc -l) files"
echo "Deploy key: $(ssh ${PXE_HOST} ls -la ${PXE_KEYS}/deploy_key)"
```

**Step 2: Generate deploy key (if needed)**

```bash
ssh-keygen -t ed25519 -f /home/patrick/.ssh/github_deploy_key -N '' -C 'deploy@korczewski.de'
```

Then add the public key (`~/.ssh/github_deploy_key.pub`) as a **read-only deploy key** at:
`https://github.com/Paddione/projects/settings/keys`

**Step 3: Run sync**

```bash
chmod +x k8s/scripts/pxe/sync-secrets.sh
./k8s/scripts/pxe/sync-secrets.sh
```

---

## Task 10: Create the master setup script

This is the all-in-one script that sets up the PXE server from scratch. Write to: `k8s/scripts/pxe/setup-pxe.sh`

```bash
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
# arm64 GRUB may not be in default repos on amd64 host
apt-get install -y -qq grub-efi-arm64-signed 2>/dev/null || \
    log_warn "grub-efi-arm64-signed not available (install manually for arm64 PXE)"

# Step 2: Create directory structure
log_info "Step 2: Creating directory structure..."
mkdir -p /srv/pxe/tftp/{grub,pxelinux.cfg,amd64,arm64}
mkdir -p /srv/pxe/http/{ubuntu/amd64,ubuntu/arm64,autoinstall,secrets,keys}
mkdir -p /srv/pxe/scripts

# Step 3: Copy bootloader files
log_info "Step 3: Copying bootloader files..."
cp /usr/lib/PXELINUX/pxelinux.0 /srv/pxe/tftp/
cp /usr/lib/syslinux/modules/bios/ldlinux.c32 /srv/pxe/tftp/
cp /usr/lib/syslinux/modules/bios/menu.c32 /srv/pxe/tftp/ 2>/dev/null || true
cp /usr/lib/syslinux/modules/bios/libutil.c32 /srv/pxe/tftp/ 2>/dev/null || true

if [ -f /usr/lib/grub/x86_64-efi-signed/grubnetx64.efi.signed ]; then
    cp /usr/lib/grub/x86_64-efi-signed/grubnetx64.efi.signed /srv/pxe/tftp/grubnetx64.efi
fi
if [ -f /usr/lib/grub/arm64-efi-signed/grubnetaa64.efi.signed ]; then
    cp /usr/lib/grub/arm64-efi-signed/grubnetaa64.efi.signed /srv/pxe/tftp/grubnetaa64.efi
fi

# Step 4: Configure dnsmasq
log_info "Step 4: Configuring dnsmasq..."
systemctl stop dnsmasq 2>/dev/null || true
# Use our custom config via systemd override
mkdir -p /etc/systemd/system/dnsmasq.service.d
cat > /etc/systemd/system/dnsmasq.service.d/override.conf << 'EOF'
[Service]
ExecStart=
ExecStart=/usr/sbin/dnsmasq -k -C /srv/pxe/dnsmasq.conf
EOF
systemctl daemon-reload

# Step 5: Configure nginx
log_info "Step 5: Configuring nginx..."
rm -f /etc/nginx/sites-enabled/default
ln -sf /srv/pxe/nginx-pxe.conf /etc/nginx/sites-enabled/pxe

# Step 6: Enable and start services
log_info "Step 6: Starting services..."
systemctl enable dnsmasq nginx
systemctl restart dnsmasq nginx

# Step 7: Verify
log_info "Step 7: Verifying..."
systemctl is-active dnsmasq && log_info "dnsmasq: running" || log_error "dnsmasq: FAILED"
systemctl is-active nginx && log_info "nginx: running" || log_error "nginx: FAILED"
curl -sf http://10.10.0.4:8080/health && log_info "HTTP health check: OK" || log_error "HTTP health check: FAILED"

echo ""
echo "=========================================="
echo -e "${GREEN}PXE Server Setup Complete${NC}"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Download ISOs:    /srv/pxe/scripts/update-iso.sh"
echo "  2. Sync secrets:     (from dev machine) ./k8s/scripts/pxe/sync-secrets.sh"
echo "  3. Set DHCP reservations on FritzBox for new nodes"
echo "  4. Boot new machine with PXE/network boot enabled"
echo ""
```

---

## Task 11: Start services and verify end-to-end

**Step 1: Copy all config files to PXE server**

```bash
# From dev machine:
scp k8s/scripts/pxe/dnsmasq.conf patrick@10.10.0.4:/srv/pxe/dnsmasq.conf
scp k8s/scripts/pxe/nginx-pxe.conf patrick@10.10.0.4:/srv/pxe/nginx-pxe.conf
scp k8s/scripts/pxe/grub.cfg patrick@10.10.0.4:/srv/pxe/tftp/grub/grub.cfg
scp k8s/scripts/pxe/pxelinux-default patrick@10.10.0.4:/srv/pxe/tftp/pxelinux.cfg/default
scp k8s/scripts/pxe/user-data patrick@10.10.0.4:/srv/pxe/http/autoinstall/user-data
scp k8s/scripts/pxe/meta-data patrick@10.10.0.4:/srv/pxe/http/autoinstall/meta-data
scp k8s/scripts/pxe/setup-pxe.sh patrick@10.10.0.4:/srv/pxe/scripts/setup-pxe.sh
scp k8s/scripts/pxe/update-iso.sh patrick@10.10.0.4:/srv/pxe/scripts/update-iso.sh
scp k8s/scripts/pxe/sync-secrets.sh patrick@10.10.0.4:/srv/pxe/scripts/sync-secrets.sh
```

**Step 2: Run setup on PXE server**

```bash
ssh patrick@10.10.0.4 'sudo chmod +x /srv/pxe/scripts/*.sh && sudo /srv/pxe/scripts/setup-pxe.sh'
```

**Step 3: Download ISOs**

```bash
ssh patrick@10.10.0.4 '/srv/pxe/scripts/update-iso.sh'
```

**Step 4: Sync secrets**

```bash
./k8s/scripts/pxe/sync-secrets.sh
```

**Step 5: Verify all endpoints**

```bash
# Health check
curl -sf http://10.10.0.4:8080/health

# Autoinstall config accessible
curl -sf http://10.10.0.4:8080/autoinstall/user-data | head -5

# Secrets accessible
curl -sf http://10.10.0.4:8080/secrets/ | head

# TFTP bootloader present
ssh patrick@10.10.0.4 'ls -la /srv/pxe/tftp/grubnetx64.efi /srv/pxe/tftp/pxelinux.0'

# dnsmasq listening
ssh patrick@10.10.0.4 'sudo ss -ulnp | grep dnsmasq'
```

---

## Task 12: Commit all PXE scripts to the repository

**Step 1: Add all new files**

```bash
git add k8s/scripts/pxe/
git commit -m "feat(pxe): add multi-arch PXE boot server for automated node provisioning

Includes dnsmasq proxy DHCP, TFTP bootloaders, nginx HTTP server,
Ubuntu 24.04 autoinstall with k3s prerequisites, auto-format extra
drives as SMB shares, deploy key and secrets delivery.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 13: Update CLAUDE.md and memory

**Step 1: Add PXE section to root CLAUDE.md**

Add under `## Common Commands > ### Root-Level Commands`:

```markdown
# PXE Boot Server (on 10.10.0.4)
./k8s/scripts/pxe/sync-secrets.sh     # Push secrets + deploy key to PXE server
ssh patrick@10.10.0.4 '/srv/pxe/scripts/update-iso.sh'   # Update Ubuntu ISOs
ssh patrick@10.10.0.4 'sudo /srv/pxe/scripts/setup-pxe.sh'  # Re-run PXE setup
```

**Step 2: Commit CLAUDE.md update**

```bash
git add CLAUDE.md
git commit -m "docs: add PXE boot server commands to CLAUDE.md

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 14: Test with a real PXE boot

**Step 1: Set DHCP reservation on FritzBox**

In FritzBox admin (fritz.box):
1. Heimnetz → Netzwerk
2. Find the new device (or add manually by MAC)
3. Set "Immer die gleiche IPv4-Adresse zuweisen" → assign desired IP (e.g., 10.0.3.4)

**Step 2: Boot the machine**

1. Enter BIOS/UEFI setup
2. Set boot order: Network Boot first (or one-time boot from network)
3. Save and restart
4. Watch the GRUB menu appear (5 second timeout)
5. Autoinstall runs (~5-15 minutes depending on hardware)
6. Machine reboots into Ubuntu

**Step 3: Verify provisioning**

```bash
NEW_NODE=10.0.3.4  # adjust to actual IP

# SSH access
ssh patrick@${NEW_NODE} 'hostname && whoami'

# Passwordless sudo
ssh patrick@${NEW_NODE} 'sudo whoami'

# k3s prerequisites
ssh patrick@${NEW_NODE} 'cat /proc/sys/net/ipv4/ip_forward && swapon --show && lsmod | grep br_netfilter'

# Git repo
ssh patrick@${NEW_NODE} 'ls ~/projects/k8s/secrets/*.yaml | wc -l'

# SMB shares (if extra drives present)
ssh patrick@${NEW_NODE} 'smbclient -L localhost -U smbcluster%170591pk 2>/dev/null | grep Disk || echo "no shares (no extra drives)"'
```

Expected: All checks pass, node is ready for `bootstrap-cluster.sh`.
