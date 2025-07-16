#!/bin/bash

# Management Service Admin API Example Script
# This script demonstrates how to use the Management Service API with curl

set -ex

# Configuration
MANAGEMENT_SERVICE_URL="http://localhost:8085"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="admin123"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper function to print colored output
print_header() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}→ $1${NC}"
}

# Check if jq is available
if ! command -v jq &> /dev/null; then
    print_error "jq is required but not installed. Please install jq first."
    exit 1
fi

# Check if curl is available
if ! command -v curl &> /dev/null; then
    print_error "curl is required but not installed. Please install curl first."
    exit 1
fi

print_header "Management Service Admin API Demo"

# Step 1: Admin Login
print_info "Step 1: Admin Login"
print_info "Logging in as admin user..."

LOGIN_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "{\"username\": \"$ADMIN_USERNAME\", \"password\": \"$ADMIN_PASSWORD\"}" \
    "$MANAGEMENT_SERVICE_URL/api/admin/login")

if [ $? -ne 0 ]; then
    print_error "Failed to connect to Management Service at $MANAGEMENT_SERVICE_URL"
    print_info "Make sure the service is running and accessible:"
    print_info "  kubectl port-forward svc/management-service 8085:80"
    exit 1
fi

ADMIN_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token')

if [ "$ADMIN_TOKEN" = "null" ] || [ -z "$ADMIN_TOKEN" ]; then
    print_error "Login failed. Response:"
    echo "$LOGIN_RESPONSE" | jq .
    exit 1
fi

print_success "Login successful"
print_info "Token: ${ADMIN_TOKEN:0:20}..."

# Step 2: Get System Information
print_header "Step 2: System Information"
print_info "Getting system information..."

SYSTEM_INFO=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
    "$MANAGEMENT_SERVICE_URL/api/admin/system")

if [ $? -eq 0 ]; then
    print_success "System information retrieved"
    echo "$SYSTEM_INFO" | jq .
else
    print_error "Failed to get system information"
fi

# Step 3: List Tenants
print_header "Step 3: Tenant Information"
print_info "Listing all tenants..."

TENANTS=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
    "$MANAGEMENT_SERVICE_URL/api/admin/tenants")

if [ $? -eq 0 ]; then
    print_success "Tenants listed"
    echo "$TENANTS" | jq .
else
    print_error "Failed to get tenants"
fi

# Step 4: List Models
print_header "Step 4: Model Management"
print_info "Listing all models across tenants..."

MODELS=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
    "$MANAGEMENT_SERVICE_URL/api/models")

if [ $? -eq 0 ]; then
    print_success "Models listed"
    echo "$MODELS" | jq .
    
    # Count models
    MODEL_COUNT=$(echo "$MODELS" | jq '.models | length')
    print_info "Total models: $MODEL_COUNT"
else
    print_error "Failed to get models"
fi

# Step 5: List Published Models
print_header "Step 5: Published Models"
print_info "Listing all published models..."

PUBLISHED_MODELS=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
    "$MANAGEMENT_SERVICE_URL/api/published-models")

if [ $? -eq 0 ]; then
    print_success "Published models listed"
    echo "$PUBLISHED_MODELS" | jq .
    
    # Count published models
    PUBLISHED_COUNT=$(echo "$PUBLISHED_MODELS" | jq '.publishedModels | length')
    print_info "Total published models: $PUBLISHED_COUNT"
else
    print_error "Failed to get published models"
fi

# Step 6: Execute kubectl command
print_header "Step 6: System Console (kubectl)"
print_info "Checking pod status across all namespaces..."

KUBECTL_RESPONSE=$(curl -s -X POST \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"command": "get pods --all-namespaces"}' \
    "$MANAGEMENT_SERVICE_URL/api/admin/kubectl")

if [ $? -eq 0 ]; then
    print_success "kubectl command executed"
    echo "$KUBECTL_RESPONSE" | jq -r '.result'
else
    print_error "Failed to execute kubectl command"
fi

# Step 7: Model Publishing Example (if models exist)
if [ "$MODEL_COUNT" -gt 0 ]; then
    print_header "Step 7: Model Publishing Example"
    
    # Get the first model name
    FIRST_MODEL=$(echo "$MODELS" | jq -r '.models[0].name')
    FIRST_MODEL_NAMESPACE=$(echo "$MODELS" | jq -r '.models[0].namespace')
    
    if [ "$FIRST_MODEL" != "null" ] && [ -n "$FIRST_MODEL" ]; then
        print_info "Attempting to publish model: $FIRST_MODEL"
        
        PUBLISH_RESPONSE=$(curl -s -X POST \
            -H "Authorization: Bearer $ADMIN_TOKEN" \
            -H "Content-Type: application/json" \
            -d "{
                \"config\": {
                    \"tenantId\": \"$FIRST_MODEL_NAMESPACE\",
                    \"publicHostname\": \"api.router.inference-in-a-box\",
                    \"rateLimiting\": {
                        \"requestsPerMinute\": 100,
                        \"requestsPerHour\": 5000
                    }
                }
            }" \
            "$MANAGEMENT_SERVICE_URL/api/models/$FIRST_MODEL/publish")
        
        if [ $? -eq 0 ]; then
            SUCCESS=$(echo "$PUBLISH_RESPONSE" | jq -r '.message')
            if [ "$SUCCESS" != "null" ]; then
                print_success "Model published successfully"
                echo "$PUBLISH_RESPONSE" | jq .
                
                # Get API key
                API_KEY=$(echo "$PUBLISH_RESPONSE" | jq -r '.publishedModel.apiKey')
                EXTERNAL_URL=$(echo "$PUBLISH_RESPONSE" | jq -r '.publishedModel.externalUrl')
                
                print_info "External URL: $EXTERNAL_URL"
                print_info "API Key: ${API_KEY:0:20}..."
                
                # Test the published model
                print_info "Testing published model with external API call..."
                
                TEST_RESPONSE=$(curl -s -X POST \
                    -H "Content-Type: application/json" \
                    -H "X-API-Key: $API_KEY" \
                    -d '{"instances": [{"feature1": 1.0, "feature2": 2.0}]}' \
                    "$EXTERNAL_URL/predict")
                
                if [ $? -eq 0 ]; then
                    print_success "External API test completed"
                    echo "$TEST_RESPONSE" | jq .
                else
                    print_error "External API test failed"
                fi
            else
                print_error "Model publishing failed"
                echo "$PUBLISH_RESPONSE" | jq .
            fi
        else
            print_error "Failed to publish model"
        fi
    fi
fi

# Step 8: Cleanup example
print_header "Step 8: Cleanup (Optional)"
print_info "To unpublish the model, run:"
print_info "curl -X DELETE -H 'Authorization: Bearer $ADMIN_TOKEN' \\"
print_info "  '$MANAGEMENT_SERVICE_URL/api/models/$FIRST_MODEL/publish'"

print_header "Demo Complete"
print_success "All API operations completed successfully!"
print_info "Admin token is valid for this session: $ADMIN_TOKEN"
print_info ""
print_info "Next steps:"
print_info "1. Open the Management Service UI: http://localhost:8085"
print_info "2. Use the Developer Console to test published models"
print_info "3. Check the API documentation: docs/management-service-api.md"
print_info "4. Review the publishing guide: docs/model-publishing-guide.md"
