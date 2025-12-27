#!/bin/bash

# Test Environment Validation Script
# Validates that the Docker-based test environment is properly configured

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

# Validation results
VALIDATION_ERRORS=0
VALIDATION_WARNINGS=0

# Add error
add_error() {
    log_error "$1"
    VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
}

# Add warning
add_warning() {
    log_warning "$1"
    VALIDATION_WARNINGS=$((VALIDATION_WARNINGS + 1))
}

# Check if file exists
check_file() {
    local file_path=$1
    local description=$2
    
    if [ -f "$file_path" ]; then
        log_success "$description exists: $file_path"
        return 0
    else
        add_error "$description missing: $file_path"
        return 1
    fi
}

# Check if directory exists
check_directory() {
    local dir_path=$1
    local description=$2
    
    if [ -d "$dir_path" ]; then
        log_success "$description exists: $dir_path"
        return 0
    else
        add_error "$description missing: $dir_path"
        return 1
    fi
}

# Check Docker installation
check_docker() {
    log_info "Checking Docker installation..."
    
    if command -v docker >/dev/null 2>&1; then
        log_success "Docker is installed"
        
        if docker info >/dev/null 2>&1; then
            log_success "Docker daemon is running"
        else
            add_error "Docker daemon is not running"
        fi
    else
        add_error "Docker is not installed"
    fi
}

# Check Docker Compose installation
check_docker_compose() {
    log_info "Checking Docker Compose installation..."
    
    if command -v docker-compose >/dev/null 2>&1; then
        log_success "Docker Compose is installed"
        local version=$(docker-compose --version)
        log_info "Version: $version"
    else
        add_error "Docker Compose is not installed"
    fi
}

# Check required files
check_required_files() {
    log_info "Checking required files..."
    
    # Docker configuration files
    check_file "$COMPOSE_FILE" "Docker Compose test configuration"
    check_file "backend/Dockerfile.test" "Backend test Dockerfile"
    check_file "frontend/Dockerfile.test" "Frontend test Dockerfile"
    check_file ".dockerignore.test" "Docker ignore file for tests"
    
    # Configuration files
    check_file "test-config.yml" "Test configuration file"
    
    # Database files
    check_file "database/init.sql" "Database initialization script"
    
    # Package files
    check_file "backend/package.json" "Backend package.json"
    check_file "frontend/package.json" "Frontend package.json"
    
    # Test scripts
    check_file "scripts/test-environment.sh" "Test environment management script"
}

# Check required directories
check_required_directories() {
    log_info "Checking required directories..."
    
    check_directory "backend/src" "Backend source directory"
    check_directory "frontend/src" "Frontend source directory"
    check_directory "database" "Database directory"
    check_directory "scripts" "Scripts directory"
}

# Validate Docker Compose configuration
validate_compose_config() {
    log_info "Validating Docker Compose configuration..."
    
    if [ -f "$COMPOSE_FILE" ]; then
        if docker-compose -f "$COMPOSE_FILE" config >/dev/null 2>&1; then
            log_success "Docker Compose configuration is valid"
        else
            add_error "Docker Compose configuration is invalid"
            log_info "Run 'docker-compose -f $COMPOSE_FILE config' for details"
        fi
    else
        add_error "Docker Compose file not found: $COMPOSE_FILE"
    fi
}

# Check port availability
check_port_availability() {
    log_info "Checking port availability..."
    
    local ports=(3000 3001 5433 8001 8025 1025 6380)
    
    for port in "${ports[@]}"; do
        if lsof -i :$port >/dev/null 2>&1; then
            add_warning "Port $port is already in use"
        else
            log_success "Port $port is available"
        fi
    done
}

# Check disk space
check_disk_space() {
    log_info "Checking disk space..."
    
    local available_space=$(df . | awk 'NR==2 {print $4}')
    local required_space=2097152  # 2GB in KB
    
    if [ "$available_space" -gt "$required_space" ]; then
        log_success "Sufficient disk space available ($(($available_space / 1024 / 1024))GB)"
    else
        add_warning "Low disk space. At least 2GB recommended for test environment"
    fi
}

# Check memory
check_memory() {
    log_info "Checking available memory..."
    
    local available_memory=$(free -m | awk 'NR==2{print $7}')
    local required_memory=2048  # 2GB in MB
    
    if [ "$available_memory" -gt "$required_memory" ]; then
        log_success "Sufficient memory available (${available_memory}MB)"
    else
        add_warning "Low memory. At least 2GB recommended for test environment"
    fi
}

# Check network connectivity
check_network() {
    log_info "Checking network connectivity..."
    
    # Check if we can reach Docker Hub
    if curl -s --connect-timeout 5 https://registry-1.docker.io/v2/ >/dev/null; then
        log_success "Can reach Docker Hub"
    else
        add_warning "Cannot reach Docker Hub. Image pulls may fail"
    fi
    
    # Check if we can reach PostgreSQL image registry
    if curl -s --connect-timeout 5 https://hub.docker.com/v2/repositories/library/postgres/ >/dev/null; then
        log_success "Can reach PostgreSQL image registry"
    else
        add_warning "Cannot reach PostgreSQL image registry"
    fi
}

# Validate environment variables
check_environment_variables() {
    log_info "Checking environment variables..."
    
    # Check if any critical environment variables are set that might conflict
    local env_vars=("DATABASE_URL" "NODE_ENV" "PORT")
    
    for var in "${env_vars[@]}"; do
        if [ -n "${!var}" ]; then
            add_warning "Environment variable $var is set: ${!var}. This might conflict with test environment"
        fi
    done
}

# Check Docker images
check_docker_images() {
    log_info "Checking Docker images..."
    
    local images=("postgres:15-alpine" "node:18-alpine" "redis:7-alpine" "mailhog/mailhog:latest")
    
    for image in "${images[@]}"; do
        if docker image inspect "$image" >/dev/null 2>&1; then
            log_success "Image available locally: $image"
        else
            log_info "Image not available locally (will be pulled): $image"
        fi
    done
}

# Main validation function
run_validation() {
    log_info "Starting test environment validation..."
    echo ""
    
    check_docker
    echo ""
    
    check_docker_compose
    echo ""
    
    check_required_files
    echo ""
    
    check_required_directories
    echo ""
    
    validate_compose_config
    echo ""
    
    check_port_availability
    echo ""
    
    check_disk_space
    echo ""
    
    check_memory
    echo ""
    
    check_network
    echo ""
    
    check_environment_variables
    echo ""
    
    check_docker_images
    echo ""
    
    # Summary
    log_info "Validation Summary:"
    if [ $VALIDATION_ERRORS -eq 0 ]; then
        log_success "No errors found"
    else
        log_error "$VALIDATION_ERRORS error(s) found"
    fi
    
    if [ $VALIDATION_WARNINGS -eq 0 ]; then
        log_success "No warnings"
    else
        log_warning "$VALIDATION_WARNINGS warning(s) found"
    fi
    
    echo ""
    
    if [ $VALIDATION_ERRORS -eq 0 ]; then
        log_success "Test environment validation passed!"
        log_info "You can now run: ./scripts/test-environment.sh start"
        return 0
    else
        log_error "Test environment validation failed!"
        log_info "Please fix the errors above before starting the test environment"
        return 1
    fi
}

# Show help
show_help() {
    echo "Test Environment Validation Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --help, -h    Show this help message"
    echo ""
    echo "This script validates that the Docker-based test environment"
    echo "is properly configured and ready to use."
    echo ""
}

# Main script logic
case "${1:-validate}" in
    validate|"")
        run_validation
        ;;
    --help|-h|help)
        show_help
        ;;
    *)
        log_error "Unknown option: $1"
        show_help
        exit 1
        ;;
esac