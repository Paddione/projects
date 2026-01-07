#!/bin/bash

# Dashboard Manager - Supports both development and production modes
# Usage: ./manage_dashboard.sh [dev|prod]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DASHBOARD_DIR="$PROJECT_DIR/dashboard"
LOG_FILE="$DASHBOARD_DIR/dashboard.log"

# Default to production if no argument provided
MODE="${1:-prod}"

echo "--- Dashboard Manager ---"
echo "Mode: $MODE"

# 1. Kill all active dashboard processes
echo "Killing active dashboard processes..."
PIDS=$(pgrep -f "node.*server.js" || true)

if [ -n "$PIDS" ]; then
    echo "Found PIDs: $PIDS"
    echo "$PIDS" | xargs kill -9 2>/dev/null || true
    echo "Processes terminated."
else
    echo "No active dashboard processes found."
fi

# Also kill nodemon processes if in dev mode
if [ "$MODE" = "dev" ]; then
    NODEMON_PIDS=$(pgrep -f "nodemon" || true)
    if [ -n "$NODEMON_PIDS" ]; then
        echo "Killing nodemon processes: $NODEMON_PIDS"
        echo "$NODEMON_PIDS" | xargs kill -9 2>/dev/null || true
    fi
fi

# 2. Start a new instance
echo "Starting new dashboard instance in $MODE mode..."
if [ ! -d "$DASHBOARD_DIR" ]; then
    echo "Error: Dashboard directory not found at $DASHBOARD_DIR"
    exit 1
fi

cd "$DASHBOARD_DIR" || exit

# Ensure dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Load environment variables
if [ -f "$DASHBOARD_DIR/.env" ]; then
    export $(grep -v '^#' "$DASHBOARD_DIR/.env" | xargs)
elif [ -f "$PROJECT_DIR/.env" ]; then
    export $(grep -v '^#' "$PROJECT_DIR/.env" | xargs)
fi

# Set NODE_ENV based on mode
if [ "$MODE" = "dev" ]; then
    export NODE_ENV=development
    export DASHBOARD_PORT=${DASHBOARD_PORT:-4242}
    
    echo "Starting dashboard in DEVELOPMENT mode with hot reload..."
    echo "Logs are being written to $LOG_FILE"
    echo "URL: http://localhost:${DASHBOARD_PORT}"
    echo "Press Ctrl+C to stop"
    echo "--------------------------"
    
    # Run in foreground with nodemon for development
    npm run dev 2>&1 | tee "$LOG_FILE"
else
    export NODE_ENV=production
    export DASHBOARD_PORT=${DASHBOARD_PORT:-4242}
    
    echo "Starting dashboard in PRODUCTION mode..."
    nohup npm start > "$LOG_FILE" 2>&1 &
    
    NEW_PID=$!
    echo "Dashboard started with PID: $NEW_PID"
    echo "Logs are being written to $LOG_FILE"
    echo "URL: http://localhost:${DASHBOARD_PORT}"
    echo "--------------------------"
fi
