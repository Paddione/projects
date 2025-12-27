#!/bin/bash

# Test Environment Health Check Script
# This script checks if all test services are healthy and ready for Playwright tests

set -e

echo "🔍 Checking Learn2Play Test Environment Health..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check service health
check_service() {
    local name=$1
    local url=$2
    local command=$3
    
    echo -n "   Checking $name... "
    
    if [ -n "$command" ]; then
        # Use custom command (e.g., for databases)
        if eval "$command" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Healthy${NC}"
            return 0
        else
            echo -e "${RED}❌ Unhealthy${NC}"
            return 1
        fi
    else
        # Use HTTP check
        if curl -f "$url" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Healthy${NC}"
            return 0
        else
            echo -e "${RED}❌ Unhealthy${NC}"
            return 1
        fi
    fi
}

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_ROOT"

# Check if test stack is running
if ! docker compose -f docker-compose.test.yml ps --quiet > /dev/null 2>&1; then
    echo -e "${RED}❌ Test stack is not running${NC}"
    echo "Start it with: npm run start:docker-test"
    exit 1
fi

echo "🐳 Test stack is running, checking service health..."

# Check PostgreSQL
check_service "PostgreSQL" "" "docker compose -f docker-compose.test.yml exec -T postgres-test pg_isready -U l2p_user -d learn2play_test"

# Check Backend API
check_service "Backend API" "http://localhost:3006/api/health"

# Check Frontend
check_service "Frontend" "http://localhost:3007/"

# Check MailHog
check_service "MailHog" "http://localhost:8025/"

# Check Redis
check_service "Redis" "" "docker compose -f docker-compose.test.yml exec -T redis-test redis-cli ping"

echo ""
echo "📋 Test Environment Status:"
echo "   Frontend: http://localhost:3007"
echo "   Backend API: http://localhost:3006/api"
echo "   MailHog: http://localhost:8025"
echo "   PostgreSQL: localhost:5433"
echo "   Redis: localhost:6380"

echo ""
echo "🧪 Ready for Playwright tests!"
echo "   Run: npm run test:e2e:docker"
