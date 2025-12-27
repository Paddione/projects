#!/bin/bash

# Backend Test Runner Script
# This script runs different types of tests with proper configuration

set -e

echo "🧪 Backend Test Runner"
echo "======================"

# Set test environment
export NODE_ENV=test
export DATABASE_URL="postgresql://test:test@localhost:5432/test_db"
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=test_db
export DB_USER=test
export POSTGRES_PASSWORD=test
export DB_SSL=false
export GEMINI_API_KEY=test_key
export SMTP_HOST=smtp.test.com
export SMTP_PORT=587
export SMTP_USER=test@test.com
export SMTP_PASS=test_password

# Function to run specific test categories
run_unit_tests() {
    echo "📋 Running Unit Tests..."
    npm test -- --testPathPattern="services/__tests__" --verbose --maxWorkers=1 --no-coverage
}

run_repository_tests() {
    echo "🗄️  Running Repository Tests..."
    npm test -- --testPathPattern="repositories/__tests__" --verbose --maxWorkers=1 --no-coverage
}

run_integration_tests() {
    echo "🔗 Running Integration Tests..."
    npm test -- --testPathPattern="routes/__tests__" --verbose --maxWorkers=1 --no-coverage
}

run_all_tests() {
    echo "🚀 Running All Tests..."
    npm test -- --verbose --maxWorkers=1 --no-coverage
}

# Function to generate test report
generate_report() {
    echo "📊 Generating Test Report..."
    
    # Create test results directory
    mkdir -p test-results
    
    # Run tests and capture output
    npm test -- --verbose --maxWorkers=1 --json --outputFile=test-results/results.json 2>&1 | tee test-results/test-output.log
    
    # Generate HTML report
    cat > test-results/report.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Backend Test Results</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f0f0f0; padding: 20px; border-radius: 5px; }
        .summary { margin: 20px 0; }
        .test-suite { margin: 10px 0; padding: 10px; border: 1px solid #ddd; border-radius: 3px; }
        .passed { background: #d4edda; border-color: #c3e6cb; }
        .failed { background: #f8d7da; border-color: #f5c6cb; }
        .error { color: #721c24; }
        .success { color: #155724; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Backend Test Results</h1>
        <p>Generated on: $(date)</p>
    </div>
    
    <div class="summary">
        <h2>Test Summary</h2>
        <p>Total Test Suites: <span id="total-suites">-</span></p>
        <p>Passed: <span id="passed" class="success">-</span></p>
        <p>Failed: <span id="failed" class="error">-</span></p>
        <p>Total Tests: <span id="total-tests">-</span></p>
    </div>
    
    <div id="test-results">
        <!-- Test results will be populated here -->
    </div>
    
    <script>
        // Parse and display test results
        fetch('results.json')
            .then(response => response.json())
            .then(data => {
                document.getElementById('total-suites').textContent = data.numTotalTestSuites;
                document.getElementById('passed').textContent = data.numPassedTestSuites;
                document.getElementById('failed').textContent = data.numFailedTestSuites;
                document.getElementById('total-tests').textContent = data.numTotalTests;
                
                const resultsDiv = document.getElementById('test-results');
                data.testResults.forEach(suite => {
                    const suiteDiv = document.createElement('div');
                    suiteDiv.className = `test-suite ${suite.status === 'passed' ? 'passed' : 'failed'}`;
                    suiteDiv.innerHTML = `
                        <h3>${suite.name}</h3>
                        <p>Status: ${suite.status}</p>
                        <p>Tests: ${suite.numPassingTests}/${suite.numTotalTests} passed</p>
                        ${suite.message ? `<p class="error">Error: ${suite.message}</p>` : ''}
                    `;
                    resultsDiv.appendChild(suiteDiv);
                });
            })
            .catch(error => {
                console.error('Error loading test results:', error);
                document.getElementById('test-results').innerHTML = '<p class="error">Error loading test results</p>';
            });
    </script>
</body>
</html>
EOF

    echo "📄 Test report generated: test-results/report.html"
    echo "📝 Test output saved: test-results/test-output.log"
}

# Main execution
case "${1:-all}" in
    "unit")
        run_unit_tests
        ;;
    "repository")
        run_repository_tests
        ;;
    "integration")
        run_integration_tests
        ;;
    "report")
        generate_report
        ;;
    "all")
        run_all_tests
        ;;
    *)
        echo "Usage: $0 [unit|repository|integration|report|all]"
        echo "  unit        - Run unit tests only"
        echo "  repository  - Run repository tests only"
        echo "  integration - Run integration tests only"
        echo "  report      - Generate HTML test report"
        echo "  all         - Run all tests (default)"
        exit 1
        ;;
esac

echo "✅ Test execution completed!" 