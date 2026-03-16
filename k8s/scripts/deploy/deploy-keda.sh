#!/bin/bash
# =============================================================================
# Install KEDA (Kubernetes Event-Driven Autoscaling)
# =============================================================================
# Installs KEDA via Helm into the 'keda' namespace.
# Idempotent — safe to run multiple times (uses helm upgrade --install).
#
# Usage: ./deploy-keda.sh
# =============================================================================

set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_step() { echo -e "\n${BLUE}========================================${NC}"; echo -e "${BLUE}$1${NC}"; echo -e "${BLUE}========================================${NC}"; }

log_step "Installing KEDA"

log_info "Adding KEDA Helm repo..."
helm repo add kedacore https://kedacore.github.io/charts 2>/dev/null || true
helm repo update

log_info "Installing KEDA..."
helm upgrade --install keda kedacore/keda \
  --namespace keda --create-namespace \
  --wait --timeout 120s

log_info "KEDA installed successfully!"
kubectl get pods -n keda
