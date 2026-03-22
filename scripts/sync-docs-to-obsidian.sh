#!/usr/bin/env bash
#
# Bidirectional sync of .md files between the monorepo and
# SMB-Symlinks/storage-pve3a/Obsidian/Synch/, preserving directory structure.
#
# For each .md file, the newer copy wins. Files that exist on only one side
# are copied to the other (no deletions).
#
# Usage:
#   ./scripts/sync-docs-to-obsidian.sh          # sync all
#   ./scripts/sync-docs-to-obsidian.sh --dry-run # preview only

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$REPO_ROOT/SMB-Symlinks/storage-pve3a/Obsidian/Synch"

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

# Ensure destination exists
mkdir -p "$DEST"

# Directories to skip (relative patterns for find -path)
EXCLUDES=(
    .git .github .venv node_modules dist build .next
    coverage test-results playwright-report SMB-Symlinks
    Obsidian openclaw .claude/plans .claude/brainstorms
)

# Build find exclusion args for repo side
FIND_EXCLUDES=()
for ex in "${EXCLUDES[@]}"; do
    FIND_EXCLUDES+=(-path "*/${ex}/*" -o -path "*/${ex}" -o)
done
# Remove trailing -o
unset 'FIND_EXCLUDES[-1]'

# Collect all .md files from repo (relative paths)
repo_files() {
    cd "$REPO_ROOT"
    find . -type f -name '*.md' \( ! \( "${FIND_EXCLUDES[@]}" \) \) | sed 's|^\./||' | sort
}

# Collect all .md files from Obsidian Synch dir (relative paths)
# -P: never follow symlinks (prevents escaping Synch/)
obsidian_files() {
    cd "$DEST"
    find -P . -type f -name '*.md' 2>/dev/null | sed 's|^\./||' | sort
}

REPO_LIST=$(repo_files)
OBSIDIAN_LIST=$(obsidian_files)

COPIED_TO_OBSIDIAN=0
COPIED_TO_REPO=0
SKIPPED=0

# Arithmetic (( x++ )) returns 1 when x is 0, which trips set -e.
# Use "|| true" pattern or increment safely.
inc() { eval "$1=$(( ${!1} + 1 ))"; }

# Guard: reject any relative path containing ".." components.
# This prevents traversal above Synch/ or the repo root regardless of
# whether the destination directory exists yet.
is_safe_rel() {
    local rel="$1"
    # Split on / and reject if any component is ".."
    [[ ! "$rel" =~ (^|/)\.\.(/|$) ]]
}

sync_file() {
    local rel="$1"
    local src="$2"
    local dst="$3"
    local direction="$4"

    local dst_dir
    dst_dir="$(dirname "$dst")"

    if $DRY_RUN; then
        echo "[dry-run] $direction $rel"
    else
        mkdir -p "$dst_dir"
        cp -p "$src" "$dst"
    fi
}

# Process files that exist in both or only in repo
while IFS= read -r rel; do
    [[ -z "$rel" ]] && continue
    repo_file="$REPO_ROOT/$rel"
    obs_file="$DEST/$rel"

    # Skip paths with ".." that could escape the sync roots
    if ! is_safe_rel "$rel"; then
        echo "[SKIP] unsafe path: $rel"
        continue
    fi

    if [[ -f "$obs_file" ]]; then
        # Both exist — compare timestamps
        repo_mtime=$(stat -c '%Y' "$repo_file")
        obs_mtime=$(stat -c '%Y' "$obs_file")

        if (( repo_mtime > obs_mtime )); then
            sync_file "$rel" "$repo_file" "$obs_file" "repo → obsidian"
            inc COPIED_TO_OBSIDIAN
        elif (( obs_mtime > repo_mtime )); then
            sync_file "$rel" "$obs_file" "$repo_file" "obsidian → repo"
            inc COPIED_TO_REPO
        else
            inc SKIPPED
        fi
    else
        # Only in repo — copy to Obsidian
        sync_file "$rel" "$repo_file" "$obs_file" "repo → obsidian (new)"
        inc COPIED_TO_OBSIDIAN
    fi
done <<< "$REPO_LIST"

# Process files that exist only in Obsidian (not in repo)
while IFS= read -r rel; do
    [[ -z "$rel" ]] && continue
    repo_file="$REPO_ROOT/$rel"

    # Skip paths with ".." that could escape the sync roots
    if ! is_safe_rel "$rel"; then
        echo "[SKIP] unsafe path: $rel"
        continue
    fi

    if [[ ! -f "$repo_file" ]]; then
        sync_file "$rel" "$DEST/$rel" "$repo_file" "obsidian → repo (new)"
        inc COPIED_TO_REPO
    fi
done <<< "$OBSIDIAN_LIST"

echo ""
echo "Sync complete:"
echo "  → Obsidian: $COPIED_TO_OBSIDIAN files"
echo "  → Repo:     $COPIED_TO_REPO files"
echo "  Unchanged:  $SKIPPED files"
