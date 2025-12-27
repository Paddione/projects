#!/bin/bash

# Configuration
PROJECT_DIR="/home/patrick/vllm"
DASHBOARD_DIR="$PROJECT_DIR/dashboard"
LOG_FILE="$DASHBOARD_DIR/dashboard.log"

echo "--- Dashboard Manager ---"

# 1. Kill all active dashboard processes
echo "Killing active dashboard processes..."
# Find processes running server.js in the dashboard directory
PIDS=$(pgrep -f "node.*server.js")

if [ -n "$PIDS" ]; then
    echo "Found PIDs: $PIDS"
    echo "$PIDS" | xargs kill -9
    echo "Processes terminated."
else
    echo "No active dashboard processes found."
fi

# 2. Start a single instance
echo "Starting new dashboard instance..."
if [ ! -d "$DASHBOARD_DIR" ]; then
    echo "Error: Dashboard directory not found at $DASHBOARD_DIR"
    exit 1
fi

cd "$DASHBOARD_DIR" || exit

# Ensure dependencies are installed (optional but good)
# npm install

# Load .env if it exists in the root
if [ -f "$PROJECT_DIR/.env" ]; then
    export $(grep -v '^#' "$PROJECT_DIR/.env" | xargs)
fi

# Start the dashboard
nohup node server.js > "$LOG_FILE" 2>&1 &

NEW_PID=$!
echo "Dashboard started with PID: $NEW_PID"
echo "Logs are being written to $LOG_FILE"
echo "URL: http://localhost:${DASHBOARD_PORT:-4242}"
echo "--------------------------"
