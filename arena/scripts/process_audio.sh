#!/usr/bin/env bash
#
# Phase 3 (Audio Post-Processing)
# Normalizes, trims silence, and converts audio to .ogg + .mp3 formats.
#
# Usage:
#   ./process_audio.sh [--type sfx|music|all]
#
# Requires: ffmpeg
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARENA_DIR="$(dirname "$SCRIPT_DIR")"
RAW_SFX_DIR="$ARENA_DIR/assets/audio/sfx"
RAW_MUSIC_DIR="$ARENA_DIR/assets/audio/music"
OUT_SFX_DIR="$ARENA_DIR/frontend/public/assets/sfx"
OUT_MUSIC_DIR="$ARENA_DIR/frontend/public/assets/music"

# Loudness targets (EBU R128)
SFX_LOUDNESS="-16"    # SFX louder
MUSIC_LOUDNESS="-20"  # Music quieter (background)

TYPE="all"

# Parse args
while [[ $# -gt 0 ]]; do
    case $1 in
        --type) TYPE="$2"; shift 2 ;;
        *) echo "Unknown arg: $1"; exit 1 ;;
    esac
done

# Check ffmpeg
if ! command -v ffmpeg &>/dev/null; then
    echo "[ERROR] ffmpeg not found. Install: sudo apt install ffmpeg"
    exit 1
fi

process_file() {
    local input="$1"
    local output_dir="$2"
    local loudness="$3"
    local basename
    basename="$(basename "$input" .wav)"

    local ogg_out="$output_dir/$basename.ogg"
    local mp3_out="$output_dir/$basename.mp3"

    # Skip if both outputs exist
    if [[ -f "$ogg_out" && -f "$mp3_out" ]]; then
        echo "  [SKIP] $basename — already processed"
        return
    fi

    echo "  [PROC] $basename"

    # Step 1: Normalize loudness + trim silence from start/end
    local normalized
    normalized="$(mktemp /tmp/arena-audio-XXXXX.wav)"

    ffmpeg -y -i "$input" \
        -af "silenceremove=start_periods=1:start_silence=0.05:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_silence=0.05:start_threshold=-50dB,areverse,loudnorm=I=${loudness}:TP=-1.5:LRA=11" \
        -ar 44100 -ac 1 \
        "$normalized" 2>/dev/null

    # Step 2: Convert to OGG (Opus, 96kbps — better quality than Vorbis at same size)
    ffmpeg -y -i "$normalized" \
        -c:a libopus -b:a 96k \
        "$ogg_out" 2>/dev/null
    echo "    → $ogg_out ($(du -h "$ogg_out" | cut -f1))"

    # Step 3: Convert to MP3 (128kbps CBR for broad compatibility)
    ffmpeg -y -i "$normalized" \
        -c:a libmp3lame -b:a 128k \
        "$mp3_out" 2>/dev/null
    echo "    → $mp3_out ($(du -h "$mp3_out" | cut -f1))"

    rm -f "$normalized"
}

# Process SFX
if [[ "$TYPE" == "sfx" || "$TYPE" == "all" ]]; then
    echo ""
    echo "============================================================"
    echo "  Processing SFX"
    echo "============================================================"
    mkdir -p "$OUT_SFX_DIR"

    if [[ -d "$RAW_SFX_DIR" ]]; then
        for wav in "$RAW_SFX_DIR"/*.wav; do
            [[ -f "$wav" ]] || continue
            process_file "$wav" "$OUT_SFX_DIR" "$SFX_LOUDNESS"
        done
    else
        echo "  [WARN] No raw SFX directory: $RAW_SFX_DIR"
    fi
fi

# Process Music
if [[ "$TYPE" == "music" || "$TYPE" == "all" ]]; then
    echo ""
    echo "============================================================"
    echo "  Processing Music"
    echo "============================================================"
    mkdir -p "$OUT_MUSIC_DIR"

    if [[ -d "$RAW_MUSIC_DIR" ]]; then
        for wav in "$RAW_MUSIC_DIR"/*.wav; do
            [[ -f "$wav" ]] || continue
            process_file "$wav" "$OUT_MUSIC_DIR" "$MUSIC_LOUDNESS"
        done
    else
        echo "  [WARN] No raw music directory: $RAW_MUSIC_DIR"
    fi
fi

echo ""
echo "[DONE] Audio processing complete"
echo "  SFX:   $OUT_SFX_DIR"
echo "  Music: $OUT_MUSIC_DIR"
