#!/bin/bash
# Production Deployment Test Script
# This script tests the full production deployment with docker-compose

set -e  # Exit on error

echo "========================================="
echo "Production Deployment Test"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Navigate to RAG directory
cd "$(dirname "$0")/rag"

echo -e "${YELLOW}Step 1: Loading production environment...${NC}"
if [ -f "../.env-prod" ]; then
    export $(cat ../.env-prod | grep -v '^#' | xargs)
    echo -e "${GREEN}✓ Production environment loaded${NC}"
else
    echo -e "${RED}✗ .env-prod not found${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Step 2: Checking Docker...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker not found${NC}"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo -e "${RED}✗ Docker daemon not running${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker is ready${NC}"

echo ""
echo -e "${YELLOW}Step 3: Validating docker-compose.yml...${NC}"
if docker-compose config &> /dev/null; then
    echo -e "${GREEN}✓ docker-compose.yml is valid${NC}"
else
    echo -e "${RED}✗ docker-compose.yml has errors${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Step 4: Starting production services...${NC}"
docker-compose up -d

echo ""
echo -e "${YELLOW}Step 5: Waiting for services to start (10 seconds)...${NC}"
sleep 10

echo ""
echo -e "${YELLOW}Step 6: Checking service status...${NC}"
docker-compose ps

echo ""
echo -e "${YELLOW}Step 7: Verifying critical services...${NC}"

# Check if containers are running
SERVICES=("vllm-rag" "qdrant-rag" "infinity-embeddings" "postgres-rag" "open-webui-rag" "vllm-dashboard")
ALL_RUNNING=true

for service in "${SERVICES[@]}"; do
    if docker ps --format '{{.Names}}' | grep -q "^${service}$"; then
        echo -e "${GREEN}✓ ${service} is running${NC}"
    else
        echo -e "${RED}✗ ${service} is not running${NC}"
        ALL_RUNNING=false
    fi
done

echo ""
if [ "$ALL_RUNNING" = true ]; then
    echo -e "${GREEN}=========================================${NC}"
    echo -e "${GREEN}✓ Production deployment successful!${NC}"
    echo -e "${GREEN}=========================================${NC}"
    echo ""
    echo "Access points:"
    echo "  - Dashboard: https://dashboard.korczewski.de"
    echo "  - Open WebUI: https://chat.korczewski.de"
    echo "  - vLLM API: https://api.korczewski.de"
    echo "  - Qdrant: https://qdrant.korczewski.de"
    echo ""
    echo "To view logs: docker-compose logs -f [service-name]"
    echo "To stop: docker-compose down"
else
    echo -e "${RED}=========================================${NC}"
    echo -e "${RED}✗ Some services failed to start${NC}"
    echo -e "${RED}=========================================${NC}"
    echo ""
    echo "Check logs with: docker-compose logs"
    exit 1
fi
