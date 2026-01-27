#!/bin/bash
# =============================================================================
# Quick Deploy Changed Services
# =============================================================================
# Convenience wrapper for k8s/scripts/deploy/deploy-changed.sh
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

exec "$PROJECT_ROOT/k8s/scripts/deploy/deploy-changed.sh" "$@"
