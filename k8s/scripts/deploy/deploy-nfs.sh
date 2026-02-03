#!/bin/bash
# =============================================================================
# Deploy NFS Provisioner
# =============================================================================
# Requires NFS_SERVER_IP to be configured in the ConfigMap.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo "Deploying NFS Provisioner..."

# Check if NFS server IP is configured
NFS_CONFIG="$K8S_DIR/infrastructure/nfs-provisioner/deployment.yaml"
if grep -q "REPLACE_WITH_NFS_SERVER_IP" "$NFS_CONFIG"; then
    log_error "NFS server IP not configured!"
    log_error "Please update $NFS_CONFIG with your NFS server IP"
    log_error "Replace 'REPLACE_WITH_NFS_SERVER_IP' with actual IP address"
    exit 1
fi

# Apply NFS provisioner manifests
kubectl apply -k "$K8S_DIR/infrastructure/nfs-provisioner/"

# Wait for provisioner to be ready
log_info "Waiting for NFS provisioner to be ready..."
kubectl wait --for=condition=ready pod -l app=nfs-subdir-external-provisioner \
    -n kube-system --timeout=120s 2>/dev/null || {
    log_warn "Timeout waiting for NFS provisioner"
    kubectl get pods -l app=nfs-subdir-external-provisioner -n kube-system
    exit 1
}

# Verify storage class
log_info "Verifying storage class..."
kubectl get storageclass nfs-storage

log_info "NFS Provisioner deployed successfully!"
