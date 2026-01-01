#!/bin/bash

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
INSTALL_DIR="$ROOT_DIR/ai-image-gen"
FORGE_DIR="$INSTALL_DIR/forge"
MODEL_DIR="$FORGE_DIR/models/Stable-diffusion"
VAE_DIR="$FORGE_DIR/models/VAE"
ENCODER_DIR="$FORGE_DIR/models/text_encoder"

echo "🚀 Starting AI Image Stack Installation (Forge + Pinokio)..."

# Create directories
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR" || exit

# 1. Download Pinokio (Latest .deb)
echo "📦 Downloading Pinokio AI Browser..."
PINOKIO_URL="https://github.com/pinokiocomputer/pinokio/releases/download/v5.1.10/Pinokio_5.1.10_amd64.deb"
wget -q --show-progress "$PINOKIO_URL" -O pinokio_latest.deb
echo "✅ Pinokio downloaded to $INSTALL_DIR/pinokio_latest.deb"

# 2. Setup SD-WebUI-Forge
echo "🛠️ Cloning SD-WebUI-Forge..."
if [ ! -d "$FORGE_DIR" ]; then
    git clone https://github.com/lllyasviel/stable-diffusion-webui-forge "$FORGE_DIR"
else
    echo "⚠️ Forge directory already exists, skipping clone."
fi

# Create model subdirectories for Flux
mkdir -p "$VAE_DIR"
mkdir -p "$ENCODER_DIR"

# 3. Download the "2 Most Contested Models" + Flux Essentials
echo "📥 Downloading Models (this may take a while, ~40GB total)..."

# --- FLUX.1 [schnell] (The Current King) ---
echo "🔹 Downloading FLUX.1-schnell..."
aria2c -x 16 -s 16 -k 1M "https://huggingface.co/black-forest-labs/FLUX.1-schnell/resolve/main/flux1-schnell.safetensors" -d "$MODEL_DIR" -o flux1-schnell.safetensors

# --- SDXL 1.0 Base (The Established Standard) ---
echo "🔹 Downloading SDXL 1.0 Base..."
aria2c -x 16 -s 16 -k 1M "https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0.safetensors" -d "$MODEL_DIR" -o sd_xl_base_1.0.safetensors

# --- Flux Necessities (VAE & Encoders) ---
echo "🔹 Downloading Flux VAE..."
aria2c -x 16 -s 16 -k 1M "https://huggingface.co/black-forest-labs/FLUX.1-dev/resolve/main/ae.safetensors" -d "$VAE_DIR" -o ae.safetensors

echo "🔹 Downloading Flux CLIP-L..."
aria2c -x 16 -s 16 -k 1M "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/clip_l.safetensors" -d "$ENCODER_DIR" -o clip_l.safetensors

echo "🔹 Downloading Flux T5-XXL (FP8)..."
aria2c -x 16 -s 16 -k 1M "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/t5xxl_fp8_e4m3fn.safetensors" -d "$ENCODER_DIR" -o t5xxl_fp8_e4m3fn.safetensors

echo "✨ All models and tools are ready!"
echo "--------------------------------------------------"
echo "To start Forge for the first time:"
echo "1. cd $FORGE_DIR"
echo "2. ./webui.sh"
echo "--------------------------------------------------"
echo "To install Pinokio (GUI Interface Manager):"
echo "sudo dpkg -i $INSTALL_DIR/pinokio_latest.deb"
