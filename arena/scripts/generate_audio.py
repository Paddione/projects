#!/usr/bin/env python3
"""
Phase 3 (Audio): Sound Effect and Music Generation
Generates audio assets using AudioCraft (SFX) and MusicGen (music) locally,
or falls back to ElevenLabs/Suno cloud APIs.

Usage:
    python generate_audio.py [--backend auto|audiocraft|elevenlabs] [--type sfx|music|all]
                             [--id ASSET_ID]

Requirements (local):
    pip install audiocraft torch torchaudio

Environment variables (cloud):
    ELEVENLABS_API_KEY — for SFX generation
    SUNO_API_KEY — for music generation (if using Suno)
"""

import argparse
import json
import os
import struct
import sys
import time
import urllib.request
import urllib.error
import wave
from pathlib import Path

MANIFEST_PATH = Path(__file__).parent.parent / "assets" / "manifest.json"
OUTPUT_SFX = Path(__file__).parent.parent / "assets" / "audio" / "sfx"
OUTPUT_MUSIC = Path(__file__).parent.parent / "assets" / "audio" / "music"

# AudioCraft settings
SAMPLE_RATE = 32000  # AudioCraft default
MUSIC_SAMPLE_RATE = 32000


def load_manifest() -> dict:
    with open(MANIFEST_PATH) as f:
        return json.load(f)


def ensure_dir(p: Path):
    p.mkdir(parents=True, exist_ok=True)


# =============================================================================
# AudioCraft Backend (Local — SFX)
# =============================================================================

_audiogen_model = None
_musicgen_model = None


def audiocraft_available() -> bool:
    """Check if audiocraft + torch + CUDA are available."""
    try:
        import torch
        import audiocraft  # noqa: F401
        return torch.cuda.is_available()
    except ImportError:
        return False


def free_gpu_memory():
    """Free GPU memory from any previously loaded models (e.g. SDXL from Phase 1)."""
    try:
        import torch
        import gc
        gc.collect()
        torch.cuda.empty_cache()
    except Exception:
        pass


def get_audiogen():
    """Load AudioGen model for sound effects (lazy singleton)."""
    global _audiogen_model
    if _audiogen_model is None:
        free_gpu_memory()
        from audiocraft.models import AudioGen
        print("  Loading AudioGen model (first run)...")
        _audiogen_model = AudioGen.get_pretrained("facebook/audiogen-medium")
        _audiogen_model.set_generation_params(duration=5)  # max, will trim later
    return _audiogen_model


def get_musicgen():
    """Load MusicGen model for music (lazy singleton)."""
    global _musicgen_model, _audiogen_model
    if _musicgen_model is None:
        # Unload AudioGen to free VRAM for MusicGen
        if _audiogen_model is not None:
            del _audiogen_model
            _audiogen_model = None
        free_gpu_memory()
        from audiocraft.models import MusicGen
        print("  Loading MusicGen-small model...")
        _musicgen_model = MusicGen.get_pretrained("facebook/musicgen-small")
    return _musicgen_model


def save_audio_wav(audio_tensor, output_path: Path, sample_rate: int):
    """Save audio tensor to WAV using soundfile (avoids torchaudio nightly issues)."""
    import soundfile as sf
    import numpy as np

    # audio_tensor shape: [1, samples] or [channels, samples]
    audio_np = audio_tensor.cpu().numpy()
    if audio_np.ndim == 2:
        audio_np = audio_np.T  # soundfile expects [samples, channels]
    sf.write(str(output_path), audio_np, sample_rate)


def audiocraft_generate_sfx(prompt: str, duration: float, output_path: Path) -> bool:
    """Generate a sound effect using AudioGen."""
    try:
        model = get_audiogen()
        model.set_generation_params(duration=min(duration + 0.5, 10))  # slight padding

        wav = model.generate([prompt])  # shape: [1, 1, samples]
        audio = wav[0]  # [1, samples]

        # Trim to exact duration
        target_samples = int(duration * SAMPLE_RATE)
        if audio.shape[-1] > target_samples:
            audio = audio[:, :target_samples]

        save_audio_wav(audio, output_path, SAMPLE_RATE)
        return True
    except Exception as e:
        print(f"  [ERROR] AudioGen SFX failed: {e}")
        return False


def audiocraft_generate_music(prompt: str, duration: float, output_path: Path) -> bool:
    """Generate music using MusicGen."""
    try:
        import torch
        import gc

        # Free GPU memory from any prior models (e.g. SDXL)
        gc.collect()
        torch.cuda.empty_cache()

        model = get_musicgen()
        model.set_generation_params(duration=duration)

        wav = model.generate([prompt])
        audio = wav[0]  # [1, samples]

        save_audio_wav(audio, output_path, MUSIC_SAMPLE_RATE)
        return True
    except Exception as e:
        print(f"  [ERROR] MusicGen failed: {e}")
        return False


# =============================================================================
# ElevenLabs Backend (Cloud — SFX)
# =============================================================================

def elevenlabs_available() -> bool:
    return bool(os.environ.get("ELEVENLABS_API_KEY"))


def elevenlabs_generate_sfx(prompt: str, duration: float, output_path: Path) -> bool:
    """Generate SFX using ElevenLabs Sound Effects API."""
    api_key = os.environ.get("ELEVENLABS_API_KEY", "")

    payload = json.dumps({
        "text": prompt,
        "duration_seconds": duration,
    }).encode()

    req = urllib.request.Request(
        "https://api.elevenlabs.io/v1/sound-generation",
        data=payload,
        headers={
            "xi-api-key": api_key,
            "Content-Type": "application/json",
        },
    )

    try:
        resp = urllib.request.urlopen(req, timeout=60)
        audio_data = resp.read()
        output_path.write_bytes(audio_data)
        return True
    except Exception as e:
        print(f"  [ERROR] ElevenLabs SFX failed: {e}")
        return False


# =============================================================================
# Placeholder Generator (when no backend available)
# =============================================================================

def generate_silence(duration: float, output_path: Path, sample_rate: int = 44100):
    """Generate a silent WAV file as a placeholder."""
    num_samples = int(duration * sample_rate)
    with wave.open(str(output_path), 'w') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)  # 16-bit
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(struct.pack(f'<{num_samples}h', *([0] * num_samples)))


# =============================================================================
# Main
# =============================================================================

def main():
    parser = argparse.ArgumentParser(description="Generate audio assets for Arena")
    parser.add_argument("--backend", choices=["auto", "audiocraft", "elevenlabs", "placeholder"],
                        default="auto")
    parser.add_argument("--type", choices=["sfx", "music", "all"], default="all")
    parser.add_argument("--id", help="Only generate this asset ID")
    args = parser.parse_args()

    manifest = load_manifest()

    # Determine backend
    sfx_backend = args.backend
    music_backend = args.backend

    if args.backend == "auto":
        if audiocraft_available():
            sfx_backend = "audiocraft"
            music_backend = "audiocraft"
            print("[INFO] Using AudioCraft (local GPU)")
        elif elevenlabs_available():
            sfx_backend = "elevenlabs"
            music_backend = "placeholder"
            print("[INFO] Using ElevenLabs (cloud) for SFX, placeholder for music")
        else:
            sfx_backend = "placeholder"
            music_backend = "placeholder"
            print("[WARN] No audio backend available — generating silent placeholders")
            print("  Install AudioCraft: pip install audiocraft torch torchaudio")
            print("  Or set ELEVENLABS_API_KEY for cloud SFX")

    # Generate SFX
    if args.type in ("sfx", "all"):
        ensure_dir(OUTPUT_SFX)
        sfx_list = manifest.get("sfx", [])
        print(f"\n{'='*60}")
        print(f"  SFX Generation ({len(sfx_list)} sounds, backend: {sfx_backend})")
        print(f"{'='*60}")

        for sfx in sfx_list:
            if args.id and sfx["id"] != args.id:
                continue

            out_path = OUTPUT_SFX / f"{sfx['id']}.wav"
            if out_path.exists():
                print(f"  [SKIP] {sfx['id']}.wav — already exists")
                continue

            duration = sfx.get("duration", 1.0)
            prompt = sfx["prompt"]
            print(f"  [GEN] {sfx['id']} ({duration}s)")

            if sfx_backend == "audiocraft":
                ok = audiocraft_generate_sfx(prompt, duration, out_path)
            elif sfx_backend == "elevenlabs":
                ok = elevenlabs_generate_sfx(prompt, duration, out_path)
            else:
                generate_silence(duration, out_path)
                ok = True
                print(f"    (placeholder)")

            if ok:
                print(f"    → {out_path}")

    # Generate Music
    if args.type in ("music", "all"):
        ensure_dir(OUTPUT_MUSIC)
        music_list = manifest.get("music", [])
        print(f"\n{'='*60}")
        print(f"  Music Generation ({len(music_list)} tracks, backend: {music_backend})")
        print(f"{'='*60}")

        for track in music_list:
            if args.id and track["id"] != args.id:
                continue

            out_path = OUTPUT_MUSIC / f"{track['id']}.wav"
            if out_path.exists():
                print(f"  [SKIP] {track['id']}.wav — already exists")
                continue

            duration = track.get("duration", 30)
            prompt = track["prompt"]
            print(f"  [GEN] {track['id']} ({duration}s)")

            if music_backend == "audiocraft":
                ok = audiocraft_generate_music(prompt, duration, out_path)
            else:
                generate_silence(duration, out_path)
                ok = True
                print(f"    (placeholder)")

            if ok:
                print(f"    → {out_path}")

    print(f"\n[DONE] Audio saved to:")
    print(f"  SFX:   {OUTPUT_SFX}")
    print(f"  Music: {OUTPUT_MUSIC}")


if __name__ == "__main__":
    main()
