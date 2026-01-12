#!/bin/bash
# Health check for all production services

echo "🏥 Health Check - Production Services"
echo "================================================"
echo ""

# Function to check HTTP endpoint
check_http() {
    local name=$1
    local url=$2
    local status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null || echo "000")
    
    if [ "$status" = "200" ] || [ "$status" = "302" ]; then
        echo "✅ $name - OK ($status)"
        return 0
    else
        echo "❌ $name - FAILED ($status)"
        return 1
    fi
}

# Function to check Docker container
check_container() {
    local name=$1
    local container=$2
    local status=$(docker inspect -f '{{.State.Running}}' "$container" 2>/dev/null || echo "false")
    
    if [ "$status" = "true" ]; then
        echo "✅ $name - RUNNING"
        return 0
    else
        echo "❌ $name - NOT RUNNING"
        return 1
    fi
}

# Infrastructure
echo "Infrastructure Services:"
check_container "Traefik" "traefik"
check_container "Shared PostgreSQL" "shared-postgres"
echo ""

# Core Services
echo "Core Services:"
check_container "Auth Service" "auth-service"
check_http "Auth Health" "https://auth.korczewski.de/health"
check_container "vLLM Dashboard" "vllm-dashboard"
check_http "Dashboard" "https://dashboard.korczewski.de"
echo ""

# Application Services
echo "Application Services:"
check_container "L2P Frontend" "l2p-app"
check_container "L2P Backend" "l2p-api"
check_http "L2P Health" "https://l2p.korczewski.de/api/health"

check_container "Payment Service" "web"
check_http "Payment Health" "https://payment.korczewski.de/api/health"

check_container "VideoVault" "videovault"
check_http "VideoVault Health" "https://videovault.korczewski.de/api/health"
echo ""

# AI/ML Services
echo "AI/ML Services:"
check_container "vLLM" "vllm-rag"
check_container "Open WebUI" "open-webui-rag"
check_http "Open WebUI" "https://vllm.korczewski.de/health"
check_container "Qdrant" "qdrant-rag"
check_container "Infinity" "infinity-embeddings"
check_container "Postgres (WebUI)" "postgres-rag"
check_container "Ingest Engine" "rag-ingest-engine"
echo ""

# Summary
echo "================================================"
echo "Docker Containers Summary:"
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "traefik|postgres|auth|l2p|payment|videovault|vllm|webui|qdrant|infinity|ingest|dashboard"
echo ""
