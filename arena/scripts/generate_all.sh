#!/usr/bin/env bash
#
# Master Asset Generation Pipeline
# Orchestrates all generation phases from manifest to game-ready assets.
#
# Usage:
#   ./generate_all.sh [--phase PHASE] [--category CATEGORY] [--id ASSET_ID]
#
# Phases:
#   1  concepts    — Generate concept art (ComfyUI/SDXL)
#   2  models      — Convert concepts to 3D models (TripoSR/Meshy)
#   3  sprites     — Render 3D models to sprite frames (Blender)
#   4  pack        — Pack sprite frames into atlases (free-tex-packer)
#   5  audio       — Generate sound effects and music (AudioCraft)
#   6  process     — Post-process audio (ffmpeg normalize + convert)
#   all            — Run all phases (default)
#
# Prerequisites:
#   - Python 3.10+ with venv
#   - Blender 3.6+ (for sprite rendering)
#   - Node.js 20+ with npm
#   - ffmpeg (for audio processing)
#   - GPU with 12GB+ VRAM (for local AI generation)
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARENA_DIR="$(dirname "$SCRIPT_DIR")"
VENV_DIR="$ARENA_DIR/.venv"

# Load .env if present (for ELEVENLABS_API_KEY etc.)
if [[ -f "$ARENA_DIR/.env" ]]; then
    set -a
    source "$ARENA_DIR/.env"
    set +a
fi

PHASE="all"
CATEGORY=""
ASSET_ID=""
EXTRA_ARGS=()

# Use Python 3.12 (3.14 is too new for PyTorch/AudioCraft)
PYTHON="${PYTHON:-python3.12}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${CYAN}[PIPELINE]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC} $*"; }

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --phase)    PHASE="$2"; shift 2 ;;
        --category) CATEGORY="$2"; EXTRA_ARGS+=(--category "$2"); shift 2 ;;
        --id)       ASSET_ID="$2"; EXTRA_ARGS+=(--id "$2"); shift 2 ;;
        *)          warn "Unknown arg: $1"; shift ;;
    esac
done

# ============================================================================
# Prerequisite Checks
# ============================================================================

check_prereqs() {
    log "Checking prerequisites..."
    local ok=true

    if ! command -v "$PYTHON" &>/dev/null; then
        error "$PYTHON not found"
        ok=false
    else
        log "Using $($PYTHON --version)"
    fi

    if ! command -v ffmpeg &>/dev/null; then
        warn "ffmpeg not found — audio processing will fail"
    fi

    if ! command -v blender &>/dev/null; then
        warn "blender not found — sprite rendering will fail"
        warn "  Install: sudo apt install blender  (or download from blender.org)"
    fi

    if ! command -v npx &>/dev/null; then
        error "npx not found — sprite packing requires Node.js"
        ok=false
    fi

    if [[ "$ok" == false ]]; then
        error "Missing prerequisites. Aborting."
        exit 1
    fi

    success "Prerequisites OK"
}

# ============================================================================
# Python Virtual Environment
# ============================================================================

setup_venv() {
    if [[ ! -d "$VENV_DIR" ]]; then
        log "Creating Python virtual environment..."
        "$PYTHON" -m venv "$VENV_DIR"
    fi

    # shellcheck disable=SC1091
    source "$VENV_DIR/bin/activate"

    # Skip dependency install if venv already has torch
    if python3 -c "import torch" 2>/dev/null; then
        log "Venv ready (torch already installed)"
    else
        log "Installing Python dependencies (first run)..."
        pip install --quiet --upgrade pip
        # Use nightly for Blackwell GPU (sm_120) support
        pip install --quiet --pre torch torchaudio torchvision --index-url https://download.pytorch.org/whl/nightly/cu128 2>/dev/null || true
        pip install --quiet diffusers transformers accelerate safetensors pillow 2>/dev/null || true
        pip install --quiet audiocraft librosa soundfile spacy 2>/dev/null || true
        pip install --quiet tsr 2>/dev/null || true
    fi
}

# ============================================================================
# Phase Runners
# ============================================================================

run_concepts() {
    log "Phase 1: Concept Art Generation"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    python3 "$SCRIPT_DIR/generate_concepts.py" "${EXTRA_ARGS[@]}"
    success "Phase 1 complete"
}

run_models() {
    log "Phase 2: 3D Model Generation"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    python3 "$SCRIPT_DIR/generate_3d.py" "${EXTRA_ARGS[@]}"
    success "Phase 2 complete"
}

run_sprites() {
    log "Phase 3: Sprite Rendering (Blender)"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    if command -v blender &>/dev/null; then
        blender --background --python "$SCRIPT_DIR/render_sprites.py" -- "${EXTRA_ARGS[@]}"
        success "Phase 3 complete"
    else
        warn "Blender not available, skipping sprite rendering"
        warn "Install Blender and re-run: ./generate_all.sh --phase sprites"
    fi
}

run_pack() {
    log "Phase 4: Sprite Sheet Packing"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Install free-tex-packer if needed
    if [[ ! -d "$ARENA_DIR/node_modules/free-tex-packer-core" ]]; then
        log "Installing free-tex-packer-core..."
        cd "$ARENA_DIR" && npm install --save-dev free-tex-packer-core
    fi

    npx tsx "$SCRIPT_DIR/pack_sprites.ts" "${EXTRA_ARGS[@]}"
    success "Phase 4 complete"
}

run_audio() {
    log "Phase 5: Audio Generation"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━"
    python3 "$SCRIPT_DIR/generate_audio.py" "${EXTRA_ARGS[@]}"
    success "Phase 5 complete"
}

run_process_audio() {
    log "Phase 6: Audio Post-Processing"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    bash "$SCRIPT_DIR/process_audio.sh"
    success "Phase 6 complete"
}

# ============================================================================
# Main
# ============================================================================

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║    Arena Asset Generation Pipeline       ║"
echo "╚══════════════════════════════════════════╝"
echo ""

check_prereqs

# Only set up venv for phases that need Python
case "$PHASE" in
    1|concepts|2|models|5|audio|all)
        setup_venv
        ;;
esac

case "$PHASE" in
    1|concepts)       run_concepts ;;
    2|models)         run_models ;;
    3|sprites)        run_sprites ;;
    4|pack)           run_pack ;;
    5|audio)          run_audio ;;
    6|process)        run_process_audio ;;
    all)
        run_concepts
        run_models
        run_sprites
        run_pack
        run_audio
        run_process_audio
        ;;
    *)
        error "Unknown phase: $PHASE"
        echo "Valid phases: 1-6, concepts, models, sprites, pack, audio, process, all"
        exit 1
        ;;
esac

echo ""
log "Pipeline complete!"
log "Assets location:"
log "  Sprites: $ARENA_DIR/frontend/public/assets/sprites/"
log "  SFX:     $ARENA_DIR/frontend/public/assets/sfx/"
log "  Music:   $ARENA_DIR/frontend/public/assets/music/"
echo ""
