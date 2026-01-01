#!/usr/bin/env bash

# Interactive test runner for Learn2Play
# Location: l2p/scripts/test-runner.sh

set -eu -o pipefail

# Exit on any error, undefined variable, or pipe failure
# This ensures we catch errors early and fail fast

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR" || exit 1

APP_VERSION="1.0.0"

# Default configurations
export DISPLAY=${DISPLAY:-':0'}
DEFAULT_NODE_OPTIONS="--experimental-vm-modules --no-warnings"
DEFAULT_JEST_FLAGS="--passWithNoTests --logHeapUsage --detectOpenHandles --forceExit"

# Playwright configuration
PLAYWRIGHT_BROWSERS_PATH="${HOME}/.cache/ms-playwright"
PLAYWRIGHT_TEST_DIR="${ROOT_DIR}/frontend/e2e/tests"
PLAYWRIGHT_CONFIG="${ROOT_DIR}/frontend/playwright.config.ts"
PLAYWRIGHT_REPORT_DIR="${ROOT_DIR}/frontend/e2e/playwright-report"
COVERAGE_DIR="${ROOT_DIR}/coverage"
LOGS_DIR="${ROOT_DIR}/logs/tests"
ERROR_LOG="${LOGS_DIR}/error.log"

# Ensure Node runs with ESM support for Jest (needed for TS + ESM tests)
ensure_node_esm() {
  # If caller didn't set NODE_OPTIONS, default to ESM-friendly options
  if [[ -z "${NODE_OPTIONS-}" ]]; then
    export NODE_OPTIONS="$DEFAULT_NODE_OPTIONS"
  fi
  
  # Set default NODE_ENV to test if not set
  export NODE_ENV=${NODE_ENV:-test}
  
  # Set test timezone to UTC for consistent test results
  export TZ=UTC
}

# Ensure logs directory exists
ensure_logs_dir() {
  mkdir -p "$LOGS_DIR"
  # Create or truncate error log file
  > "$ERROR_LOG"
}

# Log error to error log file
log_error() {
  local message="$1"
  local timestamp
  timestamp=$(date +'%Y-%m-%d %H:%M:%S')
  echo "[$timestamp] ERROR: $message" >> "$ERROR_LOG"
}

# Build test infrastructure
build_test_infrastructure() {
  echo "Building test infrastructure..."
  
  # Clean up any existing test infrastructure first
  echo "Pre-cleaning any existing test infrastructure..."
  cleanup_test_infrastructure
  
  local error_count=0
  
  # Install root dependencies
  echo "Installing root dependencies..."
  if ! npm install 2>&1 | tee -a "$ERROR_LOG"; then
    log_error "Failed to install root dependencies"
    ((error_count++))
  fi
  
  # Install backend dependencies
  echo "Installing backend dependencies..."
  if ! (cd backend && npm install) 2>&1 | tee -a "$ERROR_LOG"; then
    log_error "Failed to install backend dependencies"
    ((error_count++))
  fi
  
  # Install frontend dependencies
  echo "Installing frontend dependencies..."
  if ! (cd frontend && npm install) 2>&1 | tee -a "$ERROR_LOG"; then
    log_error "Failed to install frontend dependencies"
    ((error_count++))
  fi
  
  # Install Playwright browsers
  echo "Installing Playwright browsers..."
  if ! (cd frontend/e2e && npm install && npx playwright install --with-deps) 2>&1 | tee -a "$ERROR_LOG"; then
    log_error "Failed to install Playwright browsers"
    ((error_count++))
  fi
  
  # Start test environment if needed
  echo "Starting test environment..."
  if ! npm run test:env:start 2>&1 | tee -a "$ERROR_LOG"; then
    log_error "Failed to start test environment"
    ((error_count++))
  fi
  
  # Wait for services to be ready
  echo "Waiting for test services to be ready..."
  sleep 10
  
  # Verify test environment health
  echo "Checking test environment health..."
  if ! npm run test:env:health 2>&1 | tee -a "$ERROR_LOG"; then
    log_error "Test environment health check failed"
    ((error_count++))
  fi
  
  if [ $error_count -eq 0 ]; then
    echo "✓ Test infrastructure built successfully"
    return 0
  else
    echo "✗ Test infrastructure build completed with $error_count errors. Check $ERROR_LOG for details."
    return 1
  fi
}

# Cleanup test infrastructure
cleanup_test_infrastructure() {
  echo "Cleaning up test infrastructure..."
  
  # Stop test environment
  npm run test:env:stop 2>&1 | tee -a "$ERROR_LOG" || true
  
  # Force cleanup of any remaining test containers
  echo "Removing any remaining test containers..."
  docker ps -a --filter "name=l2p-*-test" -q | xargs -r docker rm -f 2>/dev/null || true
  docker ps -a --filter "label=com.docker.compose.project=learn2play-test" -q | xargs -r docker rm -f 2>/dev/null || true
  
  # Force cleanup of test networks
  echo "Removing test networks..."
  docker network ls --filter "name=learn2play-test" -q | xargs -r docker network rm 2>/dev/null || true
  docker network ls --filter "name=test-network" -q | xargs -r docker network rm 2>/dev/null || true
  
  # Clean up test volumes
  echo "Removing test volumes..."
  docker volume ls --filter "name=learn2play-test" -q | xargs -r docker volume rm 2>/dev/null || true
  
  # Clean up test images if they exist
  echo "Removing test images..."
  docker images --filter "label=com.docker.compose.project=learn2play-test" -q | xargs -r docker rmi -f 2>/dev/null || true
  docker images "learn2play-test*" -q | xargs -r docker rmi -f 2>/dev/null || true
  
  echo "Test infrastructure cleanup completed"
}

# Check if test infrastructure is running and healthy
is_infrastructure_running() {
  # Quick check - if containers are running and test environment is healthy
  if docker ps --filter "name=l2p-*-test" --filter "label=com.docker.compose.project=learn2play-test" | grep -q "Up" && \
     npm run test:env:health >/dev/null 2>&1; then
    return 0  # Infrastructure is running and healthy
  else
    return 1  # Infrastructure is not running or unhealthy
  fi
}

# Smart build that only builds if infrastructure is not running
smart_build_infrastructure() {
  echo "Checking test infrastructure status..."

  if is_infrastructure_running; then
    echo "✓ Test infrastructure is already running and healthy. Skipping build."
    return 0
  else
    echo "✗ Test infrastructure is not running or unhealthy. Building..."
    if ! build_test_infrastructure; then
      return 1
    fi
  fi
}

# Check status of test infrastructure
check_infrastructure_status() {
  echo "Checking test infrastructure status..."
  echo

  # Check if test environment services are running
  echo "=== Test Environment Services ==="
  if npm run test:env:health >/dev/null 2>&1; then
    echo "✓ Test environment services are healthy"
  else
    echo "✗ Test environment services are not running or unhealthy"
  fi

  # Check Docker containers
  echo
  echo "=== Docker Containers ==="
  local test_containers
  test_containers=$(docker ps -a --filter "name=l2p-*-test" --filter "label=com.docker.compose.project=learn2play-test" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}")

  if [[ -n "$test_containers" && "$test_containers" != *"NAMES"* ]]; then
    echo "Test containers found:"
    echo "$test_containers"
  else
    echo "No test containers found"
  fi

  # Check Docker networks
  echo
  echo "=== Docker Networks ==="
  local test_networks
  test_networks=$(docker network ls --filter "name=learn2play-test" --filter "name=test-network" --format "table {{.Name}}\t{{.Driver}}")

  if [[ -n "$test_networks" && "$test_networks" != *"NAME"* ]]; then
    echo "Test networks found:"
    echo "$test_networks"
  else
    echo "No test networks found"
  fi

  # Check Docker volumes
  echo
  echo "=== Docker Volumes ==="
  local test_volumes
  test_volumes=$(docker volume ls --filter "name=learn2play-test" --format "table {{.Name}}\t{{.Driver}}")

  if [[ -n "$test_volumes" && "$test_volumes" != *"NAME"* ]]; then
    echo "Test volumes found:"
    echo "$test_volumes"
  else
    echo "No test volumes found"
  fi

  echo
  echo "=== Summary ==="
  if docker ps --filter "name=l2p-*-test" --filter "label=com.docker.compose.project=learn2play-test" | grep -q "Up"; then
    echo "✓ Test infrastructure appears to be running"
  else
    echo "✗ No running test infrastructure found"
    echo "  Use 'infra:setup' to start the test environment"
  fi
}

print_header() {
  echo "==========================================="
  echo " Learn2Play - Interactive Test Runner"
  echo "==========================================="
}

print_usage() {
  cat <<'EOF'
Usage: ./scripts/test-runner.sh [--help] [--list] [--run <key> [skip-build]]

Options:
  --help, -h         Show this help and exit
  --list, -l         List available test keys and exit
  --run, -r <key>    Run a specific test target non-interactively (see --list)
                     Optional second parameter 'skip-build' to skip infrastructure setup

Note: When running tests, the script automatically checks if test infrastructure
is already running and healthy. If so, it skips the build process for efficiency.

Common keys:
  unit:frontend        Run frontend unit tests
  unit:backend         Run backend unit tests
  unit:both            Run unit tests for both frontend and backend

  integration:frontend Run frontend integration tests
  integration:backend  Run backend integration tests
  integration:both     Run integration tests for both frontend and backend

  e2e:headless         Run Playwright E2E (headless)
  e2e:headed           Run Playwright E2E (headed)
  e2e:ui               Run Playwright E2E (UI mode)

  coverage:frontend    Collect frontend coverage
  coverage:backend     Collect backend coverage
  coverage:both        Collect coverage for both frontend and backend

  infra:setup          Set up test infrastructure (fresh build, use when needed)
  infra:status         Check status of test infrastructure
  infra:cleanup        Clean up test infrastructure (containers, services)

  all                  Run all tests (unit + integration + e2e)
EOF
}

list_keys() {
  print_usage | awk 'NR>7' # print from keys onward for a concise list
}

require_tools() {
  if ! command -v npm >/dev/null 2>&1; then
    echo "Error: npm is required but not found in PATH." >&2
    exit 1
  fi
}

# Run a command with proper error handling and output formatting
run_cmd() {
  local cmd="$*"
  local start_time
  start_time=$(date +%s)
  
  echo -e "\n\033[1;34m[$(date +'%H:%M:%S')] Running: $cmd\033[0m"
  
  # Execute the command with error handling and logging
  if eval "$cmd" 2>&1 | tee -a "$ERROR_LOG"; then
    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - start_time))
    echo -e "\n\033[1;32m✓ Command completed successfully in ${duration}s\033[0m"
    return 0
  else
    local exit_code=$?
    echo -e "\n\033[1;31m✗ Command failed with status $exit_code\033[0m"
    log_error "Command failed: $cmd (exit code: $exit_code)"
    return $exit_code
  fi
}

# Run Jest with common flags and options
run_jest() {
  local jest_cmd="npx jest $DEFAULT_JEST_FLAGS $*"
  run_cmd "$jest_cmd"
}

# Run Playwright tests with proper environment setup
run_playwright() {
  local mode="$1"
  local additional_flags="${2:-}"
  
  # Change to e2e directory to avoid Playwright conflicts
  local original_dir="$PWD"
  cd "${SCRIPT_DIR}/frontend/e2e" || {
    echo "Error: Could not change to e2e directory"
    return 1
  }
  
  # Ensure Playwright browsers are installed in e2e directory
  if [ ! -d "$PLAYWRIGHT_BROWSERS_PATH" ]; then
    echo "Installing Playwright browsers in e2e directory..."
    npx playwright install --with-deps
  fi
  
  # Set up environment for remote display if needed
  if [ -n "${SSH_CONNECTION:-}" ] && [ "$mode" = "headed" ]; then
    export DISPLAY=:0
    export ELECTRON_EXTRA_LAUNCH_ARGS="--disable-gpu"
  fi
  
  # Run Playwright with appropriate flags from e2e directory
  local playwright_cmd="npx playwright test"
  
  case "$mode" in
    headless)
      playwright_cmd+=" --workers=1"
      # Explicitly force headless mode to avoid X server issues
      export PLAYWRIGHT_BROWSERS_PATH="${HOME}/.cache/ms-playwright"
      ;;
    headed)
      playwright_cmd+=" --headed --workers=1"
      ;;
    ui)
      playwright_cmd="npx playwright test --ui"
      ;;
  esac
  
  # Add additional flags and run
  playwright_cmd+=" $additional_flags"
  
  echo "Running Playwright from: $(pwd)"
  echo "Command: $playwright_cmd"
  
  run_cmd "$playwright_cmd"
  local exit_code=$?
  
  # Generate HTML report if not in UI mode
  if [ "$mode" != "ui" ]; then
    run_cmd "npx playwright show-report playwright-report || true"
  fi
  
  # Return to original directory
  cd "$original_dir"
  return $exit_code
}

# Generate coverage report for Playwright tests
run_playwright_coverage() {
  echo "Setting up coverage for Playwright tests..."
  
  # Ensure coverage directory exists
  mkdir -p "${COVERAGE_DIR}/playwright"
  
  # Run Playwright with coverage
  run_playwright "headless" "--reporter=html,json,junit --output=${COVERAGE_DIR}/playwright"
  
  # Process coverage if needed
  if [ -f "${COVERAGE_DIR}/playwright/coverage-final.json" ]; then
    echo "Processing coverage report..."
    npx nyc report --reporter=lcov --reporter=text --report-dir="${COVERAGE_DIR}/playwright"
    echo "Coverage report available at: ${COVERAGE_DIR}/playwright/lcov-report/index.html"
  fi
}

run_by_key() {
  local key="$1"
  local jest_cmd="npx jest $DEFAULT_JEST_FLAGS"
  
  # Log the test run
  local timestamp
  timestamp=$(date +'%Y-%m-%d %H:%M:%S')
  echo "[$timestamp] Starting test: $key" >> "$ERROR_LOG"
  
  case "$key" in
    # Unit tests
    unit:frontend)
      run_jest "--config=frontend/jest.config.mjs" ;;

    unit:backend)
      TEST_TYPE=unit run_jest "--config=backend/jest.config.js" ;;

    unit:both)
      TEST_TYPE=unit run_jest "--config=jest.config.js" ;;

    # Integration tests
    integration:frontend)
      run_jest "--config=frontend/jest.config.mjs" "--testPathPattern=.*\.int\." ;;

    integration:backend)
      TEST_TYPE=integration run_jest "--config=backend/jest.config.js" ;;

    integration:both)
      TEST_TYPE=integration run_jest "--config=jest.config.js" ;;

    # E2E tests
    e2e:headless)
      run_playwright "headless" ;;
      
    e2e:headed)
      run_playwright "headed" ;;
      
    e2e:ui)
      run_playwright "ui" ;;
      
    e2e:debug)
      run_playwright "headed" "--debug" ;;
      
    e2e:record)
      run_playwright "headed" "--trace on --video on --screenshot on" ;;

    # Coverage
    coverage:frontend)
      run_jest "--config=frontend/jest.config.mjs" "--coverage" "--coverageDirectory=${COVERAGE_DIR}/frontend" ;;

    coverage:backend)
      TEST_TYPE=unit run_jest "--config=backend/jest.config.js" "--coverage" "--coverageDirectory=${COVERAGE_DIR}/backend" ;;
      
    coverage:e2e)
      run_playwright_coverage ;;
      
    coverage:all)
      TEST_TYPE=unit run_jest "--config=jest.config.js" "--coverage" "--coverageDirectory=${COVERAGE_DIR}/all"
      run_playwright_coverage ;;
      
    coverage:open)
      if command -v xdg-open >/dev/null; then
        xdg-open "${COVERAGE_DIR}/all/lcov-report/index.html" 2>/dev/null || \
        xdg-open "${COVERAGE_DIR}/playwright/lcov-report/index.html" 2>/dev/null || \
        echo "Could not automatically open coverage report. Please check ${COVERAGE_DIR}"
      else
        echo "Coverage reports available in: ${COVERAGE_DIR}"
      fi ;;

    # Run all tests
    all)
      echo "Running comprehensive test suite..."
      local all_errors=0

      # Unit tests
      echo "Running unit tests..."
      if ! TEST_TYPE=unit run_jest "--config=jest.config.js"; then
        log_error "Unit tests failed"
        ((all_errors++))
      fi

      # Integration tests
      echo "Running integration tests..."
      if ! TEST_TYPE=integration run_jest "--config=jest.config.js"; then
        log_error "Integration tests failed"
        ((all_errors++))
      fi

      # E2E tests
      echo "Running E2E tests..."
      if ! run_playwright "headless"; then
        log_error "E2E tests failed"
        ((all_errors++))
      fi

      # Generate coverage report
      echo "Generating coverage report..."
      if ! TEST_TYPE=unit run_jest "--config=jest.config.js" "--coverage" "--coverageDirectory=${COVERAGE_DIR}/all"; then
        log_error "Coverage generation failed"
        ((all_errors++))
      fi

      # Summary
      if [ $all_errors -eq 0 ]; then
        echo "✓ All tests completed successfully"
      else
        echo "✗ Tests completed with $all_errors error(s). Check $ERROR_LOG for details."
        return 1
      fi
      ;;
      
    # Debug mode
    debug:*)
      local test_file="${key#debug:}"
      run_jest "--config=jest.config.js" "--runInBand" "--no-cache" "--detectOpenHandles" "--logHeapUsage" "$test_file" ;;
      
    # Watch mode
    watch:*)
      local test_path="${key#watch:}"
      run_jest "--config=jest.config.js" "--watch" "$test_path" ;;

    # Infrastructure management
    infra:setup)
      echo "Setting up test infrastructure (fresh build)..."
      build_test_infrastructure ;;

    infra:status)
      check_infrastructure_status ;;

    infra:cleanup)
      cleanup_test_infrastructure ;;

    *)
      echo "Unknown key: $key" >&2
      return 2 ;;
  esac
}

interactive_menu_tests() {
  local PS3="Select an option (number): "
  local main_choice
  while true; do
    echo
    echo "Main Menu"
    echo "1) Unit tests"
    echo "2) Integration tests"
    echo "3) E2E tests"
    echo "4) Coverage"
    echo "5) Run ALL tests"
    echo "6) Infrastructure"
    echo "7) Quit"
    read -r -p "$PS3" main_choice
    case $main_choice in
      1) submenu_unit ;;
      2) submenu_integration ;;
      3) submenu_e2e ;;
      4) submenu_coverage ;;
      5) run_by_key all ;;
      6) submenu_infrastructure ;;
      7) return 0 ;;
      *) echo "Invalid selection. Please enter 1-7." ;;
    esac
  done
}

pause() {
  read -r -p $'\nPress Enter to return to menu...' _
}

submenu_unit() {
  local choice
  echo
  echo "Unit tests"
  echo "1) Frontend"
  echo "2) Backend"
  echo "3) Both"
  echo "4) Back"
  read -r -p "Select an option (number): " choice
  case $choice in
    1) run_by_key unit:frontend; pause ;;
    2) run_by_key unit:backend; pause ;;
    3) run_by_key unit:both; pause ;;
    4) ;;
    *) echo "Invalid selection. Please enter 1-4." ;;
  esac
}

submenu_integration() {
  local choice
  echo
  echo "Integration tests"
  echo "1) Frontend"
  echo "2) Backend"
  echo "3) Both"
  echo "4) Back"
  read -r -p "Select an option (number): " choice
  case $choice in
    1) run_by_key integration:frontend; pause ;;
    2) run_by_key integration:backend; pause ;;
    3) run_by_key integration:both; pause ;;
    4) ;;
    *) echo "Invalid selection. Please enter 1-4." ;;
  esac
}

submenu_e2e() {
  local choice
  echo
  echo "E2E tests (Playwright)"
  echo "1) Headless"
  echo "2) Headed"
  echo "3) UI mode"
  echo "4) Back"
  read -r -p "Select an option (number): " choice
  case $choice in
    1) run_by_key e2e:headless; pause ;;
    2) run_by_key e2e:headed; pause ;;
    3) run_by_key e2e:ui; pause ;;
    4) ;;
    *) echo "Invalid selection. Please enter 1-4." ;;
  esac
}

submenu_coverage() {
  local choice
  echo
  echo "Coverage"
  echo "1) Frontend"
  echo "2) Backend"
  echo "3) Both"
  echo "4) Back"
  read -r -p "Select an option (number): " choice
  case $choice in
    1) run_by_key coverage:frontend; pause ;;
    2) run_by_key coverage:backend; pause ;;
    3) run_by_key coverage:both; pause ;;
    4) ;;
    *) echo "Invalid selection. Please enter 1-4." ;;
  esac
}

submenu_infrastructure() {
  local choice
  echo
  echo "Infrastructure Management"
  echo "1) Setup test environment"
  echo "2) Check status"
  echo "3) Cleanup test environment"
  echo "4) Back"
  read -r -p "Select an option (number): " choice
  case $choice in
    1) run_by_key infra:setup; pause ;;
    2) run_by_key infra:status; pause ;;
    3) run_by_key infra:cleanup; pause ;;
    4) ;;
    *) echo "Invalid selection. Please enter 1-4." ;;
  esac
}

main() {
  require_tools
  # Set ESM-friendly defaults so Jest can execute TS ESM tests in backend
  ensure_node_esm
  # Ensure logs directory exists
  ensure_logs_dir
  
  # Note: Test infrastructure cleanup is now manual via 'infra:cleanup'
  if [[ ${1-} == "--help" || ${1-} == "-h" ]]; then
    print_header
    print_usage
    exit 0
  fi
  if [[ ${1-} == "--list" || ${1-} == "-l" ]]; then
    list_keys
    exit 0
  fi
  if [[ ${1-} == "--run" || ${1-} == "-r" ]]; then
    if [[ $# -lt 2 ]]; then
      echo "Missing key for --run" >&2
      echo
      print_usage
      exit 2
    fi
    local key="$2"
    local build_infra="true"
    if [[ $# -ge 3 && "$3" == "skip-build" ]]; then
      build_infra="false"
    fi
    
    print_header
    
    # Build test infrastructure if requested
    if [[ "$build_infra" == "true" ]]; then
      if ! smart_build_infrastructure; then
        echo "Failed to build test infrastructure. Aborting tests."
        exit 1
      fi
    fi
    
    # Run the tests
    if run_by_key "$key"; then
      echo "\nTest run completed successfully. Logs: $ERROR_LOG"
      echo "ℹ️  Note: Test infrastructure is still running. Use 'infra:cleanup' to clean up when done."
      exit 0
    else
      echo "\nTest run failed. Check error log: $ERROR_LOG"
      exit 1
    fi
  fi

  # Interactive mode
  print_header

  echo "Ensuring test infrastructure is ready..."
  if ! smart_build_infrastructure; then
    echo "Failed to build test infrastructure. Some tests may fail."
    echo "Continuing in interactive mode anyway..."
  fi

  echo
  echo "ℹ️  Note: Test infrastructure will NOT be automatically cleaned up when you exit."
  echo "   Use '6) Infrastructure > 3) Cleanup test environment' when you're done testing."
  echo

  interactive_menu_tests
}

main "$@"
