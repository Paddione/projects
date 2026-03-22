#!/usr/bin/env bash
# WSL2 VHDX Cleanup Script
# Run this BEFORE compacting the VHDX from Windows.
#
# Usage:
#   ./scripts/wsl-cleanup.sh          # dry-run (shows what would be cleaned)
#   ./scripts/wsl-cleanup.sh --run    # actually clean
#
# After running with --run, compact the VHDX from PowerShell (elevated):
#   wsl --shutdown
#   Optimize-VHD -Path "C:\Users\Patrick\AppData\Local\Docker\wsl\data\ext4.vhdx" -Mode Full
#   Optimize-VHD -Path "C:\Users\Patrick\AppData\Local\Packages\CanonicalGroupLimited.Ubuntu*\LocalState\ext4.vhdx" -Mode Full
#
# Or if Hyper-V module is unavailable, use diskpart:
#   wsl --shutdown
#   diskpart
#     select vdisk file="C:\path\to\ext4.vhdx"
#     compact vdisk
#     exit

set -euo pipefail
shopt -s nullglob

DRY_RUN=true
if [[ "${1:-}" == "--run" ]]; then
    DRY_RUN=false
fi

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

total_freed=0

log()  { echo -e "${CYAN}[INFO]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
step() { echo -e "\n${GREEN}==> $*${NC}"; }
dry()  { if $DRY_RUN; then echo -e "  ${YELLOW}[DRY-RUN]${NC} would: $*"; else echo -e "  ${GREEN}[RUN]${NC} $*"; fi; }

size_of() {
    local result
    result=$(du -sb "$1" 2>/dev/null | tail -1 | awk '{print $1}')
    echo "${result:-0}"
}

human() {
    numfmt --to=iec-i --suffix=B "$1" 2>/dev/null || echo "${1} bytes"
}

clean_path() {
    local path="$1"
    local desc="$2"
    if [[ -e "$path" ]]; then
        local sz
        sz=$(size_of "$path")
        total_freed=$((total_freed + sz))
        dry "remove $desc ($(human "$sz"))"
        if ! $DRY_RUN; then
            rm -rf "$path"
        fi
    fi
}

# ─────────────────────────────────────────────────
step "1/8 — Docker cleanup"
# ─────────────────────────────────────────────────
if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
    log "Docker system usage before cleanup:"
    docker system df

    # Remove stopped containers
    stopped=$(docker ps -aq --filter "status=exited" --filter "status=created" | wc -l)
    dry "remove $stopped stopped containers"

    # Remove dangling images
    dangling=$(docker images -f "dangling=true" -q | wc -l)
    dry "remove $dangling dangling images"

    # Remove unused images (not used by any container)
    unused=$(docker images --format '{{.ID}}' | wc -l)
    dry "remove all unused images (keeping ones used by running containers)"

    # Remove dangling volumes
    dvols=$(docker volume ls -q --filter "dangling=true" | wc -l)
    dry "remove $dvols dangling volumes"

    # Remove build cache
    dry "remove all Docker build cache"

    if ! $DRY_RUN; then
        # Stop non-essential containers first
        log "Stopping non-essential containers..."
        # Keep only currently running essential ones
        docker container prune -f

        # Full prune: images, build cache, networks
        docker system prune -a -f

        # Volumes need separate prune (not included in system prune by default)
        docker volume prune -a -f

        # Remove build cache explicitly
        docker builder prune -a -f

        log "Docker system usage after cleanup:"
        docker system df
    fi
else
    warn "Docker not available, skipping"
fi

# ─────────────────────────────────────────────────
step "2/8 — HuggingFace cache (~35 GB)"
# ─────────────────────────────────────────────────
clean_path "$HOME/.cache/huggingface" "HuggingFace model cache"

# ─────────────────────────────────────────────────
step "3/8 — Package manager caches"
# ─────────────────────────────────────────────────
# pip cache
if command -v pip &>/dev/null; then
    pip_sz=$(du -sb "$HOME/.cache/pip" 2>/dev/null | tail -1 | awk '{print $1}')
    pip_sz=${pip_sz:-0}
    total_freed=$((total_freed + pip_sz))
    dry "clear pip cache ($(human "$pip_sz"))"
    if ! $DRY_RUN; then
        pip cache purge 2>/dev/null || rm -rf "$HOME/.cache/pip"
    fi
else
    clean_path "$HOME/.cache/pip" "pip cache"
fi

# npm cache
if command -v npm &>/dev/null; then
    npm_sz=$(du -sb "$HOME/.npm" 2>/dev/null | tail -1 | awk '{print $1}')
    npm_sz=${npm_sz:-0}
    total_freed=$((total_freed + npm_sz))
    dry "clear npm cache ($(human "$npm_sz"))"
    if ! $DRY_RUN; then
        npm cache clean --force 2>/dev/null
        # Also clean npx cache (old one-off runs)
        rm -rf "$HOME/.npm/_npx"
    fi
fi

# pnpm store
clean_path "$HOME/.local/share/pnpm" "pnpm global store"

# Homebrew cache
if [[ -d "$HOME/.cache/Homebrew" ]]; then
    brew_sz=$(size_of "$HOME/.cache/Homebrew")
    total_freed=$((total_freed + brew_sz))
    dry "clear Homebrew cache ($(human "$brew_sz"))"
    if ! $DRY_RUN; then
        if command -v brew &>/dev/null; then
            brew cleanup --prune=all -s 2>/dev/null
        fi
        rm -rf "$HOME/.cache/Homebrew"
    fi
fi

# node-gyp rebuild cache
clean_path "$HOME/.cache/node-gyp" "node-gyp cache"

# Prisma engines cache
clean_path "$HOME/.cache/prisma" "Prisma engines cache"

# ─────────────────────────────────────────────────
step "4/8 — Playwright browsers (~3.4 GB)"
# ─────────────────────────────────────────────────
# These get re-downloaded on `npx playwright install` anyway
clean_path "$HOME/.cache/ms-playwright" "Playwright browser binaries"
clean_path "$HOME/.cache/ms-playwright-go" "Playwright Go binaries"

# ─────────────────────────────────────────────────
step "5/8 — Old VS Code Server binaries (Antigravity)"
# ─────────────────────────────────────────────────
if [[ -d "$HOME/.antigravity-server/bin" ]]; then
    # Keep only the most recent version, remove older ones
    ag_total=$(size_of "$HOME/.antigravity-server/bin")
    dry "clean old Antigravity/VS Code server binaries ($(human "$ag_total"))"
    if ! $DRY_RUN; then
        # Keep the two newest directories, remove the rest
        cd "$HOME/.antigravity-server/bin"
        ls -t | tail -n +3 | xargs -r rm -rf
        cd - >/dev/null
    fi
fi

# Old VS Code extensions (keep only latest version of each)
if [[ -d "$HOME/.antigravity-server/extensions" ]]; then
    ext_sz=$(size_of "$HOME/.antigravity-server/extensions")
    log "Antigravity extensions: $(human "$ext_sz") (keeping all — remove manually if unused)"
fi

# ─────────────────────────────────────────────────
step "6/8 — System caches and logs"
# ─────────────────────────────────────────────────

# Journal logs (keep last 1 day)
journal_sz=$(sudo du -sb /var/log/journal 2>/dev/null | tail -1 | awk '{print $1}' || echo 0)
journal_sz=${journal_sz:-0}
dry "vacuum systemd journal to 1 day (currently $(human "$journal_sz"))"
if ! $DRY_RUN; then
    sudo journalctl --vacuum-time=1d 2>/dev/null || true
fi
total_freed=$((total_freed + journal_sz * 9 / 10))  # estimate 90% freed

# Rotated logs
for logfile in /var/log/*.1 /var/log/*.gz /var/log/*.old; do
    if [[ -f "$logfile" ]]; then
        log_sz=$(size_of "$logfile")
        total_freed=$((total_freed + log_sz))
        dry "remove rotated log $(basename "$logfile") ($(human "$log_sz"))"
        if ! $DRY_RUN; then
            sudo rm -f "$logfile"
        fi
    fi
done

# apt cache
apt_sz=$(sudo du -sb /var/cache/apt 2>/dev/null | tail -1 | awk '{print $1}' || echo 0)
apt_sz=${apt_sz:-0}
dry "clean apt cache ($(human "$apt_sz"))"
if ! $DRY_RUN; then
    sudo apt-get clean 2>/dev/null || true
    sudo apt-get autoremove -y 2>/dev/null || true
fi
total_freed=$((total_freed + apt_sz))

# /tmp
tmp_sz=$(sudo du -sb /tmp 2>/dev/null | tail -1 | awk '{print $1}' || echo 0)
tmp_sz=${tmp_sz:-0}
dry "clean /tmp ($(human "$tmp_sz"))"
if ! $DRY_RUN; then
    sudo find /tmp -mindepth 1 -maxdepth 1 -mtime +1 -exec rm -rf {} + 2>/dev/null || true
fi
total_freed=$((total_freed + tmp_sz / 2))  # conservative: only old files

# ─────────────────────────────────────────────────
step "7/8 — Miscellaneous caches"
# ─────────────────────────────────────────────────
clean_path "$HOME/.cache/google-chrome" "Chrome cache"
clean_path "$HOME/.cache/mesa_shader_cache" "Mesa shader cache"
clean_path "$HOME/.cache/mesa_shader_cache_db" "Mesa shader cache DB"
clean_path "$HOME/.cache/typescript" "TypeScript cache"

# Stray project outside main workspace
if [[ -d "$HOME/instant-workspace" ]]; then
    iw_sz=$(size_of "$HOME/instant-workspace")
    warn "Found ~/instant-workspace ($(human "$iw_sz")) — not auto-removing (may be intentional)"
    log "  Remove manually if unused: rm -rf ~/instant-workspace"
fi

# ─────────────────────────────────────────────────
step "8/8 — Filesystem trim (CRITICAL for VHDX compaction)"
# ─────────────────────────────────────────────────
dry "run fstrim to mark freed blocks for VHDX compaction"
if ! $DRY_RUN; then
    # fstrim tells the virtual disk which blocks are free
    # Without this, diskpart/Optimize-VHD cannot reclaim space
    sudo fstrim -av 2>/dev/null || warn "fstrim failed — VHDX compaction may not reclaim all space"
fi

# ─────────────────────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════════════${NC}"
if $DRY_RUN; then
    echo -e "${YELLOW}DRY RUN COMPLETE${NC}"
    echo -e "Estimated reclaimable: ${CYAN}$(human "$total_freed")${NC}"
    echo ""
    echo "Run with --run to actually clean:"
    echo "  ./scripts/wsl-cleanup.sh --run"
else
    echo -e "${GREEN}CLEANUP COMPLETE${NC}"
    echo -e "Estimated freed: ${CYAN}$(human "$total_freed")${NC}"
    echo ""
    echo "Now compact the VHDX from Windows (PowerShell as Admin):"
    echo ""
    echo -e "${CYAN}  wsl --shutdown${NC}"
    echo ""
    echo "Then for Docker Desktop's VHDX:"
    echo -e "${CYAN}  Optimize-VHD -Path \"\$env:LOCALAPPDATA\\Docker\\wsl\\data\\ext4.vhdx\" -Mode Full${NC}"
    echo ""
    echo "And for Ubuntu's VHDX:"
    echo -e "${CYAN}  # Find your distro's VHDX path:${NC}"
    echo -e "${CYAN}  Get-ChildItem \"\$env:LOCALAPPDATA\\Packages\\Canonical*\\LocalState\\ext4.vhdx\"${NC}"
    echo -e "${CYAN}  Optimize-VHD -Path <path> -Mode Full${NC}"
    echo ""
    echo "If Optimize-VHD is unavailable (no Hyper-V module), use diskpart:"
    echo -e "${CYAN}  diskpart${NC}"
    echo -e "${CYAN}    select vdisk file=\"C:\\path\\to\\ext4.vhdx\"${NC}"
    echo -e "${CYAN}    compact vdisk${NC}"
    echo -e "${CYAN}    exit${NC}"
fi
echo -e "${GREEN}════════════════════════════════════════════════${NC}"
