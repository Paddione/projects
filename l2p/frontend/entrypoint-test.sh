#!/bin/bash

# Entrypoint script for frontend test environment
# This script handles test setup and execution in the Docker container

set -e

echo "Starting frontend test environment..."

# Function to handle cleanup on exit
cleanup() {
    echo "Cleaning up test environment..."
    # Kill any background processes
    jobs -p | xargs -r kill
    exit 0
}

# Set up signal handlers
trap cleanup SIGTERM SIGINT

# Check if we're in test mode
if [ "$NODE_ENV" = "test" ]; then
    echo "Running in test mode..."
    
    # Install Playwright browsers if not already installed
    if [ ! -d "/app/node_modules/.cache/ms-playwright" ]; then
        echo "Installing Playwright browsers..."
        npx playwright install --with-deps
    fi
    
    # Run tests based on environment
    if [ "$TEST_TYPE" = "e2e" ]; then
        echo "Running E2E tests..."
        npm run test:e2e
    elif [ "$TEST_TYPE" = "unit" ]; then
        echo "Running unit tests..."
        npm run test:unit
    elif [ "$TEST_TYPE" = "integration" ]; then
        echo "Running integration tests..."
        npm run test:integration
    else
        echo "Running all tests..."
        npm run test
    fi
else
    echo "Starting development server..."
    # Start the development server
    exec npm run dev -- --host 0.0.0.0
fi
