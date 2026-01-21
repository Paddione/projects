#!/bin/bash
# Start all production services in the correct order
# This script ensures only ONE production environment per service is running

set -e

echo "🚀 Starting all production services..."
echo "================================================"

# 1. Infrastructure Services (must start first)
echo ""
echo "📦 Step 1: Starting Infrastructure Services..."
echo "------------------------------------------------"

echo "  → Starting Traefik Reverse Proxy..."
cd /home/patrick/projects/reverse-proxy
docker compose up -d
echo "  ✓ Traefik started"

echo "  → Starting Shared PostgreSQL..."
cd /home/patrick/projects/shared-infrastructure
docker compose up -d
echo "  ✓ Shared PostgreSQL started"

# Wait for database to be ready
echo "  ⏳ Waiting for PostgreSQL to be ready..."
sleep 5

# 2. Core Services
echo ""
echo "🔐 Step 2: Starting Core Services..."
echo "------------------------------------------------"

echo "  → Starting Auth Service..."
cd /home/patrick/projects/auth
docker compose up -d
echo "  ✓ Auth Service started"

echo "  → Starting Dashboard..."
cd /home/patrick/projects/dashboard
docker compose up -d
echo "  ✓ Dashboard started"

# 3. Application Services
echo ""
echo "🎮 Step 3: Starting Application Services..."
echo "------------------------------------------------"

echo "  → Starting L2P (Production Profile)..."
cd /home/patrick/projects/l2p
docker compose --profile production up -d
echo "  ✓ L2P Production started"

echo "  → Starting Payment Service..."
cd /home/patrick/projects/payment
docker compose up -d
echo "  ✓ Payment Service started"

echo "  → Starting VideoVault (Production)..."
cd /home/patrick/projects/VideoVault
docker compose up videovault -d
echo "  ✓ VideoVault Production started"

# Summary
echo ""
echo "================================================"
echo "✅ All production services started successfully!"
echo "================================================"
echo ""
echo "Service URLs:"
echo "  • Dashboard:    https://dashboard.korczewski.de"
echo "  • Auth:         https://auth.korczewski.de"
echo "  • L2P:          https://l2p.korczewski.de"
echo "  • Payment:      https://payment.korczewski.de"
echo "  • VideoVault:   https://videovault.korczewski.de"
echo "  • Traefik:      https://traefik.korczewski.de"
echo ""
echo "Check status: docker ps"
echo "View logs:    docker compose logs -f [service-name]"
echo ""
