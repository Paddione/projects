# VRAM Mastermind Dashboard

A lightweight, premium control center for managing your AI models and GPU VRAM.

## How it works
- **vLLM (LLM)**: Controls the `vllm-rag` Docker container. This model is your "Brain" for code analysis and chat.
- **Forge (Image Gen)**: Controls the local Stable Diffusion Forge process. Uses FLUX.1/SDXL for high-quality visuals.
- **Infinity (Embeddings)**: Controls the `infinity-embeddings` container. Required for the RAG (Document Search) feature.

## Usage
Run from the root directory:
```bash
cd dashboard
node server.js
```
Then open `http://localhost:4242` in your browser.

## Tech Stack
- **Backend**: Node.js, Express, Socket.io, Dockerode
- **Frontend**: Vanilla HTML/JS/CSS (Premium Glassmorphism Design)
- **Monitoring**: Real-time `nvidia-smi` integration.
