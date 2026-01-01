#!/bin/bash

# Repository Setup Script
# This script automates the setup process for all projects

set -e  # Exit on error

echo "=========================================="
echo "Patrick's Projects - Automated Setup"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Check prerequisites
echo "Checking prerequisites..."

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    print_success "Node.js found: $NODE_VERSION"
else
    print_error "Node.js not found. Please install Node.js 18 or higher."
    exit 1
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    print_success "npm found: $NPM_VERSION"
else
    print_error "npm not found."
    exit 1
fi

# Check Python
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    print_success "Python found: $PYTHON_VERSION"
else
    print_error "Python3 not found. Please install Python 3.10 or higher."
    exit 1
fi

# Check Docker
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    print_success "Docker found: $DOCKER_VERSION"
else
    print_info "Docker not found. Some features may not work."
fi

echo ""
echo "=========================================="
echo "Setting up projects..."
echo "=========================================="
echo ""

# Function to setup a Node.js project
setup_node_project() {
    local project_name=$1
    local project_path=$2
    
    echo ""
    print_info "Setting up $project_name..."
    
    if [ -d "$project_path" ]; then
        cd "$project_path"
        
        # Check if package.json exists
        if [ -f "package.json" ]; then
            print_info "Installing dependencies for $project_name..."
            npm install
            print_success "$project_name dependencies installed"
        else
            print_info "No package.json found in $project_name, skipping..."
        fi
        
        # Copy .env.example to .env if it doesn't exist
        if [ -f ".env.example" ] && [ ! -f ".env" ]; then
            cp .env.example .env
            print_success "Created .env file for $project_name"
            print_info "Please edit .env file with your configuration"
        fi
        
        cd - > /dev/null
    else
        print_error "$project_name directory not found at $project_path"
    fi
}

# Get the script directory and repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Setup L2P
setup_node_project "L2P" "$ROOT_DIR/l2p"

# Setup Payment
setup_node_project "Payment" "$ROOT_DIR/payment"

# Setup VideoVault
setup_node_project "VideoVault" "$ROOT_DIR/VideoVault"

# Setup VLLM
setup_node_project "VLLM" "$ROOT_DIR/vllm"

# Setup VLLM Dashboard
if [ -d "$ROOT_DIR/vllm/dashboard" ]; then
    setup_node_project "VLLM Dashboard" "$ROOT_DIR/vllm/dashboard"
fi

# Setup Python virtual environment for Forge
echo ""
print_info "Setting up Python environment for AI Image Generation..."

FORGE_PATH="$ROOT_DIR/vllm/ai-image-gen/forge"
if [ -d "$FORGE_PATH" ]; then
    cd "$FORGE_PATH"
    
    if [ ! -d "venv" ]; then
        print_info "Creating Python virtual environment..."
        python3 -m venv venv
        print_success "Virtual environment created"
        
        print_info "Activating virtual environment and installing dependencies..."
        source venv/bin/activate
        
        if [ -f "requirements.txt" ]; then
            print_info "Installing Python packages (this may take a while)..."
            pip install --upgrade pip
            pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
            pip install -r requirements.txt
            print_success "Python dependencies installed"
        else
            print_info "No requirements.txt found, skipping Python package installation"
        fi
        
        deactivate
    else
        print_success "Virtual environment already exists for Forge"
    fi
    
    cd - > /dev/null
else
    print_info "Forge directory not found, skipping Python setup"
fi

# Docker setup
echo ""
print_info "Docker setup..."

if command -v docker &> /dev/null; then
    read -p "Do you want to start Docker services? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Start L2P database
        if [ -f "$ROOT_DIR/l2p/docker-compose.yml" ]; then
            print_info "Starting L2P database..."
            cd "$ROOT_DIR/l2p"
            docker-compose up -d postgres
            print_success "L2P database started"
            cd - > /dev/null
        fi
        
        # Start Payment database
        if [ -f "$ROOT_DIR/payment/compose.yaml" ]; then
            print_info "Starting Payment database..."
            cd "$ROOT_DIR/payment"
            docker-compose up -d db
            print_success "Payment database started"
            cd - > /dev/null
        fi
    fi
fi

# Summary
echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
print_success "All projects have been set up successfully!"
echo ""
echo "Next steps:"
echo "1. Edit .env files in each project with your configuration"
echo "2. Run database migrations (see SETUP_GUIDE.md)"
echo "3. Download AI models if needed (see SETUP_GUIDE.md)"
echo ""
echo "To start development:"
echo "  - L2P:        cd l2p && npm run dev"
echo "  - Payment:    cd payment && npm run dev"
echo "  - VideoVault: cd VideoVault && npm run dev"
echo "  - VLLM:       cd vllm && npm run dev"
echo ""
echo "For more details, see SETUP_GUIDE.md"
echo ""
print_info "Note: AI models are NOT downloaded automatically."
print_info "See SETUP_GUIDE.md for model download instructions."
echo ""
