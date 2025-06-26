#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
CLUSTER_NAME="inference-in-a-box"

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

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠ $1${NC}"
}

# Create Kind cluster
create_cluster() {
    log "Creating Kind cluster..."
    
    # Check if kind is installed
    if ! command -v kind &> /dev/null; then
        error "Kind is not installed. Please install it first: https://kind.sigs.k8s.io/docs/user/quick-start/"
        exit 1
    fi
    
    # Check if Docker is running
    if ! docker info &> /dev/null; then
        error "Docker is not running. Please start Docker and try again"
        exit 1
    fi
    
    # Create single unified cluster
    if kind get clusters | grep -q "^${CLUSTER_NAME}$"; then
        warn "Cluster ${CLUSTER_NAME} already exists"
    else
        log "Creating cluster: ${CLUSTER_NAME}"
        kind create cluster --name ${CLUSTER_NAME} --config ${PROJECT_DIR}/configs/clusters/cluster.yaml
        success "Cluster created"
    fi
    
    # Set kubectl context
    log "Setting kubectl context to kind-${CLUSTER_NAME}"
    kubectl config use-context kind-${CLUSTER_NAME}
    
    success "Kind cluster setup completed successfully"
    log "Cluster info:"
    kubectl cluster-info
}

# Execute the function
create_cluster
