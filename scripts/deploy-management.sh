#!/bin/bash

set -e

echo "🚀 Deploying Consolidated Management Service..."

# Configuration
PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
CONFIGS_DIR="$PROJECT_ROOT/configs/management"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check deployment type
DEPLOYMENT_TYPE=${1:-"configmap"}

if [[ "$DEPLOYMENT_TYPE" == "registry" ]]; then
    DEPLOYMENT_FILE="$CONFIGS_DIR/management-registry.yaml"
    print_status "Using registry-based deployment"
else
    DEPLOYMENT_FILE="$CONFIGS_DIR/management.yaml"
    print_status "Using ConfigMap-based deployment"
fi

# Check if deployment file exists
if [ ! -f "$DEPLOYMENT_FILE" ]; then
    print_error "Deployment file not found: $DEPLOYMENT_FILE"
    exit 1
fi

# Check if we're in a Kubernetes cluster
if ! kubectl cluster-info &>/dev/null; then
    print_error "Unable to connect to Kubernetes cluster"
    print_error "Please ensure kubectl is configured and cluster is accessible"
    exit 1
fi

print_status "Connected to Kubernetes cluster: $(kubectl config current-context)"

# Apply the deployment
print_status "Applying deployment configuration..."
kubectl apply -f "$DEPLOYMENT_FILE"

# Wait for deployment to be ready
print_status "Waiting for deployment to be ready..."
if kubectl wait --for=condition=Available deployment/management-service --timeout=300s; then
    print_success "Deployment is ready!"
else
    print_error "Deployment failed to become ready within timeout"
    print_status "Checking deployment status..."
    kubectl describe deployment management-service
    kubectl get pods -l app=management-service
    exit 1
fi

# Get deployment information
print_status "Getting deployment information..."
kubectl get deployment management-service -o wide
kubectl get service management-service -o wide

# Show pods
print_status "Checking pods..."
kubectl get pods -l app=management-service

# Health check
print_status "Performing health check..."
if command -v curl &> /dev/null; then
    kubectl port-forward svc/management-service 8085:80 > /dev/null 2>&1 &
    PORTFORWARD_PID=$!
    sleep 5

    if curl -s http://localhost:8085/health > /dev/null; then
        print_success "Management service is healthy!"
        HEALTH_STATUS="✅ Healthy"
    else
        print_warning "Health check failed, service may still be starting"
        HEALTH_STATUS="⚠️  Health check failed"
    fi

    # Clean up port-forward
    kill $PORTFORWARD_PID 2>/dev/null || true
else
    print_warning "curl not found, skipping health check"
    HEALTH_STATUS="⚠️  Health check skipped"
fi

print_success "Management service deployment complete!"
echo ""
echo "📋 Deployment Summary:"
echo "  • Service: management-service"
echo "  • Namespace: default"
echo "  • Port: 80 (internal)"
echo "  • Status: $HEALTH_STATUS"
echo "  • Deployment Type: $DEPLOYMENT_TYPE"
echo ""
echo "🔧 Access the service:"
echo "  kubectl port-forward svc/management-service 8085:80"
echo "  Then open: http://localhost:8085"
echo ""
echo "🌐 Available endpoints:"
echo "  • Web UI: http://localhost:8085/"
echo "  • API: http://localhost:8085/api/"
echo "  • Health: http://localhost:8085/health"
echo "  • Tokens: http://localhost:8085/api/tokens"
echo ""
echo "🔍 Useful commands:"
echo "  • View logs: kubectl logs -f deployment/management-service"
echo "  • Get pods: kubectl get pods -l app=management-service"
echo "  • Describe service: kubectl describe service management-service"
echo "  • Port forward: kubectl port-forward svc/management-service 8085:80"
echo ""
echo "🗑️  Delete service:"
echo "  kubectl delete -f $DEPLOYMENT_FILE"