#!/bin/bash

# Port Assignment Registry
# Auth:        5432
# L2P Prod:    5435
# L2P Test:    5433
# Payment:     5436
# VideoVault:  5437
# VLLM RAG:    5438

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

status() {
    echo -e "${BLUE}=== Postgres Database Status ===${NC}"
    docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "postgres|db" || echo "No postgres containers found."
    
    echo -e "\n${BLUE}=== Local Postgres Processes ===${NC}"
    ps aux | grep -E "postgres|postmaster" | grep -v grep || echo "No local postgres processes found."
    
    echo -e "\n${BLUE}=== Listening Ports (543x) ===${NC}"
    ss -tulpn | grep 543 || echo "No processes listening on 543x ports."
}

stop_all() {
    echo -e "${YELLOW}Stopping all project databases...${NC}"
    
    # Auth
    if [ -d "$ROOT_DIR/auth" ]; then
        cd "$ROOT_DIR/auth" && docker-compose down && cd "$ROOT_DIR"
    fi
    
    # L2P
    if [ -d "$ROOT_DIR/l2p" ]; then
        cd "$ROOT_DIR/l2p" && docker-compose --profile development --profile production --profile test down && cd "$ROOT_DIR"
    fi
    
    # VideoVault
    if [ -d "$ROOT_DIR/VideoVault" ]; then
        cd "$ROOT_DIR/VideoVault" && docker-compose down && cd "$ROOT_DIR"
    fi
    
    # VLLM RAG
    if [ -d "$ROOT_DIR/vllm/rag" ]; then
        cd "$ROOT_DIR/vllm/rag" && docker-compose down && cd "$ROOT_DIR"
    fi
    
    # Payment
    if [ -d "$ROOT_DIR/payment" ]; then
        cd "$ROOT_DIR/payment" && docker-compose down && cd "$ROOT_DIR"
    fi
    
    echo -e "${GREEN}All databases stopped and containers removed.${NC}"
}

nuke_orphans() {
    echo -e "${RED}WARNING: This will remove all unused anonymous volumes and networks.${NC}"
    read -p "Are you sure? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker volume prune -f --filter "label=com.docker.volume.anonymous="
        docker network prune -f
        echo -e "${GREEN}Cleanup complete.${NC}"
    fi
}

case "$1" in
    status)
        status
        ;;
    stop)
        stop_all
        ;;
    nuke)
        stop_all
        nuke_orphans
        ;;
    *)
        echo "Usage: $0 {status|stop|nuke}"
        exit 1
esac
