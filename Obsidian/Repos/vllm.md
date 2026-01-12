# VLLM

## Purpose
MCP server for AI inference and analysis, with optional dashboard and RAG stack.

## Stack
TypeScript, vLLM, PostgreSQL.

## Key folders
- `vllm/src/` - MCP tool handlers
- `vllm/tests/` - Jest tests
- `vllm/dashboard/` - control panel (Node server)
- `vllm/rag/` - RAG stack setup

## Build
```bash
cd vllm
npm install
npm run build
```

## Development
```bash
cd vllm
npm run dev:watch
```

## Dashboard
```bash
cd vllm/dashboard
node server.js    # http://localhost:4242
```

## Notes
- Database tools are SELECT-only for safety.

## Ports
- MCP server: 4100
- Dashboard: 4242
