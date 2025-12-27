#!/bin/bash

# Learn2Play - Interactive Container Rebuild Script
# Domain: l2p.korczewski.de

set -e

# BuildKit configuration (use Docker defaults; do not force logging mode)
# If you want BuildKit explicitly, uncomment the lines below.
# export DOCKER_BUILDKIT=1
# export COMPOSE_DOCKER_CLI_BUILD=1

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.yml"
PROFILE="production"
ENV_FILE=".env"

# Available compose files
AVAILABLE_COMPOSE_FILES=("docker-compose.yml" "docker-compose-npm.yml")
AVAILABLE_COMPOSE_DESCRIPTIONS=("Direct Communication" "Nginx Proxy Manager")

# Available profiles
AVAILABLE_PROFILES=("test" "dev" "production")

# Function to validate compose file
validate_compose_file() {
    local file=$1
    for valid_file in "${AVAILABLE_COMPOSE_FILES[@]}"; do
        if [[ "$file" == "$valid_file" ]]; then
            return 0
        fi
    done
    return 1
}

# Default advanced build options
NO_CACHE=true           # Default to no-cache builds
BUILD_ONLY=false        # If true, do not start containers after build
PULL_POLICY="missing"  # Docker Compose pull policy: always|missing|never
RESET_DB_AFTER=false    # If true, reset database after rebuilds

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${CYAN}$1${NC}"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Function to validate profile
validate_profile() {
    local profile=$1
    for valid_profile in "${AVAILABLE_PROFILES[@]}"; do
        if [[ "$profile" == "$valid_profile" ]]; then
            return 0
        fi
    done
    return 1
}

# Normalize various env aliases to canonical profile names
normalize_profile() {
    local input="$1"
    case "$input" in
        prod|production)
            echo "production"
            ;;
        dev|development)
            echo "dev"
            ;;
        test|testing)
            echo "test"
            ;;
        *)
            echo "$input"
            ;;
    esac
}

# Function to get docker compose profile token from canonical PROFILE
get_compose_profile() {
    if [[ "$PROFILE" == "dev" ]]; then
        echo "development"
    else
        echo "$PROFILE"
    fi
}

# Function to get the appropriate environment file for the profile
get_env_file() {
    case "$PROFILE" in
        production)
            if [[ -f ".env.production" ]]; then
                echo ".env.production"
            else
                echo ".env"
            fi
            ;;
        dev|development)
            if [[ -f ".env.dev" ]]; then
                echo ".env.dev"
            else
                echo ".env"
            fi
            ;;
        test)
            if [[ -f ".env.test" ]]; then
                echo ".env.test"
            else
                echo ".env"
            fi
            ;;
        *)
            echo ".env"
            ;;
    esac
}

# Wrapper to call docker-compose with the correct profile mapping
DC() {
    local profile_env_file=$(get_env_file)
    if [[ -f "$profile_env_file" ]]; then
        docker-compose -f "$COMPOSE_FILE" --env-file "$profile_env_file" --profile "$(get_compose_profile)" "$@"
    else
        docker-compose -f "$COMPOSE_FILE" --profile "$(get_compose_profile)" "$@"
    fi
}

# Function to show compose file selection menu
show_compose_file_menu() {
    print_header "=== Docker Compose File Selection ==="
    echo "Available compose files:"
    for i in "${!AVAILABLE_COMPOSE_FILES[@]}"; do
        local file="${AVAILABLE_COMPOSE_FILES[$i]}"
        local desc="${AVAILABLE_COMPOSE_DESCRIPTIONS[$i]}"
        if [[ "$file" == "$COMPOSE_FILE" ]]; then
            echo -e "  ${GREEN}$((i+1))) $file - $desc (current)${NC}"
        else
            echo "  $((i+1))) $file - $desc"
        fi
    done
    echo "  0) Cancel"
    echo
}

# Function to select compose file interactively
select_compose_file() {
    while true; do
        show_compose_file_menu
        read -p "Select compose file (0-${#AVAILABLE_COMPOSE_FILES[@]}): " choice
        echo
        
        if [[ "$choice" == "0" ]]; then
            print_status "Compose file selection cancelled"
            return 1
        elif [[ "$choice" =~ ^[0-9]+$ ]] && [[ "$choice" -ge 1 ]] && [[ "$choice" -le "${#AVAILABLE_COMPOSE_FILES[@]}" ]]; then
            local selected_file="${AVAILABLE_COMPOSE_FILES[$((choice-1))]}"
            if [[ "$selected_file" != "$COMPOSE_FILE" ]]; then
                print_status "Switching from $COMPOSE_FILE to $selected_file"
                COMPOSE_FILE="$selected_file"
            fi
            return 0
        else
            print_error "Invalid choice. Please try again."
            sleep 1
        fi
    done
}

# Function to show profile selection menu
show_profile_menu() {
    print_header "=== Profile Selection ==="
    echo "Available profiles:"
    for i in "${!AVAILABLE_PROFILES[@]}"; do
        local profile="${AVAILABLE_PROFILES[$i]}"
        if [[ "$profile" == "$PROFILE" ]]; then
            echo -e "  ${GREEN}$((i+1))) $profile (current)${NC}"
        else
            echo "  $((i+1))) $profile"
        fi
    done
    echo "  0) Cancel"
    echo
}

# Function to select profile interactively
select_profile() {
    while true; do
        show_profile_menu
        read -p "Select profile (0-${#AVAILABLE_PROFILES[@]}): " choice
        echo
        
        if [[ "$choice" == "0" ]]; then
            print_status "Profile selection cancelled"
            return 1
        elif [[ "$choice" =~ ^[0-9]+$ ]] && [[ "$choice" -ge 1 ]] && [[ "$choice" -le "${#AVAILABLE_PROFILES[@]}" ]]; then
            local selected_profile="${AVAILABLE_PROFILES[$((choice-1))]}"
            if [[ "$selected_profile" != "$PROFILE" ]]; then
                print_status "Switching from $PROFILE to $selected_profile profile"
                PROFILE="$selected_profile"
            fi
            return 0
        else
            print_error "Invalid choice. Please try again."
            sleep 1
        fi
    done
}

# Function to show help
show_help() {
    echo "Usage: $0 [OPTIONS] [COMMAND]"
    echo "       $0 [ENV] [COMMAND]"
    echo
    echo "Learn2Play Container Manager - Non-interactive mode for automation"
    echo
    echo "COMMANDS:"
    echo "  status              Show container status"
    echo "  rebuild-all         Rebuild all services (with cache)"
    echo "  rebuild-all-force   Rebuild all services (no cache)"
    echo "  rebuild-frontend    Rebuild frontend only (with cache)"
    echo "  rebuild-frontend-force Rebuild frontend only (no cache)"
    echo "  rebuild-backend     Rebuild backend only (with cache)"
    echo "  rebuild-backend-force Rebuild backend only (no cache)"
    echo ""
    echo "  rebuild-db          Rebuild database only"
    echo "  rebuild [SERVICES]  Rebuild one or more services (advanced)"
    echo "  reset-db            Reset database (with backup)"
    echo "  reset-db-force      Reset database WITHOUT backup (dangerous)"
    echo "  backup-db           Create database backup"
    echo "  logs [SERVICE]      View service logs (all, frontend, backend, postgres)"
    echo "  verify-routing      Verify routing configuration"
    echo "  start               Start all services"
    echo "  stop                Stop all services"
    echo "  restart             Restart all services"
    echo "  cache-clean         Clean Docker build cache"
    echo "  cache-prune         Prune unused Docker images and volumes"
    echo "  create-profile-env  Create a new environment file for the current profile"
    echo
    echo "OPTIONS:"
    echo "  -h, --help          Show this help message"
    echo "  -y, --yes           Auto-confirm all prompts (for automation)"
    echo "  -v, --verbose       Verbose output"
    echo "  -p, --profile       Docker Compose profile (test|dev|production, default: production)"
    echo "  -f, --file          Docker Compose file (docker-compose-npm.yml|docker-compose.yml, default: docker-compose-npm.yml)"
    echo "  -c, --compose       Same as --file (alias for compatibility)"
    echo "  -e, --env           Environment file (default: .env)"
    echo "      --no-cache      Disable docker build cache"
    echo "      --build-only    Only build images, do not restart containers"
    echo "      --pull POLICY   Set pull policy: always|missing|never (default: missing)"
    echo "      --reset-db      Reset database after rebuilds (for active profile)"
    echo
    echo "ENV (positional):"
    echo "  prod | production   Production (default)"
    echo "  dev  | development  Development"
    echo "  test | testing      Test"
    echo
    echo "PROFILES:"
    echo "  test                Test environment with minimal services"
    echo "  dev                 Development environment with debugging tools"
    echo "  production          Production environment with all services"
    echo
    echo "EXAMPLES:"
    echo "  $0 rebuild-all -y                    # Rebuild all services without prompts"
    echo "  $0 rebuild-frontend -y -p dev        # Rebuild frontend in dev profile"
    echo "  $0 dev rebuild-all                   # Positional env: dev profile"
    echo "  $0 test status                       # Positional env: test profile"
    echo "  $0 rebuild frontend backend --no-cache --pull always  # Rebuild multiple services"
    echo "  $0 rebuild-all --build-only          # Build images but do not restart containers"
    echo "  $0 rebuild-traefik -y                # Recreate Traefik with pull policy (default: missing)"
    echo "  $0 rebuild-traefik-force -y --pull always  # Force pull latest Traefik and recreate"
    echo "  $0 status -p test                    # Show status for test profile"
    echo "  $0 logs frontend -p production       # View frontend logs in production"
    echo "  $0 reset-db -y -p dev                # Reset database in dev profile"
    echo "  $0 start -p test                     # Start services in test profile"
    echo "  $0 stop -p production                # Stop services in production profile"
    echo "  $0 -f docker-compose.yml rebuild-all      # Use Traefik compose file"
    echo "  $0 --compose docker-compose.yml status    # Check status with Traefik compose file"
    echo
    echo "PROFILE-SPECIFIC COMMANDS:"
    echo "  $0 -p test rebuild-all               # Rebuild test environment"
    echo "  $0 -p dev logs backend               # View backend logs in dev"
    echo "  $0 -p production verify-routing      # Verify production routing"
    echo
    echo "For interactive mode, run without parameters: $0"
}

# Function to parse command line arguments
parse_args() {
    AUTO_CONFIRM=false
    VERBOSE=false
    REBUILD_SERVICES=()
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            # Positional environment aliases (set profile)
            prod|production|dev|development|test|testing)
                PROFILE="$(normalize_profile "$1")"
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            -y|--yes)
                AUTO_CONFIRM=true
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -p|--profile)
                PROFILE="$(normalize_profile "$2")"
                if ! validate_profile "$PROFILE"; then
                    print_error "Invalid profile: $PROFILE"
                    print_status "Valid profiles: ${AVAILABLE_PROFILES[*]}"
                    exit 1
                fi
                shift 2
                ;;
            -f|--file|-c|--compose)
                COMPOSE_FILE="$2"
                if ! validate_compose_file "$COMPOSE_FILE"; then
                    print_error "Invalid compose file: $COMPOSE_FILE"
                    print_status "Valid compose files: ${AVAILABLE_COMPOSE_FILES[*]}"
                    exit 1
                fi
                shift 2
                ;;
            -e|--env)
                ENV_FILE="$2"
                shift 2
                ;;
            --no-cache)
                NO_CACHE=true
                shift
                ;;
            --build-only)
                BUILD_ONLY=true
                shift
                ;;
            --pull)
                PULL_POLICY="$2"
                case "$PULL_POLICY" in
                    always|missing|never) ;;
                    *) print_error "Invalid pull policy: $PULL_POLICY"; exit 1;;
                esac
                shift 2
                ;;
            --reset-db)
                RESET_DB_AFTER=true
                shift
                ;;
            status|rebuild-all|rebuild-all-force|rebuild-frontend|rebuild-frontend-force|rebuild-backend|rebuild-backend-force|rebuild-traefik|rebuild-traefik-force|rebuild-db|rebuild|reset-db|reset-db-force|backup-db|logs|verify-routing|start|stop|restart|cache-clean|cache-prune|create-profile-env)
                COMMAND="$1"
                shift
                # Handle logs command with optional service parameter
                if [[ "$COMMAND" == "logs" && $# -gt 0 ]]; then
                    LOGS_SERVICE="$1"
                    shift
                fi
                # Handle rebuild advanced with explicit services list
                if [[ "$COMMAND" == "rebuild" ]]; then
                    while [[ $# -gt 0 ]]; do
                        case $1 in
                            -* ) break;;
                            * ) REBUILD_SERVICES+=("$1"); shift;;
                        esac
                    done
                fi
                ;;
            *)
                print_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# Function to handle auto-confirmation
auto_confirm() {
    if [[ "$AUTO_CONFIRM" == "true" ]]; then
        return 0
    else
        read -p "$1 (y/N): " confirm
        [[ $confirm =~ ^[Yy]$ ]]
    fi
}

# Function to check if required files exist
check_prerequisites() {
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        print_error "docker-compose.yml not found!"
        exit 1
    fi
    
    # Check for appropriate environment file
    local profile_env_file=$(get_env_file)
    if [[ ! -f "$profile_env_file" ]]; then
        print_error "Required environment file $profile_env_file not found for profile $PROFILE!"
        print_status "Available environment files:"
        for env_file in .env .env.production .env.dev .env.test; do
            if [[ -f "$env_file" ]]; then
                print_status "  ✓ $env_file"
            else
                print_status "  ✗ $env_file"
            fi
        done
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed!"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed!"
        exit 1
    fi
    
    # Check if the required network exists
    if ! docker network ls | grep -q "l2p-network"; then
        print_error "Required Docker network 'l2p-network' not found!"
        print_status "Creating l2p-network..."
        if docker network create l2p-network; then
            print_success "l2p-network created successfully"
        else
            print_error "Failed to create l2p-network"
            exit 1
        fi
    fi
    
    # Create required directories for bind mounts
    create_required_directories
}

# Function to create required directories for volumes
create_required_directories() {
    local data_path="${DATA_PATH:-./data}"
    local logs_path="${LOGS_PATH:-./logs}"
    
    print_status "Creating required directories for bind mounts..."
    
    # Create data directories
    mkdir -p "$data_path/postgres"
    mkdir -p "$data_path/letsencrypt"
    
    # Create log directories
    mkdir -p "$logs_path/backend"
    mkdir -p "$logs_path/frontend" 
    mkdir -p "$logs_path/postgres"
    mkdir -p "$logs_path/traefik"
    
    # Set appropriate permissions (only if we have write access)
    if [[ -d "$data_path/postgres" && -w "$data_path/postgres" ]]; then
        chmod 755 "$data_path/postgres" 2>/dev/null || true
    fi
    
    if [[ -d "$data_path/letsencrypt" && -w "$data_path/letsencrypt" ]]; then
        chmod 755 "$data_path/letsencrypt" 2>/dev/null || true
    fi
    
    # Make log directories writable
    if [[ -d "$logs_path" ]]; then
        chmod 755 "$logs_path" 2>/dev/null || true
        for logdir in backend frontend postgres traefik; do
            if [[ -d "$logs_path/$logdir" ]]; then
                chmod 755 "$logs_path/$logdir" 2>/dev/null || true
            fi
        done
    fi
    
    print_success "Required directories created successfully"
}

# Function to load environment variables
load_env() {
    # Get the appropriate environment file for the current profile
    local profile_env_file=$(get_env_file)
    
    # Load the primary environment file
    if [[ -f "$profile_env_file" ]]; then
        print_status "Loading environment variables from $profile_env_file"
        while IFS= read -r line || [[ -n "$line" ]]; do
            if [[ "$line" =~ ^[^#]*= ]]; then
                export "$line"
            fi
        done < "$profile_env_file"
    else
        print_warning "Environment file $profile_env_file not found!"
    fi
    
    # Also load the main .env file if it's different (as fallback for missing vars)
    if [[ "$profile_env_file" != ".env" && -f ".env" ]]; then
        print_status "Loading fallback environment variables from .env"
        while IFS= read -r line || [[ -n "$line" ]]; do
            if [[ "$line" =~ ^[^#]*= ]]; then
                # Only export if variable is not already set
                local var_name="${line%%=*}"
                if [[ -z "${!var_name}" ]]; then
                    export "$line"
                fi
            fi
        done < ".env"
    fi
    
    print_status "Environment loaded for profile: $PROFILE (using $profile_env_file)"
}

# Function to show current status
show_status() {
    print_header "=== Current Container Status ==="
    local profile_indicator=$(get_profile_indicator)
    print_status "Profile: $profile_indicator $PROFILE"
    echo
    DC ps
    echo
    
    print_header "=== Service Health ==="
    if DC ps --services --filter "status=running" | grep -q .; then
        for service in $(DC ps --services --filter "status=running"); do
            if DC exec -T "$service" echo "Service $service is responsive" 2>/dev/null; then
                print_success "$service: ✓ Running and responsive"
            else
                print_warning "$service: ⚠ Running but not responsive"
            fi
        done
    else
        print_warning "No services are currently running"
    fi
    echo
}

# Resolve DB service name for active profile
resolve_db_service() {
    local compose_profile=$(get_compose_profile)
    local services
    services=$(docker-compose -f "$COMPOSE_FILE" --profile "$compose_profile" config --services 2>/dev/null || true)
    if echo "$services" | grep -q '^postgres-test$'; then
        echo "postgres-test"
    else
        echo "postgres"
    fi
}

# Function to backup database
backup_database() {
    print_status "Creating database backup..."
    local backup_file="backup_$(date +%Y%m%d_%H%M%S)_${PROFILE}.sql"
    local db_service
    local pg_user
    local pg_db
    
    db_service=$(resolve_db_service)
    if [[ "$db_service" == "postgres-test" ]]; then
        pg_user="${TEST_POSTGRES_USER:-test_user}"
        pg_db="${TEST_POSTGRES_DB:-learn2play_test}"
    else
        pg_user="${POSTGRES_USER:-l2p_user}"
        pg_db="${POSTGRES_DB:-learn2play}"
    fi
    
    if DC exec -T "$db_service" pg_dump -U "$pg_user" "$pg_db" > "$backup_file"; then
        print_success "Database backup created: $backup_file"
        return 0
    else
        print_error "Failed to create database backup"
        return 1
    fi
}

# Function to reset database
reset_database() {
    local SKIP_BACKUP=${1:-false}
    local db_service
    db_service=$(resolve_db_service)
    if [[ "$AUTO_CONFIRM" != "true" ]]; then
        print_warning "This will PERMANENTLY DELETE all data in the database!"
        echo -e "Database service: ${YELLOW}$db_service${NC}"
        echo -e "Profile: ${YELLOW}$PROFILE${NC}"
        echo
        
        if ! auto_confirm "Are you sure you want to proceed?"; then
            print_status "Database reset cancelled"
            return 0
        fi
    fi
    
    if [[ "$SKIP_BACKUP" == "true" ]]; then
        print_warning "Skipping database backup as requested (reset-db-force)"
        BACKUP_OK=true
    else
        print_status "Creating backup before reset..."
        if backup_database; then
            BACKUP_OK=true
        else
            BACKUP_OK=false
        fi
    fi

    if [[ "$BACKUP_OK" == "true" ]]; then
        print_status "Stopping and removing database container..."
        DC stop "$db_service" || true
        DC rm -f "$db_service" || true
        
        print_status "Wiping database data directory inside the volume..."
        # Use a short-lived container with the same volumes mounted to erase the data dir
        set +e
        DC run --rm --no-deps --entrypoint sh "$db_service" -c "rm -rf /var/lib/postgresql/data/*" >/dev/null 2>&1
        rc=$?
        set -e
        if [[ $rc -ne 0 ]]; then
            print_warning "Could not run cleanup container; attempting host path cleanup for bind mounts"
            local data_dir="${DATA_PATH:-./data}/postgres"
            rm -rf "$data_dir"/* 2>/dev/null || true
        fi
        
        print_status "Starting database with fresh data..."
        DC up -d "$db_service"
        
        print_status "Waiting for database to be ready..."
        sleep 10
        
        print_success "Database has been reset and reinitialized for profile '$PROFILE'"
    else
        print_error "Backup failed. Database reset aborted for safety. Use 'reset-db-force' to skip backup."
        return 1
    fi
}

# Function to rebuild specific service with intelligent caching
rebuild_service() {
    local service=$1
    local force_rebuild=${2:-false}
    local build_only_arg=${3:-}
    local pull_policy_arg=${4:-}
    
    print_status "Rebuilding $service..."
    
    # Stop the service
    DC stop "$service"
    
    # Remove the container
    DC rm -f "$service"
    
    # Determine cache usage
    local build_args=""
    if [[ "$force_rebuild" == "true" || "$NO_CACHE" == "true" ]]; then
        build_args="--no-cache"
        print_status "Rebuilding $service with NO CACHE"
    else
        print_status "Rebuilding $service with cache optimization"
    fi

    # Attempt to build if a build context exists; otherwise skip build gracefully
    local build_succeeded=true
    set +e
    DC build $build_args "$service"
    local build_rc=$?
    set -e
    if [[ $build_rc -ne 0 ]]; then
        build_succeeded=false
        print_warning "No build context or build failed for $service. Skipping build and proceeding to recreate with pull policy."
    fi
    
    # Recreate container, honoring pull policy
    local effective_pull_policy=${pull_policy_arg:-$PULL_POLICY}
    if [[ "${build_only_arg:-$BUILD_ONLY}" == "true" ]]; then
        print_status "Build-only mode: not starting $service"
        if [[ "$build_succeeded" == false ]]; then
            # For image-only services, optionally pull image according to policy
            print_status "Pulling image for $service (policy: $effective_pull_policy)"
            COMPOSE_PULL_POLICY="$effective_pull_policy" DC pull "$service" || true
        fi
    else
        COMPOSE_PULL_POLICY="$effective_pull_policy" DC up -d "$service"
    fi
    
    print_success "$service has been rebuilt"
}

# Function to rebuild all services with intelligent caching and proper startup sequencing
rebuild_all() {
    local force_rebuild=${1:-false}
    local build_only_arg=${2:-}
    local pull_policy_arg=${3:-}
    
    print_status "Rebuilding all services..."
    
    # Stop all services
    print_status "Stopping all services..."
    DC down
    
    # Determine cache usage
    local build_args=""
    if [[ "$force_rebuild" == "true" || "$NO_CACHE" == "true" ]]; then
        build_args="--no-cache"
        print_status "Rebuilding all services with NO CACHE"
    else
        print_status "Rebuilding all services with cache optimization"
    fi
    
    # Build all services
    print_status "Building all services..."
    DC build $build_args
    
    # Start all services (unless build-only)
    local effective_pull_policy=${pull_policy_arg:-$PULL_POLICY}
    if [[ "${build_only_arg:-$BUILD_ONLY}" == "true" ]]; then
        print_status "Build-only mode: not starting services"
    else
        print_status "Starting services with proper dependency order..."
        start_services_sequentially "$effective_pull_policy"
        if [[ "$RESET_DB_AFTER" == true ]]; then
            print_status "--reset-db specified: resetting database of active profile..."
            reset_database "true"
        fi
    fi
    
    print_success "All services have been rebuilt"
}

# Function to start services with proper dependency sequencing
start_services_sequentially() {
    local effective_pull_policy=${1:-$PULL_POLICY}
    
    # Start database first (if it exists in the profile)
    local db_service=$(resolve_db_service)
    if DC config --services | grep -q "^$db_service$"; then
        print_status "Starting database service: $db_service"
        COMPOSE_PULL_POLICY="$effective_pull_policy" DC up -d "$db_service"
        
        print_status "Waiting for database to be healthy..."
        wait_for_service_health "$db_service" 120
    fi
    
    # Start backend services
    local backend_services=()
    for service in backend backend-dev backend-test; do
        if DC config --services | grep -q "^$service$"; then
            backend_services+=("$service")
        fi
    done
    
    if [[ ${#backend_services[@]} -gt 0 ]]; then
        print_status "Starting backend services: ${backend_services[*]}"
        COMPOSE_PULL_POLICY="$effective_pull_policy" DC up -d "${backend_services[@]}"
        
        for service in "${backend_services[@]}"; do
            print_status "Waiting for $service to be healthy..."
            wait_for_service_health "$service" 120
        done
    fi
    
    # Start frontend services
    local frontend_services=()
    for service in frontend frontend-dev frontend-test; do
        if DC config --services | grep -q "^$service$"; then
            frontend_services+=("$service")
        fi
    done
    
    if [[ ${#frontend_services[@]} -gt 0 ]]; then
        print_status "Starting frontend services: ${frontend_services[*]}"
        COMPOSE_PULL_POLICY="$effective_pull_policy" DC up -d "${frontend_services[@]}"
        
        for service in "${frontend_services[@]}"; do
            print_status "Waiting for $service to be healthy..."
            wait_for_service_health "$service" 90
        done
    fi
    
    # Finally start proxy services (NPM or Traefik)
    local proxy_services=()
    for service in nginx-proxy-manager traefik; do
        if DC config --services | grep -q "^$service$"; then
            proxy_services+=("$service")
        fi
    done
    
    if [[ ${#proxy_services[@]} -gt 0 ]]; then
        print_status "Starting proxy services: ${proxy_services[*]}"
        COMPOSE_PULL_POLICY="$effective_pull_policy" DC up -d "${proxy_services[@]}"
        
        for service in "${proxy_services[@]}"; do
            print_status "Waiting for $service to be healthy..."
            wait_for_service_health "$service" 120
        done
        
        # Give NPM extra time to establish connections after startup
        if [[ " ${proxy_services[*]} " =~ " nginx-proxy-manager " ]]; then
            print_status "Allowing NPM additional time to establish proxy connections..."
            sleep 15
        fi
    fi
    
    # Start any remaining services
    print_status "Starting any remaining services..."
    COMPOSE_PULL_POLICY="$effective_pull_policy" DC up -d
}

# Function to wait for service health with timeout
wait_for_service_health() {
    local service=$1
    local timeout=${2:-60}
    local elapsed=0
    local interval=5
    
    print_status "Waiting for $service to become healthy (timeout: ${timeout}s)..."
    
    while [[ $elapsed -lt $timeout ]]; do
        if DC ps "$service" 2>/dev/null | grep -q "(healthy)"; then
            print_success "$service is healthy"
            return 0
        elif DC ps "$service" 2>/dev/null | grep -q "(unhealthy)"; then
            print_warning "$service is unhealthy, continuing to wait..."
        fi
        
        sleep $interval
        elapsed=$((elapsed + interval))
        
        if [[ $((elapsed % 15)) -eq 0 ]]; then
            print_status "Still waiting for $service... (${elapsed}s/${timeout}s)"
        fi
    done
    
    print_warning "Timeout waiting for $service to become healthy"
    return 1
}

# Function to view logs
view_logs() {
    local service=${LOGS_SERVICE:-"all"}
    
    case $service in
        all) DC logs -f ;;
        frontend) DC logs -f frontend ;;
        backend) DC logs -f backend ;;
        postgres) DC logs -f postgres ;;
        traefik) DC logs -f traefik ;;
        nginx-proxy-manager|npm) DC logs -f nginx-proxy-manager ;;
        *) 
            print_error "Invalid service: $service"
            print_status "Valid services: all, frontend, backend, postgres, traefik, nginx-proxy-manager"
            exit 1
            ;;
    esac
}

# Function to clean Docker build cache
clean_cache() {
    print_header "=== Docker Cache Cleanup ==="
    print_status "Cleaning Docker build cache..."
    
    # Clean build cache
    docker builder prune -f
    
    # Clean system cache
    docker system prune -f
    
    print_success "Docker cache cleaned successfully"
}

# Function to prune unused Docker resources
prune_cache() {
    print_header "=== Docker Resource Pruning ==="
    print_status "Pruning unused Docker images, containers, and volumes..."
    
    # Prune everything (images, containers, networks, volumes)
    docker system prune -a -f --volumes
    
    print_success "Docker resources pruned successfully"
}

# Function to verify proxy routing
verify_routing() {
    local proxy_name
    if [[ "$COMPOSE_FILE" == "docker-compose-npm.yml" ]]; then
        proxy_name="Nginx Proxy Manager"
    else
        proxy_name="Traefik"
    fi
    print_header "=== $proxy_name Routing Verification ==="
    local profile_indicator=$(get_profile_indicator)
    print_status "Profile: $profile_indicator $PROFILE"
    print_status "Domain: $DOMAIN"
    print_status "Frontend URL: https://$DOMAIN"
    print_status "Backend API URL: https://$DOMAIN/api"
    echo
    
    if command -v curl &> /dev/null; then
        print_status "Testing connectivity..."
        
        # Test if proxy is running
        local proxy_service
        if [[ "$COMPOSE_FILE" == "docker-compose-npm.yml" ]]; then
            proxy_service="nginx-proxy-manager"
        else
            proxy_service="traefik"
        fi
        if DC ps "$proxy_service" | grep -q "Up"; then
            print_success "$proxy_name container is running"
        else
            print_error "$proxy_name container is not running"
        fi
        
        # Test local connectivity
        if curl -k -s --max-time 10 http://localhost:80 > /dev/null 2>&1; then
            print_success "Local HTTP port (80) is accessible"
        else
            print_warning "Local HTTP port (80) is not accessible"
        fi
        
        if curl -k -s --max-time 10 https://localhost:443 > /dev/null 2>&1; then
            print_success "Local HTTPS port (443) is accessible"
        else
            print_warning "Local HTTPS port (443) is not accessible"
        fi
    else
        print_warning "curl not available for connectivity testing"
    fi
    
    echo
    print_status "Manual verification steps:"
    echo "1. Ensure DNS for $DOMAIN points to this server"
    echo "2. Visit https://$DOMAIN to test frontend"
    echo "3. Visit https://$DOMAIN/api/health to test backend"
    echo "4. Check SSL certificate is valid and from Let's Encrypt"
}

# Function to show profile services
show_profile_services() {
    print_header "=== Profile Services for $PROFILE ==="
    
    case $PROFILE in
        test)
            print_status "Test profile includes minimal services for testing:"
            echo "  • frontend (minimal build)"
            echo "  • backend (test mode)"
            echo "  • postgres (test database)"
            echo "  • traefik (basic routing)"
            ;;
        dev)
            print_status "Development profile includes debugging tools:"
            echo "  • frontend (with hot reload)"
            echo "  • backend (with debug mode)"
            echo "  • postgres (development database)"
            echo "  • traefik (development routing)"
            echo "  • Additional debugging services"
            ;;
        production)
            print_status "Production profile includes all services:"
            echo "  • frontend (optimized build)"
            echo "  • backend (production mode)"
            echo "  • postgres (production database)"
            echo "  • traefik (production routing with SSL)"
            echo "  • Monitoring and logging services"
            ;;
    esac
    echo
}

# Function to create profile environment file
create_profile_env() {
    local profile_env_file
    case "$PROFILE" in
        production)
            profile_env_file=".env.production"
            ;;
        dev|development)
            profile_env_file=".env.dev"
            ;;
        test)
            profile_env_file=".env.test"
            ;;
        *)
            profile_env_file=".env.$PROFILE"
            ;;
    esac
    
    if [[ -f "$profile_env_file" ]]; then
        print_warning "Profile environment file $profile_env_file already exists!"
        if ! auto_confirm "Do you want to overwrite it?"; then
            print_status "Profile environment file creation cancelled"
            return 0
        fi
    fi
    
    print_status "Creating profile environment file: $profile_env_file"
    
    cat > "$profile_env_file" << EOF
# Learn2Play Environment Configuration for $PROFILE profile
# Generated on $(date)

# Database Configuration
POSTGRES_DB=l2p_${PROFILE}
POSTGRES_USER=l2p_${PROFILE}_user
POSTGRES_PASSWORD=change_me_${PROFILE}
POSTGRES_HOST=postgres
POSTGRES_PORT=5433

# Application Configuration
NODE_ENV=${PROFILE}
DOMAIN=l2p.korczewski.de

# Add your $PROFILE-specific environment variables below
# Example:
# DEBUG=true
# LOG_LEVEL=debug
# API_URL=http://localhost:3000

EOF
    
    print_success "Profile environment file created: $profile_env_file"
    print_status "Please edit the file to set appropriate values for your $PROFILE environment"
}

# Function to show profile information
show_profile_info() {
    print_header "=== Profile Information ==="
    print_status "Current profile: $PROFILE"
    echo
    print_status "Available profiles:"
    for profile in "${AVAILABLE_PROFILES[@]}"; do
        if [[ "$profile" == "$PROFILE" ]]; then
            echo -e "  ${GREEN}✓ $profile (active)${NC}"
        else
            echo "  ○ $profile"
        fi
    done
    echo
    print_status "Profile descriptions:"
    echo "  test        - Test environment with minimal services"
    echo "  dev         - Development environment with debugging tools"
    echo "  production  - Production environment with all services"
    echo
    
    # Show current profile services
    show_profile_services
}

# Function to get profile indicator
get_profile_indicator() {
    if [[ "$PROFILE" == "production" ]]; then
        echo "${RED}●${NC}"
    elif [[ "$PROFILE" == "dev" ]]; then
        echo "${YELLOW}●${NC}"
    else
        echo "${GREEN}●${NC}"
    fi
}

# Prompt for build options in interactive mode
prompt_build_options() {
    local no_cache_choice
    local build_only_choice
    local pull_choice
    echo
    print_header "=== Build Options ==="
    read -p "Use no-cache for build? (y/N): " no_cache_choice
    if [[ $no_cache_choice =~ ^[Yy]$ ]]; then
        INTERACTIVE_NO_CACHE=true
    else
        INTERACTIVE_NO_CACHE=false
    fi

    read -p "Build only (do not (re)start containers)? (y/N): " build_only_choice
    if [[ $build_only_choice =~ ^[Yy]$ ]]; then
        INTERACTIVE_BUILD_ONLY=true
    else
        INTERACTIVE_BUILD_ONLY=false
    fi

    echo "Select pull policy:"
    echo "  1) missing (default)"
    echo "  2) always"
    echo "  3) never"
    read -p "Choice [1-3]: " pull_choice
    case "$pull_choice" in
        2) INTERACTIVE_PULL_POLICY="always" ;;
        3) INTERACTIVE_PULL_POLICY="never" ;;
        *) INTERACTIVE_PULL_POLICY="missing" ;;
    esac
}

# Prompt for a list of services in interactive mode
prompt_service_list() {
    echo
    print_header "=== Select Services ==="
    echo "Enter space-separated services to rebuild. Common options:"
    echo "  - frontend"
    echo "  - backend"
    echo "  - postgres"
    echo "  - traefik"
    read -p "Services: " services_input
    # shellcheck disable=SC2206
    INTERACTIVE_SERVICES=( $services_input )
}

# Function to show main menu (interactive mode)
show_menu() {
    clear
    local profile_indicator=$(get_profile_indicator)
    local compose_indicator
    if [[ "$COMPOSE_FILE" == "docker-compose-npm.yml" ]]; then
        compose_indicator="${PURPLE}NPM${NC}"
    else
        compose_indicator="${BLUE}Direct${NC}"
    fi
    print_header "======================================"
    print_header "    Learn2Play Container Manager"
    print_header "    Domain: $DOMAIN"
    print_header "    Profile: $profile_indicator $PROFILE"
    print_header "    Proxy: $compose_indicator ($COMPOSE_FILE)"
    print_header "======================================"
    echo
    echo "1)  Show container status"
    echo "2)  Rebuild all services"
    echo "3)  Rebuild frontend only"
    echo "4)  Rebuild backend only"
    echo "5)  Rebuild database only"
    echo "6)  Reset database (with backup)"
    echo "7)  Create database backup"
    echo "8)  View service logs"
    echo "9)  Verify proxy routing"
    echo "10) Start all services"
    echo "11) Stop all services"
    echo "12) Restart all services"
    echo "13) Change profile"
    echo "14) Change compose file"
    echo "15) Show profile info"
    echo "16) Create profile environment file"
    echo "17) Show profile services"
    echo "18) Rebuild selected services (advanced)"
    echo "19) Rebuild frontend only (NO CACHE, restart)"
    echo "20) Rebuild backend only (NO CACHE, restart)"
    echo "0)  Exit"
    echo
}

# Function to execute command
execute_command() {
    case $COMMAND in
        status)
            show_status
            ;;
        rebuild-all)
            rebuild_all
            ;;
        rebuild-all-force)
            rebuild_all "true"
            ;;
        rebuild-frontend)
            rebuild_service "frontend"
            ;;
        rebuild-frontend-force)
            rebuild_service "frontend" "true"
            ;;
        rebuild-backend)
            rebuild_service "backend"
            ;;
        rebuild-backend-force)
            rebuild_service "backend" "true"
            ;;
        rebuild-db)
            rebuild_service "$(resolve_db_service)"
            ;;
        rebuild)
            if [[ ${#REBUILD_SERVICES[@]} -eq 0 ]]; then
                print_error "No services specified. Usage: $0 rebuild [SERVICES] [--no-cache] [--build-only] [--pull POLICY] [--reset-db]"
                exit 1
            fi
            for svc in "${REBUILD_SERVICES[@]}"; do
                rebuild_service "$svc"
            done
            if [[ "$RESET_DB_AFTER" == true ]]; then
                print_status "--reset-db specified: resetting database of active profile..."
                reset_database "true"
            fi
            ;;
        reset-db)
            reset_database
            ;;
        reset-db-force)
            reset_database "true"
            ;;
        backup-db)
            backup_database
            ;;
        logs)
            view_logs
            ;;
        verify-routing)
            verify_routing
            ;;
        start)
            print_status "Starting all services..."
            COMPOSE_PULL_POLICY="$PULL_POLICY" DC up -d
            print_success "All services started"
            ;;
        stop)
            print_status "Stopping all services..."
            DC down
            print_success "All services stopped"
            ;;
        restart)
            print_status "Restarting all services..."
            DC restart
            print_success "All services restarted"
            ;;
        cache-clean)
            clean_cache
            ;;
        cache-prune)
            prune_cache
            ;;
        create-profile-env)
            create_profile_env
            ;;
        *)
            print_error "Unknown command: $COMMAND"
            show_help
            exit 1
            ;;
    esac
}

# Main script execution
main() {
    # Parse command line arguments
    parse_args "$@"
    
    # Validate profile if specified
    if ! validate_profile "$PROFILE"; then
        print_error "Invalid profile: $PROFILE"
        print_status "Valid profiles: ${AVAILABLE_PROFILES[*]}"
        exit 1
    fi
    
    # If no command specified, run interactive mode
    if [[ -z "$COMMAND" ]]; then
        check_prerequisites
        load_env
        
        while true; do
            show_menu
            read -p "Choice (0-20): " choice
            echo
            
            case "$choice" in
                1)
                    show_status
                    ;;
                2)
                    rebuild_all "false"
                    ;;
                3)
                    rebuild_service "frontend" "false"
                    ;;
                4)
                    rebuild_service "backend" "false"
                    ;;
                5)
                    rebuild_service "$(resolve_db_service)" "false"
                    ;;
                6)
                    reset_database
                    ;;
                7)
                    backup_database
                    ;;
                8)
                    view_logs
                    ;;
                9)
                    verify_routing
                    ;;
                10)
                    print_status "Starting all services..."
                    COMPOSE_PULL_POLICY="$PULL_POLICY" DC up -d
                    print_success "All services started"
                    ;;
                11)
                    print_status "Stopping all services..."
                    DC down
                    print_success "All services stopped"
                    ;;
                12)
                    print_status "Restarting all services..."
                    DC restart
                    print_success "All services restarted"
                    ;;
                13)
                    select_profile
                    ;;
                14)
                    select_compose_file
                    ;;
                15)
                    show_profile_info
                    ;;
                16)
                    create_profile_env
                    ;;
                17)
                    show_profile_services
                    ;;
                18)
                    prompt_service_list
                    prompt_build_options
                    for svc in "${INTERACTIVE_SERVICES[@]}"; do
                        rebuild_service "$svc" "$INTERACTIVE_NO_CACHE" "$INTERACTIVE_BUILD_ONLY" "$INTERACTIVE_PULL_POLICY"
                    done
                    ;;
                19)
                    rebuild_service "frontend" "true" "false" "missing"
                    ;;
                20)
                    rebuild_service "backend" "true" "false" "missing"
                    ;;
                0)
                    print_status "Goodbye!"
                    exit 0
                    ;;
                *)
                    print_error "Invalid choice. Please try again."
                    ;;
            esac
            
            if [[ "$choice" != "0" ]]; then
                echo
                read -p "Press Enter to continue..." -r
            fi
        done
    else
        # Non-interactive mode
        check_prerequisites
        load_env
        local profile_indicator=$(get_profile_indicator)
        print_status "Using profile: $profile_indicator $PROFILE"
        execute_command
    fi
}

# Run the main function
main "$@" 