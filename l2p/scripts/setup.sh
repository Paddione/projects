#!/bin/bash

# Learn2Play (L2P) - Quick Setup Script
# This script will set up the entire L2P application with minimal user input

set -e  # Exit on any error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Utility functions
print_header() {
    echo -e "\n${BLUE}================================================${NC}"
    echo -e "${BLUE} $1 ${NC}"
    echo -e "${BLUE}================================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    local missing_deps=()
    
    if ! command_exists node; then
        missing_deps+=("Node.js 20+")
    else
        local node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$node_version" -lt 20 ]; then
            missing_deps+=("Node.js 20+ (current: $(node -v))")
        else
            print_success "Node.js $(node -v)"
        fi
    fi
    
    if ! command_exists npm; then
        missing_deps+=("npm")
    else
        print_success "npm $(npm -v)"
    fi
    
    if ! command_exists docker; then
        missing_deps+=("Docker")
    else
        print_success "Docker $(docker -v | cut -d' ' -f3 | cut -d',' -f1)"
    fi
    
    if ! command_exists docker-compose; then
        missing_deps+=("Docker Compose")
    else
        print_success "Docker Compose $(docker-compose -v | cut -d' ' -f4 | cut -d',' -f1)"
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        print_error "Missing required dependencies:"
        for dep in "${missing_deps[@]}"; do
            echo -e "  - $dep"
        done
        echo -e "\nPlease install the missing dependencies and run this script again."
        echo -e "Visit: https://docs.docker.com/get-docker/ and https://nodejs.org/"
        exit 1
    fi
}

# Generate random string for secrets
generate_secret() {
    openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p -c 32
}

# Setup environment files
setup_environment() {
    print_header "Setting up Environment Configuration"
    
    if [ -f .env ]; then
        read -p "Environment file (.env) already exists. Overwrite? (y/N): " overwrite
        if [[ ! $overwrite =~ ^[Yy]$ ]]; then
            print_warning "Keeping existing .env file"
            return
        fi
    fi
    
    # Generate secrets
    local jwt_secret=$(generate_secret)
    local jwt_refresh_secret=$(generate_secret)
    local db_password=$(generate_secret | cut -c1-16)
    
    cat > .env << EOF
# Learn2Play Environment Configuration
# Generated on $(date)

# Database Configuration
DATABASE_URL=postgresql://l2p_user:${db_password}@localhost:5434/learn2play
DB_HOST=localhost
DB_PORT=5434
DB_NAME=learn2play
DB_USER=l2p_user
DB_PASSWORD=${db_password}

# JWT Authentication (Generated)
JWT_SECRET=${jwt_secret}
JWT_REFRESH_SECRET=${jwt_refresh_secret}

# Email Configuration (Optional - for password reset)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password
SMTP_FROM=your-email@gmail.com


# Application Configuration
NODE_ENV=development
PORT=3001
FRONTEND_PORT=3000

# Development Settings
ALLOW_PROD_DB_IN_TESTS=false
TEST_ENVIRONMENT=local
EOF
    
    print_success "Environment file created with secure secrets"
    print_warning "Optional: Edit .env to configure email (SMTP) features"
}

# Install dependencies
install_dependencies() {
    print_header "Installing Dependencies"
    
    echo "Installing root dependencies..."
    npm install --silent
    print_success "Root dependencies installed"
    
    echo "Installing frontend dependencies..."
    cd frontend && npm install --silent && cd ..
    print_success "Frontend dependencies installed"
    
    echo "Installing backend dependencies..."
    cd backend && npm install --silent && cd ..
    print_success "Backend dependencies installed"
}

# Setup database
setup_database() {
    print_header "Setting up Database"
    
    echo "Starting PostgreSQL container..."
    docker-compose up -d postgres
    
    echo "Waiting for database to be ready..."
    sleep 10
    
    # Wait for database to be fully ready
    local retries=30
    while [ $retries -gt 0 ]; do
        if docker-compose exec -T postgres pg_isready -U l2p_user -d learn2play >/dev/null 2>&1; then
            break
        fi
        echo "Waiting for database... ($retries attempts left)"
        sleep 2
        retries=$((retries - 1))
    done
    
    if [ $retries -eq 0 ]; then
        print_error "Database failed to start. Check Docker logs: docker-compose logs postgres"
        exit 1
    fi
    
    echo "Running database migrations..."
    npm run db:migrate
    
    print_success "Database setup complete"
}

# Build applications
build_applications() {
    print_header "Building Applications"
    
    echo "Building frontend..."
    npm run build:frontend
    print_success "Frontend built successfully"
    
    echo "Building backend..."
    npm run build:backend
    print_success "Backend built successfully"
}

# Install Playwright browsers for E2E tests
install_browsers() {
    print_header "Installing Test Browsers (Optional)"
    
    read -p "Install Playwright browsers for E2E testing? (y/N): " install_browsers
    if [[ $install_browsers =~ ^[Yy]$ ]]; then
        echo "Installing Playwright browsers..."
        npm run test:browsers:install:all
        print_success "Test browsers installed"
    else
        print_warning "Skipping browser installation (E2E tests will not work)"
    fi
}

# Start services
start_services() {
    print_header "Starting Services"
    
    echo "Starting all services..."
    docker-compose --profile development up -d
    
    echo "Waiting for services to be ready..."
    sleep 5
    
    print_success "All services started successfully"
}

# Run basic health checks
health_check() {
    print_header "Running Health Checks"
    
    local backend_health=false
    local frontend_health=false
    local db_health=false
    
    # Check database
    if docker-compose exec -T postgres pg_isready -U l2p_user -d learn2play >/dev/null 2>&1; then
        print_success "Database is healthy"
        db_health=true
    else
        print_error "Database health check failed"
    fi
    
    # Check backend (with retries)
    local retries=10
    while [ $retries -gt 0 ]; do
        if curl -s http://localhost:3001/api/health >/dev/null 2>&1; then
            print_success "Backend API is healthy"
            backend_health=true
            break
        fi
        sleep 2
        retries=$((retries - 1))
    done
    
    if [ $backend_health = false ]; then
        print_warning "Backend health check failed (may still be starting)"
    fi
    
    # Check frontend
    if curl -s http://localhost:3000 >/dev/null 2>&1; then
        print_success "Frontend is healthy"
        frontend_health=true
    else
        print_warning "Frontend health check failed (may still be starting)"
    fi
    
    if [ $db_health = true ] && [ $backend_health = true ] && [ $frontend_health = true ]; then
        return 0
    else
        return 1
    fi
}

# Show final information
show_completion() {
    print_header "Setup Complete!"
    
    echo -e "${GREEN}🎉 Learn2Play is now ready!${NC}\n"
    
    echo -e "${BLUE}Access URLs:${NC}"
    echo -e "  📱 Frontend:  ${GREEN}http://localhost:3000${NC}"
    echo -e "  🔧 Backend:   ${GREEN}http://localhost:3001${NC}"
    echo -e "  🗄️  Database:  ${GREEN}localhost:5434${NC}"
    
    echo -e "\n${BLUE}Useful Commands:${NC}"
    echo -e "  🏃 Start services:     ${YELLOW}docker-compose up -d${NC}"
    echo -e "  🛑 Stop services:      ${YELLOW}docker-compose down${NC}"
    echo -e "  📊 View logs:          ${YELLOW}docker-compose logs -f${NC}"
    echo -e "  🧪 Run tests:          ${YELLOW}npm run test:all${NC}"
    echo -e "  🚀 Production deploy:  ${YELLOW}docker-compose --profile production up -d${NC}"
    
    echo -e "\n${BLUE}Next Steps:${NC}"
    echo -e "  1. Visit ${GREEN}http://localhost:3000${NC} to access the application"
    echo -e "  2. Register a new account to get started"
    echo -e "  3. Edit ${YELLOW}.env${NC} to configure email features (optional)"
    echo -e "  4. Read ${YELLOW}DEPLOYMENT.md${NC} for advanced configuration"
    
    echo -e "\n${BLUE}Documentation:${NC}"
    echo -e "  📖 Deployment Guide:   ${YELLOW}DEPLOYMENT.md${NC}"
    echo -e "  📋 Main README:        ${YELLOW}README.md${NC}"
    echo -e "  🧪 Test Runner:        ${YELLOW}./scripts/test-runner.sh${NC}"
    
    if [ -f .env ]; then
        echo -e "\n${YELLOW}⚠️  Important: Keep your .env file secure and don't commit it to version control!${NC}"
    fi
}

# Main execution
main() {
    echo -e "${BLUE}"
    echo "  _                      ____  _____  _             "
    echo " | |    ___  __ _ _ __ _ _|___ \\|  _  || | __ _ _   _ "
    echo " | |   / _ \\/ _\` | '__| '_ \\__) | |_) || |/ _\` | | | |"
    echo " | |__|  __/ (_| | |  | | | |__/|  __/ | | (_| | |_| |"
    echo " |_____\\___|\\__,_|_|  |_| |_|   |_|    |_|\\__,_|\\__, |"
    echo "                                                |___/ "
    echo -e "${NC}"
    echo -e "${BLUE}Real-time Multiplayer Quiz Platform${NC}\n"
    
    # Run setup steps
    check_prerequisites
    setup_environment
    install_dependencies
    setup_database
    build_applications
    install_browsers
    start_services
    
    if health_check; then
        show_completion
    else
        echo -e "\n${YELLOW}Setup completed with some warnings.${NC}"
        echo -e "Check the logs: ${YELLOW}docker-compose logs -f${NC}"
        echo -e "Services may still be starting up..."
        show_completion
    fi
}

# Handle script interruption
trap 'echo -e "\n${RED}Setup interrupted.${NC}"; exit 1' INT

# Run main function
main "$@"
