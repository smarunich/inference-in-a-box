#!/bin/bash

# Build and push Docker images for Management API and UI
# This script builds both containers and pushes them to Google Artifact Registry

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REGISTRY="us-east1-docker.pkg.dev/dogfood-cx/registryrepository"
TAG="${TAG:-latest}"

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

# Check if Docker is available
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is required but not installed"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        print_error "Docker daemon is not running"
        exit 1
    fi
}

# Configure Docker for Google Artifact Registry
configure_docker() {
    print_step "Configuring Docker for Google Artifact Registry"
    
    # Check if gcloud is available
    if ! command -v gcloud &> /dev/null; then
        print_error "gcloud CLI is required but not installed"
        exit 1
    fi
    
    # Configure Docker auth
    gcloud auth configure-docker us-east1-docker.pkg.dev
    
    print_success "Docker configured for Artifact Registry"
}

# Build Management API Docker image
build_management_api() {
    print_step "Building Management API Docker image"
    
    # Create a temporary Dockerfile for the API
    cat > "$PROJECT_ROOT/management-api/Dockerfile" << 'EOF'
FROM node:18-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache curl

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY server.js ./

# Expose port
EXPOSE 8082

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8082/health || exit 1

# Start server
CMD ["node", "server.js"]
EOF
    
    # Build the image
    docker build -t "$REGISTRY/management-api:$TAG" "$PROJECT_ROOT/management-api/"
    
    print_success "Management API image built"
}

# Build Management UI Docker image
build_management_ui() {
    print_step "Building Management UI Docker image"
    
    # Build the image
    docker build -t "$REGISTRY/management-ui:$TAG" "$PROJECT_ROOT/management-ui/"
    
    print_success "Management UI image built"
}

# Push images to registry
push_images() {
    print_step "Pushing images to Google Artifact Registry"
    
    # Push Management API
    docker push "$REGISTRY/management-api:$TAG"
    print_success "Management API image pushed"
    
    # Push Management UI
    docker push "$REGISTRY/management-ui:$TAG"
    print_success "Management UI image pushed"
}

# Update Kubernetes manifests with new image references
update_manifests() {
    print_step "Updating Kubernetes manifests"
    
    # Update Management API deployment
    sed -i.bak "s|image: node:18-alpine|image: $REGISTRY/management-api:$TAG|g" \
        "$PROJECT_ROOT/configs/management-api/management-api.yaml"
    
    # Remove the complex command and args since they're now in the image
    sed -i.bak '/command: \[\"\/bin\/sh\"\]/,/cd \/app && node server.js/d' \
        "$PROJECT_ROOT/configs/management-api/management-api.yaml"
    
    # Update Management UI deployment
    sed -i.bak "s|image: nginx:alpine|image: $REGISTRY/management-ui:$TAG|g" \
        "$PROJECT_ROOT/configs/management-ui/management-ui.yaml"
    
    # Remove the initContainer since the image is now pre-built
    sed -i.bak '/initContainers:/,/name: ui-build-shared/d' \
        "$PROJECT_ROOT/configs/management-ui/management-ui.yaml"
    
    print_success "Kubernetes manifests updated"
}

# Show image information
show_image_info() {
    print_step "Image Information"
    
    echo "Built images:"
    echo "  Management API: $REGISTRY/management-api:$TAG"
    echo "  Management UI:  $REGISTRY/management-ui:$TAG"
    
    echo -e "\nImage sizes:"
    docker images "$REGISTRY/management-api:$TAG" --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}"
    docker images "$REGISTRY/management-ui:$TAG" --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}"
    
    echo -e "\nTo deploy using these images:"
    echo "kubectl apply -f $PROJECT_ROOT/configs/management-api/management-api.yaml"
    echo "kubectl apply -f $PROJECT_ROOT/configs/management-ui/management-ui.yaml"
}

# Main execution
main() {
    echo -e "${BLUE}Build and Push Docker Images${NC}"
    echo -e "${BLUE}============================${NC}"
    
    check_docker
    configure_docker
    build_management_api
    build_management_ui
    push_images
    update_manifests
    show_image_info
    
    print_success "Docker images built and pushed successfully!"
}

# Handle script interruption
trap 'echo -e "\n${YELLOW}Build interrupted${NC}"; exit 1' INT

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --tag)
            TAG="$2"
            shift 2
            ;;
        --registry)
            REGISTRY="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --tag TAG         Docker image tag (default: latest)"
            echo "  --registry REG    Docker registry (default: us-east1-docker.pkg.dev/dogfood-cx/registryrepository)"
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

# Run the build and push
main