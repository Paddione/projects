#!/bin/bash
# =============================================================================
# k3d Local Development Cluster Creation Script
# =============================================================================
# Creates a local k3d cluster with a local registry for development and testing.
# k3d runs k3s inside Docker containers, perfect for local development.
#
# The script creates a local Docker registry (registry.local:5000) that mirrors
# the production registry name. This means the same manifests (using
# registry.local:5000/korczewski/<svc>) work on both k3d and production.
#
# Usage: ./k3d-create.sh [CLUSTER_NAME]
#
# Prerequisites:
#   - Docker installed and running
#   - k3d installed (curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash)
#
# Example:
#   ./k3d-create.sh                    # Creates cluster named 'korczewski-dev'
#   ./k3d-create.sh my-cluster         # Creates cluster named 'my-cluster'
#
# After creation, push images to the local registry:
#   docker tag myapp:latest localhost:5000/korczewski/myapp:latest
#   docker push localhost:5000/korczewski/myapp:latest
#
# Or use the deploy scripts — they auto-detect k3d and push to the local registry.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Configuration
CLUSTER_NAME="${1:-korczewski-dev}"
REGISTRY_NAME="registry.local"
REGISTRY_PORT="${K3D_REGISTRY_PORT:-5000}"
SERVERS="${K3D_SERVERS:-1}"
AGENTS="${K3D_AGENTS:-2}"
API_PORT="${K3D_API_PORT:-6443}"
HTTP_PORT="${K3D_HTTP_PORT:-80}"
HTTPS_PORT="${K3D_HTTPS_PORT:-443}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "\n${BLUE}========================================${NC}"; echo -e "${BLUE}$1${NC}"; echo -e "${BLUE}========================================${NC}"; }

# Pre-flight checks
preflight_checks() {
    log_info "Running pre-flight checks..."

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi

    if ! docker info &> /dev/null; then
        log_error "Docker is not running"
        exit 1
    fi

    # Check k3d
    if ! command -v k3d &> /dev/null; then
        log_error "k3d is not installed"
        echo "Install with: curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash"
        exit 1
    fi

    # Check if cluster already exists
    if k3d cluster list | grep -q "^${CLUSTER_NAME}"; then
        log_warn "Cluster '${CLUSTER_NAME}' already exists"
        read -p "Delete and recreate? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            log_info "Deleting existing cluster..."
            k3d cluster delete "${CLUSTER_NAME}"
        else
            exit 1
        fi
    fi

    # Check if ports are available
    for port in $HTTP_PORT $HTTPS_PORT $API_PORT; do
        if ss -tlnp 2>/dev/null | grep -q ":$port " || \
           netstat -tlnp 2>/dev/null | grep -q ":$port "; then
            log_error "Port $port is already in use"
            exit 1
        fi
    done

    log_info "Pre-flight checks passed"
}

# Create or reuse local registry
setup_registry() {
    log_step "Setting up local registry"

    # Check if registry already exists
    if k3d registry list 2>/dev/null | grep -q "${REGISTRY_NAME}"; then
        log_info "Registry '${REGISTRY_NAME}' already exists, reusing it"
        return 0
    fi

    # Check if port is in use by something else
    if ss -tlnp 2>/dev/null | grep -q ":${REGISTRY_PORT} " || \
       netstat -tlnp 2>/dev/null | grep -q ":${REGISTRY_PORT} "; then
        log_warn "Port ${REGISTRY_PORT} already in use — checking if it's our registry..."
        if docker ps --filter "name=registry.local" --format '{{.Names}}' | grep -q registry; then
            log_info "Found existing registry container, reusing it"
            return 0
        fi
        log_error "Port ${REGISTRY_PORT} is used by something else"
        exit 1
    fi

    log_info "Creating local registry: ${REGISTRY_NAME}:${REGISTRY_PORT}"
    k3d registry create "${REGISTRY_NAME}" --port "${REGISTRY_PORT}"

    log_info "Registry created at localhost:${REGISTRY_PORT}"
}

# Create cluster with registry
create_cluster() {
    log_step "Creating k3d cluster: ${CLUSTER_NAME}"
    log_info "  Servers: ${SERVERS}"
    log_info "  Agents: ${AGENTS}"
    log_info "  Registry: ${REGISTRY_NAME}:${REGISTRY_PORT}"
    log_info "  Ports: HTTP=${HTTP_PORT}, HTTPS=${HTTPS_PORT}, API=${API_PORT}"

    local REGISTRY_CONFIG="${SCRIPT_DIR}/k3d-registries.yaml"

    k3d cluster create "${CLUSTER_NAME}" \
        --servers "${SERVERS}" \
        --agents "${AGENTS}" \
        --registry-use "k3d-${REGISTRY_NAME}:${REGISTRY_PORT}" \
        --registry-config "${REGISTRY_CONFIG}" \
        --port "${HTTP_PORT}:80@loadbalancer" \
        --port "${HTTPS_PORT}:443@loadbalancer" \
        --api-port "${API_PORT}" \
        --k3s-arg "--disable=traefik@server:*" \
        --k3s-arg "--disable=servicelb@server:*" \
        --k3s-arg "--disable=local-storage@server:*" \
        --kubeconfig-update-default \
        --kubeconfig-switch-context \
        --wait

    log_info "Cluster created successfully"
}

# Wait for cluster to be ready
wait_for_cluster() {
    log_info "Waiting for cluster to be ready..."

    local retries=30
    local count=0

    while [ $count -lt $retries ]; do
        if kubectl get nodes &> /dev/null; then
            # Wait for all nodes to be ready
            local not_ready=$(kubectl get nodes --no-headers | grep -v "Ready" | wc -l)
            if [ "$not_ready" -eq 0 ]; then
                log_info "All nodes are ready!"
                return 0
            fi
        fi
        count=$((count + 1))
        log_info "Waiting for nodes... ($count/$retries)"
        sleep 5
    done

    log_error "Cluster failed to become ready"
    exit 1
}

# Install Traefik CRDs
install_traefik_crds() {
    log_info "Installing Traefik CRDs..."

    kubectl apply -f https://raw.githubusercontent.com/traefik/traefik/v3.0/docs/content/reference/dynamic-configuration/kubernetes-crd-definition-v1.yml 2>/dev/null || \
    log_warn "Traefik CRDs might already be installed or URL unavailable"

    log_info "Traefik CRDs installed"
}

# Verify registry connectivity from inside the cluster
verify_registry() {
    log_info "Verifying registry connectivity from cluster..."

    # Check that k3s registries.yaml was configured
    local node_name="k3d-${CLUSTER_NAME}-server-0"
    if docker exec "${node_name}" cat /etc/rancher/k3s/registries.yaml 2>/dev/null | grep -q "${REGISTRY_NAME}"; then
        log_info "Registry mirror configured in k3s registries.yaml"
    else
        log_warn "Registry mirror may not be configured — check /etc/rancher/k3s/registries.yaml"
    fi
}

# Print summary
print_summary() {
    echo ""
    echo "=========================================="
    echo -e "${GREEN}k3d Cluster Created Successfully${NC}"
    echo "=========================================="
    echo ""
    echo "Cluster Name: ${CLUSTER_NAME}"
    echo "Kubeconfig Context: k3d-${CLUSTER_NAME}"
    echo ""
    echo "Registry:"
    echo "  Push to:    localhost:${REGISTRY_PORT}/korczewski/<service>:latest"
    echo "  Pods pull:  registry.local:${REGISTRY_PORT}/korczewski/<service>:latest"
    echo ""
    echo "Endpoints:"
    echo "  API Server: https://localhost:${API_PORT}"
    echo "  HTTP:       http://localhost:${HTTP_PORT}"
    echo "  HTTPS:      https://localhost:${HTTPS_PORT}"
    echo ""
    echo "Nodes:"
    kubectl get nodes -o wide
    echo ""
    echo "=========================================="
    echo "Deploy workflow:"
    echo "=========================================="
    echo ""
    echo "1. Build and push to local registry:"
    echo "   docker build -t localhost:${REGISTRY_PORT}/korczewski/arena-backend:latest -f arena/backend/Dockerfile ."
    echo "   docker push localhost:${REGISTRY_PORT}/korczewski/arena-backend:latest"
    echo ""
    echo "2. Or use deploy scripts (auto-detect k3d):"
    echo "   ./k8s/scripts/deploy/deploy-arena.sh"
    echo ""
    echo "3. Apply manifests (same as production):"
    echo "   kubectl apply -k k8s/services/arena-backend/"
    echo "   kubectl rollout restart deployment/arena-backend -n korczewski-services"
    echo ""
    echo "4. To delete the cluster:"
    echo "   k3d cluster delete ${CLUSTER_NAME}"
    echo ""
    echo "5. Add hosts entries for domain routing:"
    echo "   echo '127.0.0.1 l2p.korczewski.de auth.korczewski.de shop.korczewski.de arena.korczewski.de videovault.korczewski.de' | sudo tee -a /etc/hosts"
    echo ""
}

# Main execution
main() {
    echo "=========================================="
    echo "k3d Local Development Cluster"
    echo "=========================================="
    echo ""

    preflight_checks
    setup_registry
    create_cluster
    wait_for_cluster
    install_traefik_crds
    verify_registry
    print_summary
}

main "$@"
