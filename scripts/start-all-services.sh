#!/bin/bash
# Start all services with centralized PostgreSQL database

set -e  # Exit on error

echo "======================================"
echo "Starting All Services"
echo "======================================"
echo ""

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

# Check if we're in the right directory
if [ ! -d "shared-infrastructure" ]; then
    print_error "shared-infrastructure directory not found!"
    print_error "Please run this script from the projects root directory"
    exit 1
fi

# Step 1: Start centralized PostgreSQL
echo "Step 1: Starting centralized PostgreSQL..."
cd shared-infrastructure

if [ ! -f ".env" ]; then
    print_warning ".env file not found in shared-infrastructure!"
    print_warning "Creating from .env.example..."
    cp .env.example .env
    print_warning "Please edit shared-infrastructure/.env with secure passwords before continuing!"
    exit 1
fi

docker-compose up -d
print_status "Centralized PostgreSQL started"

# Wait for postgres to be healthy
echo "Waiting for PostgreSQL to be ready..."
sleep 5
for i in {1..30}; do
    if docker exec shared-postgres pg_isready -U postgres > /dev/null 2>&1; then
        print_status "PostgreSQL is ready"
        break
    fi
    echo -n "."
    sleep 1
done
echo ""

cd ..

# Step 2: Start auth service
echo ""
echo "Step 2: Starting Auth Service..."
cd auth

if [ ! -f ".env" ]; then
    print_warning ".env file not found in auth directory!"
    print_warning "Please create auth/.env from .env.example"
else
    docker-compose up -d
    print_status "Auth service started"
fi

cd ..

# Step 3: Start L2P service
echo ""
echo "Step 3: Starting L2P Service..."
cd l2p

if [ ! -f ".env.production" ]; then
    print_warning ".env.production file not found in l2p directory!"
    print_warning "Skipping L2P production deployment"
else
    # Ask which profile to use
    echo "Which L2P profile would you like to start?"
    echo "1) Production"
    echo "2) Development"
    echo "3) Skip L2P"
    read -p "Enter choice (1-3): " choice

    case $choice in
        1)
            docker-compose --profile production up -d
            print_status "L2P production started"
            ;;
        2)
            docker-compose --profile development up -d
            print_status "L2P development started"
            ;;
        3)
            print_warning "Skipping L2P"
            ;;
        *)
            print_warning "Invalid choice, skipping L2P"
            ;;
    esac
fi

cd ..

# Step 4: Start Payment service
echo ""
echo "Step 4: Starting Payment Service..."
cd payment

if [ ! -f ".env" ]; then
    print_warning ".env file not found in payment directory!"
    print_warning "Please create payment/.env from .env.example"
else
    docker-compose up -d
    print_status "Payment service started"
fi

cd ..

# Step 5: Start VideoVault service
echo ""
echo "Step 5: Starting VideoVault Service..."
cd VideoVault

if [ ! -f "env/.env-app" ]; then
    print_warning "env/.env-app file not found in VideoVault directory!"
    print_warning "Please create VideoVault/env/.env-app"
else
    docker-compose up -d
    print_status "VideoVault service started"
fi

cd ..

# Summary
echo ""
echo "======================================"
echo "Service Startup Complete!"
echo "======================================"
echo ""
echo "Running services:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(shared-postgres|auth-service|l2p|payment|videovault)"

echo ""
echo "To view logs:"
echo "  - Postgres:   cd shared-infrastructure && docker-compose logs -f"
echo "  - Auth:       cd auth && docker-compose logs -f"
echo "  - L2P:        cd l2p && docker-compose logs -f"
echo "  - Payment:    cd payment && docker-compose logs -f"
echo "  - VideoVault: cd VideoVault && docker-compose logs -f"
echo ""
echo "To stop all services, run: $ROOT_DIR/scripts/stop-all-services.sh"
