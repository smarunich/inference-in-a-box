#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✓ $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ✗ $1${NC}"
}

# Generate JWT tokens for testing
generate_token() {
    local tenant="$1"
    local user="$2"
    
    # In production, this would be generated with proper JWT signing
    # These are sample tokens for demonstration purposes only
    if [ "$tenant" == "tenant-a" ]; then
        echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWEiLCJuYW1lIjoiVGVuYW50IEEgVXNlciIsInRlbmFudCI6InRlbmFudC1hIn0.8Xtgw_eSO-fTZexLFVXME5AQ_jJOf615P7VQGahNdDk"
    elif [ "$tenant" == "tenant-b" ]; then
        echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWIiLCJuYW1lIjoiVGVuYW50IEIgVXNlciIsInRlbmFudCI6InRlbmFudC1iIn0.xYKzRQIxgFcQguz4sBDt1M6ZaRPFBEPjjOvpwfEKjaE"
    elif [ "$tenant" == "tenant-c" ]; then
        echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWMiLCJuYW1lIjoiVGVuYW50IEMgVXNlciIsInRlbmFudCI6InRlbmFudC1jIn0.J8RpRwm7KWX0kS5JLxjQ3YwMhQx7LPvGX5r4L4U8Mv0"
    else
        echo "Invalid tenant"
        return 1
    fi
}

# Send request to Iris classifier
request_iris_prediction() {
    local token=$(generate_token "tenant-a" "user-a")
    
    log "Sending request to sklearn-iris model (Tenant A)"
    log "Input: Sepal length=5.1, Sepal width=3.5, Petal length=1.4, Petal width=0.2"
    
    curl -s -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${token}" \
        http://localhost:8080/v2/models/sklearn-iris/infer \
        -d '{"instances": [[5.1, 3.5, 1.4, 0.2]]}' | jq .
        
    success "Request complete"
}

# Send request to MNIST classifier
request_mnist_prediction() {
    local token=$(generate_token "tenant-b" "user-b")
    
    log "Sending request to tensorflow-mnist model (Tenant B)"
    log "Input: Zero-initialized tensor (representing a blank image)"
    
    # In a real scenario, this would be pixel values from an image
    curl -s -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${token}" \
        http://localhost:8080/v2/models/tensorflow-mnist/infer \
        -d '{"instances": [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]]}' | jq .
        
    success "Request complete"
}

# Send request to ResNet classifier
request_resnet_prediction() {
    local token=$(generate_token "tenant-c" "user-c")
    
    log "Sending request to pytorch-resnet model (Tenant C)"
    log "Input: URL to an image (would be processed by the model)"
    
    # In a real scenario, this would contain image tensor data
    curl -s -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${token}" \
        http://localhost:8080/v2/models/pytorch-resnet/infer \
        -d '{"instances": [{"image_url": "https://example.com/sample-image.jpg"}]}' | jq .
        
    success "Request complete"
}

# Send unauthorized request (wrong tenant)
request_unauthorized() {
    local token=$(generate_token "tenant-a" "user-a")
    
    log "Sending unauthorized request to tensorflow-mnist model with tenant-a token"
    log "This request should be rejected by the authorization system"
    
    curl -s -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${token}" \
        http://localhost:8080/v2/models/tensorflow-mnist/infer \
        -d '{"instances": [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0]]}' | jq .
        
    log "Expected 403 Forbidden or similar error response"
}

# Main menu
echo -e "${BLUE}===== Sample Inference Requests =====${NC}"
echo "1) Test sklearn-iris prediction (Tenant A)"
echo "2) Test tensorflow-mnist prediction (Tenant B)"
echo "3) Test pytorch-resnet prediction (Tenant C)"
echo "4) Test unauthorized request (security demonstration)"
echo "5) Run all tests"
echo "q) Quit"

read -p "Select an option: " choice

case $choice in
    1) request_iris_prediction ;;
    2) request_mnist_prediction ;;
    3) request_resnet_prediction ;;
    4) request_unauthorized ;;
    5) 
        request_iris_prediction
        echo ""
        request_mnist_prediction
        echo ""
        request_resnet_prediction
        echo ""
        request_unauthorized
        ;;
    q|Q) echo "Exiting..." ;;
    *) echo "Invalid option" ;;
esac
