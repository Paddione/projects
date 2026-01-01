# vLLM MCP Server: Repository Mastermind

An advanced Model Context Protocol (MCP) server for vLLM, designed to bridge AI assistants (like Claude Desktop) with your vLLM instance. It provides LLM inference plus repository review, analysis, and database tooling.

## Key Features

### LLM Inference Integration
- `chat_completion`: Multi-turn conversations
- `completion`: Text completions
- `list_models`: List available models

### Repository Mastermind (Audit & Analysis)
- `analyze_repository`: Repository scan with quality score
- `review_code_with_ai`: AI code review
- `check_guidelines`: Validate against guidelines
- `suggest_improvements`: Prioritized suggestions
- `generate_pr_comment`: PR-ready summaries

### Advanced Analytics & Security
- Git history analysis
- Vulnerability scan via `npm audit`
- Coverage analysis for LCOV/JSON
- Custom rule engine via `.analyzer-rules.yml`

### Database Management (PostgreSQL)
- Schema exploration
- User management (Open-WebUI)
- Safe SELECT queries

### Multi-Media & RAG
- Optional AI image generation stack (Stable Diffusion Forge)
- RAG stack with Qdrant + LlamaIndex (`rag/`)

## Quick Start

### Prerequisites
- Node.js (LTS)
- Docker & Docker Compose
- NVIDIA GPU (recommended)
- PostgreSQL (for Open-WebUI tasks)

### Deploy vLLM

Configure `.env` (copy from `.env.example`) with `HF_TOKEN`, `MODEL`, and `PORT`, then run:

```bash
bash scripts/deploy.sh
```

### AI Image Stack (Optional)

```bash
bash scripts/setup_ai_image_stack.sh
bash scripts/download_image_models.sh
```

### Build MCP Server

```bash
npm install
npm run build
```

## Claude Desktop Integration

Configuration path:
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

Configuration:

```json
{
  "mcpServers": {
    "vllm": {
      "command": "node",
      "args": ["/home/patrick/projects/vllm/build/src/index.js"],
      "env": {
        "VLLM_BASE_URL": "http://localhost:4100",
        "DATABASE_URL": "postgresql://webui:webui@localhost:5438/webui"
      }
    }
  }
}
```

## Dashboard (VRAM Mastermind)

The dashboard controls vLLM, Forge, and Infinity containers.

```bash
cd dashboard
node server.js
```

Open http://localhost:4242.

Tech stack:
- Backend: Node.js, Express, Socket.io, Dockerode
- Frontend: Vanilla HTML/JS/CSS
- Monitoring: `nvidia-smi`

## RAG Stack

Quick start:
1. Ensure `.env` has a valid `HF_TOKEN`.
2. Run `./scripts/start_rag.sh`.
3. Open http://localhost:3000.

Directory dump (inbox):
1. Drop files into `rag/storage/inbox/`.
2. The ingestion engine vectorizes and moves them to `rag/storage/processed/`.

Components:
- Inference: vLLM (GPU)
- Embeddings: Infinity (BGE-M3)
- Vector DB: Qdrant
- Frontend: Open WebUI
- Processor: LlamaIndex watcher

API endpoints:
- vLLM: http://localhost:8888/v1
- Embeddings: http://localhost:7997/v1
- Qdrant: http://localhost:6333

## Tool Catalog

| Category | Tool | Description | Example Parameters |
| --- | --- | --- | --- |
| Inference | `chat_completion` | Multi-turn chat | `{"messages": [{"role": "user", "content": "Explain quantum computing"}]}` |
|  | `completion` | Text completion | `{"prompt": "The future of AI is"}` |
|  | `list_models` | List models | `(no parameters)` |
| Analysis | `analyze_repository` | Deep repo scan | `{"repository_path": "/home/user/project"}` |
|  | `review_code_ai` | AI Code Review | `{"file_path": "src/app.ts", "focus_areas": ["security"]}` |
|  | `check_guidelines` | Guideline check | `{"repository_path": "/path/to/repo", "guidelines_file": "README.md"}` |
|  | `suggest_fixes` | Improvement list | `{"repository_path": "/path/to/repo", "auto_fix": true}` |
|  | `generate_pr` | PR comment | `{"repository_path": "/path/to/repo", "format": "github"}` |
| Advanced | `scan_vulnerability` | Security scan | `{"repository_path": "/path/to/repo"}` |
|  | `analyze_git` | Git stats | `{"repository_path": "/path/to/repo", "commit_limit": 50}` |
|  | `analyze_coverage` | Test coverage | `{"repository_path": "/path/to/repo"}` |
|  | `validate_rules` | Custom YAML rules | `{"repository_path": "/path/to/repo"}` |
| Database | `db_describe` | Schema info | `(no parameters)` |
|  | `db_list_users` | List users | `(no parameters)` |
|  | `db_run_query` | Run SELECT query | `{"sql": "SELECT count(*) FROM \"user\""}` |
|  | `db_set_role` | Update role | `{"email": "user@example.com", "role": "admin"}` |

## Architecture & Patterns

- MCP server communicates via stdio with Claude Desktop
- Tool handlers are written in TypeScript
- Axios used for vLLM API calls
- PostgreSQL connection for database tools

## Environment Files

Recommended structure:
- `.env.example` (template)
- `.env-dev` (development)
- `.env-prod` (production)

The deployment script reads `.env`. For local work, copy `.env-dev` to `.env` as needed.

RAG stack (production):
- `vllm/rag/.env-prod` from `.env.example`
- Generate `WEBUI_SECRET_KEY` with `openssl rand -hex 32`
- Update `CORS_ALLOW_ORIGIN` with production domains

Required values:
- `HF_TOKEN` (Hugging Face access token)
- `VLLM_API_KEY` (API key for vLLM)
- `ADMIN_PASSWORD` (dashboard/admin password)
- `INFINITY_API_KEY` (embeddings API key)

## Critical Constraints

- Database tools only allow SELECT queries (security)
- GPU recommended for optimal performance
- MCP server path must be absolute in Claude config

## Important Files

- `scripts/deploy.sh`: vLLM container deployment
- `.analyzer-rules.yml`: custom linting rules
- `claude_desktop_config.json`: example MCP config

## License

MIT
