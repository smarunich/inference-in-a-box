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

# Configure cluster networking
setup_networking() {
    log "Setting up cluster networking..."
    
    # Switch to the correct context
    kubectl config use-context kind-${CLUSTER_NAME}
    
    # Create MetalLB for load balancing (required for Istio Gateway)
    log "Installing MetalLB for load balancing..."
    kubectl apply -f https://raw.githubusercontent.com/metallb/metallb/v0.13.7/config/manifests/metallb-native.yaml
    kubectl wait --namespace metallb-system --for=condition=ready pod --selector=app=metallb --timeout=300s
    
    # Configure MetalLB with docker kind network CIDR
    log "Configuring MetalLB IP address pool..."
    
    # Get the docker kind network CIDR
    DOCKER_KIND_CIDR=$(docker network inspect kind -f '{{range .IPAM.Config}}{{.Subnet}}{{end}}')
    
    # Extract the first three octets of the CIDR
    PREFIX=$(echo $DOCKER_KIND_CIDR | cut -d'.' -f1-3)
    
    # Create MetalLB IP address pool
    cat <<EOF | kubectl apply -f -
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  name: default
  namespace: metallb-system
spec:
  addresses:
  - ${PREFIX}.200-${PREFIX}.250
---
apiVersion: metallb.io/v1beta1
kind: L2Advertisement
metadata:
  name: default
  namespace: metallb-system
EOF
    
    # Configure CoreDNS for service discovery
    log "Configuring CoreDNS for service discovery..."
    
    # Add DNS resolution for .local domain
    kubectl get configmap -n kube-system coredns -o yaml | \
      sed 's/\/etc\/resolv.conf/\/etc\/resolv.conf\n    forward .local 10.96.0.10/' | \
      kubectl apply -f -
    
    # Restart CoreDNS pods to apply configuration change
    kubectl delete pod -n kube-system -l k8s-app=kube-dns
    
    # Wait for CoreDNS to be ready
    kubectl wait --namespace kube-system --for=condition=ready pod --selector=k8s-app=kube-dns --timeout=300s
    
    success "Cluster networking configured successfully"
}

# Execute networking setup
setup_networking
