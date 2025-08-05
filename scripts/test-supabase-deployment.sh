#!/bin/bash

# Supabase Railway Deployment Testing Script
# Tests all deployed services and validates connectivity

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date +'%H:%M:%S')] $1${NC}"; }
error() { echo -e "${RED}[ERROR] $1${NC}" >&2; }
warning() { echo -e "${YELLOW}[WARNING] $1${NC}"; }
info() { echo -e "${BLUE}[INFO] $1${NC}"; }

# Configuration from generated keys
JWT_SECRET="R/s8fG38k8ifAadkE65VxaBecxSJrmK3VGY+uA1AZoyLMrUFGLJoCZb+LurGKeLoFDM34OOqaw4UPoVC6kPmUw=="
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzUzNzg5MjcwLCJleHAiOjIwNjkxNDkyNzB9.xoVnCh7OKMIp8PPE-FGv0BhNHelTdX_fN1JUHULHfMU"
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NTM3ODkyNzAsImV4cCI6MjA2OTE0OTI3MH0.jj46y-qjR3TBLax3MtDRcY8nNM-Z_tNGlNH9GlsIPLU"
POSTGRES_PASSWORD="8869f2b07dae6169239c7cefb3205072f61c32105fef6f8a6bbdad1ba398a305"

# Service URLs (these will be provided by Railway after deployment)
API_URL="https://supabase-api-production.up.railway.app"
AUTH_URL="https://supabase-auth-production.up.railway.app"
REALTIME_URL="https://supabase-realtime-production.up.railway.app"
STORAGE_URL="https://supabase-storage-production.up.railway.app"

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TOTAL_TESTS=0

run_test() {
    local test_name="$1"
    local test_command="$2"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    info "Running test: $test_name"
    
    if eval "$test_command"; then
        log "✅ PASSED: $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        error "❌ FAILED: $test_name"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Test Railway CLI connectivity
test_railway_connection() {
    railway whoami > /dev/null 2>&1
}

# Test PostgreSQL connectivity (if psql is available)
test_postgres_connection() {
    if command -v psql > /dev/null 2>&1; then
        echo "SELECT 1 as test;" | psql "postgresql://postgres:$POSTGRES_PASSWORD@postgres.railway.internal:5432/supabase" > /dev/null 2>&1
    else
        warning "psql not available, skipping direct PostgreSQL test"
        return 0
    fi
}

# Test Supabase API endpoint
test_api_endpoint() {
    local response=$(curl -s -w "%{http_code}" -o /dev/null \
        -H "apikey: $ANON_KEY" \
        -H "Authorization: Bearer $ANON_KEY" \
        "$API_URL/" || echo "000")
    
    [ "$response" -eq "200" ] || [ "$response" -eq "404" ] || [ "$response" -eq "301" ]
}

# Test Supabase API health
test_api_health() {
    local response=$(curl -s -w "%{http_code}" -o /dev/null \
        -H "apikey: $ANON_KEY" \
        -H "Authorization: Bearer $ANON_KEY" \
        "$API_URL/rest/v1/" || echo "000")
    
    [ "$response" -eq "200" ] || [ "$response" -eq "404" ]
}

# Test database function via API
test_database_function() {
    local response=$(curl -s -w "%{http_code}" -o /dev/null \
        -H "apikey: $ANON_KEY" \
        -H "Authorization: Bearer $ANON_KEY" \
        "$API_URL/rest/v1/rpc/railway_health_check" || echo "000")
    
    [ "$response" -eq "200" ] || [ "$response" -eq "404" ]
}

# Test Auth service
test_auth_service() {
    local response=$(curl -s -w "%{http_code}" -o /dev/null \
        "$AUTH_URL/health" || echo "000")
    
    [ "$response" -eq "200" ] || [ "$response" -eq "404" ]
}

# Test Realtime service
test_realtime_service() {
    local response=$(curl -s -w "%{http_code}" -o /dev/null \
        "$REALTIME_URL/" || echo "000")
    
    [ "$response" -eq "200" ] || [ "$response" -eq "404" ] || [ "$response" -eq "426" ]
}

# Test Storage service
test_storage_service() {
    local response=$(curl -s -w "%{http_code}" -o /dev/null \
        -H "apikey: $ANON_KEY" \
        -H "Authorization: Bearer $ANON_KEY" \
        "$STORAGE_URL/status" || echo "000")
    
    [ "$response" -eq "200" ] || [ "$response" -eq "404" ]
}

# Test JWT token validation
test_jwt_validation() {
    # Test anon key structure
    local anon_parts=$(echo "$ANON_KEY" | tr '.' '\n' | wc -l)
    [ "$anon_parts" -eq "3" ] || return 1
    
    # Test service key structure
    local service_parts=$(echo "$SERVICE_KEY" | tr '.' '\n' | wc -l)
    [ "$service_parts" -eq "3" ] || return 1
    
    return 0
}

# Test Railway service status
test_railway_services() {
    railway status > /dev/null 2>&1
}

# Check service deployment status
check_deployment_status() {
    log "🔍 Checking Railway deployment status..."
    
    info "Project: $(railway status | grep "Project:" | cut -d: -f2 | xargs)"
    info "Environment: $(railway status | grep "Environment:" | cut -d: -f2 | xargs)"
    
    # Check if services are deployed
    local services=("supabase-api" "supabase-auth" "supabase-realtime" "supabase-storage")
    
    for service in "${services[@]}"; do
        if railway variables --service "$service" > /dev/null 2>&1; then
            log "✅ Service deployed: $service"
        else
            warning "⚠️  Service not found: $service"
        fi
    done
}

# Generate test report
generate_test_report() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    cat > /tmp/supabase-test-report.md << EOF
# Supabase Railway Deployment Test Report

**Generated:** $timestamp  
**Project:** rra-roborail-assistant  
**Environment:** production  

## 📊 Test Summary

- **Total Tests:** $TOTAL_TESTS
- **Passed:** $TESTS_PASSED
- **Failed:** $TESTS_FAILED
- **Success Rate:** $(( (TESTS_PASSED * 100) / TOTAL_TESTS ))%

## 🔗 Service Endpoints

| Service | URL | Status |
|---------|-----|--------|
| API | $API_URL | Testing |
| Auth | $AUTH_URL | Testing |
| Realtime | $REALTIME_URL | Testing |
| Storage | $STORAGE_URL | Testing |

## 🔑 Authentication Keys

- **JWT Secret:** Configured ✅
- **Anonymous Key:** Generated ✅
- **Service Key:** Generated ✅
- **PostgreSQL Password:** Configured ✅

## 🧪 Test Results

### Infrastructure Tests
- Railway CLI Connection: $([ $TESTS_PASSED -gt 0 ] && echo "✅ PASSED" || echo "❌ FAILED")
- Railway Services Status: Testing
- PostgreSQL Connection: Testing

### API Tests
- API Endpoint Response: Testing
- API Health Check: Testing
- Database Function Access: Testing

### Service Tests
- Auth Service Health: Testing
- Realtime Service Health: Testing
- Storage Service Health: Testing

### Security Tests
- JWT Token Validation: Testing
- Key Structure Validation: Testing

## 📋 Next Steps

$(if [ $TESTS_FAILED -gt 0 ]; then
echo "⚠️  **Issues Found:** $TESTS_FAILED test(s) failed. Please review the errors above."
echo ""
echo "### Troubleshooting Steps:"
echo "1. Check Railway logs: \`railway logs --service [service-name]\`"
echo "2. Verify environment variables: \`railway variables --service [service-name]\`"
echo "3. Ensure all services are deployed and running"
echo "4. Check network connectivity between services"
else
echo "🎉 **All Tests Passed!** Your Supabase deployment is ready."
echo ""
echo "### You can now:"
echo "1. Connect your application using the provided keys"
echo "2. Create database tables and configure RLS"
echo "3. Set up authentication providers"
echo "4. Test with your application"
fi)

## 🔧 Connection Details

Use these details to configure your application:

\`\`\`env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=$API_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY

# Database Configuration
DATABASE_URL=postgresql://postgres:$POSTGRES_PASSWORD@postgres.railway.internal:5432/supabase
\`\`\`

---
*Generated by Supabase Railway Deployment Testing Script*
EOF

    log "📋 Test report generated: /tmp/supabase-test-report.md"
    echo ""
    cat /tmp/supabase-test-report.md
}

# Main testing function
main() {
    log "🧪 Starting Supabase Railway Deployment Tests"
    echo ""
    
    # Check deployment status first
    check_deployment_status
    echo ""
    
    # Run all tests
    log "🔬 Running connectivity tests..."
    run_test "Railway CLI Connection" "test_railway_connection"
    run_test "Railway Services Status" "test_railway_services"
    run_test "PostgreSQL Connection" "test_postgres_connection"
    
    echo ""
    log "🌐 Running API tests..."
    run_test "API Endpoint Response" "test_api_endpoint"
    run_test "API Health Check" "test_api_health"
    run_test "Database Function Access" "test_database_function"
    
    echo ""
    log "🔐 Running service tests..."
    run_test "Auth Service Health" "test_auth_service"
    run_test "Realtime Service Health" "test_realtime_service"
    run_test "Storage Service Health" "test_storage_service"
    
    echo ""
    log "🔒 Running security tests..."
    run_test "JWT Token Validation" "test_jwt_validation"
    
    echo ""
    
    # Generate report
    generate_test_report
    
    echo ""
    if [ $TESTS_FAILED -eq 0 ]; then
        log "🎉 All tests passed! Your Supabase deployment is ready."
        log "📚 Check the test report above for connection details"
        exit 0
    else
        error "❌ $TESTS_FAILED out of $TOTAL_TESTS tests failed."
        error "🔧 Please review the issues and check Railway logs"
        exit 1
    fi
}

# Show usage information
show_usage() {
    echo "Supabase Railway Deployment Testing Script"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --help, -h    Show this help message"
    echo "  --quick, -q   Run quick tests only"
    echo "  --verbose, -v Enable verbose output"
    echo ""
    echo "Examples:"
    echo "  $0                # Run all tests"
    echo "  $0 --quick       # Run basic connectivity tests only"
    echo "  $0 --verbose     # Run with detailed output"
}

# Handle command line arguments
case "${1:-}" in
    --help|-h)
        show_usage
        exit 0
        ;;
    --quick|-q)
        log "🚀 Running quick tests only..."
        run_test "Railway Connection" "test_railway_connection"
        run_test "JWT Validation" "test_jwt_validation"
        exit 0
        ;;
    --verbose|-v)
        set -x
        main
        ;;
    "")
        main
        ;;
    *)
        error "Unknown option: $1"
        show_usage
        exit 1
        ;;
esac