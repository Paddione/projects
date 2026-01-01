#!/bin/bash
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${YELLOW}→${NC} $1"
}

echo -e "${YELLOW}=== Stopping All Services ===${NC}\n"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROXY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BASE_DIR="$(cd "$PROXY_DIR/.." && pwd)"

# Stop services in reverse order

# Stop Payment service
print_info "Stopping Payment service..."
cd "$BASE_DIR/payment"
docker-compose down
if [ $? -eq 0 ]; then
    print_status "Payment service stopped"
fi

# Stop VideoVault
print_info "Stopping VideoVault..."
cd "$BASE_DIR/VideoVault"
docker-compose down
if [ $? -eq 0 ]; then
    print_status "VideoVault stopped"
fi

# Stop L2P
print_info "Stopping L2P..."
cd "$BASE_DIR/l2p"
docker-compose --profile production down
if [ $? -eq 0 ]; then
    print_status "L2P stopped"
fi

# Stop Auth service
print_info "Stopping Auth service..."
cd "$BASE_DIR/auth"
docker-compose down
if [ $? -eq 0 ]; then
    print_status "Auth service stopped"
fi

# Stop Traefik last
print_info "Stopping Traefik..."
cd "$PROXY_DIR"
docker-compose --env-file .env-prod down
if [ $? -eq 0 ]; then
    print_status "Traefik stopped"
fi

echo -e "\n${GREEN}All services stopped!${NC}"

# Show remaining containers (if any)
running=$(docker ps -q | wc -l)
if [ "$running" -gt 0 ]; then
    echo -e "\n${YELLOW}Still running containers:${NC}"
    docker ps --format "table {{.Names}}\t{{.Status}}"
else
    echo -e "\n${GREEN}No containers running${NC}"
fi
