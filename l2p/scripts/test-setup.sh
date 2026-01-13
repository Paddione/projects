#!/bin/bash

# Test Infrastructure Setup Script
# This script manages the test database, backend, and frontend setup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.test.yml"
PROJECT_NAME="learn2play-test"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
}

# Wait for service to be healthy
wait_for_service() {
    local service_name=$1
    local max_attempts=${2:-30}
    local attempt=1

    log_info "Waiting for $service_name to be healthy..."

    while [ $attempt -le $max_attempts ]; do
        if docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME ps $service_name 2>/dev/null | grep -q "healthy"; then
            log_success "$service_name is healthy"
            return 0
        fi

        if [ $((attempt % 5)) -eq 0 ]; then
            log_info "Still waiting for $service_name... (attempt $attempt/$max_attempts)"
        fi

        sleep 2
        attempt=$((attempt + 1))
    done

    log_error "$service_name failed to become healthy within $((max_attempts * 2)) seconds"
    return 1
}

# Setup test database only
setup_database() {
    log_info "Setting up test database..."

    check_docker

    # Start only the database service
    docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME up -d postgres-test

    # Wait for database to be ready
    wait_for_service "postgres-test" 30

    log_success "Test database is ready!"
    log_info "Database URL: postgresql://l2p_user:***@localhost:5432/l2p_db"
}

# Setup test backend (includes database)
setup_backend() {
    log_info "Setting up test backend..."

    check_docker

    # Start database and backend services
    docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME up -d postgres-test backend-test

    # Wait for services to be ready
    wait_for_service "postgres-test" 30
    wait_for_service "backend-test" 40

    log_success "Test backend is ready!"
    log_info "Backend API: http://localhost:3006/api"
}

# Setup full test environment (database, backend, frontend)
setup_full() {
    log_info "Setting up full test environment..."

    check_docker

    # Start all test services
    docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME up -d postgres-test backend-test frontend-test mailhog-test redis-test

    # Wait for services to be ready
    wait_for_service "postgres-test" 30
    wait_for_service "backend-test" 40
    wait_for_service "frontend-test" 50
    wait_for_service "mailhog-test" 15
    wait_for_service "redis-test" 15

    log_success "Full test environment is ready!"
    show_urls
}

# Show service URLs
show_urls() {
    echo ""
    log_info "Service URLs:"
    echo "  Frontend:     http://localhost:3007"
    echo "  Backend API:  http://localhost:3006/api"
    echo "  Database:     postgresql://l2p_user:***@localhost:5432/l2p_db"
    echo "  MailHog UI:   http://localhost:8025"
    echo "  Redis:        redis://localhost:6380"
    echo ""
}

# Show service status
show_status() {
    log_info "Test infrastructure status:"
    docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME ps
}

# Teardown test infrastructure
teardown() {
    log_info "Tearing down test infrastructure..."
    docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME down
    log_success "Test infrastructure stopped"
}

# Clean teardown (removes volumes)
teardown_clean() {
    log_info "Cleaning test infrastructure (removing volumes)..."
    docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME down -v --remove-orphans
    log_success "Test infrastructure cleaned"
}

# Show help
show_help() {
    echo "Test Infrastructure Setup Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  db           Setup test database only"
    echo "  backend      Setup test database and backend"
    echo "  full         Setup full test environment (database, backend, frontend)"
    echo "  status       Show status of test infrastructure"
    echo "  teardown     Stop test infrastructure"
    echo "  clean        Stop test infrastructure and remove volumes"
    echo "  urls         Show service URLs"
    echo "  help         Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 db                    # Setup just the database for unit tests"
    echo "  $0 backend               # Setup database and backend for integration tests"
    echo "  $0 full                  # Setup everything for E2E tests"
    echo "  $0 teardown              # Stop all test services"
    echo ""
}

# Main script logic
main() {
    case "${1:-help}" in
        db|database)
            setup_database
            ;;
        backend|be)
            setup_backend
            ;;
        full|all)
            setup_full
            ;;
        status)
            show_status
            ;;
        teardown|stop)
            teardown
            ;;
        clean|cleanup)
            teardown_clean
            ;;
        urls)
            show_urls
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
