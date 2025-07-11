#!/bin/bash

set -e

echo "🏗️  Building Consolidated Management Service..."

# Configuration
PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
MANAGEMENT_DIR="$PROJECT_ROOT/management"
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

# Check if management directory exists
if [ ! -d "$MANAGEMENT_DIR" ]; then
    print_error "Management directory not found: $MANAGEMENT_DIR"
    exit 1
fi

# Check if we're in a Kubernetes cluster
if ! kubectl cluster-info &>/dev/null; then
    print_error "Unable to connect to Kubernetes cluster"
    exit 1
fi

print_status "Connected to Kubernetes cluster"

# Build UI source ConfigMap
print_status "Building UI source ConfigMap..."
cd "$MANAGEMENT_DIR/ui"

# Create UI source files data
UI_SOURCE_DATA=""
for file in src/App.js src/index.js src/index.css src/components/*.js src/contexts/*.js public/index.html public/manifest.json; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        dirname=$(dirname "$file")
        # Create directory structure in ConfigMap
        if [ "$dirname" != "." ]; then
            key="${dirname}/${filename}"
        else
            key="$filename"
        fi
        UI_SOURCE_DATA="$UI_SOURCE_DATA  ${key}: |\n$(sed 's/^/    /' "$file")\n"
    fi
done

# Update the ConfigMap with UI source files
print_status "Updating ConfigMap with UI source files..."
kubectl create configmap management-ui-source \
    --from-file=package.json \
    --from-file=src/ \
    --from-file=public/ \
    --dry-run=client -o yaml | kubectl apply -f -

cd "$PROJECT_ROOT"

# Apply the management deployment
print_status "Deploying consolidated management service..."
kubectl apply -f "$CONFIGS_DIR/management.yaml"

# Wait for deployment to be ready
print_status "Waiting for deployment to be ready..."
kubectl wait --for=condition=Available deployment/management-service --timeout=300s

# Get deployment information
print_status "Getting deployment information..."
kubectl get deployment management-service -o wide
kubectl get service management-service -o wide
kubectl get pods -l app=management-service

# Health check
print_status "Performing health check..."
kubectl port-forward svc/management-service 8085:80 > /dev/null 2>&1 &
PORTFORWARD_PID=$!
sleep 3

if curl -s http://localhost:8085/health > /dev/null; then
    print_success "Management service is healthy!"
else
    print_warning "Health check failed, but service may still be starting"
fi

# Clean up port-forward
kill $PORTFORWARD_PID 2>/dev/null || true

print_success "Management service deployment complete!"
echo ""
echo "📋 Deployment Summary:"
echo "  • Service: management-service"
echo "  • Namespace: default"
echo "  • Port: 80 (internal)"
echo "  • Endpoints:"
echo "    - Web UI: http://localhost:8085/ (via port-forward)"
echo "    - API: http://localhost:8085/api/ (via port-forward)"
echo "    - Health: http://localhost:8085/health (via port-forward)"
echo ""
echo "🔧 Access the service:"
echo "  kubectl port-forward svc/management-service 8085:80"
echo ""
echo "🔍 View logs:"
echo "  kubectl logs -f deployment/management-service"
echo ""
echo "🗑️  Delete service:"
echo "  kubectl delete -f configs/management/management.yaml"