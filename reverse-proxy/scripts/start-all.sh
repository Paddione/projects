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

echo -e "${GREEN}=== Starting All Services ===${NC}\n"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROXY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BASE_DIR="$(cd "$PROXY_DIR/.." && pwd)"

# Start Traefik first
print_info "Starting Traefik..."
cd "$PROXY_DIR"
docker-compose --env-file .env-prod up -d
if [ $? -eq 0 ]; then
    print_status "Traefik started"
else
    print_error "Failed to start Traefik"
    exit 1
fi

# Wait for Traefik to be ready
sleep 5

# Start Auth service
print_info "Starting Auth service..."
cd "$BASE_DIR/auth"
docker-compose up -d
if [ $? -eq 0 ]; then
    print_status "Auth service started"
else
    print_error "Failed to start Auth service"
fi

# Wait for Auth to be ready
sleep 5

# Start L2P (production profile)
print_info "Starting L2P..."
cd "$BASE_DIR/l2p"
docker-compose --profile production up -d
if [ $? -eq 0 ]; then
    print_status "L2P started"
else
    print_error "Failed to start L2P"
fi

# Start VideoVault
print_info "Starting VideoVault..."
cd "$BASE_DIR/VideoVault"
docker-compose up -d videovault-dev
if [ $? -eq 0 ]; then
    print_status "VideoVault started"
else
    print_error "Failed to start VideoVault"
fi

# Start Payment service
print_info "Starting Payment service..."
cd "$BASE_DIR/payment"
docker-compose up -d
if [ $? -eq 0 ]; then
    print_status "Payment service started"
else
    print_error "Failed to start Payment service"
fi

# Show running containers
echo -e "\n${GREEN}=== Running Containers ===${NC}"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Show service status
echo -e "\n${GREEN}=== Service URLs ===${NC}"
echo -e "Traefik Dashboard: ${YELLOW}https://traefik.korczewski.de${NC}"
echo -e "L2P:               ${YELLOW}https://l2p.korczewski.de${NC}"
echo -e "VideoVault:        ${YELLOW}https://videovault.korczewski.de${NC}"
echo -e "Payment:           ${YELLOW}https://payment.korczewski.de${NC}"
echo -e "Auth:              ${YELLOW}https://auth.korczewski.de${NC}"

echo -e "\n${GREEN}All services started!${NC}"
echo -e "\nTo view logs:"
echo "  docker-compose logs -f <service-name>"
echo -e "\nTo stop all services:"
echo "  $PROXY_DIR/scripts/stop-all.sh"
