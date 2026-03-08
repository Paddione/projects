# PXE Boot Server Design — Multi-Arch Cluster Node Provisioning

**Date**: 2026-03-08
**Status**: Approved

## Problem

Provisioning new k3s cluster nodes requires manual OS installation, user creation, SSH setup, package installation, and kernel configuration before `bootstrap-cluster.sh` can run. This takes 30-60 minutes of manual work per node and is error-prone.

## Solution

A PXE boot server on `10.10.0.4` (ubuntu-laptop, Ubuntu 24.04) that network-boots new machines on the LAN, auto-installs Ubuntu 24.04 with full cluster prerequisites, formats extra drives as SMB shares, and produces "cluster-ready" nodes that `bootstrap-cluster.sh` can SSH into immediately.

## Architecture

```
New Machine (PXE boot)
    |
    +--DHCP--> FritzBox (assigns IP, gateway, DNS)
    +--DHCP--> dnsmasq proxy on 10.10.0.4 (provides boot filename + TFTP server)
    |
    +--TFTP--> 10.10.0.4 (serves GRUB/pxelinux bootloader, kernel, initrd)
    |           +-- amd64: grubnetx64.efi / pxelinux.0
    |           +-- arm64: grubnetaa64.efi (Raspberry Pi UEFI)
    |
    +--HTTP--> 10.10.0.4:8080 (serves autoinstall config + Ubuntu ISO)
    |           +-- /ubuntu/amd64/   (Ubuntu 24.04 live server ISO)
    |           +-- /ubuntu/arm64/   (Ubuntu 24.04 arm64 ISO)
    |           +-- /autoinstall/    (cloud-init user-data, meta-data)
    |           +-- /secrets/        (k8s secret YAMLs, LAN-only)
    |           +-- /keys/           (SSH deploy key for git)
    |
    +--Result: Ubuntu 24.04 node with:
              - User: patrick (pw: 170591pk, crypt hash in config)
              - SSH ed25519 key authorized
              - Passwordless sudo
              - All k3s prerequisites (swap off, kernel modules, sysctl, packages)
              - Git repo cloned to /home/patrick/projects
              - K8s secrets in /home/patrick/projects/k8s/secrets/
              - Extra drives formatted (ext4) and shared via SMB
              - Does NOT auto-join k3s (bootstrap-cluster.sh handles that)
```

## Components on 10.10.0.4

| Component | Purpose | Config |
|-----------|---------|--------|
| **dnsmasq** (proxy mode) | DHCP proxy — PXE boot options only, no IP assignment | `--dhcp-range=10.10.0.0,proxy` |
| **dnsmasq** (TFTP) | Serves bootloaders, kernels, initrds | Built-in TFTP in dnsmasq |
| **nginx** (port 8080) | HTTP server for ISOs, autoinstall configs, secrets, keys | Binds to 10.10.0.4 only |
| **systemd services** | dnsmasq + nginx as systemd units | Auto-start on boot |

## Architecture Detection

dnsmasq detects client architecture via DHCP option 93:

| Client Arch ID | Architecture | Boot File |
|----------------|-------------|-----------|
| `0x0007` (EFI x86_64) | amd64 | `grubnetx64.efi` |
| `0x000B` (EFI ARM64) | arm64 | `grubnetaa64.efi` |
| `0x0000` (BIOS x86) | amd64 legacy | `pxelinux.0` |

## Autoinstall Provisioning Steps

The Ubuntu autoinstall `user-data` executes:

### Phase 1: OS Installation
1. Locale: en_US.UTF-8, US keyboard
2. Storage: Install on first NVMe (`/dev/nvme0n1`), LVM, ext4
3. Network: DHCP (FritzBox assigns via reservation)

### Phase 2: User & Security
4. Create user: `patrick`, password: `170591pk` (stored as crypt hash)
5. Add to groups: sudo, adm, docker, plugdev, netdev, lxd, sambashare
6. Passwordless sudo: `/etc/sudoers.d/patrick` with `patrick ALL=(ALL) NOPASSWD:ALL`
7. SSH: authorize `ssh-ed25519 AAAAC3NzIFN75CnuOz7YXaJipTFxWMVDgm35heu64JKN1QL+Z84+ patrick@korczewski.de`
8. Enable sshd

### Phase 3: K3s Prerequisites
9. Install packages: cifs-utils, open-iscsi, nfs-common, curl, jq, git, ca-certificates, samba
10. Disable swap permanently (swapoff + remove from fstab)
11. Kernel modules: overlay, br_netfilter (persistent via /etc/modules-load.d/)
12. Sysctl: net.ipv4.ip_forward=1, net.bridge.bridge-nf-call-iptables=1, net.bridge.bridge-nf-call-ip6tables=1
13. UFW rules (if active): 6443, 2379-2380, 10250, 8472/udp, 51820/udp, 30000-32767, 445/tcp (SMB)

### Phase 4: Repository & Secrets (late-commands)
14. `git clone https://github.com/Paddione/projects.git /home/patrick/projects`
15. Fetch secrets: `http://10.10.0.4:8080/secrets/` -> `/home/patrick/projects/k8s/secrets/`
16. Fetch deploy key: `http://10.10.0.4:8080/keys/deploy_key` -> `/home/patrick/.ssh/deploy_key`
17. Configure `~/.ssh/config` to use deploy key for github.com
18. `chown -R patrick:patrick /home/patrick`

### Phase 5: Storage Auto-Discovery & SMB Sharing
19. Identify boot disk (the NVMe holding `/`)
20. Enumerate all other block devices (exclude loop, ram, rom, boot disk)
21. For each non-boot drive:
    a. `wipefs --all` + `sgdisk --zap-all` (full wipe)
    b. `mkfs.ext4 -L <hostname>-<device>-<size>` (e.g., `cp4-sda-2T`)
    c. `mkdir -p /srv/smb/<share-name>`
    d. Add UUID-based mount to `/etc/fstab`
    e. Append SMB share block to `/etc/samba/smb.conf`
22. Create `smbcluster` system user with password matching `SMB_PASSWORD` from `.env`
23. Enable + start `smbd`, `nmbd`

### Phase 6: Reboot
24. System reboots into installed Ubuntu on local NVMe
25. Node is cluster-ready for `bootstrap-cluster.sh`

## Storage Design

### Drive Classification

```
Boot disk:    First NVMe on PCI bus (/dev/nvme0n1)  -> OS (LVM, ext4)
All others:   SATA, USB, additional NVMe            -> Format + SMB share
```

### Naming Convention

```
Share name:   <hostname>-<device>-<size>
Mount point:  /srv/smb/<share-name>

Examples (hostname: cp4):
  /dev/sda  (2TB SATA)    -> cp4-sda-2T     at /srv/smb/cp4-sda-2T
  /dev/sdb  (1TB USB)     -> cp4-sdb-1T     at /srv/smb/cp4-sdb-1T
  /dev/nvme1n1 (1TB NVMe) -> cp4-nvme1n1-1T at /srv/smb/cp4-nvme1n1-1T
```

### SMB Configuration

```ini
[global]
   workgroup = KORCZEWSKI
   server string = %h k3s storage
   security = user
   map to guest = never
   min protocol = SMB3

# Per-drive share block (appended dynamically):
[cp4-sda-2T]
   path = /srv/smb/cp4-sda-2T
   browseable = yes
   read only = no
   valid users = smbcluster
   force user = smbcluster
   force group = smbcluster
   create mask = 0664
   directory mask = 0775
```

### SMB Credentials

- System user: `smbcluster` (nologin shell)
- Password: matches `SMB_PASSWORD` from root `.env` (served via PXE HTTP)
- Same credentials on every node for cluster-wide mount access

### Kubernetes Integration

Shares are consumable via the existing SMB-CSI driver:

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: cp4-sda-2T
spec:
  capacity:
    storage: 2Ti
  accessModes: [ReadWriteMany]
  storageClassName: smb-storage
  csi:
    driver: smb.csi.k8s.io
    volumeAttributes:
      source: //10.0.3.4/cp4-sda-2T
    nodeStageSecretRef:
      name: smbcreds
      namespace: korczewski-infra
```

## Raspberry Pi Specifics

- Pi EEPROM must have `BOOT_ORDER=0xf21` (one-time setup via `rpi-eeprom-config`)
- dnsmasq detects ARM64 UEFI (option 93: 0x000B) and serves `grubnetaa64.efi`
- Same autoinstall `user-data` (architecture-agnostic provisioning)
- arm64 Ubuntu 24.04 server ISO served separately

## File Layout on 10.10.0.4

```
/srv/pxe/
+-- dnsmasq.conf                     # Proxy DHCP + TFTP config
+-- tftp/
|   +-- grubnetx64.efi               # amd64 UEFI bootloader
|   +-- grubnetaa64.efi              # arm64 UEFI bootloader
|   +-- pxelinux.0                   # amd64 BIOS bootloader
|   +-- ldlinux.c32                  # syslinux support files
|   +-- grub/
|   |   +-- grub.cfg                 # GRUB menu -> autoinstall
|   +-- pxelinux.cfg/
|   |   +-- default                  # BIOS PXE menu
|   +-- amd64/
|   |   +-- vmlinuz                  # amd64 kernel
|   |   +-- initrd                   # amd64 initrd
|   +-- arm64/
|       +-- vmlinuz                  # arm64 kernel
|       +-- initrd                   # arm64 initrd
+-- http/
|   +-- ubuntu/
|   |   +-- amd64/
|   |   |   +-- ubuntu-24.04-live-server-amd64.iso
|   |   +-- arm64/
|   |       +-- ubuntu-24.04-live-server-arm64.iso
|   +-- autoinstall/
|   |   +-- user-data               # Cloud-init autoinstall config
|   |   +-- meta-data               # Empty (required by cloud-init)
|   +-- secrets/                     # Synced from k8s/secrets/
|   |   +-- postgres-secret.yaml
|   |   +-- auth-secret.yaml
|   |   +-- l2p-backend-secret.yaml
|   |   +-- shop-secret.yaml
|   |   +-- videovault-secret.yaml
|   |   +-- traefik-secret.yaml
|   |   +-- registry-secret.yaml
|   |   +-- ipv64-secret.yaml
|   |   +-- smb-secret.yaml
|   |   +-- tls-secret.yaml
|   +-- keys/
|       +-- deploy_key              # Read-only SSH deploy key
+-- scripts/
    +-- setup-pxe.sh                # Main setup script (run once on 10.10.0.4)
    +-- sync-secrets.sh             # Push secrets from dev machine to PXE server
    +-- update-iso.sh               # Download latest Ubuntu ISOs
    +-- storage-setup.sh            # Drive detection + SMB setup (embedded in autoinstall)
```

## Security

- nginx binds to `10.10.0.4:8080` only (LAN interface, not 0.0.0.0)
- Secrets endpoint: no auth (LAN-trusted network)
- Deploy key: read-only scope on GitHub repo
- Password stored as SHA-512 crypt hash in autoinstall, not plaintext
- SMB uses SMB3 minimum protocol, no guest access
- UFW rules opened only for necessary ports

## Integration with Existing Bootstrap

```
Before (manual):                      After (PXE):
1. Install Ubuntu             -->  Automated via PXE
2. Create user                -->  Automated via cloud-init
3. Configure SSH              -->  Automated via cloud-init
4. Set static IP              -->  FritzBox DHCP reservation
5. Run node-prerequisites.sh  -->  Automated via cloud-init
6. Clone repo                 -->  Automated via cloud-init
7. Copy secrets               -->  Automated via HTTP fetch
8. Format extra drives        -->  Automated via storage-setup
9. Share drives via SMB       -->  Automated via storage-setup
---------------------------------------------------------
10. bootstrap-cluster.sh      -->  Same as today (SSH-based k3s join)
```

## Operational Scripts

### sync-secrets.sh (run from dev machine)
Pushes current k8s/secrets/ to the PXE server:
```bash
rsync -av /home/patrick/projects/k8s/secrets/ patrick@10.10.0.4:/srv/pxe/http/secrets/
```

### update-iso.sh (run on PXE server)
Downloads latest Ubuntu 24.04 server ISOs for both architectures.

### setup-pxe.sh (run once on 10.10.0.4)
Installs dnsmasq + nginx, downloads ISOs, extracts kernel/initrd, writes configs,
enables systemd services. Idempotent — safe to re-run.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| DHCP | FritzBox stays, dnsmasq proxy | No network disruption |
| PXE host | 10.10.0.4 (dedicated) | No chicken-and-egg with k3s |
| Architectures | amd64 + arm64 | Full fleet coverage |
| Node role | Manual via bootstrap-cluster.sh | Clean separation of concerns |
| Secrets delivery | HTTP from PXE server | Updatable without image rebuild |
| Git auth | SSH deploy key from PXE server | Minimal privilege, revocable |
| OS disk | First NVMe (PCIe) | Fastest available storage |
| Extra drives | Format ext4 + SMB share | Distributed storage mesh |
| SMB credentials | Match existing SMB_PASSWORD | Consistent with cluster config |
| Filesystem | ext4 | Reliable, well-supported |
| SMB naming | hostname-device-size | No collisions across nodes |
