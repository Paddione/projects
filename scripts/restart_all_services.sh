#!/bin/bash

# Comprehensive Service Restart Script
# This script restarts all services in the monorepo

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

echo "=========================================="
echo "  Restarting All Services"
echo "=========================================="
echo ""

# Get script directory and repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

# Step 1: Stop all Node.js processes (except system ones)
print_info "Stopping Node.js application processes..."
pkill -f "node server.js" || true
pkill -f "npm run dev" || true
pkill -f "vite" || true
print_success "Node.js processes stopped"

# Step 2: Restart Docker containers (stop then start to avoid port conflicts)
print_info "Restarting Docker containers..."

# VLLM containers
if [ -f "$ROOT_DIR/vllm/rag/docker-compose.yml" ]; then
    print_info "Stopping VLLM RAG stack..."
    cd "$ROOT_DIR/vllm/rag"
    docker-compose stop
    print_info "Starting VLLM RAG stack..."
    docker-compose up -d
    print_success "VLLM RAG stack restarted"
fi

# Auth containers
if [ -f "$ROOT_DIR/auth/docker-compose.yml" ]; then
    print_info "Restarting Auth services..."
    cd "$ROOT_DIR/auth"
    docker-compose restart
    print_success "Auth services restarted"
fi

# L2P - only restart if containers are running
cd "$ROOT_DIR/l2p"
if docker ps --format '{{.Names}}' | grep -q "l2p-"; then
    print_info "Restarting L2P services..."
    docker-compose --profile development restart || docker-compose --profile production restart || print_warning "No L2P services to restart"
    print_success "L2P services restarted"
else
    print_info "L2P services not running, skipping..."
fi

# VideoVault - only restart if containers are running
cd "$ROOT_DIR/VideoVault"
if [ -f "docker-compose.yml" ] && docker ps --format '{{.Names}}' | grep -q "videovault"; then
    print_info "Restarting VideoVault services..."
    docker-compose restart
    print_success "VideoVault services restarted"
else
    print_info "VideoVault services not running, skipping..."
fi

cd "$ROOT_DIR"

# Step 3: Wait for services to be ready
print_info "Waiting for services to initialize (10 seconds)..."
sleep 10

# Step 4: Start dashboard
print_info "Starting VRAM Dashboard..."
if [ -f "$ROOT_DIR/vllm/scripts/manage_dashboard.sh" ]; then
    bash "$ROOT_DIR/vllm/scripts/manage_dashboard.sh"
    print_success "Dashboard started"
else
    print_warning "Dashboard script not found"
fi

# Step 5: Check service status
echo ""
print_info "Checking service status..."
echo ""

# Check Docker containers
print_info "Docker containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(vllm|qdrant|postgres|infinity|auth|l2p|videovault)" || print_warning "No matching containers found"

echo ""
print_info "Node.js processes:"
ps aux | grep -E "node.*server.js" | grep -v grep || print_warning "No dashboard process found"

echo ""
echo "=========================================="
print_success "Service restart complete!"
echo "=========================================="
echo ""
echo "Available services:"
echo "  - VRAM Dashboard:  http://localhost:4242"
echo "  - L2P Frontend:    http://localhost:5173"
echo "  - L2P Backend:     http://localhost:5001"
echo "  - VideoVault:      http://localhost:5100"
echo "  - Payment:         http://localhost:3004"
echo "  - VLLM API:        http://localhost:4100"
echo ""
print_info "Check logs with: docker logs <container-name>"
print_info "Dashboard logs: tail -f vllm/dashboard/dashboard.log"
echo ""
