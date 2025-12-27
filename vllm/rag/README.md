# Integrated RAG Solution for vLLM

This solution provides a high-quality, fully open-source RAG (Retrieval-Augmented Generation) stack integrated with your vLLM inference engine.

## Quick Start
1. Ensure your `.env` in the root directory has a valid `HF_TOKEN`.
2. Run `./start_rag.sh`.
3. Open `http://localhost:3000` in your browser to access the Chat UI.

## Directory Dump Feature (Inbox)
To index documents and code into your RAG brain:
1. Drop files (PDF, Markdown, Code) into `rag/storage/inbox/`.
2. The **Ingestion Engine** will:
   - Vectorize the content using `BAAI/bge-m3`.
   - Index it into **Qdrant**.
   - Automatically sort and move the file into `rag/storage/processed/[Category]/`.

## Components
- **Inference**: vLLM (runs on GPU, 75% utilization).
- **Embeddings**: Infinity (runs on GPU, BGE-M3 model).
- **Vector DB**: Qdrant (Persistent storage).
- **Frontend**: Open WebUI (Supports RAG and local vllm).
- **Processor**: LlamaIndex-based watcher.

## Configuration
- Modify `docker-compose.yml` to change models or GPU settings.
- The stack shares the same GPU. If you experience VRAM issues, lower `gpu_memory_utilization` in `docker-compose.yml`.

## API Access
- **vLLM API**: `http://localhost:8888/v1`
- **Embeddings API**: `http://localhost:7997/v1`
- **Qdrant API**: `http://localhost:6333`
