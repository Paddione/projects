#!/bin/bash
# =============================================================================
# Deploy SMB-CSI Driver
# =============================================================================
# Installs the SMB CSI driver via Helm and applies StorageClasses.
# Required for persistent storage (PostgreSQL, VideoVault, Registry).
#
# Usage: ./deploy-smb-csi.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if Helm is installed
if ! command -v helm &> /dev/null; then
    log_error "Helm is not installed. Install it first: https://helm.sh/docs/intro/install/"
    exit 1
fi

# Check if already installed
if helm list -n kube-system 2>/dev/null | grep -q csi-driver-smb; then
    log_info "SMB-CSI driver already installed via Helm"
    EXISTING_VERSION=$(helm list -n kube-system -f csi-driver-smb -o json | jq -r '.[0].chart')
    log_info "Current: ${EXISTING_VERSION}"

    log_info "Upgrading SMB-CSI driver..."
    helm upgrade csi-driver-smb csi-driver-smb/csi-driver-smb \
        --namespace kube-system \
        --set controller.replicas=1
else
    log_info "Installing SMB-CSI driver via Helm..."

    # Add Helm repo
    helm repo add csi-driver-smb https://raw.githubusercontent.com/kubernetes-csi/csi-driver-smb/master/charts 2>/dev/null || true
    helm repo update csi-driver-smb

    # Install
    helm install csi-driver-smb csi-driver-smb/csi-driver-smb \
        --namespace kube-system \
        --set controller.replicas=1
fi

# Wait for CSI driver pods
log_info "Waiting for SMB-CSI controller..."
kubectl rollout status deployment/csi-smb-controller -n kube-system --timeout=120s

log_info "Waiting for SMB-CSI node DaemonSet..."
kubectl rollout status daemonset/csi-smb-node -n kube-system --timeout=120s

# Apply StorageClasses
log_info "Applying StorageClasses..."
kubectl apply -k "$K8S_DIR/infrastructure/smb-csi"

# Verify
log_info "Verifying SMB-CSI installation..."
echo ""
echo "CSI Pods:"
kubectl get pods -n kube-system -l app.kubernetes.io/name=csi-driver-smb
echo ""
echo "StorageClasses:"
kubectl get storageclass | grep -E "^(NAME|smb)"
echo ""

log_info "SMB-CSI deployment complete"
