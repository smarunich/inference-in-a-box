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

# Deploy models
deploy_models() {
    log "Deploying inference models to tenants..."

    # Ensure namespaces exist
    for ns in tenant-a tenant-b tenant-c; do
        if ! kubectl get namespace ${ns} &> /dev/null; then
            error "Namespace ${ns} does not exist. Please run the security setup script first."
            exit 1
        fi
    done

    # Deploy scikit-learn Iris model to tenant-a
    log "Deploying scikit-learn Iris model to tenant-a..."
    kubectl apply -f "${PROJECT_DIR}/configs/kserve/models/sklearn-iris.yaml"
    
    # Deploy TensorFlow MNIST model to tenant-b
    log "Deploying TensorFlow MNIST model to tenant-b..."
    kubectl apply -f "${PROJECT_DIR}/configs/kserve/models/tensorflow-mnist.yaml"
    
    # Deploy PyTorch ResNet model to tenant-c
    log "Deploying PyTorch ResNet model to tenant-c..."
    kubectl apply -f "${PROJECT_DIR}/configs/kserve/models/pytorch-resnet.yaml"
    
    # Wait for models to be ready
    log "Waiting for models to be ready (this may take a few minutes)..."
    
    echo -n "Waiting for sklearn-iris: "
    kubectl wait --for=condition=Ready inferenceservice sklearn-iris -n tenant-a --timeout=600s
    echo "Ready"
    
    echo -n "Waiting for tensorflow-mnist: "
    kubectl wait --for=condition=Ready inferenceservice tensorflow-mnist -n tenant-b --timeout=600s
    echo "Ready"
    
    echo -n "Waiting for pytorch-resnet: "
    kubectl wait --for=condition=Ready inferenceservice pytorch-resnet -n tenant-c --timeout=600s
    echo "Ready"
    
    success "All models deployed successfully"
}

# Apply Istio virtual services for routing
apply_virtual_services() {
    log "Applying Istio virtual services for model routing..."
    kubectl apply -f "${PROJECT_DIR}/configs/istio/virtual-services/tenant-models.yaml"
    success "Virtual services created"
}

# Deploy Envoy AI Gateway
deploy_envoy_gateway() {
    log "Deploying Envoy AI Gateway..."
    
    # Create namespace if it doesn't exist
    kubectl create namespace envoy-ai-gateway --dry-run=client -o yaml | kubectl apply -f -
    kubectl label namespace envoy-ai-gateway istio-injection=enabled --overwrite
    
    # Apply Envoy configuration
    kubectl apply -f "${PROJECT_DIR}/configs/envoy-ai-gateway/configuration.yaml"
    
    # Wait for gateway to be ready
    kubectl wait --for=condition=ready pod -l app=envoy-ai-gateway -n envoy-ai-gateway --timeout=300s
    
    success "Envoy AI Gateway deployed"
}

# Main function
main() {
    # Check if connected to the right cluster
    kubectl config use-context kind-${CLUSTER_NAME} || {
        error "Failed to switch to cluster ${CLUSTER_NAME}. Is it running?"
        exit 1
    }
    
    # Deploy everything
    deploy_envoy_gateway
    deploy_models
    apply_virtual_services
    
    # Show status
    log "Deployment status:"
    echo ""
    echo "Tenant A (sklearn-iris):"
    kubectl get inferenceservice sklearn-iris -n tenant-a
    echo ""
    echo "Tenant B (tensorflow-mnist):"
    kubectl get inferenceservice tensorflow-mnist -n tenant-b
    echo ""
    echo "Tenant C (pytorch-resnet):"
    kubectl get inferenceservice pytorch-resnet -n tenant-c
    echo ""
    
    success "Model deployment completed"
    log "You can now send inference requests to http://localhost:8080/v2/models/{model-name}/infer"
    log "See the sample-requests.sh script in examples/inference-requests for examples"
}

# Execute main function
main
