# vLLM MCP Server: Repository Mastermind 🚀

An advanced Model Context Protocol (MCP) server for **vLLM**, designed to bridge AI assistants (like Claude Desktop) with your vLLM instance. It doesn't just provide LLM inference; it acts as a **Repository Mastermind** for code review, analysis, quality assurance, and database management.

---

## 🌟 Key Features

### 1. **LLM Inference Integration**
*   **`chat_completion`**: Multi-turn conversations with system, user, and assistant messages.
*   **`completion`**: Simple text completions.
*   **`list_models`**: List all models available on your vLLM instance.

### 2. **Repository Mastermind (Audit & Analysis)**
*   **`analyze_repository`**: Comprehensive repository scan including structure, issues, and a quality score (0-100).
*   **`review_code_with_ai`**: AI-powered code reviews with focus on security, performance, and readability.
*   **`check_guidelines`**: Validate repository compliance against specific guidelines (e.g., this README or custom docs).
*   **`suggest_improvements`**: Get prioritized suggestions with optional **Auto-Fixes** for common issues.
*   **`generate_pr_comment`**: Automatically format findings into professional GitHub/GitLab-ready comments.

### 3. **Advanced Analytics & Security**
*   **Git History Analysis**: Analyze commit quality, hot spots, contributor stats, and repository evolution.
*   **Vulnerability Scanning**: Integration with `npm audit` with severity categorization and fix recommendations.
*   **Coverage Analysis**: Parse LCOV/JSON reports to identify untested code paths and suggest tests.
*   **Custom Rule Engine**: Define your own YAML-based linting and project rules in `.analyzer-rules.yml`.

### 4. **Database Management (PostgreSQL)**
*   **Schema Exploration**: Inspect your database structure, tables, and columns.
*   **User Management**: List and manage users in the Open-WebUI database (set roles to admin, user, or pending).
*   **Query Execution**: Run safe `SELECT` queries to explore your data directly from the AI assistant.

### 5. **Multi-Media & RAG**
*   **AI Image Generation**: Local stack setup for Stable Diffusion (Forge) and automatic model downloading.
*   **RAG Stack**: Full retrieval-augmented generation pipeline with Qdrant and LlamaIndex (located in `rag/`).

---

## 🚀 Quick Start

### 1. Prerequisites
*   **Node.js** (LTS version)
*   **Docker & Docker Compose**
*   **NVIDIA GPU** (recommended for vLLM and Image Gen performance)
*   **PostgreSQL** (running locally or via Docker for Open-WebUI tasks)

### 2. Deploy vLLM
Configure your `.env` file with your `HF_TOKEN`, `MODEL`, and `PORT`. Then run:
```bash
# Start the vLLM API container
bash deploy.sh
```

### 3. Setup AI Image Stack (Optional)
```bash
# Installs Stable Diffusion Forge and necessary dependencies
bash setup_ai_image_stack.sh
# Download recommended models (SDXL, etc.)
bash download_image_models.sh
```

### 4. Install & Build MCP Server
```bash
npm install
npm run build
```

---

## 💻 Claude Desktop Integration

To use these tools in Claude Desktop, add the server to your configuration:

**Configuration Path:**
*   **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
*   **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

**Configuration:**
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

---

## 🛠 Available Tools & Usage

| Category | Tool | Description | Example Parameters |
| :--- | :--- | :--- | :--- |
| **Inference** | `chat_completion` | Multi-turn chat | `{"messages": [{"role": "user", "content": "Explain quantum computing"}]}` |
| | `completion` | Text completion | `{"prompt": "The future of AI is"}` |
| | `list_models` | List models | `(no parameters)` |
| **Analysis** | `analyze_repository` | Deep repo scan | `{"repository_path": "/home/user/project"}` |
| | `review_code_ai` | AI Code Review | `{"file_path": "src/app.ts", "focus_areas": ["security"]}` |
| | `check_guidelines`| Guideline check | `{"repository_path": "/path/to/repo", "guidelines_file": "CONTRIBUTING.md"}` |
| | `suggest_fixes` | Improvement list | `{"repository_path": "/path/to/repo", "auto_fix": true}` |
| | `generate_pr` | PR Comment Gen | `{"repository_path": "/path/to/repo", "format": "github"}` |
| **Advanced** | `scan_vulnerability`| Security scan | `{"repository_path": "/path/to/repo"}` |
| | `analyze_git` | Git stats | `{"repository_path": "/path/to/repo", "commit_limit": 50}` |
| | `analyze_coverage`| Test coverage | `{"repository_path": "/path/to/repo"}` |
| | `validate_rules` | Custom YAML rules | `{"repository_path": "/path/to/repo"}` |
| **Database** | `db_describe` | Schema info | `(no parameters)` |
| | `db_list_users` | List registered users| `(no parameters)` |
| | `db_run_query` | Run SELECT query | `{"sql": "SELECT count(*) FROM \"user\""}` |
| | `db_set_role` | Update user role | `{"email": "user@example.com", "role": "admin"}` |

---

## 📋 Repository Guidelines

### Project Standards
*   **Module Organization**: Logic resides in `src/`, compiled assets in `build/`.
*   **Environment**: Always use `.env.example` as a template for new deployments.
*   **Security**: Database tools only allow `SELECT` queries by default (except for specific role management tools).

### Coding Style
*   **TypeScript**: Explicit return types and interfaces for all MCP tool handlers.
*   **Naming**: Use snake_case for tool names and descriptive descriptions for the LLM to understand intent.

---

## 🎯 RAG Implementation (In Progress)

The RAG stack (located in `/rag`) provides a robust document retrieval system:
1.  **Storage**: Qdrant Vector DB.
2.  **Engine**: LlamaIndex with `BAAI/bge-m3` embeddings.
3.  **UI**: Open WebUI integration for interactive chatting with your documents.

---

## 📜 Changelog

### v2.1.0 (Current)
*   **Added**: PostgreSQL Database Management suite.
*   **Added**: Local AI Image Generation automation scripts.
*   **Added**: Test coverage and PR comment generation tools.

### v2.0.0
*   Initial Repository Mastermind features (Code review, Git history, Vulnerability canning).

### v1.0.0
*   Basic vLLM integration for chat and text completion.

---

## 📄 License
MIT
