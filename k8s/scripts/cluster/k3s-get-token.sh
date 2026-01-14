#!/bin/bash
# =============================================================================
# k3s Get Join Token Script
# =============================================================================
# Retrieves the node join token from the k3s server.
# Run this on the master node to get the token for joining workers/servers.
#
# Usage: ./k3s-get-token.sh
# =============================================================================

set -euo pipefail

TOKEN_PATH="/var/lib/rancher/k3s/server/node-token"

if [ ! -f "$TOKEN_PATH" ]; then
    echo "Error: Token file not found at $TOKEN_PATH"
    echo "Is this a k3s server node?"
    exit 1
fi

echo "K3s Join Token:"
echo "==============="
cat "$TOKEN_PATH"
echo ""
echo ""
echo "To join a worker node:"
echo "  ./k3s-join-worker.sh $(hostname -I | awk '{print $1}') '$(cat $TOKEN_PATH)'"
echo ""
echo "To join another server node (HA):"
echo "  ./k3s-join-server.sh $(hostname -I | awk '{print $1}') '$(cat $TOKEN_PATH)'"
