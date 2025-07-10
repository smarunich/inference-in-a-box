#!/bin/bash

# Demo script for Management API
# This script demonstrates the complete workflow of managing models

set -e

# Configuration
API_URL="http://localhost:8082"
TENANT="tenant-a"
MODEL_NAME="demo-sklearn-model"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper function to print colored output
print_step() {
    echo -e "${BLUE}==== $1 ====${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Check if required tools are installed
check_dependencies() {
    print_step "Checking dependencies"
    
    if ! command -v curl &> /dev/null; then
        print_error "curl is required but not installed"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        print_error "jq is required but not installed"
        exit 1
    fi
    
    print_success "All dependencies are available"
}

# Check if Management API is accessible
check_api_health() {
    print_step "Checking Management API health"
    
    if curl -s -f ${API_URL}/health > /dev/null; then
        print_success "Management API is healthy"
    else
        print_error "Management API is not accessible at ${API_URL}"
        print_warning "Make sure to run: kubectl port-forward -n default svc/management-api 8082:8082"
        exit 1
    fi
}

# Get JWT token
get_token() {
    print_step "Getting JWT token for ${TENANT}"
    
    TOKEN=$(curl -s ${API_URL}/api/tokens | jq -r ".\"${TENANT}\"")
    
    if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
        print_error "Failed to get JWT token for ${TENANT}"
        exit 1
    fi
    
    print_success "Token obtained: ${TOKEN:0:50}..."
}

# List current models
list_models() {
    print_step "Listing current models"
    
    echo "Current models:"
    curl -s -H "Authorization: Bearer $TOKEN" \
         ${API_URL}/api/models | jq '.models[] | {name: .name, status: .status, ready: .ready}'
}

# Create a new model
create_model() {
    print_step "Creating new model: ${MODEL_NAME}"
    
    response=$(curl -s -w "%{http_code}" -H "Authorization: Bearer $TOKEN" \
                    -H "Content-Type: application/json" \
                    -d "{
                      \"name\": \"${MODEL_NAME}\",
                      \"framework\": \"sklearn\",
                      \"storageUri\": \"gs://kfserving-examples/models/sklearn/1.0/model\",
                      \"minReplicas\": 1,
                      \"maxReplicas\": 3,
                      \"scaleTarget\": 60
                    }" \
                    ${API_URL}/api/models)
    
    http_code="${response: -3}"
    response_body="${response%???}"
    
    if [ "$http_code" -eq 201 ]; then
        print_success "Model created successfully"
        echo "$response_body" | jq '.'
    else
        print_error "Failed to create model (HTTP $http_code)"
        echo "$response_body" | jq '.'
        exit 1
    fi
}

# Wait for model to be ready
wait_for_model() {
    print_step "Waiting for model to be ready"
    
    max_attempts=30
    attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        model_status=$(curl -s -H "Authorization: Bearer $TOKEN" \
                           ${API_URL}/api/models/${MODEL_NAME} | jq -r '.ready')
        
        if [ "$model_status" = "true" ]; then
            print_success "Model is ready"
            return 0
        fi
        
        echo -n "."
        sleep 10
        ((attempt++))
    done
    
    print_warning "Model did not become ready within expected time"
    print_warning "Continuing with demo..."
}

# Get model details
get_model_details() {
    print_step "Getting model details"
    
    echo "Model details:"
    curl -s -H "Authorization: Bearer $TOKEN" \
         ${API_URL}/api/models/${MODEL_NAME} | jq '.'
}

# Make a prediction
make_prediction() {
    print_step "Making prediction"
    
    echo "Prediction request:"
    echo '{
      "instances": [
        [6.8, 2.8, 4.8, 1.4],
        [6.0, 3.4, 4.5, 1.6]
      ]
    }'
    
    echo "Prediction response:"
    curl -s -X POST \
         -H "Authorization: Bearer $TOKEN" \
         -H "Content-Type: application/json" \
         -d '{
           "instances": [
             [6.8, 2.8, 4.8, 1.4],
             [6.0, 3.4, 4.5, 1.6]
           ]
         }' \
         ${API_URL}/api/models/${MODEL_NAME}/predict | jq '.'
}

# Update model configuration
update_model() {
    print_step "Updating model configuration"
    
    response=$(curl -s -w "%{http_code}" -X PUT \
                    -H "Authorization: Bearer $TOKEN" \
                    -H "Content-Type: application/json" \
                    -d '{
                      "minReplicas": 2,
                      "maxReplicas": 5,
                      "scaleTarget": 80
                    }' \
                    ${API_URL}/api/models/${MODEL_NAME})
    
    http_code="${response: -3}"
    response_body="${response%???}"
    
    if [ "$http_code" -eq 200 ]; then
        print_success "Model updated successfully"
        echo "$response_body" | jq '.'
    else
        print_error "Failed to update model (HTTP $http_code)"
        echo "$response_body" | jq '.'
    fi
}

# Get model logs
get_model_logs() {
    print_step "Getting model logs"
    
    echo "Recent logs:"
    curl -s -H "Authorization: Bearer $TOKEN" \
         "${API_URL}/api/models/${MODEL_NAME}/logs?lines=10" | jq -r '.logs[] | select(length > 0)'
}

# Get tenant information
get_tenant_info() {
    print_step "Getting tenant information"
    
    echo "Tenant info:"
    curl -s -H "Authorization: Bearer $TOKEN" \
         ${API_URL}/api/tenant | jq '.'
}

# Clean up - delete the model
cleanup_model() {
    print_step "Cleaning up - deleting model"
    
    response=$(curl -s -w "%{http_code}" -X DELETE \
                    -H "Authorization: Bearer $TOKEN" \
                    ${API_URL}/api/models/${MODEL_NAME})
    
    http_code="${response: -3}"
    response_body="${response%???}"
    
    if [ "$http_code" -eq 200 ]; then
        print_success "Model deleted successfully"
        echo "$response_body" | jq '.'
    else
        print_error "Failed to delete model (HTTP $http_code)"
        echo "$response_body" | jq '.'
    fi
}

# Main execution
main() {
    echo -e "${BLUE}Management API Demo${NC}"
    echo -e "${BLUE}==================${NC}"
    
    check_dependencies
    check_api_health
    get_token
    list_models
    create_model
    wait_for_model
    get_model_details
    make_prediction
    update_model
    get_model_logs
    get_tenant_info
    
    echo
    read -p "Press Enter to clean up and delete the demo model..."
    cleanup_model
    
    print_success "Demo completed successfully!"
}

# Handle script interruption
trap 'echo -e "\n${YELLOW}Demo interrupted. Cleaning up...${NC}"; cleanup_model; exit 1' INT

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --api-url)
            API_URL="$2"
            shift 2
            ;;
        --tenant)
            TENANT="$2"
            shift 2
            ;;
        --model-name)
            MODEL_NAME="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --api-url URL     Management API URL (default: http://localhost:8082)"
            echo "  --tenant NAME     Tenant name (default: tenant-a)"
            echo "  --model-name NAME Model name (default: demo-sklearn-model)"
            echo "  --help            Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Run the demo
main