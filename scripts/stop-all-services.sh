#!/bin/bash
# Stop all services

set -e  # Exit on error

echo "======================================"
echo "Stopping All Services"
echo "======================================"
echo ""

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

# Check if we're in the right directory
if [ ! -d "shared-infrastructure" ]; then
    print_warning "shared-infrastructure directory not found!"
    print_warning "Please run this script from the projects root directory"
    exit 1
fi

# Stop VideoVault
echo "Stopping VideoVault..."
cd VideoVault
docker-compose down 2>/dev/null || print_warning "VideoVault not running or already stopped"
cd ..
print_status "VideoVault stopped"

# Stop Payment
echo "Stopping Payment service..."
cd payment
docker-compose down 2>/dev/null || print_warning "Payment not running or already stopped"
cd ..
print_status "Payment stopped"

# Stop L2P (all profiles)
echo "Stopping L2P service..."
cd l2p
docker-compose --profile production down 2>/dev/null || true
docker-compose --profile development down 2>/dev/null || true
docker-compose --profile test down 2>/dev/null || true
cd ..
print_status "L2P stopped"

# Stop Auth
echo "Stopping Auth service..."
cd auth
docker-compose down 2>/dev/null || print_warning "Auth not running or already stopped"
cd ..
print_status "Auth stopped"

# Stop centralized PostgreSQL (ask first)
echo ""
echo "Do you want to stop the centralized PostgreSQL instance?"
echo "WARNING: This will stop database access for all services!"
read -p "Stop PostgreSQL? (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    cd shared-infrastructure
    docker-compose down
    cd ..
    print_status "Centralized PostgreSQL stopped"
else
    print_warning "Keeping PostgreSQL running"
fi

echo ""
echo "======================================"
echo "Service Shutdown Complete!"
echo "======================================"
echo ""
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "(postgres|auth|l2p|payment|videovault)" || echo "No related services running"
