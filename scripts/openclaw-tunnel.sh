#!/bin/bash
# =============================================================================
# OpenClaw SSH Tunnel
# =============================================================================
# Forwards OpenClaw gateway (18789) and browser relay (18792) from cluster
# node to localhost via auto-reconnecting SSH tunnel.
#
# Usage: ./scripts/openclaw-tunnel.sh [node-ip]
# Default node: 10.10.0.4
# =============================================================================

set -euo pipefail

NODE_IP="${1:-10.10.0.4}"
USER="patrick"

GATEWAY_PORT=18789
RELAY_PORT=18792

echo "Starting OpenClaw tunnel to ${USER}@${NODE_IP}"
echo "  Gateway:       localhost:${GATEWAY_PORT}"
echo "  Browser Relay: localhost:${RELAY_PORT}"
echo "  Press Ctrl+C to stop"
echo ""

if command -v autossh &> /dev/null; then
    autossh -M 0 -N \
        -o "ServerAliveInterval 30" \
        -o "ServerAliveCountMax 3" \
        -L "${GATEWAY_PORT}:127.0.0.1:${GATEWAY_PORT}" \
        -L "${RELAY_PORT}:127.0.0.1:${RELAY_PORT}" \
        "${USER}@${NODE_IP}"
else
    echo "autossh not found, falling back to ssh (no auto-reconnect)"
    ssh -N \
        -o "ServerAliveInterval 30" \
        -o "ServerAliveCountMax 3" \
        -L "${GATEWAY_PORT}:127.0.0.1:${GATEWAY_PORT}" \
        -L "${RELAY_PORT}:127.0.0.1:${RELAY_PORT}" \
        "${USER}@${NODE_IP}"
fi
