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
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
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

# Main function to clean up resources
cleanup() {
    log "Starting cleanup of Inference-in-a-Box resources"
    
    # Check if the cluster exists
    if kind get clusters | grep -q "^${CLUSTER_NAME}$"; then
        log "Deleting Kind cluster: ${CLUSTER_NAME}"
        kind delete cluster --name ${CLUSTER_NAME}
        success "Kind cluster deleted"
    else
        warn "Kind cluster ${CLUSTER_NAME} not found, skipping deletion"
    fi
    
    # Clean up any remaining Docker resources if needed
    log "Cleaning up any dangling Docker resources"
    docker system prune -f
    
    # Clean up any downloaded tools/binaries
    if [ -d "$PROJECT_DIR/istio-"* ]; then
        log "Cleaning up Istio binaries"
        rm -rf "$PROJECT_DIR/istio-"*
    fi
    
    success "Cleanup completed successfully"
}

# Execute cleanup
cleanup
