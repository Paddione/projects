#!/bin/bash
# Stop all services (production and development)

set -e

echo "🛑 Stopping all services..."
echo "================================================"

# Stop application services first
echo ""
echo "Stopping Application Services..."
cd /home/patrick/projects/l2p && docker compose --profile production down
cd /home/patrick/projects/l2p && docker compose --profile development down
cd /home/patrick/projects/payment && docker compose down
cd /home/patrick/projects/VideoVault && docker compose down
echo "✓ Application services stopped"

# Stop core services
echo ""
echo "Stopping Core Services..."
cd /home/patrick/projects/dashboard && docker compose down
cd /home/patrick/projects/auth && docker compose down
echo "✓ Core services stopped"

# Stop infrastructure (optional - usually keep running)
echo ""
echo "Stopping Infrastructure Services..."
read -p "Stop infrastructure (Traefik, PostgreSQL)? [y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
    cd /home/patrick/projects/reverse-proxy && docker compose down
    cd /home/patrick/projects/shared-infrastructure && docker compose down
    echo "✓ Infrastructure stopped"
else
    echo "⏭️  Infrastructure services kept running"
fi

echo ""
echo "================================================"
echo "✅ Services stopped"
echo "================================================"
