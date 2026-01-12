# VLLM

## Purpose
MCP (Model Context Protocol) server for AI inference and analysis. Provides tools for running LLM inference, database queries, and RAG (Retrieval Augmented Generation) workflows. Includes dashboard for managing containers and RAG stack.

## Stack
- **MCP Server**: TypeScript, stdio communication
- **Inference**: vLLM, GGUF models
- **Database**: PostgreSQL (read-only tools)
- **Dashboard**: Node.js, Express
- **RAG Stack**: Qdrant, LlamaIndex, Open WebUI
- **Testing**: Jest

## Quick Start
```bash
cd vllm
npm install
npm run dev:watch
```

## Architecture

### System Overview

```mermaid
graph TB
    subgraph "Claude Desktop"
        Claude[Claude Desktop App]
    end

    subgraph "MCP Server :stdio"
        MCP[MCP Server<br/>TypeScript]
        Tools[Tool Handlers]
    end

    subgraph "AI Infrastructure"
        vLLM[vLLM Container<br/>:8000]
        Forge[LM-Forge<br/>:8001]
        Infinity[Infinity Embed<br/>:7997]
    end

    subgraph "RAG Stack"
        Qdrant[Qdrant Vector DB<br/>:6333]
        WebUI[Open WebUI<br/>:3002]
    end

    subgraph "Database"
        PG[(PostgreSQL)]
    end

    subgraph "Management"
        Dashboard[Dashboard<br/>:4242]
    end

    Claude <-->|stdio| MCP
    MCP --> Tools

    Tools -->|HTTP| vLLM
    Tools -->|HTTP| Forge
    Tools -->|HTTP| Infinity
    Tools -->|SELECT only| PG

    Dashboard --> vLLM
    Dashboard --> Forge
    Dashboard --> Infinity

    WebUI --> Qdrant
    WebUI --> vLLM
    WebUI --> PG

    style MCP fill:#e1f5ff
    style vLLM fill:#ffe1e1
    style PG fill:#e1f5ff
```

### MCP Architecture

```mermaid
graph LR
    subgraph "Client (Claude Desktop)"
        Client[Claude Desktop]
    end

    subgraph "MCP Server"
        Stdio[Stdio Transport]
        Handler[Request Handler]
        Router[Tool Router]
    end

    subgraph "Tool Implementations"
        Inference[inference_query]
        DB[database_query]
        Analysis[analyze_text]
        RAG[rag_query]
    end

    subgraph "External Services"
        vLLM_API[vLLM API]
        Postgres[PostgreSQL]
        Vector[Vector DB]
    end

    Client <-->|JSON-RPC| Stdio
    Stdio --> Handler
    Handler --> Router

    Router --> Inference
    Router --> DB
    Router --> Analysis
    Router --> RAG

    Inference --> vLLM_API
    DB --> Postgres
    Analysis --> vLLM_API
    RAG --> Vector
    RAG --> vLLM_API

    style Stdio fill:#e1f5ff
    style vLLM_API fill:#ffe1e1
```

**MCP Protocol:** Uses JSON-RPC over stdio for communication between Claude Desktop and the MCP server.

### Tool Architecture

```mermaid
graph TB
    subgraph "MCP Tools"
        T1[inference_query<br/>LLM completion]
        T2[database_query<br/>PostgreSQL SELECT]
        T3[analyze_text<br/>Text analysis]
        T4[list_models<br/>Available models]
    end

    subgraph "Tool Handlers"
        H1[Inference Handler]
        H2[Database Handler]
        H3[Analysis Handler]
        H4[Model Handler]
    end

    subgraph "External APIs"
        vLLM[vLLM API<br/>:8000]
        DB[(PostgreSQL)]
    end

    T1 --> H1
    T2 --> H2
    T3 --> H3
    T4 --> H4

    H1 --> vLLM
    H2 --> DB
    H3 --> vLLM
    H4 --> vLLM

    style DB fill:#e1f5ff
    style vLLM fill:#ffe1e1
```

**Key Directories:**
- `src/` - MCP server implementation
- `src/tools/` - Tool handler implementations
- `tests/` - Jest tests for tools
- `dashboard/` - Container management dashboard
- `rag/` - RAG stack configuration
- `scripts/` - Deployment and utility scripts

## MCP Tools

### inference_query

Execute LLM inference via vLLM API.

```typescript
// Example usage from Claude Desktop
{
  "tool": "inference_query",
  "arguments": {
    "prompt": "Explain quantum computing",
    "model": "meta-llama/Llama-2-7b-chat-hf",
    "max_tokens": 500,
    "temperature": 0.7
  }
}
```

### database_query

Execute SELECT-only queries on PostgreSQL (security-constrained).

```typescript
// Example usage
{
  "tool": "database_query",
  "arguments": {
    "query": "SELECT * FROM users WHERE status = 'active' LIMIT 10"
  }
}
```

**Security:** Only SELECT statements allowed. INSERT, UPDATE, DELETE, and DDL are blocked.

### analyze_text

Perform text analysis tasks (sentiment, summarization, etc.).

```typescript
// Example usage
{
  "tool": "analyze_text",
  "arguments": {
    "text": "Long document content...",
    "task": "summarize",
    "length": "brief"
  }
}
```

### list_models

List available models from vLLM, LM-Forge, and Infinity.

```typescript
// Example usage
{
  "tool": "list_models",
  "arguments": {}
}
```

## Inference Flow

```mermaid
sequenceDiagram
    participant Claude as Claude Desktop
    participant MCP as MCP Server
    participant vLLM as vLLM Container
    participant Model as LLM Model

    Claude->>MCP: inference_query<br/>(via stdio)
    MCP->>MCP: Validate request
    MCP->>vLLM: POST /v1/completions
    vLLM->>Model: Load model (if needed)
    Model-->>vLLM: Model ready
    vLLM->>vLLM: Generate tokens
    vLLM-->>MCP: Completion response
    MCP-->>Claude: Formatted result

    style vLLM fill:#ffe1e1
    style MCP fill:#e1f5ff
```

## RAG Stack Architecture

```mermaid
graph TB
    subgraph "User Interface"
        WebUI[Open WebUI<br/>:3002]
    end

    subgraph "Vector Search"
        Qdrant[Qdrant<br/>Vector DB<br/>:6333]
    end

    subgraph "Embeddings"
        Infinity[Infinity Embed<br/>:7997]
    end

    subgraph "LLM"
        vLLM[vLLM<br/>:8000]
    end

    subgraph "Storage"
        DB[(PostgreSQL)]
    end

    WebUI --> Qdrant
    WebUI --> vLLM
    WebUI --> DB

    Qdrant --> Infinity

    style Qdrant fill:#e1f5ff
    style DB fill:#e1f5ff
    style vLLM fill:#ffe1e1
```

**RAG Workflow:**
1. User submits query via Open WebUI
2. Query embedded via Infinity
3. Vector search in Qdrant
4. Retrieved context + query sent to vLLM
5. Response returned to user

## Build & Development

### Build MCP Server

```bash
cd vllm

# Install dependencies
npm install

# Build TypeScript
npm run build

# Output: dist/index.js
```

### Development Mode

```bash
cd vllm

# Watch mode (auto-rebuild on changes)
npm run dev:watch
```

### Testing

```bash
cd vllm

# Run all tests
npm test

# Run specific test
npx jest src/tools/inference.test.ts

# Test with coverage
npm test -- --coverage
```

## Key Scripts
- `npm run dev:watch` - rebuild on changes
- `npm run build` - build MCP server
- `npm test` - run tests
- `./scripts/start_rag.sh` - start RAG stack

## Dashboard

```mermaid
graph LR
    subgraph "Dashboard :4242"
        UI[Web Interface]
        API[Express API]
    end

    subgraph "Container Management"
        Docker[Docker API]
    end

    subgraph "Containers"
        vLLM[vLLM]
        Forge[LM-Forge]
        Infinity[Infinity]
    end

    UI --> API
    API --> Docker
    Docker --> vLLM
    Docker --> Forge
    Docker --> Infinity

    style vLLM fill:#ffe1e1
    style Forge fill:#ffe1e1
    style Infinity fill:#ffe1e1
```

### Start Dashboard

```bash
cd vllm/dashboard

# Start dashboard server
node server.js    # http://localhost:4242
```

**Dashboard Features:**
- View container status
- Start/stop containers
- View logs
- Monitor resource usage
- Model management

## RAG Stack Deployment

### Start RAG Stack

```bash
cd vllm

# Start full RAG environment
./scripts/start_rag.sh
```

**Components Started:**
- Qdrant (vector database)
- Infinity (embedding service)
- Open WebUI (user interface)
- vLLM (LLM inference)

### Stop RAG Stack

```bash
cd vllm/rag
docker-compose down
```

## Claude Desktop Integration

### MCP Configuration

Add to Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "vllm": {
      "command": "node",
      "args": ["/absolute/path/to/vllm/dist/index.js"],
      "env": {
        "VLLM_API_URL": "http://localhost:8000",
        "DATABASE_URL": "postgresql://user:pass@localhost:5432/db"
      }
    }
  }
}
```

**Important:** Use absolute paths in configuration.

### Verify Connection

```bash
# Check MCP server logs
tail -f ~/.config/Claude/logs/mcp-vllm.log

# Test tool availability in Claude Desktop
# Tools should appear in Claude's tool list
```

## Container Deployment

### vLLM Container

```bash
cd vllm

# Deploy vLLM with model
bash scripts/deploy.sh

# Or manually
docker run -d \
  --name vllm \
  --gpus all \
  -p 8000:8000 \
  -v ~/.cache/huggingface:/root/.cache/huggingface \
  vllm/vllm-openai:latest \
  --model meta-llama/Llama-2-7b-chat-hf \
  --max-model-len 4096
```

### LM-Forge Container

```bash
docker run -d \
  --name lm-forge \
  --gpus all \
  -p 8001:8001 \
  lm-forge:latest
```

### Infinity Embedding

```bash
docker run -d \
  --name infinity-embed \
  --gpus all \
  -p 7997:7997 \
  michaelf34/infinity:latest
```

## Environment Setup

### Required Variables

```bash
# vLLM API
VLLM_API_URL=http://localhost:8000
VLLM_API_KEY=optional_api_key

# LM-Forge
FORGE_API_URL=http://localhost:8001

# Infinity
INFINITY_API_URL=http://localhost:7997

# Database (for Open WebUI)
DATABASE_URL=postgresql://user:pass@shared-postgres:5432/vllm_db

# RAG Stack
QDRANT_URL=http://localhost:6333
OPEN_WEBUI_PORT=3002
```

## Ports

| Service | Port | Protocol |
|---------|------|----------|
| MCP Server | stdio | JSON-RPC |
| vLLM API | 8000 | HTTP |
| LM-Forge | 8001 | HTTP |
| Infinity Embed | 7997 | HTTP |
| Qdrant | 6333 | HTTP |
| Open WebUI | 3002 | HTTP |
| Dashboard | 4242 | HTTP |

## API Endpoints

### vLLM API

```
POST   /v1/completions
POST   /v1/chat/completions
GET    /v1/models
GET    /health
```

### Dashboard API

```
GET    /api/containers
POST   /api/containers/:name/start
POST   /api/containers/:name/stop
GET    /api/containers/:name/logs
GET    /api/models
```

## Performance Considerations

### Model Loading

```mermaid
flowchart LR
    A[Request Inference] --> B{Model Loaded?}
    B -->|Yes| C[Generate]
    B -->|No| D[Load Model]
    D --> E[Allocate GPU Memory]
    E --> F[Load Weights]
    F --> G[Compile Kernels]
    G --> C
    C --> H[Return Result]

    style D fill:#fff4e1
    style E fill:#fff4e1
    style F fill:#fff4e1
```

**Cold Start:** First request to a model takes longer (10-60s) due to loading.

**Optimization:**
- Keep frequently used models in memory
- Use smaller quantized models (GGUF)
- Allocate sufficient GPU VRAM
- Enable tensor parallelism for large models

### Batching

vLLM automatically batches requests for efficiency:
- Multiple concurrent requests processed together
- Reduces per-request latency
- Increases throughput

## Security Constraints

### Database Tools

```mermaid
flowchart LR
    A[Database Query Tool] --> B{Parse SQL}
    B --> C{Allowed?}
    C -->|SELECT| D[Execute]
    C -->|INSERT/UPDATE/DELETE| E[Block]
    C -->|DDL| E
    D --> F[Return Results]
    E --> G[Return Error]

    style E fill:#ffe1e1
    style F fill:#e1ffe1
```

**Allowed:** SELECT queries only

**Blocked:** INSERT, UPDATE, DELETE, DROP, CREATE, ALTER, etc.

**Reason:** Prevent accidental or malicious data modification.

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| MCP server not connecting | Check absolute paths in claude_desktop_config.json |
| vLLM API not responding | Verify container is running: `docker ps` |
| Out of memory error | Reduce model size or increase GPU VRAM |
| Slow inference | Enable GPU, check CUDA availability |
| Database connection fails | Verify DATABASE_URL and PostgreSQL is running |
| Tool not found in Claude | Restart Claude Desktop, check MCP logs |

### Debug Mode

```bash
# MCP server verbose logs
DEBUG=* node dist/index.js

# Check vLLM logs
docker logs vllm -f

# Check dashboard logs
cd dashboard
DEBUG=* node server.js
```

### GPU Verification

```bash
# Check GPU availability
nvidia-smi

# Verify CUDA in container
docker exec vllm nvidia-smi

# Check vLLM GPU usage
curl http://localhost:8000/health
```

## Model Management

### Supported Models

- **Llama 2** (7B, 13B, 70B)
- **Mistral** (7B, 8x7B Mixtral)
- **CodeLlama** (7B, 13B, 34B)
- **Phi-2/3**
- **Gemma**
- **GGUF quantized models**

### Download Models

```bash
# Via Hugging Face
python -c "from huggingface_hub import snapshot_download; \
  snapshot_download('meta-llama/Llama-2-7b-chat-hf')"

# Models cached in ~/.cache/huggingface
```

## Advanced Usage

### Custom Tool Implementation

```typescript
// src/tools/custom.ts
export async function customTool(args: any) {
  // Tool implementation
  const result = await processRequest(args);
  return {
    content: [{ type: 'text', text: JSON.stringify(result) }]
  };
}
```

### RAG Pipeline Customization

```python
# Custom embedding pipeline
from llama_index import VectorStoreIndex, SimpleDirectoryReader

documents = SimpleDirectoryReader('data').load_data()
index = VectorStoreIndex.from_documents(documents)
query_engine = index.as_query_engine()

response = query_engine.query("Your question here")
```

## Monitoring

### Key Metrics
- Inference latency (time per token)
- Throughput (tokens/second)
- GPU utilization
- Memory usage
- Request queue depth
- Model load time

### Dashboard Monitoring

Access http://localhost:4242 for real-time metrics:
- Container status
- Resource usage
- Request logs
- Error rates

## Links

- [[Architecture Overview]] - System architecture
- [[Database Architecture]] - Database details
- [[Repository Index]] - Back to index
