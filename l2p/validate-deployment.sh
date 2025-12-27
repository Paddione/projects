#!/bin/bash

# Deployment Validation Script
# Validates that all necessary files and configurations are in place

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_header() {
    echo -e "\n${BLUE}$1${NC}"
}

errors=0
warnings=0

print_header "🔍 Learn2Play Deployment Validation"

# Check required files
print_header "Checking required files..."

required_files=(
    "package.json"
    "docker-compose.yml"
    "frontend/package.json"
    "backend/package.json"
    ".env.example"
    "setup.sh"
    "deploy.sh"
    "DEPLOYMENT.md"
    "QUICKSTART.md"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        print_success "$file exists"
    else
        print_error "$file is missing"
        errors=$((errors + 1))
    fi
done

# Check script permissions
print_header "Checking script permissions..."

scripts=("setup.sh" "deploy.sh" "test-runner.sh")
for script in "${scripts[@]}"; do
    if [ -f "$script" ]; then
        if [ -x "$script" ]; then
            print_success "$script is executable"
        else
            print_warning "$script is not executable (run: chmod +x $script)"
            warnings=$((warnings + 1))
        fi
    fi
done

# Check Docker Compose configuration
print_header "Checking Docker Compose configuration..."

if docker-compose config >/dev/null 2>&1; then
    print_success "docker-compose.yml is valid"
else
    print_error "docker-compose.yml has syntax errors"
    errors=$((errors + 1))
fi

# Check if production compose exists and is valid
if [ -f "docker-compose.prod.yml" ]; then
    if docker-compose -f docker-compose.yml -f docker-compose.prod.yml config >/dev/null 2>&1; then
        print_success "Production Docker Compose configuration is valid"
    else
        print_error "Production Docker Compose configuration has errors"
        errors=$((errors + 1))
    fi
fi

# Check package.json scripts
print_header "Checking package.json scripts..."

required_scripts=("install:all" "build:all" "test:unit" "db:migrate")
for script in "${required_scripts[@]}"; do
    if grep -q "\"$script\":" package.json; then
        print_success "npm script '$script' is defined"
    else
        print_error "npm script '$script' is missing"
        errors=$((errors + 1))
    fi
done

# Check shell scripts
shell_scripts=("setup" "deploy")
for script in "${shell_scripts[@]}"; do
    if [ -x "${script}.sh" ]; then
        print_success "Shell script '${script}.sh' exists and is executable"
    else
        print_error "Shell script '${script}.sh' is missing or not executable"
        errors=$((errors + 1))
    fi
done

# Check environment template
print_header "Checking environment configuration..."

if [ -f ".env.example" ]; then
    # Check for required environment variables
    required_env_vars=("DATABASE_URL" "JWT_SECRET" "JWT_REFRESH_SECRET" "NODE_ENV")
    for var in "${required_env_vars[@]}"; do
        if grep -q "^${var}=" .env.example; then
            print_success "Environment variable $var is in template"
        else
            print_warning "Environment variable $var is missing from template"
            warnings=$((warnings + 1))
        fi
    done
else
    print_error "Environment template (.env.example) is missing"
    errors=$((errors + 1))
fi

# Check if .env exists (should not be committed)
if [ -f ".env" ]; then
    print_warning ".env file exists (make sure it's not committed to version control)"
    warnings=$((warnings + 1))
fi

# Check frontend structure
print_header "Checking frontend structure..."

frontend_files=("src/App.tsx" "src/main.tsx" "index.html" "vite.config.ts")
for file in "${frontend_files[@]}"; do
    if [ -f "frontend/$file" ]; then
        print_success "Frontend file $file exists"
    else
        print_error "Frontend file $file is missing"
        errors=$((errors + 1))
    fi
done

# Check backend structure
print_header "Checking backend structure..."

backend_files=("src/server.ts" "src/app.ts" "migrations" "database.ts")
for file in "${backend_files[@]}"; do
    if [ -e "backend/$file" ]; then
        print_success "Backend file/directory $file exists"
    else
        print_error "Backend file/directory $file is missing"
        errors=$((errors + 1))
    fi
done

# Check database migrations
print_header "Checking database migrations..."

migration_count=$(ls backend/migrations/*.sql 2>/dev/null | wc -l)
if [ "$migration_count" -gt 0 ]; then
    print_success "Found $migration_count database migration(s)"
else
    print_warning "No database migrations found"
    warnings=$((warnings + 1))
fi

# Summary
print_header "📊 Validation Summary"

if [ $errors -eq 0 ] && [ $warnings -eq 0 ]; then
    echo -e "${GREEN}🎉 All checks passed! Deployment is ready.${NC}"
    exit 0
elif [ $errors -eq 0 ]; then
    echo -e "${YELLOW}✅ Deployment is ready with $warnings warning(s).${NC}"
    exit 0
else
    echo -e "${RED}❌ Found $errors error(s) and $warnings warning(s).${NC}"
    echo -e "${RED}Please fix the errors before deploying.${NC}"
    exit 1
fi