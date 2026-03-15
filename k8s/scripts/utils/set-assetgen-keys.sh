#!/bin/bash
# =============================================================================
# Set API Keys for Assetgenerator
# =============================================================================
# Creates/updates the k8s secret with all configured API keys and restarts pod.
# Preserves existing keys when adding new ones.
#
# Usage:
#   ./set-assetgen-keys.sh                        # interactive prompts
#   ./set-assetgen-keys.sh --gemini AIza...       # set one key
#   ./set-assetgen-keys.sh --suno sk-...          # set one key
#   ./set-assetgen-keys.sh --gemini X --suno Y    # set multiple
# =============================================================================

set -euo pipefail

NAMESPACE="korczewski-services"
SECRET_NAME="assetgenerator-secrets"

# Read existing keys from cluster (so we don't wipe them when setting one)
get_existing() {
  kubectl get secret "$SECRET_NAME" -n "$NAMESPACE" -o json 2>/dev/null | \
    node -e "
      const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8')).data||{};
      for(const[k,v]of Object.entries(d)) console.log(k+'='+Buffer.from(v,'base64').toString());
    " 2>/dev/null || true
}

declare -A KEYS
while IFS='=' read -r k v; do
  [ -n "$k" ] && KEYS["$k"]="$v"
done < <(get_existing)

# Parse CLI args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --gemini)  KEYS[GEMINI_API_KEY]="$2"; shift 2 ;;
    --suno)    KEYS[SUNO_API_KEY]="$2"; shift 2 ;;
    --siliconflow) KEYS[SILICONFLOW_API_KEY]="$2"; shift 2 ;;
    --elevenlabs)  KEYS[ELEVENLABS_API_KEY]="$2"; shift 2 ;;
    *) echo "Unknown flag: $1. Use --gemini, --suno, --siliconflow, --elevenlabs"; exit 1 ;;
  esac
done

# If no CLI args were given, prompt interactively
if [ ${#KEYS[@]} -eq 0 ] || {
  # Check if any values are non-empty (CLI args set something)
  all_empty=true
  for v in "${KEYS[@]}"; do [ -n "$v" ] && all_empty=false; done
  $all_empty
}; then
  echo "Set API keys for Assetgenerator (press Enter to skip/keep existing)"
  echo ""

  echo -n "Gemini API key [${KEYS[GEMINI_API_KEY]:+(set)}]: "
  read -r val
  [ -n "$val" ] && KEYS[GEMINI_API_KEY]="$val"

  echo -n "Suno API key [${KEYS[SUNO_API_KEY]:+(set)}]: "
  read -r val
  [ -n "$val" ] && KEYS[SUNO_API_KEY]="$val"

  echo -n "ElevenLabs API key [${KEYS[ELEVENLABS_API_KEY]:+(set)}]: "
  read -r val
  [ -n "$val" ] && KEYS[ELEVENLABS_API_KEY]="$val"

  echo -n "SiliconFlow API key [${KEYS[SILICONFLOW_API_KEY]:+(set)}]: "
  read -r val
  [ -n "$val" ] && KEYS[SILICONFLOW_API_KEY]="$val"
fi

# Build secret from all non-empty keys
ARGS=()
for k in "${!KEYS[@]}"; do
  [ -n "${KEYS[$k]}" ] && ARGS+=("--from-literal=${k}=${KEYS[$k]}")
done

if [ ${#ARGS[@]} -eq 0 ]; then
  echo "No keys configured. Nothing to do."
  exit 0
fi

echo ""
echo "Updating $SECRET_NAME with ${#ARGS[@]} key(s)..."
kubectl create secret generic "$SECRET_NAME" \
  -n "$NAMESPACE" \
  "${ARGS[@]}" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "Restarting assetgenerator pod..."
kubectl rollout restart deployment/assetgenerator -n "$NAMESPACE"
kubectl rollout status deployment/assetgenerator -n "$NAMESPACE" --timeout=120s

echo ""
echo "Done. Keys configured:"
for k in "${!KEYS[@]}"; do
  [ -n "${KEYS[$k]}" ] && echo "  $k: ****${KEYS[$k]: -4}"
done
