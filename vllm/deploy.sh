#!/bin/bash
set -euo pipefail

# Load environment variables
if [ -f .env ]; then
    set -a
    # shellcheck source=/dev/null
    source .env
    set +a
fi

IMAGE=${IMAGE:-vllm/vllm-openai:latest}
PLATFORM=${PLATFORM:-linux/amd64}
PORT=${PORT:-8888}
MODEL=${MODEL:-Qwen/Qwen2.5-Coder-1.5B}

# Check for HF_TOKEN
if [ -z "$HF_TOKEN" ]; then
    echo "Error: HF_TOKEN is not set. Please set it in .env file or environment."
    exit 1
fi

# Handle API Key
VLLM_API_KEY=${VLLM_API_KEY:-}

# Run Docker container with WSL memory pinning patch and Root Route patch
docker run -d --runtime nvidia --gpus all \
    --platform "$PLATFORM" \
    --ipc=host \
    --ulimit memlock=-1 \
    --ulimit stack=67108864 \
    -v /usr/lib/wsl:/usr/lib/wsl \
    --device /dev/dxg \
    -v ~/.cache/huggingface:/root/.cache/huggingface \
    --env "HF_TOKEN=$HF_TOKEN" \
    --env "HUGGING_FACE_HUB_TOKEN=$HF_TOKEN" \
    --env "LD_LIBRARY_PATH=/usr/lib/wsl/lib:/usr/local/cuda/lib64:/usr/local/nvidia/lib:/usr/local/nvidia/lib64" \
    --env "NVIDIA_VISIBLE_DEVICES=all" \
    --env "NVIDIA_DRIVER_CAPABILITIES=compute,utility" \
    --env "VLLM_ATTENTION_BACKEND=FLASH_ATTN" \
    --env "VLLM_USE_V1=0" \
    --env "PYTHONUNBUFFERED=1" \
    -p "$PORT:$PORT" \
    --restart no \
    --name vllm_sm120_deployment \
    --entrypoint /bin/bash \
    "$IMAGE" \
    -c "sed -i 's/return \"microsoft\" in \" \".join(platform.uname()).lower()/return False/g' \$(python3 -c 'import vllm; import os; print(os.path.join(os.path.dirname(vllm.__file__), \"platforms/interface.py\"))') && \
        python3 -c \"import vllm.entrypoints.openai.api_server as api; path = api.__file__; content = open(path).read(); (open(path, 'w').write(content.replace('app.include_router(router)', 'app.include_router(router)\\n\\n    @app.get(\\\"/\\\")\\n    async def root(): return {\\\"status\\\": \\\"ok\\\", \\\"message\\\": \\\"vLLM API Server is running\\\", \\\"version\\\": VLLM_VERSION}'))) if '@app.get(\\\"/\\\")' not in content else None\" && \
        exec vllm serve \"$MODEL\" --host 0.0.0.0 --port \"$PORT\" --gpu-memory-utilization 0.75 --max-num-seqs 128 ${VLLM_API_KEY:+--api-key \"$VLLM_API_KEY\"}"
