#!/bin/bash

# ============================================================================
# Whisper Setup Script
# Sets up OpenAI Whisper for local transcription
# ============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
VENV_DIR="${ROOT_DIR}/.venv-whisper"

echo "============================================"
echo "OpenAI Whisper Setup"
echo "============================================"
echo ""

# Check for Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 is not installed. Please install Python 3.8+ first."
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
echo "✓ Python version: $PYTHON_VERSION"

# Check for FFmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo "❌ FFmpeg is not installed. Please install it first:"
    echo "   Ubuntu/Debian: sudo apt install ffmpeg"
    echo "   macOS: brew install ffmpeg"
    exit 1
fi
echo "✓ FFmpeg is installed"

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

# Install Whisper
echo ""
echo "Installing OpenAI Whisper..."
pip install openai-whisper

# Install torch with CUDA support if available
echo ""
echo "Checking for CUDA support..."
if command -v nvidia-smi &> /dev/null; then
    echo "✓ NVIDIA GPU detected, installing PyTorch with CUDA support..."
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
else
    echo "ℹ No NVIDIA GPU detected, using CPU-only PyTorch"
fi

# Verify installation
echo ""
echo "Verifying installation..."
python -c "import whisper; print(f'✓ Whisper version: {whisper.__version__}')"

# Pre-download a model (optional)
echo ""
read -p "Pre-download a Whisper model? [base/small/medium/large/n] (default: base): " MODEL_CHOICE
MODEL_CHOICE=${MODEL_CHOICE:-base}

if [ "$MODEL_CHOICE" != "n" ]; then
    echo "Downloading $MODEL_CHOICE model (this may take a while)..."
    python -c "import whisper; model = whisper.load_model('$MODEL_CHOICE'); print(f'✓ Model $MODEL_CHOICE downloaded successfully')"
fi

echo ""
echo "============================================"
echo "✅ Whisper setup complete!"
echo "============================================"
echo ""
echo "To use Whisper, activate the virtual environment:"
echo "  source $VENV_DIR/bin/activate"
echo ""
echo "Or use python directly:"
echo "  $VENV_DIR/bin/python -c 'import whisper; ...'"
echo ""
echo "Available models (ordered by accuracy/speed):"
echo "  tiny    - 39MB  - Fastest, basic accuracy"
echo "  base    - 74MB  - Good balance"
echo "  small   - 244MB - Better accuracy"
echo "  medium  - 769MB - High accuracy"
echo "  large   - 1.5GB - Best accuracy, slowest"
echo ""
