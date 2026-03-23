#!/usr/bin/env bash
# sync-dr-secrets.sh — Sync disaster recovery files to control plane nodes
# Purpose: If this dev machine dies, any CP node can immediately build + deploy
#
# Usage: ./sync-dr-secrets.sh [node...]
#   No args = sync to all 3 CP nodes
#   Args    = sync to specified nodes only
#
# What gets synced:
#   1. SSH deploy key (for git clone/pull via SSH)
#   2. Git repository (clone or pull latest master)
#   3. Root .env (master secrets — generate-secrets.sh reads this)
#   4. k8s/secrets/*.yaml (pre-generated k8s secret manifests)
#   5. Vault unseal secret
#   6. Docker directory (~/.docker/)
#   7. Kubeconfig (~/.kube/config)
#   8. Claude directory (~/.claude/)
#   9. Claude config (~/.claude.json)
#  10. Config directory (~/.config/)
#  11. Samba setup script (~/setup_samba_root.sh)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Control plane nodes
ALL_NODES=("k3s-1" "k3s-2" "k3s-3" "10.10.0.4")
NODES=("${@:-${ALL_NODES[@]}}")
REMOTE_USER="patrick"
REMOTE_PROJECT_DIR="/home/patrick/projects"
REMOTE_SECRETS_DIR="$REMOTE_PROJECT_DIR/k8s/secrets"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[DR-SYNC]${NC} $*"; }
warn() { echo -e "${YELLOW}[DR-SYNC]${NC} $*"; }
err()  { echo -e "${RED}[DR-SYNC]${NC} $*" >&2; }

# SSH options — same as bootstrap-cluster.sh
SSH_OPTS=(-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10 -o LogLevel=ERROR)
ssh() { command ssh "${SSH_OPTS[@]}" "$@"; }
scp() { command scp "${SSH_OPTS[@]}" "$@"; }

# Verify local files exist before syncing
verify_local_files() {
    local missing=0

    log "Verifying local files..."

    [[ -f "$PROJECT_ROOT/.env" ]] || { err "Missing: $PROJECT_ROOT/.env"; missing=$((missing + 1)); }
    [[ -f "$HOME/.kube/config" ]] || { err "Missing: ~/.kube/config"; missing=$((missing + 1)); }
    [[ -d "$HOME/.docker" ]] || { err "Missing: ~/.docker/"; missing=$((missing + 1)); }
    [[ -d "$HOME/.claude" ]] || { warn "Missing: ~/.claude/ — skipping"; }
    [[ -f "$HOME/.claude.json" ]] || { warn "Missing: ~/.claude.json — skipping"; }
    [[ -d "$HOME/.config" ]] || { warn "Missing: ~/.config/ — skipping"; }
    [[ -f "$HOME/setup_samba_root.sh" ]] || { warn "Missing: ~/setup_samba_root.sh — skipping"; }
    [[ -d "$PROJECT_ROOT/k8s/secrets" ]] || { warn "Missing: k8s/secrets/ — run generate-secrets.sh first"; }

    if [[ $missing -gt 0 ]]; then
        err "$missing critical file(s) missing. Aborting."
        exit 1
    fi
}

sync_to_node() {
    local node="$1"

    log "────────────────────────────────────────"
    log "Syncing to ${CYAN}${node}${NC}..."

    # Test SSH connectivity
    if ! ssh "$REMOTE_USER@$node" "echo ok" &>/dev/null; then
        err "Cannot reach $node via SSH. Skipping."
        return 1
    fi

    # 1. Sync SSH deploy key (needed for git clone via SSH)
    log "  [1/11] Syncing SSH deploy key..."
    local deploy_key="$HOME/.ssh/github_deploy_key"
    ssh "$REMOTE_USER@$node" "mkdir -p ~/.ssh && chmod 700 ~/.ssh"
    if [[ -f "$deploy_key" ]]; then
        scp -q "$deploy_key" "$REMOTE_USER@$node:~/.ssh/deploy_key"
        ssh "$REMOTE_USER@$node" bash -s <<'SSHSETUP'
            chmod 600 ~/.ssh/deploy_key
            # Configure SSH to use deploy key for GitHub
            if ! grep -q 'github.com' ~/.ssh/config 2>/dev/null; then
                printf 'Host github.com\n  IdentityFile ~/.ssh/deploy_key\n  IdentitiesOnly yes\n  StrictHostKeyChecking no\n' >> ~/.ssh/config
                chmod 600 ~/.ssh/config
            fi
SSHSETUP
        log "  Deploy key synced"
    else
        warn "  No deploy key at $deploy_key — will try HTTPS clone"
    fi

    # 2. Ensure project directory exists and has the repo
    log "  [2/11] Ensuring git repo exists on $node..."
    ssh "$REMOTE_USER@$node" bash -s <<'REMOTE_SETUP'
        set -euo pipefail
        PROJECT_DIR="/home/patrick/projects"
        if [[ -d "$PROJECT_DIR/.git" ]]; then
            echo "  Repo exists. Pulling latest..."
            cd "$PROJECT_DIR" && git fetch --all && git checkout master && git pull origin master
        else
            # Remove any partial/broken directory
            if [[ -d "$PROJECT_DIR" ]]; then
                echo "  Removing broken project dir (no .git)..."
                rm -rf "$PROJECT_DIR"
            fi
            echo "  Cloning repository..."
            # Try SSH first, fall back to HTTPS (public read)
            if git clone git@github.com:Paddione/projects.git "$PROJECT_DIR" 2>/dev/null; then
                echo "  Cloned via SSH"
            else
                echo "  SSH clone failed, trying HTTPS..."
                git clone https://github.com/Paddione/projects.git "$PROJECT_DIR"
                # Switch remote to SSH for future pushes (if deploy key is present)
                cd "$PROJECT_DIR"
                git remote set-url origin git@github.com:Paddione/projects.git
                echo "  Cloned via HTTPS (remote set to SSH for pushes)"
            fi
        fi
REMOTE_SETUP

    # 3. Sync root .env
    log "  [3/11] Syncing root .env..."
    scp -q "$PROJECT_ROOT/.env" "$REMOTE_USER@$node:$REMOTE_PROJECT_DIR/.env"

    # 4. Sync k8s secrets
    log "  [4/11] Syncing k8s/secrets/..."
    ssh "$REMOTE_USER@$node" "mkdir -p $REMOTE_SECRETS_DIR"
    if ls "$PROJECT_ROOT/k8s/secrets/"*.yaml &>/dev/null; then
        scp -q "$PROJECT_ROOT/k8s/secrets/"*.yaml "$REMOTE_USER@$node:$REMOTE_SECRETS_DIR/"
    else
        warn "  No secret YAML files found in k8s/secrets/ — skipping"
    fi

    # 5. Sync Vault unseal secret (if exists)
    log "  [5/11] Syncing Vault unseal secret..."
    local vault_secret="$PROJECT_ROOT/k8s/infrastructure/vault/unseal-secret.yaml"
    if [[ -f "$vault_secret" ]]; then
        ssh "$REMOTE_USER@$node" "mkdir -p $REMOTE_PROJECT_DIR/k8s/infrastructure/vault"
        scp -q "$vault_secret" "$REMOTE_USER@$node:$REMOTE_PROJECT_DIR/k8s/infrastructure/vault/unseal-secret.yaml"
    else
        warn "  Vault unseal secret not found — skipping"
    fi

    # 6. Sync Docker directory
    log "  [6/11] Syncing Docker directory..."
    ssh "$REMOTE_USER@$node" "mkdir -p ~/.docker"
    scp -rq "$HOME/.docker/." "$REMOTE_USER@$node:~/.docker/"

    # 7. Sync kubeconfig
    log "  [7/11] Syncing kubeconfig..."
    ssh "$REMOTE_USER@$node" "mkdir -p ~/.kube"
    scp -q "$HOME/.kube/config" "$REMOTE_USER@$node:~/.kube/config"

    # 8. Sync Claude directory
    log "  [8/11] Syncing Claude directory..."
    if [[ -d "$HOME/.claude" ]]; then
        ssh "$REMOTE_USER@$node" "mkdir -p ~/.claude"
        scp -rq "$HOME/.claude/." "$REMOTE_USER@$node:~/.claude/"
    else
        warn "  ~/.claude not found — skipping"
    fi

    # 9. Sync Claude config
    log "  [9/11] Syncing Claude config..."
    if [[ -f "$HOME/.claude.json" ]]; then
        scp -q "$HOME/.claude.json" "$REMOTE_USER@$node:~/.claude.json"
    else
        warn "  ~/.claude.json not found — skipping"
    fi

    # 10. Sync .config directory
    log "  [10/11] Syncing .config directory..."
    if [[ -d "$HOME/.config" ]]; then
        ssh "$REMOTE_USER@$node" "mkdir -p ~/.config"
        scp -rq "$HOME/.config/." "$REMOTE_USER@$node:~/.config/"
    else
        warn "  ~/.config not found — skipping"
    fi

    # 11. Sync setup_samba_root.sh
    log "  [11/11] Syncing setup_samba_root.sh..."
    if [[ -f "$HOME/setup_samba_root.sh" ]]; then
        scp -q "$HOME/setup_samba_root.sh" "$REMOTE_USER@$node:~/setup_samba_root.sh"
        ssh "$REMOTE_USER@$node" "chmod +x ~/setup_samba_root.sh"
    else
        warn "  ~/setup_samba_root.sh not found — skipping"
    fi

    log "  ${GREEN}✓ $node synced successfully${NC}"
}

verify_node_readiness() {
    local node="$1"

    log "Verifying ${CYAN}${node}${NC} readiness..."

    ssh "$REMOTE_USER@$node" bash -s <<'VERIFY'
        PASS=0
        FAIL=0

        check() {
            if eval "$2" &>/dev/null; then
                echo "  ✓ $1"
                PASS=$((PASS + 1))
            else
                echo "  ✗ $1"
                FAIL=$((FAIL + 1))
            fi
        }

        check "SSH deploy key"    "[[ -f ~/.ssh/deploy_key ]]"
        check "Git repo"          "[[ -d /home/patrick/projects/.git ]]"
        check "Root .env"         "[[ -f /home/patrick/projects/.env ]]"
        check "Kubeconfig"        "[[ -f ~/.kube/config ]]"
        check "Docker dir"        "[[ -d ~/.docker ]]"
        check "Claude dir"        "[[ -d ~/.claude ]]"
        check "Claude config"     "[[ -f ~/.claude.json ]]"
        check "Config dir"        "[[ -d ~/.config ]]"
        check "Samba setup"       "[[ -f ~/setup_samba_root.sh ]]"
        check "kubectl works"     "kubectl get nodes"
        check "Docker works"      "docker info"
        check "k8s secrets dir"   "[[ -d /home/patrick/projects/k8s/secrets ]]"
        check "Deploy scripts"    "[[ -x /home/patrick/projects/k8s/scripts/deploy/deploy-all.sh ]]"
        check "Registry login"    "docker pull registry.korczewski.de/korczewski/l2p-backend:latest 2>&1 | grep -v 'denied\|unauthorized' || docker images --format '{{.Repository}}' | grep -q registry.korczewski.de"

        echo ""
        echo "  Results: $PASS passed, $FAIL failed"
        [[ $FAIL -eq 0 ]]
VERIFY
}

# ─── Main ───────────────────────────────────────

echo ""
log "═══════════════════════════════════════════════"
log "  Disaster Recovery Sync"
log "  Syncing to: ${NODES[*]}"
log "═══════════════════════════════════════════════"
echo ""

verify_local_files

SYNCED=0
FAILED=0

for node in "${NODES[@]}"; do
    if sync_to_node "$node"; then
        SYNCED=$((SYNCED + 1))
    else
        FAILED=$((FAILED + 1))
    fi
done

echo ""
log "═══════════════════════════════════════════════"
log "  Verification"
log "═══════════════════════════════════════════════"
echo ""

for node in "${NODES[@]}"; do
    verify_node_readiness "$node" || true
    echo ""
done

log "═══════════════════════════════════════════════"
log "  Summary: $SYNCED synced, $FAILED failed"
if [[ $FAILED -eq 0 ]]; then
    log "  ${GREEN}All nodes ready for disaster recovery!${NC}"
    echo ""
    log "  To take over from any CP node:"
    log "    ssh patrick@k3s-1"
    log "    cd /home/patrick/projects"
    log "    ./k8s/scripts/deploy/deploy-changed.sh --committed"
else
    warn "  Some nodes failed — check connectivity and retry"
fi
log "═══════════════════════════════════════════════"
