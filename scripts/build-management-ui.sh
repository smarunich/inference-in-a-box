#!/bin/bash

# Build and deploy Management UI
# This script builds the React app and creates the necessary ConfigMaps

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
UI_DIR="$PROJECT_ROOT/management-ui"
NAMESPACE="default"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
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

# Check if Node.js is available
check_nodejs() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js is required but not installed"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is required but not installed"
        exit 1
    fi
}

# Check if kubectl is available
check_kubectl() {
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is required but not installed"
        exit 1
    fi
}

# Install dependencies
install_dependencies() {
    print_step "Installing UI dependencies"
    
    cd "$UI_DIR"
    npm ci --only=production
    
    print_success "Dependencies installed"
}

# Build the React app
build_ui() {
    print_step "Building React application"
    
    cd "$UI_DIR"
    
    # Set environment variables for build
    export REACT_APP_API_URL="/api"
    export GENERATE_SOURCEMAP="false"
    
    npm run build
    
    print_success "React application built"
}

# Create ConfigMaps with built files
create_configmaps() {
    print_step "Creating Kubernetes ConfigMaps"
    
    # Create a temporary directory for ConfigMap files
    TEMP_DIR=$(mktemp -d)
    
    # Copy built files to temp directory
    cp -r "$UI_DIR/build/"* "$TEMP_DIR/"
    
    # Create ConfigMap for built files
    kubectl create configmap management-ui-build \
        --from-file="$TEMP_DIR" \
        --namespace="$NAMESPACE" \
        --dry-run=client -o yaml | kubectl apply -f -
    
    # Clean up temp directory
    rm -rf "$TEMP_DIR"
    
    print_success "ConfigMaps created"
}

# Deploy the UI
deploy_ui() {
    print_step "Deploying Management UI"
    
    # Apply the deployment configuration
    kubectl apply -f "$PROJECT_ROOT/configs/management-ui/management-ui.yaml"
    
    print_success "Management UI configuration applied"
}

# Wait for deployment to be ready
wait_for_deployment() {
    print_step "Waiting for Management UI deployment to be ready"
    
    kubectl rollout status deployment/management-ui -n "$NAMESPACE" --timeout=300s
    
    print_success "Management UI deployment is ready"
}

# Test UI health
test_ui_health() {
    print_step "Testing Management UI health"
    
    # Port forward to test locally
    kubectl port-forward -n "$NAMESPACE" svc/management-ui 8083:80 &
    PF_PID=$!
    
    # Wait for port forward to be ready
    sleep 3
    
    # Test health endpoint
    if curl -s -f http://localhost:8083/health > /dev/null; then
        print_success "Management UI health check passed"
    else
        print_error "Management UI health check failed"
        kill $PF_PID 2>/dev/null
        exit 1
    fi
    
    # Kill port forward
    kill $PF_PID 2>/dev/null
}

# Show deployment information
show_deployment_info() {
    print_step "Deployment Information"
    
    echo "Management UI Service:"
    kubectl get svc -n "$NAMESPACE" management-ui
    
    echo -e "\nManagement UI Pods:"
    kubectl get pods -n "$NAMESPACE" -l app=management-ui
    
    echo -e "\nTo access the Management UI locally:"
    echo "kubectl port-forward -n $NAMESPACE svc/management-ui 8083:80"
    
    echo -e "\nUI will be available at:"
    echo "http://localhost:8083"
    
    echo -e "\nTo access both API and UI:"
    echo "kubectl port-forward -n $NAMESPACE svc/management-api 8082:8082 &"
    echo "kubectl port-forward -n $NAMESPACE svc/management-ui 8083:80 &"
}

# Main execution
main() {
    echo -e "${BLUE}Management UI Build and Deployment${NC}"
    echo -e "${BLUE}===================================${NC}"
    
    check_nodejs
    check_kubectl
    install_dependencies
    build_ui
    create_configmaps
    deploy_ui
    wait_for_deployment
    test_ui_health
    show_deployment_info
    
    print_success "Management UI build and deployment completed successfully!"
}

# Handle script interruption
trap 'echo -e "\n${YELLOW}Build interrupted${NC}"; exit 1' INT

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --namespace NAME  Kubernetes namespace (default: default)"
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

# Run the build and deployment
main