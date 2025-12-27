#!/bin/bash

# ============================================================================
# Coqui TTS Setup Script
# Sets up Coqui TTS with XTTSv2 for text-to-speech and voice cloning
# ============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="${SCRIPT_DIR}/.venv-tts"

echo "============================================"
echo "Coqui TTS Setup"
echo "============================================"
echo ""

# Check for Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 is not installed. Please install Python 3.9+ first."
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
echo "✓ Python version: $PYTHON_VERSION"

# Check Python version is 3.9+
MAJOR=$(echo $PYTHON_VERSION | cut -d. -f1)
MINOR=$(echo $PYTHON_VERSION | cut -d. -f2)
if [ "$MAJOR" -lt 3 ] || ([ "$MAJOR" -eq 3 ] && [ "$MINOR" -lt 9 ]); then
    echo "❌ Python 3.9+ is required. Found: $PYTHON_VERSION"
    exit 1
fi

# Check for pip
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip3 is not installed. Please install it first."
    exit 1
fi
echo "✓ pip3 is installed"

# Create virtual environment
echo ""
echo "Creating virtual environment..."
if [ ! -d "$VENV_DIR" ]; then
    python3 -m venv "$VENV_DIR"
    echo "✓ Virtual environment created at $VENV_DIR"
else
    echo "✓ Virtual environment already exists"
fi

# Activate virtual environment
source "$VENV_DIR/bin/activate"

# Upgrade pip
echo ""
echo "Upgrading pip..."
pip install --upgrade pip

# Install PyTorch with CUDA support if available
echo ""
echo "Checking for CUDA support..."
if command -v nvidia-smi &> /dev/null; then
    echo "✓ NVIDIA GPU detected, installing PyTorch with CUDA support..."
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
else
    echo "ℹ No NVIDIA GPU detected, using CPU-only PyTorch (TTS will be slower)"
    pip install torch torchvision torchaudio
fi

# Install Coqui TTS
echo ""
echo "Installing Coqui TTS..."
pip install TTS

# Verify installation
echo ""
echo "Verifying installation..."
python -c "from TTS.api import TTS; print('✓ Coqui TTS installed successfully')"

# Pre-download XTTS model (optional)
echo ""
read -p "Pre-download XTTSv2 model (~1.5GB)? [y/n] (default: y): " DOWNLOAD_MODEL
DOWNLOAD_MODEL=${DOWNLOAD_MODEL:-y}

if [ "$DOWNLOAD_MODEL" = "y" ] || [ "$DOWNLOAD_MODEL" = "Y" ]; then
    echo "Downloading XTTSv2 model (this may take a while)..."
    python -c "
from TTS.api import TTS
import torch
device = 'cuda' if torch.cuda.is_available() else 'cpu'
tts = TTS('tts_models/multilingual/multi-dataset/xtts_v2').to(device)
print('✓ XTTSv2 model downloaded successfully')
"
fi

# Create directories
echo ""
echo "Creating directories..."
mkdir -p "${SCRIPT_DIR}/voice-models"
mkdir -p "${SCRIPT_DIR}/tts-output"
echo "✓ Directories created"

echo ""
echo "============================================"
echo "✅ Coqui TTS setup complete!"
echo "============================================"
echo ""
echo "To use TTS, activate the virtual environment:"
echo "  source $VENV_DIR/bin/activate"
echo ""
echo "Or use python directly:"
echo "  $VENV_DIR/bin/python"
echo ""
echo "Supported features:"
echo "  - Multi-language TTS (en, de, es, fr, it, pt, pl, tr, ru, nl, cs, ar, zh, ja, ko, hu)"
echo "  - Voice cloning from 6+ seconds of reference audio"
echo "  - Adjustable speed and language"
echo ""
echo "Voice models are stored in: ${SCRIPT_DIR}/voice-models/"
echo "Audio output is stored in: ${SCRIPT_DIR}/tts-output/"
echo ""
