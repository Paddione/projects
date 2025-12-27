#!/bin/bash

# Start Test Environment Script
# This script starts the Docker test stack and waits for all services to be healthy

set -e

echo "🚀 Starting Learn2Play Test Environment..."

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "📁 Project root: $PROJECT_ROOT"
echo "🐳 Starting Docker test stack..."

# Start the test stack
cd "$PROJECT_ROOT"
docker compose -f docker-compose.test.yml up -d --build

echo "⏳ Waiting for services to be healthy..."

# Wait for PostgreSQL to be healthy
echo "📊 Waiting for PostgreSQL..."
until docker compose -f docker-compose.test.yml exec -T postgres-test pg_isready -U l2p_user -d learn2play_test > /dev/null 2>&1; do
  echo "   PostgreSQL not ready yet..."
  sleep 5
done
echo "✅ PostgreSQL is healthy"

# Wait for backend to be healthy
echo "🔧 Waiting for backend..."
until curl -f http://localhost:3006/api/health > /dev/null 2>&1; do
  echo "   Backend not ready yet..."
  sleep 5
done
echo "✅ Backend is healthy"

# Wait for frontend to be healthy
echo "🎨 Waiting for frontend..."
until curl -f http://localhost:3007/ > /dev/null 2>&1; do
  echo "   Frontend not ready yet..."
  sleep 5
done
echo "✅ Frontend is healthy"

# Wait for MailHog to be healthy
echo "📧 Waiting for MailHog..."
until curl -f http://localhost:8025/ > /dev/null 2>&1; do
  echo "   MailHog not ready yet..."
  sleep 5
done
echo "✅ MailHog is healthy"

# Wait for Redis to be healthy
echo "🔴 Waiting for Redis..."
until docker compose -f docker-compose.test.yml exec -T redis-test redis-cli ping > /dev/null 2>&1; do
  echo "   Redis not ready yet..."
  sleep 5
done
echo "✅ Redis is healthy"

echo ""
echo "🎉 All test services are healthy and ready!"
echo ""
echo "📋 Test Environment URLs:"
echo "   Frontend: http://localhost:3007"
echo "   Backend API: http://localhost:3006/api"
echo "   MailHog: http://localhost:8025"
echo "   PostgreSQL: localhost:5433"
echo "   Redis: localhost:6380"
echo ""
echo "🧪 Run Playwright tests with:"
echo "   cd frontend && npm run test:e2e:docker"
echo ""
echo "🛑 Stop test environment with:"
echo "   cd frontend && npm run stop:docker-test"
