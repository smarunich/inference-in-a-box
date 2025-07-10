#!/bin/bash

# Deploy Management API
# This script deploys the Management API service to the Kubernetes cluster

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
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

# Check if kubectl is available
check_kubectl() {
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is required but not installed"
        exit 1
    fi
}

# Check if cluster is available
check_cluster() {
    if ! kubectl cluster-info &> /dev/null; then
        print_error "Kubernetes cluster is not accessible"
        print_warning "Make sure your cluster is running and kubectl is configured"
        exit 1
    fi
}

# Deploy Management API
deploy_management_api() {
    print_step "Deploying Management API"
    
    # Apply the deployment configuration
    kubectl apply -f "${PROJECT_ROOT}/configs/management-api/management-api.yaml"
    
    print_success "Management API configuration applied"
}

# Wait for deployment to be ready
wait_for_deployment() {
    print_step "Waiting for Management API deployment to be ready"
    
    kubectl rollout status deployment/management-api -n ${NAMESPACE} --timeout=300s
    
    print_success "Management API deployment is ready"
}

# Verify deployment
verify_deployment() {
    print_step "Verifying Management API deployment"
    
    # Check if pods are running
    if kubectl get pods -n ${NAMESPACE} -l app=management-api | grep -q "Running"; then
        print_success "Management API pods are running"
    else
        print_error "Management API pods are not running"
        echo "Pod status:"
        kubectl get pods -n ${NAMESPACE} -l app=management-api
        exit 1
    fi
    
    # Check if service is available
    if kubectl get svc -n ${NAMESPACE} management-api &> /dev/null; then
        print_success "Management API service is available"
    else
        print_error "Management API service is not available"
        exit 1
    fi
}

# Test API health
test_api_health() {
    print_step "Testing Management API health"
    
    # Port forward to test locally
    kubectl port-forward -n ${NAMESPACE} svc/management-api 8082:8082 &
    PF_PID=$!
    
    # Wait for port forward to be ready
    sleep 3
    
    # Test health endpoint
    if curl -s -f http://localhost:8082/health > /dev/null; then
        print_success "Management API health check passed"
    else
        print_error "Management API health check failed"
        kill $PF_PID 2>/dev/null
        exit 1
    fi
    
    # Kill port forward
    kill $PF_PID 2>/dev/null
}

# Show deployment information
show_deployment_info() {
    print_step "Deployment Information"
    
    echo "Management API Service:"
    kubectl get svc -n ${NAMESPACE} management-api
    
    echo -e "\nManagement API Pods:"
    kubectl get pods -n ${NAMESPACE} -l app=management-api
    
    echo -e "\nTo access the Management API locally:"
    echo "kubectl port-forward -n ${NAMESPACE} svc/management-api 8082:8082"
    
    echo -e "\nAPI endpoints will be available at:"
    echo "http://localhost:8082/health"
    echo "http://localhost:8082/api/tokens"
    echo "http://localhost:8082/api/models"
    
    echo -e "\nTo test the API, run:"
    echo "${PROJECT_ROOT}/examples/management-api/demo-api.sh"
}

# Main execution
main() {
    echo -e "${BLUE}Management API Deployment${NC}"
    echo -e "${BLUE}========================${NC}"
    
    check_kubectl
    check_cluster
    deploy_management_api
    wait_for_deployment
    verify_deployment
    test_api_health
    show_deployment_info
    
    print_success "Management API deployment completed successfully!"
}

# Handle script interruption
trap 'echo -e "\n${YELLOW}Deployment interrupted${NC}"; exit 1' INT

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

# Run the deployment
main