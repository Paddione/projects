#!/bin/bash
# =============================================================================
# Migrate SMB Storage: 10.10.0.3/SMB-Share → 10.0.0.11/storage-pve3b
# =============================================================================
# Moves all dynamically-provisioned PVC data from the old NAS to NVMe on pve3b.
#
# What it does:
#   Phase 1: Scale down all consumers (postgres, registry, videovault)
#   Phase 2: Mount both shares and rsync data
#   Phase 3: Delete old PVCs + PVs, re-apply manifests (new PVs provisioned)
#   Phase 4: Move data into newly-provisioned PV directories
#   Phase 5: Scale back up and verify
#
# Prerequisites:
#   - cifs-utils installed (for mounting SMB shares)
#   - kubectl configured with cluster access
#   - SMB credentials available (same for both shares)
#   - Sufficient space on storage-pve3b for all data
#
# PVCs being migrated:
#   PVC                          PV (old dir on SMB-Share)                  Data
#   ─────────────────────────    ─────────────────────────────────────────  ──────────
#   postgres-data-postgres-0     pvc-40aeff28-125e-4a6a-9749-9de27b34b65b  All DBs
#   registry-data                pvc-7988de13-60b8-4282-9a06-fbb518ad36ef  Docker images
#   videovault-media             pvc-98abfa45-f3ac-408a-a760-bd77372fc05e  Inbox/Processed
#   videovault-thumbnails        pvc-b0b9c68c-31a3-4b6b-a304-c8fd6da04790  Thumbnails
#
# Storage path map (after migration):
#   Consumer              Share                     Path
#   ────────────────────  ────────────────────────  ──────────────────
#   PostgreSQL            //10.0.0.11/storage-pve3b  /pvc-<new-uuid>/
#   Docker Registry       //10.0.0.11/storage-pve3b  /pvc-<new-uuid>/
#   VideoVault media      //10.0.0.11/storage-pve3b  /pvc-<new-uuid>/
#   VideoVault thumbs     //10.0.0.11/storage-pve3b  /pvc-<new-uuid>/
#   VideoVault audiobooks //10.0.0.11/storage-pve3b  /audiobooks/
#   VideoVault ebooks     //10.0.0.11/storage-pve3b  /ebooks/
#   VideoVault movies     //10.0.0.11/SDD-Share      /movies/
#   VideoVault hdd-ext    //10.0.0.11/SDD-Share      /
#   Cleanup CronJob       //10.0.0.11/storage-pve3b  / (root)
#
# Usage:
#   sudo ./migrate-smb-storage.sh              # Full migration (interactive)
#   sudo ./migrate-smb-storage.sh --dry-run    # Show what would happen
#   sudo ./migrate-smb-storage.sh --phase N    # Run only phase N (1-5)
#
# IMPORTANT: Run this script from a machine that can reach both shares AND
#            has kubectl access to the cluster (e.g., a control plane node).
# =============================================================================

set -euo pipefail

# ─── Configuration ──────────────────────────────────────────────────────────

OLD_SERVER="10.10.0.3"
OLD_SHARE="SMB-Share"
NEW_SERVER="10.0.0.11"
NEW_SHARE="storage-pve3b"

OLD_MOUNT="/tmp/migrate-smb-old"
NEW_MOUNT="/tmp/migrate-smb-new"

# Credentials (read from environment or prompt)
SMB_USER="${SMB_USER:-}"
SMB_PASS="${SMB_PASS:-}"

# Old PV names (data directories on old share)
declare -A OLD_PVS=(
    ["postgres-data-postgres-0"]="pvc-40aeff28-125e-4a6a-9749-9de27b34b65b"
    ["registry-data"]="pvc-7988de13-60b8-4282-9a06-fbb518ad36ef"
    ["videovault-media"]="pvc-98abfa45-f3ac-408a-a760-bd77372fc05e"
    ["videovault-thumbnails"]="pvc-b0b9c68c-31a3-4b6b-a304-c8fd6da04790"
)

# PVC → namespace mapping
declare -A PVC_NS=(
    ["postgres-data-postgres-0"]="korczewski-infra"
    ["registry-data"]="korczewski-infra"
    ["videovault-media"]="korczewski-services"
    ["videovault-thumbnails"]="korczewski-services"
)

# ─── Colors & Helpers ───────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_phase() { echo -e "\n${BLUE}══════════════════════════════════════════${NC}"; echo -e "${BLUE}  $1${NC}"; echo -e "${BLUE}══════════════════════════════════════════${NC}"; }

DRY_RUN=false
PHASE_ONLY=""

for arg in "$@"; do
    case $arg in
        --dry-run)  DRY_RUN=true ;;
        --phase)    shift; PHASE_ONLY="${2:-}" ;;
        [1-5])      PHASE_ONLY="$arg" ;;
    esac
done

confirm() {
    if [ "$DRY_RUN" = true ]; then
        log_warn "DRY RUN — would execute: $1"
        return 1
    fi
    echo -en "${YELLOW}>>> $1 [y/N] ${NC}"
    read -r answer
    [[ "$answer" =~ ^[Yy]$ ]]
}

run_phase() {
    [ -z "$PHASE_ONLY" ] || [ "$PHASE_ONLY" = "$1" ]
}

# ─── Preflight ──────────────────────────────────────────────────────────────

if [ "$EUID" -ne 0 ]; then
    log_error "This script must be run as root (sudo) for SMB mounts"
    exit 1
fi

# Preserve kubeconfig when running under sudo
if [ -z "${KUBECONFIG:-}" ]; then
    SUDO_USER_HOME=$(eval echo "~${SUDO_USER:-root}")
    if [ -f "$SUDO_USER_HOME/.kube/config" ]; then
        export KUBECONFIG="$SUDO_USER_HOME/.kube/config"
        log_info "Using kubeconfig: $KUBECONFIG"
    fi
fi

if ! command -v kubectl &>/dev/null; then
    log_error "kubectl not found"
    exit 1
fi

if [ -z "$SMB_USER" ]; then
    echo -n "SMB username: "
    read -r SMB_USER
fi
if [ -z "$SMB_PASS" ]; then
    echo -n "SMB password: "
    read -rs SMB_PASS
    echo
fi

CREDS_FILE=$(mktemp)
chmod 600 "$CREDS_FILE"
cat > "$CREDS_FILE" <<EOF
username=${SMB_USER}
password=${SMB_PASS}
EOF
trap 'rm -f "$CREDS_FILE"; umount "$OLD_MOUNT" 2>/dev/null; umount "$NEW_MOUNT" 2>/dev/null; rmdir "$OLD_MOUNT" "$NEW_MOUNT" 2>/dev/null' EXIT

# ═══════════════════════════════════════════════════════════════════════════
# PHASE 1: Scale down consumers
# ═══════════════════════════════════════════════════════════════════════════

if run_phase 1; then
    log_phase "Phase 1/5: Scale down consumers"

    log_info "Current state:"
    kubectl get pods -n korczewski-infra -l 'app in (postgres,registry)' --no-headers 2>/dev/null || true
    kubectl get pods -n korczewski-services -l app=videovault --no-headers 2>/dev/null || true
    echo ""

    if confirm "Scale down postgres, registry, and videovault?"; then
        log_info "Scaling down videovault..."
        kubectl scale deployment/videovault -n korczewski-services --replicas=0

        log_info "Scaling down registry..."
        kubectl scale deployment/registry -n korczewski-infra --replicas=0 2>/dev/null || log_warn "Registry deployment not found (may be named differently)"

        log_info "Scaling down postgres..."
        kubectl scale statefulset/postgres -n korczewski-infra --replicas=0

        log_info "Waiting for pods to terminate..."
        kubectl wait --for=delete pod -l app=videovault -n korczewski-services --timeout=120s 2>/dev/null || true
        kubectl wait --for=delete pod -l app=registry -n korczewski-infra --timeout=120s 2>/dev/null || true
        kubectl wait --for=delete pod -l app=postgres -n korczewski-infra --timeout=120s 2>/dev/null || true

        log_info "All consumers stopped"
        kubectl get pods -n korczewski-infra --no-headers 2>/dev/null || true
        kubectl get pods -n korczewski-services --no-headers 2>/dev/null || true
    fi
fi

# ═══════════════════════════════════════════════════════════════════════════
# PHASE 2: Mount shares and copy data
# ═══════════════════════════════════════════════════════════════════════════

if run_phase 2; then
    log_phase "Phase 2/5: Mount shares and copy data"

    mkdir -p "$OLD_MOUNT" "$NEW_MOUNT"

    log_info "Mounting old share: //${OLD_SERVER}/${OLD_SHARE}"
    mount -t cifs "//${OLD_SERVER}/${OLD_SHARE}" "$OLD_MOUNT" \
        -o "credentials=${CREDS_FILE},dir_mode=0755,file_mode=0644,noperm,noserverino"

    log_info "Mounting new share: //${NEW_SERVER}/${NEW_SHARE}"
    mount -t cifs "//${NEW_SERVER}/${NEW_SHARE}" "$NEW_MOUNT" \
        -o "credentials=${CREDS_FILE},dir_mode=0755,file_mode=0644,noperm,noserverino"

    echo ""
    log_info "Old share contents (pvc-* directories):"
    du -sh "$OLD_MOUNT"/pvc-* 2>/dev/null || log_warn "No pvc-* directories found"
    echo ""

    for pvc_name in "${!OLD_PVS[@]}"; do
        old_dir="${OLD_PVS[$pvc_name]}"
        src="$OLD_MOUNT/$old_dir"

        if [ ! -d "$src" ]; then
            log_warn "Source not found: $src (PVC: $pvc_name) — skipping"
            continue
        fi

        size=$(du -sh "$src" 2>/dev/null | cut -f1)
        log_info "Copying $pvc_name ($size): $old_dir → new share"

        if [ "$DRY_RUN" = false ]; then
            rsync -a --info=progress2 "$src/" "$NEW_MOUNT/$old_dir/"
            log_info "Verifying $pvc_name..."
            OLD_COUNT=$(find "$src" -type f | wc -l)
            NEW_COUNT=$(find "$NEW_MOUNT/$old_dir" -type f | wc -l)
            if [ "$OLD_COUNT" -eq "$NEW_COUNT" ]; then
                log_info "  ✓ File count matches: $OLD_COUNT files"
            else
                log_error "  ✗ File count mismatch! old=$OLD_COUNT new=$NEW_COUNT"
                exit 1
            fi
        else
            log_warn "DRY RUN — would rsync $src/ → $NEW_MOUNT/$old_dir/"
        fi
    done

    log_info "Data copy complete"

    umount "$OLD_MOUNT"
    umount "$NEW_MOUNT"
    log_info "Shares unmounted"
fi

# ═══════════════════════════════════════════════════════════════════════════
# PHASE 3: Delete old PVCs + PVs, re-apply manifests
# ═══════════════════════════════════════════════════════════════════════════

if run_phase 3; then
    log_phase "Phase 3/5: Delete old PVCs + PVs, re-provision on new share"

    log_info "Current PV → PVC bindings:"
    for pvc_name in "${!OLD_PVS[@]}"; do
        pv_name="${OLD_PVS[$pvc_name]}"
        ns="${PVC_NS[$pvc_name]}"
        echo "  $pv_name → $ns/$pvc_name"
    done
    echo ""

    if confirm "Delete all 4 PVCs and their PVs? (reclaimPolicy=Retain — old data stays)"; then
        # Delete PVCs first (releases the PV binding)
        for pvc_name in "${!OLD_PVS[@]}"; do
            ns="${PVC_NS[$pvc_name]}"
            log_info "Deleting PVC $pvc_name in $ns..."
            kubectl delete pvc "$pvc_name" -n "$ns" --wait=false
        done

        # Delete PVs (data stays on old share due to Retain policy)
        for pvc_name in "${!OLD_PVS[@]}"; do
            pv_name="${OLD_PVS[$pvc_name]}"
            log_info "Deleting PV $pv_name..."
            kubectl delete pv "$pv_name" --wait=false
        done

        log_info "Waiting for deletions..."
        sleep 5

        # Re-apply manifests to create new PVCs
        SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        K8S_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

        log_info "Re-applying VideoVault PVC manifests..."
        kubectl apply -f "$K8S_DIR/services/videovault/pvc.yaml"

        log_info "Re-applying registry PVC..."
        kubectl apply -f "$K8S_DIR/infrastructure/registry/pvc.yaml"

        # PostgreSQL PVC is part of the StatefulSet volumeClaimTemplate
        # It gets re-created when we scale back up. Force it now:
        log_info "Re-creating postgres PVC..."
        kubectl apply -f - <<EOFPVC
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-data-postgres-0
  namespace: korczewski-infra
  labels:
    app: postgres
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: smb-storage
  resources:
    requests:
      storage: 20Gi
EOFPVC

        log_info "Waiting for new PVCs to bind..."
        for pvc_name in "${!OLD_PVS[@]}"; do
            ns="${PVC_NS[$pvc_name]}"
            kubectl wait --for=jsonpath='{.status.phase}'=Bound "pvc/$pvc_name" \
                -n "$ns" --timeout=120s 2>/dev/null || \
                log_warn "PVC $pvc_name not bound yet"
        done

        # Discover new PV names
        log_info "New PV bindings:"
        for pvc_name in "${!OLD_PVS[@]}"; do
            ns="${PVC_NS[$pvc_name]}"
            new_pv=$(kubectl get pvc "$pvc_name" -n "$ns" -o jsonpath='{.spec.volumeName}' 2>/dev/null || echo "PENDING")
            echo "  $pvc_name → $new_pv"
        done
    fi
fi

# ═══════════════════════════════════════════════════════════════════════════
# PHASE 4: Move data into new PV directories
# ═══════════════════════════════════════════════════════════════════════════

if run_phase 4; then
    log_phase "Phase 4/5: Move data into new PV directories"

    mkdir -p "$NEW_MOUNT"

    log_info "Mounting new share: //${NEW_SERVER}/${NEW_SHARE}"
    mount -t cifs "//${NEW_SERVER}/${NEW_SHARE}" "$NEW_MOUNT" \
        -o "credentials=${CREDS_FILE},dir_mode=0755,file_mode=0644,noperm,noserverino"

    for pvc_name in "${!OLD_PVS[@]}"; do
        ns="${PVC_NS[$pvc_name]}"
        old_dir="${OLD_PVS[$pvc_name]}"

        # Get the new PV name (= new directory name on the share)
        new_pv=$(kubectl get pvc "$pvc_name" -n "$ns" -o jsonpath='{.spec.volumeName}' 2>/dev/null || echo "")

        if [ -z "$new_pv" ]; then
            log_warn "Cannot find new PV for $pvc_name — skipping"
            continue
        fi

        old_data_dir="$NEW_MOUNT/$old_dir"
        new_data_dir="$NEW_MOUNT/$new_pv"

        if [ ! -d "$old_data_dir" ]; then
            log_warn "Old data dir not found on new share: $old_dir — was it copied in phase 2?"
            continue
        fi

        if [ "$old_dir" = "$new_pv" ]; then
            log_info "$pvc_name: PV name unchanged ($old_dir) — no move needed"
            continue
        fi

        size=$(du -sh "$old_data_dir" 2>/dev/null | cut -f1)
        log_info "$pvc_name ($size): moving $old_dir → $new_pv"

        if [ "$DRY_RUN" = false ]; then
            # New PV dir was auto-created by CSI but is empty
            # Move old data into it (preserve the new dir in case CSI set permissions)
            rsync -a "$old_data_dir/" "$new_data_dir/"
            rm -rf "$old_data_dir"
            log_info "  ✓ Done"
        else
            log_warn "DRY RUN — would move $old_data_dir/ → $new_data_dir/"
        fi
    done

    umount "$NEW_MOUNT"
    log_info "Share unmounted"
fi

# ═══════════════════════════════════════════════════════════════════════════
# PHASE 5: Scale back up and verify
# ═══════════════════════════════════════════════════════════════════════════

if run_phase 5; then
    log_phase "Phase 5/5: Scale up and verify"

    if confirm "Scale up postgres, registry, and videovault?"; then
        log_info "Scaling up postgres..."
        kubectl scale statefulset/postgres -n korczewski-infra --replicas=1

        log_info "Waiting for postgres..."
        kubectl rollout status statefulset/postgres -n korczewski-infra --timeout=180s

        # Quick postgres health check
        PG_POD=$(kubectl get pods -n korczewski-infra -l app=postgres -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
        if [ -n "$PG_POD" ]; then
            log_info "Checking postgres databases..."
            kubectl exec "$PG_POD" -n korczewski-infra -- \
                psql -U postgres -c "SELECT datname FROM pg_database WHERE datistemplate = false;" 2>/dev/null || \
                log_warn "Could not query postgres (may still be starting)"
        fi

        log_info "Scaling up registry..."
        kubectl scale deployment/registry -n korczewski-infra --replicas=1 2>/dev/null || log_warn "Registry deployment not found"

        log_info "Scaling up videovault..."
        kubectl scale deployment/videovault -n korczewski-services --replicas=1

        log_info "Waiting for videovault..."
        kubectl rollout status deployment/videovault -n korczewski-services --timeout=180s 2>/dev/null || \
            log_warn "VideoVault rollout timeout (check pods)"

        echo ""
        log_info "Final status:"
        echo ""
        echo "PVCs:"
        kubectl get pvc -n korczewski-infra --no-headers
        kubectl get pvc -n korczewski-services --no-headers
        echo ""
        echo "Pods:"
        kubectl get pods -n korczewski-infra --no-headers
        kubectl get pods -n korczewski-services --no-headers
        echo ""

        log_info "Migration complete!"
        echo ""
        echo "Verify manually:"
        echo "  1. PostgreSQL: kubectl exec into postgres pod, check all databases exist"
        echo "  2. Registry:   docker pull registry.korczewski.de/korczewski/l2p-backend:latest"
        echo "  3. VideoVault: open https://videovault.korczewski.de, check media loads"
        echo ""
        echo "Old data remains on //${OLD_SERVER}/${OLD_SHARE} (Retain policy)."
        echo "Once verified, you can safely delete the pvc-* dirs from the old share."
    fi
fi
