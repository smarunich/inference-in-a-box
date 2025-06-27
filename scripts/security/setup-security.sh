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

# Create namespaces with proper labels
create_tenant_namespaces() {
    log "Creating tenant namespaces..."
    
    # Create tenant-a namespace
    kubectl create namespace tenant-a --dry-run=client -o yaml | \
      kubectl apply -f -
      
    # Label namespace for Istio injection
    kubectl label namespace tenant-a \
      istio-injection=enabled \
      tenant=tenant-a \
      --overwrite
    
    # Create tenant-b namespace
    kubectl create namespace tenant-b --dry-run=client -o yaml | \
      kubectl apply -f -
      
    # Label namespace for Istio injection
    kubectl label namespace tenant-b \
      istio-injection=enabled \
      tenant=tenant-b \
      --overwrite
    
    # Create tenant-c namespace
    kubectl create namespace tenant-c --dry-run=client -o yaml | \
      kubectl apply -f -
      
    # Label namespace for Istio injection
    kubectl label namespace tenant-c \
      istio-injection=enabled \
      tenant=tenant-c \
      --overwrite
      
    success "Tenant namespaces created and labeled"
}

# Apply resource quotas
create_resource_quotas() {
    log "Creating resource quotas for tenants..."
    
    # Create resource quota for tenant-a
    cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ResourceQuota
metadata:
  name: tenant-a-quota
  namespace: tenant-a
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 8Gi
    limits.cpu: "8"
    limits.memory: 16Gi
    pods: "20"
EOF
    
    # Create resource quota for tenant-b
    cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ResourceQuota
metadata:
  name: tenant-b-quota
  namespace: tenant-b
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 8Gi
    limits.cpu: "8"
    limits.memory: 16Gi
    pods: "20"
EOF
    
    # Create resource quota for tenant-c
    cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ResourceQuota
metadata:
  name: tenant-c-quota
  namespace: tenant-c
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 8Gi
    limits.cpu: "8"
    limits.memory: 16Gi
    pods: "20"
EOF
    
    success "Resource quotas created"
}

# Apply network policies
setup_network_policies() {
    log "Setting up network policies for tenant isolation..."
    
    # Default deny all ingress across namespaces
    for ns in tenant-a tenant-b tenant-c; do
        cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: ${ns}
spec:
  podSelector: {}
  policyTypes:
  - Ingress
EOF
    done
    
    # Allow traffic from Istio Gateway and within the same namespace
    for ns in tenant-a tenant-b tenant-c; do
        cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-same-namespace-and-gateway
  namespace: ${ns}
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          tenant: ${ns}
    - namespaceSelector:
        matchLabels:
          istio-injection: enabled
      podSelector:
        matchLabels:
          app: istio-ingressgateway
EOF
    done
    
    # Allow traffic from Envoy AI Gateway
    for ns in tenant-a tenant-b tenant-c; do
        cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-envoy-gateway
  namespace: ${ns}
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: envoy-ai-gateway
      podSelector:
        matchLabels:
          app: envoy-ai-gateway
EOF
    done
    
    success "Network policies applied"
}

# Apply Istio authorization policies
apply_istio_auth_policies() {
    log "Applying Istio authorization policies..."
    
    # Apply tenant isolation policies
    kubectl apply -f "${PROJECT_DIR}/configs/istio/authorization/tenant-isolation.yaml"
    
    success "Istio authorization policies applied"
}

# Deploy sample JWT server for authentication
deploy_jwt_server() {
    log "Deploying JWT validation server..."
    
    # Create namespace if it doesn't exist
    kubectl create namespace jwt-auth --dry-run=client -o yaml | kubectl apply -f -
    
    # Deploy simple JWT server
    cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: jwt-server
  namespace: istio-system
spec:
  replicas: 1
  selector:
    matchLabels:
      app: jwt-server
  template:
    metadata:
      labels:
        app: jwt-server
    spec:
      containers:
      - name: jwt-server
        image: nginx:stable-alpine
        ports:
        - containerPort: 8080
        volumeMounts:
        - name: jwt-config
          mountPath: /usr/share/nginx/html
      volumes:
      - name: jwt-config
        configMap:
          name: jwt-keys
---
apiVersion: v1
kind: Service
metadata:
  name: jwt-server
  namespace: istio-system
spec:
  selector:
    app: jwt-server
  ports:
  - port: 8080
    targetPort: 8080
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: jwt-keys
  namespace: istio-system
data:
  jwks.json: |
    {
      "keys": [
        {
          "kty": "RSA",
          "kid": "demo-key",
          "use": "sig",
          "alg": "RS256",
          "n": "xAE7eB6qugXyCAG3yhh7pkDkT65pHymX-P7KfIupjf59vsdo91bSP9C8H07pSAGQO1MV_xFj9VswgsCg4R6otmg5PV2He95lZdHtOcU5DXIg_pbhLdKXbi66GlVeK6ABZOUW3WYtnNHD-91gVuoeJT_DwtGGcp4ignkgXfkiEm4sw-4sfb4qdt5oLbyVpmW6x9cfa7vs2WTfURiCrBoUqgBo_-4WTiULmmHSGZHOjzwa8WtrtOQGsAFjIbno85jp6MnGGGZPYZbDAa_b3y5u-YpW7ypZrvD8BgtKVjgtQgZhLAGezMt0ua3DRrWnKqTZ0BJ_EyxOGuHJrLsn00fnMQ",
          "e": "AQAB"
        }
      ]
    }
EOF
    
    # Wait for deployment to be ready
    kubectl wait --namespace istio-system --for=condition=ready pod -l app=jwt-server --timeout=300s
    
    success "JWT server deployed"
}

# Main function
main() {
    # Check if connected to the right cluster
    kubectl config use-context kind-${CLUSTER_NAME} || {
        error "Failed to switch to cluster ${CLUSTER_NAME}. Is it running?"
        exit 1
    }
    
    # Create namespace for Envoy AI Gateway if doesn't exist
    kubectl create namespace envoy-ai-gateway --dry-run=client -o yaml | kubectl apply -f -
    kubectl label namespace envoy-ai-gateway istio-injection=enabled --overwrite
    
    # Setup all security components
    create_tenant_namespaces
    create_resource_quotas
    setup_network_policies
    deploy_jwt_server
    apply_istio_auth_policies
    
    success "Zero-trust security setup completed"
}

# Execute main function
main
