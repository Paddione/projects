#!/bin/bash
set -euo pipefail

# Load environment variables from parent .env if it exists
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
if [ -f "$ROOT_DIR/.env" ]; then
    set -a
    source "$ROOT_DIR/.env"
    set +a
fi

# Set defaults if not provided
export IMAGE=${IMAGE:-vllm/vllm-openai:latest}
export PORT=${PORT:-8888}
export MODEL=${MODEL:-Qwen/Qwen3-0.6B}

if [ -z "${HF_TOKEN:-}" ]; then
    echo "Warning: HF_TOKEN is not set. HuggingFace models might not download."
fi

echo "Starting RAG Stack..."
echo "- vLLM Port: $PORT"
echo "- Model: $MODEL"
echo "- UI: http://localhost:3000"
echo "- Qdrant: http://localhost:6333"

cd "$ROOT_DIR/rag"
docker-compose up -d --build

echo "Stack is booting up. It may take a few minutes to download images and models."
echo "You can drop files into: $(pwd)/storage/inbox"
