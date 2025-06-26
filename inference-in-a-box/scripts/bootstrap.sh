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

# Software versions - Updated June 2025
ISTIO_VERSION="1.26.2"           
KSERVE_VERSION="0.15.2"          
CERT_MANAGER_VERSION="1.18.1"    
PROMETHEUS_VERSION="3.4.0"      
GRAFANA_VERSION="12.0.2"        
JAEGER_VERSION="1.70.0"         
KIALI_VERSION="2.11.0"           
KNATIVE_VERSION="1.18.1"         
ENVOY_GATEWAY_VERSION="1.4.1"     # Required for Envoy AI Gateway
ENVOY_AI_GATEWAY_VERSION="0.2.1"  

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

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    local missing_tools=()
    
    for tool in docker kind kubectl helm curl jq; do
        if ! command -v $tool &> /dev/null; then
            missing_tools+=($tool)
        fi
    done
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        error "Missing required tools: ${missing_tools[*]}"
        error "Please install the missing tools and try again"
        exit 1
    fi
    
    # Check if Docker is running
    if ! docker info &> /dev/null; then
        error "Docker is not running. Please start Docker and try again"
        exit 1
    fi
    
    success "All prerequisites are met"
}

# Create Kind cluster
create_cluster() {
    log "Creating Kind cluster..."
    
    # Create single unified cluster
    if kind get clusters | grep -q "^${CLUSTER_NAME}$"; then
        warn "Cluster ${CLUSTER_NAME} already exists"
    else
        log "Creating cluster: ${CLUSTER_NAME}"
        kind create cluster --name ${CLUSTER_NAME} --config ${PROJECT_DIR}/configs/clusters/cluster.yaml
        success "Cluster created"
    fi
    
    # Set up cluster networking if needed
    if [ -f "${SCRIPT_DIR}/clusters/setup-networking.sh" ]; then
        log "Setting up cluster networking..."
        ${SCRIPT_DIR}/clusters/setup-networking.sh
        success "Cluster networking configured"
    fi
}

# Install Istio
install_istio() {
    log "Installing Istio..."
    
    # Install Istio on the unified cluster
    kubectl config use-context kind-${CLUSTER_NAME}
    log "Installing Istio..."
    
    # Download and install Istio
    if ! command -v istioctl &> /dev/null; then
        log "Downloading Istio ${ISTIO_VERSION}..."
        curl -L https://istio.io/downloadIstio | ISTIO_VERSION=${ISTIO_VERSION} sh -
        export PATH="$PWD/istio-${ISTIO_VERSION}/bin:$PATH"
    fi
    
    istioctl install --set values.defaultRevision=default -y
    kubectl label namespace default istio-injection=enabled
    
    success "Istio installation completed"
}

# Install KServe
install_kserve() {
    log "Installing KServe..."
    
    kubectl config use-context kind-${CLUSTER_NAME}
    
    # Install cert-manager (required by KServe)
    log "Installing cert-manager ${CERT_MANAGER_VERSION}..."
    kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v${CERT_MANAGER_VERSION}/cert-manager.yaml
    kubectl wait --for=condition=ready pod -l app=cert-manager -n cert-manager --timeout=300s
    kubectl wait --for=condition=ready pod -l app=cainjector -n cert-manager --timeout=300s
    kubectl wait --for=condition=ready pod -l app=webhook -n cert-manager --timeout=300s
    
    # Install Knative (required by KServe)
    log "Installing Knative ${KNATIVE_VERSION}..."
    kubectl apply -f https://github.com/knative/serving/releases/download/knative-v${KNATIVE_VERSION}/serving-crds.yaml
    kubectl apply -f https://github.com/knative/serving/releases/download/knative-v${KNATIVE_VERSION}/serving-core.yaml
    kubectl wait --for=condition=ready pod -l app=controller -n knative-serving --timeout=300s
    
    # Install KServe
    log "Installing KServe ${KSERVE_VERSION} CRDs and controller..."
    kubectl apply -f https://github.com/kserve/kserve/releases/download/v${KSERVE_VERSION}/kserve.yaml
    kubectl wait --for=condition=ready pod -l control-plane=kserve-controller-manager -n kserve --timeout=300s
    
    # Install KServe built-in ClusterServingRuntimes
    kubectl apply -f https://github.com/kserve/kserve/releases/download/v${KSERVE_VERSION}/kserve-runtimes.yaml
    
    success "KServe installation completed"
}

# Install observability stack
install_observability() {
    log "Installing observability stack..."
    
    kubectl config use-context kind-${CLUSTER_NAME}
    
    # Create monitoring namespace
    kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
    kubectl label namespace monitoring istio-injection=enabled
    
    # Add helm repositories
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo add jaegertracing https://jaegertracing.github.io/helm-charts
    helm repo add kiali https://kiali.org/helm-charts
    helm repo update
    
    # Install Prometheus
    log "Installing Prometheus ${PROMETHEUS_VERSION}..."
    helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
        --namespace monitoring \
        --version ${PROMETHEUS_VERSION} \
        --values ${PROJECT_DIR}/configs/observability/prometheus.yaml \
        --wait
    
    # Install Jaeger
    log "Installing Jaeger ${JAEGER_VERSION}..."
    helm upgrade --install jaeger jaegertracing/jaeger \
        --namespace monitoring \
        --version ${JAEGER_VERSION} \
        --values ${PROJECT_DIR}/configs/observability/jaeger.yaml \
        --wait
    
    # Install Grafana
    log "Installing Grafana ${GRAFANA_VERSION}..."
    helm upgrade --install grafana grafana/grafana \
        --namespace monitoring \
        --version ${GRAFANA_VERSION} \
        --values ${PROJECT_DIR}/configs/observability/grafana-values.yaml \
        --wait
    
    # Install Kiali
    log "Installing Kiali ${KIALI_VERSION}..."
    helm upgrade --install kiali kiali/kiali-server \
        --namespace monitoring \
        --version ${KIALI_VERSION} \
        --set auth.strategy="anonymous" \
        --set deployment.ingress.enabled=false \
        --set external_services.prometheus.url="http://prometheus-kube-prometheus-prometheus.monitoring:9090" \
        --wait
    
    # Install KServe Grafana dashboards
    log "Installing KServe Grafana dashboards..."
    kubectl apply -f ${PROJECT_DIR}/configs/observability/grafana/ -n monitoring
    
    success "Observability stack installation completed"
}

# Install Envoy Gateway and Envoy AI Gateway
install_envoy_ai_gateway() {
    log "Installing Envoy Gateway v${ENVOY_GATEWAY_VERSION} and Envoy AI Gateway v${ENVOY_AI_GATEWAY_VERSION}..."
    
    kubectl config use-context kind-${CLUSTER_NAME}
    
    # Step 1: Install Envoy Gateway (prerequisite)
    log "Step 1: Installing Envoy Gateway v${ENVOY_GATEWAY_VERSION}..."
    
    # Add Envoy Gateway Helm repository
    helm repo add envoy-gateway https://envoyproxy.github.io/gateway/helm
    helm repo update
    
    # Create namespace for Envoy Gateway
    kubectl create namespace envoy-gateway-system --dry-run=client -o yaml | kubectl apply -f -
    
    # Install Envoy Gateway using Helm
    log "Installing Envoy Gateway CRDs and controller..."
    helm install envoy-gateway envoy-gateway/gateway \
        --version ${ENVOY_GATEWAY_VERSION} \
        --namespace envoy-gateway-system \
        --create-namespace \
        --wait
    
    # Verify Envoy Gateway installation
    log "Verifying Envoy Gateway installation..."
    kubectl get pods -n envoy-gateway-system
    kubectl wait --timeout=2m -n envoy-gateway-system deployment/envoy-gateway --for=condition=Available
    
    # Step 2: Install Envoy AI Gateway
    log "Step 2: Installing Envoy AI Gateway v${ENVOY_AI_GATEWAY_VERSION}..."
    
    # Create namespace for AI Gateway
    kubectl create namespace envoy-ai-gateway-system --dry-run=client -o yaml | kubectl apply -f -
    kubectl label namespace envoy-ai-gateway-system istio-injection=enabled
    
    # Install AI Gateway CRDs using Helm
    log "Installing AI Gateway CRDs..."
    helm upgrade -i aieg-crd oci://docker.io/envoyproxy/ai-gateway-crds-helm \
        --version v${ENVOY_AI_GATEWAY_VERSION} \
        --namespace envoy-ai-gateway-system \
        --create-namespace
    
    # Install AI Gateway using Helm
    log "Installing AI Gateway controller..."
    helm upgrade -i aieg oci://docker.io/envoyproxy/ai-gateway-helm \
        --version v${ENVOY_AI_GATEWAY_VERSION} \
        --namespace envoy-ai-gateway-system \
        --create-namespace
    
    # Wait for AI Gateway controller to be ready
    log "Waiting for AI Gateway controller to be ready..."
    kubectl wait --timeout=2m -n envoy-ai-gateway-system deployment/ai-gateway-controller --for=condition=Available
    
    # Step 3: Configure Envoy Gateway for AI Gateway
    log "Step 3: Configuring Envoy Gateway for AI Gateway..."
    kubectl apply -f https://raw.githubusercontent.com/envoyproxy/ai-gateway/release/v${ENVOY_AI_GATEWAY_VERSION}/manifests/envoy-gateway-config/redis.yaml
    kubectl apply -f https://raw.githubusercontent.com/envoyproxy/ai-gateway/release/v${ENVOY_AI_GATEWAY_VERSION}/manifests/envoy-gateway-config/config.yaml
    kubectl apply -f https://raw.githubusercontent.com/envoyproxy/ai-gateway/release/v${ENVOY_AI_GATEWAY_VERSION}/manifests/envoy-gateway-config/rbac.yaml
    
    # Restart Envoy Gateway and wait for it to be ready
    log "Restarting Envoy Gateway..."
    kubectl rollout restart -n envoy-gateway-system deployment/envoy-gateway
    kubectl wait --timeout=2m -n envoy-gateway-system deployment/envoy-gateway --for=condition=Available
    
    # Step 4: Apply our custom AI Gateway configuration
    log "Step 4: Applying custom AI Gateway configuration..."
    kubectl apply -f ${PROJECT_DIR}/configs/envoy-ai-gateway/configuration.yaml
    
    # Verify installation
    log "Verifying complete installation..."
    echo "Envoy Gateway pods:"
    kubectl get pods -n envoy-gateway-system
    echo "Envoy AI Gateway pods:"
    kubectl get pods -n envoy-ai-gateway-system
    
    success "Envoy Gateway and AI Gateway installation completed"
}

# Setup multi-tenant namespaces
setup_multitenancy() {
    log "Setting up multi-tenant namespaces..."
    
    kubectl config use-context kind-${CLUSTER_NAME}
    
    # Create tenant namespaces
    for tenant in tenant-a tenant-b tenant-c; do
        log "Creating namespace: ${tenant}"
        kubectl create namespace ${tenant} --dry-run=client -o yaml | kubectl apply -f -
        kubectl label namespace ${tenant} istio-injection=enabled
        kubectl label namespace ${tenant} tenant=${tenant}
    done
    
    # Apply network policies and resource quotas
    kubectl apply -f ${PROJECT_DIR}/configs/istio/virtual-services/ -R
    
    success "Multi-tenant setup completed"
}

# Deploy sample models
deploy_sample_models() {
    log "Deploying sample models..."
    
    kubectl config use-context kind-${CLUSTER_NAME}
    
    # Deploy models to different tenants
    kubectl apply -f ${PROJECT_DIR}/configs/kserve/models/ -R
    
    # Wait for models to be ready
    log "Waiting for models to be ready..."
    kubectl wait --for=condition=Ready inferenceservice --all --timeout=600s -A
    
    success "Sample models deployed successfully"
}

# Configure rate limiting and access management
configure_access_management() {
    log "Configuring rate limiting and access management..."
    
    kubectl config use-context kind-${CLUSTER_NAME}
    
    # Apply Istio authorization policies
    kubectl apply -f ${PROJECT_DIR}/configs/istio/authorization/ -R
    
    # Apply rate limiting policies
    kubectl apply -f ${PROJECT_DIR}/configs/istio/rate-limiting/ -R
    
    success "Access management and rate limiting configured"
}

# Main execution
main() {
    log "Starting Inference-in-a-Box bootstrap process..."
    
    check_prerequisites
    create_cluster
    install_istio
    install_kserve
    install_observability
    install_envoy_ai_gateway
    setup_multitenancy
    deploy_sample_models
    configure_access_management
    
    success "Inference-in-a-Box bootstrap completed successfully!"
    
    log "Next steps:"
    log "1. Run './scripts/demo.sh' to execute demo scenarios"
    log "2. Access Grafana: kubectl port-forward -n monitoring svc/grafana 3000:80"
    log "3. Access Jaeger: kubectl port-forward -n monitoring svc/jaeger-query 16686:16686"
    log "4. Access Prometheus: kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-prometheus 9090:9090"
    log "5. Access Kiali: kubectl port-forward -n monitoring svc/kiali 20001:20001"
}

# Run main function
main "$@"