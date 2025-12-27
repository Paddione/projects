#!/bin/bash

# Test Environment Management Script
# Manages Docker-based test environment with proper health checks and cleanup

set -e

# Configuration
COMPOSE_FILE="docker-compose.test.yml"
PROJECT_NAME="learn2play-test"
NETWORK_NAME="test-network"
LOG_LEVEL=${LOG_LEVEL:-"info"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Check if docker-compose is available
check_compose() {
    if ! command -v docker-compose >/dev/null 2>&1; then
        log_error "docker-compose is not installed. Please install docker-compose and try again."
        exit 1
    fi
}

# Wait for service health check
wait_for_service() {
    local service_name=$1
    local max_attempts=${2:-30}
    local attempt=1
    
    log_info "Waiting for $service_name to be healthy..."
    
    while [ $attempt -le $max_attempts ]; do
        if docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME ps $service_name | grep -q "healthy"; then
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

# Start test environment
start_environment() {
    log_info "Starting test environment..."
    
    # Pull latest images
    log_info "Pulling latest images..."
    docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME pull --quiet
    
    # Build test images
    log_info "Building test images..."
    docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME build --parallel
    
    # Start services
    log_info "Starting services..."
    docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME up -d
    
    # Wait for services to be healthy
    log_info "Waiting for services to be ready..."
    
    # Wait for database first
    wait_for_service "postgres-test" 30
    

    
    # Wait for backend
    wait_for_service "backend-test" 40
    
    # Wait for frontend
    wait_for_service "frontend-test" 50
    
    # Wait for additional services
    wait_for_service "mailhog-test" 15
    wait_for_service "redis-test" 15
    
    log_success "Test environment is ready!"
    show_service_urls
}

# Stop test environment
stop_environment() {
    log_info "Stopping test environment..."
    docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME down
    log_success "Test environment stopped"
}

# Clean up test environment
cleanup_environment() {
    log_info "Cleaning up test environment..."
    
    # Stop and remove containers
    docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME down -v --remove-orphans
    
    # Remove test images
    log_info "Removing test images..."
    docker images --filter "label=com.docker.compose.project=$PROJECT_NAME" -q | xargs -r docker rmi -f
    
    # Clean up unused volumes
    log_info "Cleaning up unused volumes..."
    docker volume prune -f
    
    # Clean up unused networks
    log_info "Cleaning up unused networks..."
    docker network prune -f
    
    log_success "Test environment cleaned up"
}

# Reset test environment
reset_environment() {
    log_info "Resetting test environment..."
    cleanup_environment
    start_environment
}

# Show service status
show_status() {
    log_info "Test environment status:"
    docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME ps
}

# Show service URLs
show_service_urls() {
    echo ""
    log_info "Service URLs:"
    echo "  Frontend:     http://localhost:3007"
    echo "  Backend API:  http://localhost:3006/api"
    echo "  Database:     postgresql://l2p_user:HEHlWwBhTj71Em5GL9qh8G8kXACPrzx3@localhost:5433/learn2play_test"

    echo "  MailHog UI:   http://localhost:8025"
    echo "  Redis:        redis://localhost:6380"
    echo ""
}

# Show logs for a specific service
show_logs() {
    local service_name=${1:-""}
    
    if [ -z "$service_name" ]; then
        log_info "Showing logs for all services..."
        docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME logs -f
    else
        log_info "Showing logs for $service_name..."
        docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME logs -f $service_name
    fi
}

# Run health checks
health_check() {
    log_info "Running health checks..."
    
    local services=("postgres-test" "backend-test" "frontend-test" "mailhog-test" "redis-test")
    local all_healthy=true
    
    for service in "${services[@]}"; do
        if docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME ps $service | grep -q "healthy"; then
            log_success "$service: healthy"
        else
            log_error "$service: unhealthy"
            all_healthy=false
        fi
    done
    
    if [ "$all_healthy" = true ]; then
        log_success "All services are healthy"
        return 0
    else
        log_error "Some services are unhealthy"
        return 1
    fi
}

# Show help
show_help() {
    echo "Test Environment Management Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  start     Start the test environment"
    echo "  stop      Stop the test environment"
    echo "  restart   Restart the test environment"
    echo "  reset     Clean up and start fresh test environment"
    echo "  cleanup   Clean up test environment and remove all data"
    echo "  status    Show status of test services"
    echo "  health    Run health checks on all services"
    echo "  logs      Show logs for all services"
    echo "  logs <service>  Show logs for specific service"
    echo "  urls      Show service URLs"
    echo "  help      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 start"
    echo "  $0 logs backend-test"
    echo "  $0 health"
    echo ""
}

# Main script logic
main() {
    check_docker
    check_compose
    
    case "${1:-help}" in
        start)
            start_environment
            ;;
        stop)
            stop_environment
            ;;
        restart)
            stop_environment
            start_environment
            ;;
        reset)
            reset_environment
            ;;
        cleanup)
            cleanup_environment
            ;;
        status)
            show_status
            ;;
        health)
            health_check
            ;;
        logs)
            show_logs "$2"
            ;;
        urls)
            show_service_urls
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