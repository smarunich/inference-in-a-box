#!/bin/bash

# Build multi-architecture Docker images for Management API and UI
# This script builds both containers for AMD64 and ARM64 and pushes them to Google Artifact Registry

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
    
    # Check if buildx is available
    if ! docker buildx version &> /dev/null; then
        print_error "Docker buildx is required for multi-arch builds"
        exit 1
    fi
    
    # Create/use buildx builder for multi-arch
    if ! docker buildx ls | grep -q "multi-arch-builder"; then
        print_step "Creating multi-arch builder"
        docker buildx create --name multi-arch-builder --driver docker-container --use
        docker buildx inspect --bootstrap
    else
        print_step "Using existing multi-arch builder"
        docker buildx use multi-arch-builder
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
    print_step "Building Management API Docker image (multi-arch)"
    
    # Build multi-architecture image
    docker buildx build \
        --platform linux/amd64,linux/arm64 \
        -t "$REGISTRY/management-api:$TAG" \
        --push \
        "$PROJECT_ROOT/management-api/"
    
    print_success "Management API multi-arch image built and pushed"
}

# Build Management UI Docker image
build_management_ui() {
    print_step "Building Management UI Docker image (multi-arch)"
    
    # Build multi-architecture image
    docker buildx build \
        --platform linux/amd64,linux/arm64 \
        -t "$REGISTRY/management-ui:$TAG" \
        --push \
        "$PROJECT_ROOT/management-ui/"
    
    print_success "Management UI multi-arch image built and pushed"
}

# Show image information
show_image_info() {
    print_step "Image Information"
    
    echo "Built multi-arch images:"
    echo "  Management API: $REGISTRY/management-api:$TAG"
    echo "  Management UI:  $REGISTRY/management-ui:$TAG"
    
    echo -e "\nArchitectures: linux/amd64, linux/arm64"
    
    echo -e "\nTo deploy using these images:"
    echo "kubectl apply -f $PROJECT_ROOT/configs/management-api/management-api-registry.yaml"
    echo "kubectl apply -f $PROJECT_ROOT/configs/management-ui/management-ui-registry.yaml"
    
    echo -e "\nTo inspect multi-arch manifest:"
    echo "docker buildx imagetools inspect $REGISTRY/management-api:$TAG"
    echo "docker buildx imagetools inspect $REGISTRY/management-ui:$TAG"
}

# Main execution
main() {
    echo -e "${BLUE}Build Multi-Architecture Docker Images${NC}"
    echo -e "${BLUE}=====================================${NC}"
    
    check_docker
    configure_docker
    build_management_api
    build_management_ui
    show_image_info
    
    print_success "Multi-arch Docker images built and pushed successfully!"
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