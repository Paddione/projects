#!/bin/bash
# Restart only services whose Docker images are out of date.
# Uses docker compose --build to rebuild and recreate containers only when needed.

set -e

echo "🔁 Restarting outdated production services (docker compose --build)..."
echo "==============================================================="

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

run_compose_build() {
    local service_name="$1"
    local service_dir="$2"
    shift 2
    local global_args=()
    local up_args=()
    local mode="global"

    for arg in "$@"; do
        if [ "$arg" = "--" ]; then
            mode="up"
            continue
        fi
        if [ "$mode" = "global" ]; then
            global_args+=("$arg")
        else
            up_args+=("$arg")
        fi
    done

    if [ ! -d "$service_dir" ]; then
        echo "  ⚠ Skipping $service_name (missing: $service_dir)"
        return
    fi

    echo ""
    echo "→ $service_name"
    cd "$service_dir"
    docker compose "${global_args[@]}" up -d --build "${up_args[@]}"
}

run_compose_build "Traefik reverse proxy" "$ROOT_DIR/reverse-proxy"
run_compose_build "Shared PostgreSQL" "$ROOT_DIR/shared-infrastructure"
run_compose_build "Auth service" "$ROOT_DIR/auth"
run_compose_build "Dashboard" "$ROOT_DIR/dashboard"
run_compose_build "L2P (production profile)" "$ROOT_DIR/l2p" --profile production
run_compose_build "Payment service" "$ROOT_DIR/payment"
run_compose_build "VideoVault (production)" "$ROOT_DIR/VideoVault" -- videovault

echo ""
echo "==============================================================="
echo "✅ Outdated service restart complete."
echo "==============================================================="
