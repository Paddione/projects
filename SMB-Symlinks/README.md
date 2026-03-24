# SMB Symlinks

Named symlinks to SMB-mounted network shares. Each symlink points to a mount under `/mnt/smb/`.

## Shares

| Symlink | Target | Usage |
|---------|--------|-------|
| `storage-pve3a` | `/mnt/smb/storage-pve3a` | Obsidian vault, Arena audio assets |
| `storage-pve3b` | `/mnt/smb/storage-pve3b` | Secondary Proxmox storage |
| `storage-desktop` | `/mnt/smb/storage-desktop` | Desktop storage |
| `SDD-Share` | `/mnt/smb/SDD-Share` | VideoVault media (movies inbox) |

## Key Paths

- **Obsidian vault**: `SMB-Symlinks/storage-pve3a/Obsidian/`
- **VideoVault inbox**: `SMB-Symlinks/SDD-Share/movies/1_inbox/`

## Prerequisites

Ensure SMB shares are mounted before accessing. Shares are mounted via `/etc/fstab` or `mount.cifs` to `/mnt/smb/`.

Referenced by:
- SMB-CSI storage class (`k8s/infrastructure/smb-csi/storageclass.yaml`)
- VideoVault thumbnail watcher (`VideoVault/scripts/live-thumbnail-watch.sh`)
