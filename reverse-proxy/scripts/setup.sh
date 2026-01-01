#!/bin/bash
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROXY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROXY_DIR"

echo -e "${GREEN}=== Traefik Reverse Proxy Setup ===${NC}\n"

# Function to print status
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}!${NC} $1"
}

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi
print_status "Docker is installed"

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi
print_status "Docker Compose is installed"

# Create required directories
echo -e "\n${GREEN}Creating required directories...${NC}"
mkdir -p logs config/dynamic
print_status "Directories created"

# Create traefik-public network if it doesn't exist
echo -e "\n${GREEN}Setting up Docker networks...${NC}"
if ! docker network inspect traefik-public &> /dev/null; then
    docker network create traefik-public
    print_status "Created traefik-public network"
else
    print_warning "traefik-public network already exists"
fi

# Create l2p-network if it doesn't exist
if ! docker network inspect l2p-network &> /dev/null; then
    docker network create l2p-network
    print_status "Created l2p-network"
else
    print_warning "l2p-network already exists"
fi

# Check if .env-prod exists, create from example if not
if [ ! -f .env-prod ]; then
    print_warning ".env-prod file not found. Creating from .env.example..."
    cp .env.example .env-prod
    print_status "Created .env-prod file"
    print_warning "Please update .env-prod with your configuration!"
else
    print_status ".env-prod file exists"
fi

# Prompt for dashboard password if needed
echo -e "\n${YELLOW}Do you want to set up the Traefik dashboard password? (y/n)${NC}"
read -r setup_password

if [[ "$setup_password" =~ ^[Yy]$ ]]; then
    # Check if htpasswd is installed
    if ! command -v htpasswd &> /dev/null; then
        print_error "htpasswd is not installed. Installing apache2-utils..."
        if command -v apt-get &> /dev/null; then
            sudo apt-get update && sudo apt-get install -y apache2-utils
        elif command -v yum &> /dev/null; then
            sudo yum install -y httpd-tools
        else
            print_error "Cannot install htpasswd. Please install it manually."
            exit 1
        fi
    fi

    echo -e "${YELLOW}Enter username for Traefik dashboard (default: admin):${NC}"
    read -r username
    username=${username:-admin}

    echo -e "${YELLOW}Enter password for Traefik dashboard:${NC}"
    read -rs password

    # Generate password hash (strip the username prefix)
    full_hash=$(htpasswd -nb "$username" "$password")
    hash="${full_hash#*:}"

    echo -e "\n${GREEN}Generated password hash. Copy this to TRAEFIK_DASHBOARD_PASSWORD_HASH in .env-prod:${NC}"
    echo "$hash"
    echo -e "\n${YELLOW}Update TRAEFIK_DASHBOARD_USER and TRAEFIK_DASHBOARD_PASSWORD_HASH in .env-prod${NC}"
fi

# Check DNS configuration
echo -e "\n${YELLOW}Checking DNS configuration...${NC}"
domains=(
    "traefik.korczewski.de"
    "l2p.korczewski.de"
    "videovault.korczewski.de"
    "payment.korczewski.de"
    "auth.korczewski.de"
)

for domain in "${domains[@]}"; do
    if host "$domain" &> /dev/null; then
        ip=$(host "$domain" | grep "has address" | awk '{print $4}' | head -1)
        print_status "$domain → $ip"
    else
        print_warning "$domain - DNS not configured"
    fi
done

# Start Traefik
echo -e "\n${YELLOW}Do you want to start Traefik now? (y/n)${NC}"
read -r start_traefik

if [[ "$start_traefik" =~ ^[Yy]$ ]]; then
    echo -e "\n${GREEN}Starting Traefik...${NC}"
    docker-compose --env-file .env-prod up -d

    echo -e "\n${GREEN}Waiting for Traefik to be ready...${NC}"
    sleep 5

    if docker ps | grep -q traefik; then
        print_status "Traefik is running!"
        echo -e "\n${GREEN}Access the dashboard at: ${NC}https://traefik.korczewski.de"
        echo -e "${GREEN}View logs with: ${NC}docker-compose logs -f traefik"
    else
        print_error "Traefik failed to start. Check logs with: docker-compose logs traefik"
    fi
else
    echo -e "\n${YELLOW}To start Traefik later, run:${NC}"
    echo "docker-compose --env-file .env-prod up -d"
fi

echo -e "\n${GREEN}=== Setup Complete ===${NC}"
echo -e "\nNext steps:"
echo "1. Update .env-prod with your configuration"
echo "2. Update dashboard password hash in docker-compose.yml"
echo "3. Start your services (l2p, VideoVault, payment, auth)"
echo "4. Check the Traefik dashboard for routing status"
echo -e "\nFor more information, see README.md"
