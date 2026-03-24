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

set -uo pipefail

NODE_IP="${1:-10.10.0.4}"
USER="patrick"

GATEWAY_PORT=18789
RELAY_PORT=18792
RECONNECT_DELAY=5
MAX_RECONNECT_DELAY=60

SSH_OPTS=(
    -o "ServerAliveInterval 15"
    -o "ServerAliveCountMax 3"
    -o "ConnectTimeout 10"
    -o "ExitOnForwardFailure yes"
    -o "TCPKeepAlive yes"
)

cleanup() {
    echo ""
    echo "Tunnel stopped."
    exit 0
}
trap cleanup INT TERM

echo "Starting OpenClaw tunnel to ${USER}@${NODE_IP}"
echo "  Gateway:       localhost:${GATEWAY_PORT}"
echo "  Browser Relay: localhost:${RELAY_PORT}"
echo "  Press Ctrl+C to stop"
echo ""

if command -v autossh &> /dev/null; then
    export AUTOSSH_GATETIME=0    # reconnect even if first connection drops quickly
    export AUTOSSH_POLL=30       # check connection every 30s
    autossh -M 0 -N \
        "${SSH_OPTS[@]}" \
        -L "${GATEWAY_PORT}:127.0.0.1:${GATEWAY_PORT}" \
        -L "${RELAY_PORT}:127.0.0.1:${RELAY_PORT}" \
        "${USER}@${NODE_IP}"
else
    echo "autossh not found, using ssh with reconnect loop"
    delay=$RECONNECT_DELAY
    while true; do
        start_time=$(date +%s)
        ssh -N \
            "${SSH_OPTS[@]}" \
            -L "${GATEWAY_PORT}:127.0.0.1:${GATEWAY_PORT}" \
            -L "${RELAY_PORT}:127.0.0.1:${RELAY_PORT}" \
            "${USER}@${NODE_IP}" || true
        elapsed=$(( $(date +%s) - start_time ))
        # Reset backoff if tunnel was up for >60s (it was a real session, not a connect failure)
        if (( elapsed > 60 )); then
            delay=$RECONNECT_DELAY
        fi
        echo "[$(date '+%H:%M:%S')] Tunnel disconnected (was up ${elapsed}s). Reconnecting in ${delay}s..."
        sleep "$delay"
        delay=$(( delay * 2 > MAX_RECONNECT_DELAY ? MAX_RECONNECT_DELAY : delay * 2 ))
    done
fi
