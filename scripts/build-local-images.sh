#!/bin/bash

# Build Docker images locally for testing
# This script builds both containers for the local architecture

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
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
    
    # Use default builder for local builds
    docker buildx use default
}

# Build Management Service Docker image (consolidated)
build_management_service() {
    print_step "Building Management Service Docker image (consolidated)"
    
    # Build the image
    docker build -t "management-service:$TAG" "$PROJECT_ROOT/management/"
    
    print_success "Management Service image built"
}

# Build Management API Docker image (legacy)
build_management_api() {
    print_step "Building Management API Docker image (legacy)"
    
    # Build the image
    docker build -t "management-api:$TAG" "$PROJECT_ROOT/management-api/"
    
    print_success "Management API image built"
}

# Build Management UI Docker image (legacy)
build_management_ui() {
    print_step "Building Management UI Docker image (legacy)"
    
    # Build the image
    docker build -t "management-ui:$TAG" "$PROJECT_ROOT/management-ui/"
    
    print_success "Management UI image built"
}

# Show image information
show_image_info() {
    print_step "Image Information"
    
    echo "Built local images:"
    echo "  Management Service: management-service:$TAG (consolidated)"
    echo "  Management API:     management-api:$TAG (legacy)"
    echo "  Management UI:      management-ui:$TAG (legacy)"
    
    echo -e "\nImage sizes:"
    docker images "management-service:$TAG" --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}"
    docker images "management-api:$TAG" --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}"
    docker images "management-ui:$TAG" --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}"
    
    echo -e "\nTo test locally:"
    echo "# Consolidated service (recommended):"
    echo "docker run -d -p 8080:8080 --name management-service management-service:$TAG"
    echo ""
    echo "# Legacy separate services:"
    echo "docker run -d -p 8082:8082 --name management-api management-api:$TAG"
    echo "docker run -d -p 8083:80 --name management-ui management-ui:$TAG"
}

# Main execution
main() {
    echo -e "${BLUE}Build Local Docker Images${NC}"
    echo -e "${BLUE}=========================${NC}"
    
    check_docker
    build_management_service
    build_management_api
    build_management_ui
    show_image_info
    
    print_success "Local Docker images built successfully!"
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
        --help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --tag TAG         Docker image tag (default: latest)"
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

# Run the build
main