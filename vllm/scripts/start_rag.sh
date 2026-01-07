#!/bin/bash
set -euo pipefail

# Production RAG Stack Deployment Script
# Starts all services in Docker containers for production use

# Load environment variables from parent .env if it exists
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Use production environment by default
if [ -f "$ROOT_DIR/.env-prod" ]; then
    echo "📋 Loading production environment variables..."
    set -a
    source "$ROOT_DIR/.env-prod"
    set +a
elif [ -f "$ROOT_DIR/.env" ]; then
    set -a
    source "$ROOT_DIR/.env"
    set +a
fi

# Ensure NODE_ENV is set to production
export NODE_ENV=production

# Set defaults if not provided
export IMAGE=${IMAGE:-vllm/vllm-openai:latest}
export PORT=${PORT:-8888}
export MODEL=${MODEL:-Qwen/Qwen3-0.6B}

if [ -z "${HF_TOKEN:-}" ]; then
    echo "⚠️  Warning: HF_TOKEN is not set. HuggingFace models might not download."
fi

echo "========================================="
echo "  🚀 Starting RAG Stack (PRODUCTION)"
echo "========================================="
echo ""
echo "Configuration:"
echo "  - vLLM Port: $PORT"
echo "  - Model: $MODEL"
echo "  - Environment: PRODUCTION"
echo ""
echo "Services:"
echo "  - Dashboard: https://dashboard.korczewski.de"
echo "  - Open WebUI: https://chat.korczewski.de"
echo "  - Qdrant: https://qdrant.korczewski.de"
echo ""

cd "$ROOT_DIR/rag"
docker-compose up -d --build

echo ""
echo "✅ Production stack is booting up."
echo "   It may take a few minutes to download images and models."
echo ""
echo "📂 Document inbox: $(pwd)/storage/inbox"
echo "========================================="

