#!/bin/bash

# Development Environment Startup Script
# Starts infrastructure services in Docker and dashboard in development mode

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "========================================="
echo "  vLLM Development Environment Startup"
echo "========================================="
echo ""

# Load environment variables from .env
if [ -f "$ROOT_DIR/.env" ]; then
    echo "📋 Loading development environment variables..."
    set -a
    source "$ROOT_DIR/.env"
    set +a
else
    echo "⚠️  Warning: .env not found, using defaults"
fi

# Ensure NODE_ENV is set to development
export NODE_ENV=development

echo ""
echo "1️⃣  Starting infrastructure services (Docker)..."
echo "   - PostgreSQL (RAG)"
echo "   - Qdrant (Vector DB)"
echo "   - Shared PostgreSQL"
echo ""

cd "$ROOT_DIR/rag"

# Start only infrastructure services (not application services)
# In development, we'll run application services via npm
docker-compose up -d db qdrant postgres-rag 2>/dev/null || {
    echo "⚠️  Some infrastructure services may already be running"
}

echo ""
echo "2️⃣  Starting Dashboard in development mode..."
echo ""

cd "$ROOT_DIR"

# Start dashboard in development mode (foreground with hot reload)
"$SCRIPT_DIR/manage_dashboard.sh" dev &
DASHBOARD_PID=$!

echo ""
echo "========================================="
echo "  ✅ Development Environment Ready!"
echo "========================================="
echo ""
echo "📊 Dashboard: http://localhost:${DASHBOARD_PORT:-4242}"
echo "   - Hot reload enabled"
echo "   - Use Ctrl+C to stop"
echo ""
echo "🗄️  Infrastructure Services:"
echo "   - PostgreSQL (RAG): localhost:5438"
echo "   - Qdrant: http://localhost:6333"
echo "   - Shared PostgreSQL: localhost:5432"
echo ""
echo "💡 To start application services:"
echo "   - Use the dashboard UI to start/stop npm services"
echo "   - Or run 'npm run dev' in respective project directories"
echo ""
echo "========================================="
echo ""

# Wait for dashboard process
wait $DASHBOARD_PID
