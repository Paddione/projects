#!/bin/bash
# =============================================================================
# Set Gemini API Key for Assetgenerator
# =============================================================================
# Creates/updates the k8s secret and restarts the pod.
#
# Usage: ./set-gemini-key.sh <your-api-key>
#    or: ./set-gemini-key.sh  (prompts interactively)
# =============================================================================

set -euo pipefail

NAMESPACE="korczewski-services"

if [ -n "${1:-}" ]; then
  API_KEY="$1"
else
  echo -n "Enter Gemini API key: "
  read -rs API_KEY
  echo ""
fi

if [ -z "$API_KEY" ]; then
  echo "Error: No API key provided"
  exit 1
fi

echo "Updating assetgenerator-secrets in $NAMESPACE..."
kubectl create secret generic assetgenerator-secrets \
  -n "$NAMESPACE" \
  --from-literal=GEMINI_API_KEY="$API_KEY" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "Restarting assetgenerator pod..."
kubectl rollout restart deployment/assetgenerator -n "$NAMESPACE"
kubectl rollout status deployment/assetgenerator -n "$NAMESPACE" --timeout=120s

echo "Done. Gemini Imagen is now available in the Assetgenerator."
