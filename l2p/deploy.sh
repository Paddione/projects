#!/bin/bash

# Learn2Play Production Deployment Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "\n${BLUE}================================================${NC}"
    echo -e "${BLUE} $1 ${NC}"
    echo -e "${BLUE}================================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check if environment file exists
if [ ! -f .env ]; then
    print_error "Environment file (.env) not found!"
    echo "Please copy .env.example to .env and configure it for production."
    exit 1
fi

# Load environment variables
set -a
source .env
set +a

# Validate required environment variables
required_vars=("JWT_SECRET" "JWT_REFRESH_SECRET" "DATABASE_URL" "DB_PASSWORD")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        print_error "Required environment variable $var is not set!"
        exit 1
    fi
done

print_header "Learn2Play Production Deployment"

# Confirmation prompt
echo -e "${YELLOW}This will deploy L2P in production mode.${NC}"
echo -e "Database: ${DATABASE_URL}"
echo -e "Frontend URL: ${FRONTEND_URL:-https://localhost}"
read -p "Continue with deployment? (y/N): " confirm

if [[ ! $confirm =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

print_header "Building Production Images"

# Build production images
echo "Building frontend production image..."
docker build -t l2p-frontend:latest ./frontend --target production

echo "Building backend production image..."
docker build -t l2p-backend:latest -f backend/Dockerfile . --target production

print_success "Production images built"

print_header "Deploying Services"

# Stop existing services
echo "Stopping existing services..."
docker-compose -f docker-compose.yml -f docker-compose.prod.yml --profile production down || true

# Start production services
echo "Starting production services..."
docker-compose -f docker-compose.yml -f docker-compose.prod.yml --profile production up -d

print_success "Services deployed"

print_header "Running Database Migrations"

# Wait for database
echo "Waiting for database to be ready..."
sleep 10

# Run migrations
echo "Running database migrations..."
docker-compose -f docker-compose.yml -f docker-compose.prod.yml --profile production exec -T backend node dist/cli/database.js migrate

print_success "Database migrations completed"

print_header "Health Checks"

# Health checks
echo "Running health checks..."
sleep 5

# Check backend health
backend_health=false
for i in {1..30}; do
    if curl -s http://localhost:3001/api/health >/dev/null 2>&1; then
        backend_health=true
        break
    fi
    echo "Waiting for backend to be healthy... ($i/30)"
    sleep 2
done

if [ $backend_health = true ]; then
    print_success "Backend is healthy"
else
    print_error "Backend health check failed"
fi

# Check frontend health (if available)
if curl -s http://localhost:3010/health >/dev/null 2>&1; then
    print_success "Frontend is healthy"
else
    print_warning "Frontend health check failed (may not be configured)"
fi

print_header "Deployment Complete"

echo -e "${GREEN}🚀 L2P has been deployed in production mode!${NC}\n"

echo -e "${BLUE}Service Status:${NC}"
docker-compose -f docker-compose.yml -f docker-compose.prod.yml --profile production ps

echo -e "\n${BLUE}Access URLs:${NC}"
echo -e "  🌐 Frontend:  ${GREEN}${FRONTEND_URL:-http://localhost:3010}${NC}"
echo -e "  🔧 Backend:   ${GREEN}http://localhost:3001${NC}"

echo -e "\n${BLUE}Management Commands:${NC}"
echo -e "  📊 View logs:    ${YELLOW}docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f${NC}"
echo -e "  🔄 Restart:      ${YELLOW}docker-compose -f docker-compose.yml -f docker-compose.prod.yml restart${NC}"
echo -e "  🛑 Stop:         ${YELLOW}docker-compose -f docker-compose.yml -f docker-compose.prod.yml down${NC}"
echo -e "  💾 Backup DB:    ${YELLOW}docker exec l2p_postgres pg_dump -U ${DB_USER} ${DB_NAME} > backup.sql${NC}"

echo -e "\n${BLUE}Monitoring:${NC}"
echo -e "  🏥 Health:       ${YELLOW}curl http://localhost:3001/api/health${NC}"
echo -e "  📈 Stats:        ${YELLOW}docker stats${NC}"

if [ $backend_health = true ]; then
    echo -e "\n${GREEN}✅ Deployment successful!${NC}"
else
    echo -e "\n${YELLOW}⚠️  Deployment completed with warnings. Check the logs.${NC}"
fi