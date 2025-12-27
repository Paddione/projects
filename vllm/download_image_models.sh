#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FORGE_DIR="$SCRIPT_DIR/ai-image-gen/forge"
MODEL_DIR="$FORGE_DIR/models/Stable-diffusion"
VAE_DIR="$FORGE_DIR/models/VAE"
ENCODER_DIR="$FORGE_DIR/models/text_encoder"

mkdir -p "$MODEL_DIR" "$VAE_DIR" "$ENCODER_DIR"

cd "$MODEL_DIR"

echo "📥 Downloading FLUX.1-schnell GGUF Q8 (~13GB)..."
aria2c -x 16 -s 16 -k 1M --continue=true "https://huggingface.co/city96/FLUX.1-schnell-gguf/resolve/main/flux1-schnell-Q8_0.gguf"

echo "📥 Downloading SDXL Base (~6GB)..."
aria2c -x 16 -s 16 -k 1M --continue=true "https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0.safetensors"

echo "📥 Downloading Flux Essentials (VAE/Encoders)..."
cd "$VAE_DIR"
aria2c -x 16 -s 16 -k 1M --continue=true "https://huggingface.co/SicariusSicariiStuff/FLUX.1-dev/resolve/main/ae.safetensors"

cd "$ENCODER_DIR"
aria2c -x 16 -s 16 -k 1M --continue=true "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/clip_l.safetensors"
aria2c -x 16 -s 16 -k 1M --continue=true "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/t5xxl_fp8_e4m3fn.safetensors"

echo "✅ All downloads complete!"
