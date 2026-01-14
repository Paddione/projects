#!/bin/bash
# =============================================================================
# k3d Local Development Cluster Creation Script
# =============================================================================
# Creates a local k3d cluster for development and testing.
# k3d runs k3s inside Docker containers, perfect for local development.
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
# =============================================================================

set -euo pipefail

# Configuration
CLUSTER_NAME="${1:-korczewski-dev}"
SERVERS="${K3D_SERVERS:-1}"
AGENTS="${K3D_AGENTS:-2}"
API_PORT="${K3D_API_PORT:-6443}"
HTTP_PORT="${K3D_HTTP_PORT:-80}"
HTTPS_PORT="${K3D_HTTPS_PORT:-443}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

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

# Create cluster
create_cluster() {
    log_info "Creating k3d cluster: ${CLUSTER_NAME}"
    log_info "  Servers: ${SERVERS}"
    log_info "  Agents: ${AGENTS}"
    log_info "  Ports: HTTP=${HTTP_PORT}, HTTPS=${HTTPS_PORT}, API=${API_PORT}"

    k3d cluster create "${CLUSTER_NAME}" \
        --servers "${SERVERS}" \
        --agents "${AGENTS}" \
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
    echo "Endpoints:"
    echo "  API Server: https://localhost:${API_PORT}"
    echo "  HTTP:       http://localhost:${HTTP_PORT}"
    echo "  HTTPS:      https://localhost:${HTTPS_PORT}"
    echo ""
    echo "Nodes:"
    kubectl get nodes -o wide
    echo ""
    echo "=========================================="
    echo "Next Steps:"
    echo "=========================================="
    echo ""
    echo "1. Deploy infrastructure:"
    echo "   cd ../deploy && ./deploy-all.sh"
    echo ""
    echo "2. Or use Skaffold for development:"
    echo "   cd ../.. && skaffold dev"
    echo ""
    echo "3. To delete the cluster:"
    echo "   k3d cluster delete ${CLUSTER_NAME}"
    echo ""
    echo "4. Add hosts entries for domain routing:"
    echo "   echo '127.0.0.1 l2p.korczewski.de auth.korczewski.de payment.korczewski.de videovault.korczewski.de' | sudo tee -a /etc/hosts"
    echo ""
}

# Main execution
main() {
    echo "=========================================="
    echo "k3d Local Development Cluster"
    echo "=========================================="
    echo ""

    preflight_checks
    create_cluster
    wait_for_cluster
    install_traefik_crds
    print_summary
}

main "$@"
