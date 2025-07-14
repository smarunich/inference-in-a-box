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

# CI mode flag (used in GitHub Actions)
CI_MODE=false

# Software versions - Updated June 2025
ISTIO_VERSION="1.26.2"           
KSERVE_VERSION="0.15.2"          
CERT_MANAGER_VERSION="1.18.1"    
KUBE_PROMETHEUS_STACK_VERSION="75.6.0"      
GRAFANA_VERSION="12.0.2"        
JAEGER_VERSION="3.4.1"         
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

    # Check if kubectl is installed
    if ! command -v kubectl &> /dev/null; then
        error "kubectl not found. Please install kubectl and try again."
        exit 1
    fi

    # Check if kind is installed
    if ! command -v kind &> /dev/null; then
        error "kind not found. Please install kind and try again."
        exit 1
    fi

    # Check if helm is installed
    if ! command -v helm &> /dev/null; then
        error "helm not found. Please install helm and try again."
        exit 1
    fi

    success "All prerequisites found and prerequisites check completed"
}

# Create Kind cluster
create_cluster() {
    log "Creating Kind cluster..."

    # Check if cluster already exists
    if ! kind get clusters | grep -q "^${CLUSTER_NAME}$"; then
        log "Creating new cluster: ${CLUSTER_NAME}"
        kind create cluster --name ${CLUSTER_NAME}
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
    
    # Download and install Istio
    if ! command -v istioctl &> /dev/null; then
        log "Downloading Istio ${ISTIO_VERSION}..."
        curl -L https://istio.io/downloadIstio | ISTIO_VERSION=${ISTIO_VERSION} sh -
        export PATH="$PWD/istio-${ISTIO_VERSION}/bin:$PATH"
    fi
    
    istioctl install --set values.defaultRevision=default \
      --set meshConfig.accessLogFile=/dev/stdout \
      --set meshConfig.enableTracing=true \
      --set meshConfig.extensionProviders[0].name=jaeger \
      --set meshConfig.extensionProviders[0].opentelemetry.port="4317" \
      --set meshConfig.extensionProviders[0].opentelemetry.service=jaeger-collector.monitoring.svc.cluster.local \
      -y

    # Patch Istio configmap
    kubectl get cm istio -n istio-system -o yaml | \
	    yq '.data.mesh=(.data.mesh | from_yaml | (.defaultConfig += {"tracing":{}}) | to_yaml)' | \
	    kubectl apply -f -

    # Enable tracing by default
        kubectl apply -f - <<EOF
apiVersion: telemetry.istio.io/v1
kind: Telemetry
metadata:
  name: mesh-default
  namespace: istio-system
spec:
  tracing:
  - providers:
    - name: jaeger
    randomSamplingPercentage: 100
EOF

    kubectl label namespace default istio-injection=disabled
    
    success "Istio installation completed"
}

# Install KServe with Serverless support
install_kserve() {
    log "Installing KServe with Serverless support..."
    
    kubectl config use-context kind-${CLUSTER_NAME}
    
    # Install cert-manager (required by KServe)
    log "Installing cert-manager ${CERT_MANAGER_VERSION}..."
    kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v${CERT_MANAGER_VERSION}/cert-manager.yaml
    
    # Wait for cert-manager to be ready
    log "Waiting for cert-manager to be ready..."
    kubectl wait --for=condition=available deployment --all -n cert-manager --timeout=300s
    
    # Create kserve namespace
    kubectl create namespace kserve 2>/dev/null || true
    
    # Install Knative Serving (required for KServe serverless mode)
    log "Installing Knative Serving ${KNATIVE_VERSION}..."
    kubectl apply -f https://github.com/knative/serving/releases/download/knative-v${KNATIVE_VERSION}/serving-crds.yaml
    kubectl apply -f https://github.com/knative/serving/releases/download/knative-v${KNATIVE_VERSION}/serving-core.yaml
    
    # Install Knative Istio controller
    log "Installing Knative Istio Integration..."
    kubectl apply -f https://github.com/knative/net-istio/releases/download/knative-v1.18.0/net-istio.yaml
    
    # Configure Knative for local development
    log "Configuring Knative for local development..."
    kubectl patch configmap/config-domain \
      --namespace knative-serving \
      --type merge \
      --patch '{"data":{"127.0.0.1.sslip.io":""}}'
    
    # Configure Knative autoscaling (scale-to-zero)
    log "Configuring Knative scale-to-zero..."
    kubectl patch configmap/config-autoscaler \
      --namespace knative-serving \
      --type merge \
      --patch '{"data":{"enable-scale-to-zero":"true", "scale-to-zero-grace-period":"30s"}}'
    
    # Install Knative Serving CRDs and Core (prerequisite for KServe)
    log "Installing Knative Serving CRDs..."
    kubectl apply -f https://github.com/knative/serving/releases/download/knative-v${KNATIVE_VERSION}/serving-crds.yaml

    log "Installing Knative Serving core..."
    kubectl apply -f https://github.com/knative/serving/releases/download/knative-v${KNATIVE_VERSION}/serving-core.yaml
    
    # Wait for Knative Serving to be ready
    log "Waiting for Knative Serving to be ready..."
    kubectl wait --for=condition=ready pod -l app=controller -n knative-serving --timeout=300s
    kubectl wait --for=condition=ready pod -l app=webhook -n knative-serving --timeout=300s
    
    # Install KServe CRDs using Helm
    log "Installing KServe CRDs (this may take several minutes)..."
    helm install kserve-crd oci://ghcr.io/kserve/charts/kserve-crd --version v${KSERVE_VERSION} --namespace kserve --create-namespace --wait --timeout=600s

    log "Installing KServe controller..."
    helm install kserve oci://ghcr.io/kserve/charts/kserve --version v${KSERVE_VERSION} --namespace kserve --create-namespace --wait --timeout=600s \
        --set-string kserve.controller.deploymentMode="Serverless"
        
    # Wait for KServe controller to be ready
    log "Waiting for KServe controller to be ready (this may take several minutes)..."
    kubectl wait --for=condition=ready pod -l control-plane=kserve-controller-manager -n kserve --timeout=600s
    
    # Additional wait for the webhook service to be fully operational
    log "Waiting for KServe webhook service to be ready..."
    kubectl wait --for=condition=available deployment/kserve-controller-manager -n kserve --timeout=300s
    
    # Sleep to ensure webhook endpoints are fully registered and certificates are propagated
    log "Ensuring webhook endpoints are fully registered..."
    sleep 20
    
    # Configure KServe to use Serverless mode
    log "Configuring KServe for Serverless deployment..."
    
    # Function to extract current ConfigMap field values
    extract_configmap_field() {
        local field=$1
        kubectl get configmap/inferenceservice-config -n kserve -o jsonpath="{.data.$field}" 2>/dev/null || echo ""
    }
    
    # Check if the ConfigMap exists and extract current values
    if kubectl get configmap/inferenceservice-config -n kserve &>/dev/null; then
        # Get current values to decide what to do
        current_deploy=$(extract_configmap_field "deploy")
        current_ingress=$(extract_configmap_field "ingress")
        
        log "Current ConfigMap state - deploy: ${current_deploy:-(empty)}"
        log "Current ConfigMap state - ingress: ${current_ingress:-(empty)}"
        
        # Check if we need to update deployment mode to serverless
        if [[ -z "$current_deploy" ]] || ! echo "$current_deploy" | grep -q "Serverless"; then
            log "Updating deploy field with Serverless mode (with --force-conflicts)..."
            kubectl patch configmap/inferenceservice-config \
              --namespace kserve \
              --type merge \
              --patch '{"data":{"deploy":"{\"defaultDeploymentMode\":\"Serverless\"}"}}' \
              --force-conflicts
            success "Updated deploy field with Serverless mode"
        else
            log "Deploy field already set to Serverless mode - no update needed"
        fi
        
        # Check if we need to update ingress configuration
        if [[ -z "$current_ingress" ]] || ! echo "$current_ingress" | grep -q "knative-serving/knative-ingress-gateway"; then
            log "Updating ingress field with Knative gateway (with --force-conflicts)..."
            kubectl patch configmap/inferenceservice-config \
              --namespace kserve \
              --type merge \
              --patch '{"data":{"ingress":"{\"ingressGateway\":\"knative-serving/knative-ingress-gateway\",\"ingressService\":\"istio-ingressgateway.istio-system.svc.cluster.local\"}"}}' \
              --force-conflicts
            success "Updated ingress field with Knative gateway"
        else
            log "Ingress field already configured correctly - no update needed"
        fi
    else
        # ConfigMap doesn't exist, we can safely create it
        log "Creating ConfigMap with serverless configuration..."
        kubectl create configmap inferenceservice-config \
          --namespace kserve \
          --from-literal=deploy='{"defaultDeploymentMode":"Serverless"}' \
          --from-literal=ingress='{"ingressGateway":"knative-serving/knative-ingress-gateway","ingressService":"istio-ingressgateway.istio-system.svc.cluster.local"}'
        success "Created KServe ConfigMap with Serverless deployment mode"
    fi
    
    success "KServe installation with Serverless support completed"
}

# Install observability stack
install_observability() {
    log "Installing observability stack..."
    
    kubectl config use-context kind-${CLUSTER_NAME}
    
    # Create monitoring namespace
    kubectl create namespace monitoring 2>/dev/null || true
    
    # Add helm repositories
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo add kiali https://kiali.org/helm-charts
    helm repo update
    
    # Add configuration to allow pod annotations scraping
    cat <<EOF | kubectl apply -f -
apiVersion: v1
data:
  additionalscrapconfig.yaml: LSBqb2JfbmFtZTogJ2t1YmVybmV0ZXMtcG9kcycKICBrdWJlcm5ldGVzX3NkX2NvbmZpZ3M6CiAgLSByb2xlOiBwb2QKICByZWxhYmVsX2NvbmZpZ3M6CiAgLSBzb3VyY2VfbGFiZWxzOiBbX19tZXRhX2t1YmVybmV0ZXNfcG9kX2Fubm90YXRpb25fcHJvbWV0aGV1c19pb19zY3JhcGVdCiAgICBhY3Rpb246IGtlZXAKICAgIHJlZ2V4OiB0cnVlCiAgLSBzb3VyY2VfbGFiZWxzOiBbX19tZXRhX2t1YmVybmV0ZXNfcG9kX2Fubm90YXRpb25fcHJvbWV0aGV1c19pb19wYXRoXQogICAgYWN0aW9uOiByZXBsYWNlCiAgICB0YXJnZXRfbGFiZWw6IF9fbWV0cmljc19wYXRoX18KICAgIHJlZ2V4OiAoLispCiAgLSBzb3VyY2VfbGFiZWxzOiBbX19hZGRyZXNzX18sIF9fbWV0YV9rdWJlcm5ldGVzX3BvZF9hbm5vdGF0aW9uX3Byb21ldGhldXNfaW9fcG9ydF0KICAgIGFjdGlvbjogcmVwbGFjZQogICAgcmVnZXg6IChbXjpdKykoPzo6XGQrKT87KFxkKykKICAgIHJlcGxhY2VtZW50OiAkMTokMgogICAgdGFyZ2V0X2xhYmVsOiBfX2FkZHJlc3NfXwogIC0gYWN0aW9uOiBsYWJlbG1hcAogICAgcmVnZXg6IF9fbWV0YV9rdWJlcm5ldGVzX3BvZF9sYWJlbF8oLispCiAgLSBzb3VyY2VfbGFiZWxzOiBbX19tZXRhX2t1YmVybmV0ZXNfbmFtZXNwYWNlXQogICAgYWN0aW9uOiByZXBsYWNlCiAgICB0YXJnZXRfbGFiZWw6IGt1YmVybmV0ZXNfbmFtZXNwYWNlCiAgLSBzb3VyY2VfbGFiZWxzOiBbX19tZXRhX2t1YmVybmV0ZXNfcG9kX25hbWVdCiAgICBhY3Rpb246IHJlcGxhY2UKICAgIHRhcmdldF9sYWJlbDoga3ViZXJuZXRlc19wb2RfbmFtZQo=
kind: Secret
metadata:
  name: additional-scrape-configs
  namespace: monitoring
EOF

    # Install Prometheus
    log "Installing Prometheus ${KUBE_PROMETHEUS_STACK_VERSION}..."
    helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
        --namespace monitoring \
        --version ${KUBE_PROMETHEUS_STACK_VERSION} \
        --set admissionWebhooks.patch.podAnnotations."sidecar\.istio\.io/inject"=false \
        --set prometheus.prometheusSpec.additionalScrapeConfigsSecret.enabled=true \
        --set prometheus.prometheusSpec.additionalScrapeConfigsSecret.name=additional-scrape-configs \
        --set prometheus.prometheusSpec.additionalScrapeConfigsSecret.key=additionalscrapconfig.yaml \
        --wait
    
    # Install the Istio Grafana dashboards
    datasource=default
    for DASHBOARD in 7645 7639 11829 7636 7630 13277; do
      REVISION="$(curl -s https://grafana.com/api/dashboards/${DASHBOARD}/revisions -s | \
        jq ".items[] | select(.description | contains(\"${VERSION}\")) | .revision" | tail -n 1)"
      curl -s https://grafana.com/api/dashboards/${DASHBOARD}/revisions/${REVISION}/download > /tmp/${DASHBOARD}.json
      envsubst < /tmp/${DASHBOARD}.json > /tmp/dashboard_${DASHBOARD}.json
      kubectl create cm dashboard-${DASHBOARD} -n monitoring --from-file /tmp/dashboard_${DASHBOARD}.json
      kubectl label cm dashboard-${DASHBOARD} -n monitoring grafana_dashboard=1
    done

    # Install Jaeger
    log "Installing Jaeger ${JAEGER_VERSION}..."
    
    # Add Jaeger Helm repo if not already added
    helm repo add jaegertracing https://jaegertracing.github.io/helm-charts
    helm repo update
    
    # Install Jaeger with in-memory storage for development
    helm upgrade --install jaeger jaegertracing/jaeger \
        --namespace monitoring \
        --version ${JAEGER_VERSION} \
        --set allInOne.enabled=true \
        --set allInOne.extraEnv[0].name=QUERY_BASE_PATH,allInOne.extraEnv[0].value=/jaeger \
        --set collector.enabled=false \
        --set query.enabled=false \
        --set agent.enabled=false \
        --set storage.type=memory \
        --set provisionDataStore.cassandra=false \
        --wait
    
    # Install Kiali
    log "Installing Kiali ${KIALI_VERSION}..."
    helm upgrade --install kiali kiali/kiali-server \
        --namespace monitoring \
        --version ${KIALI_VERSION} \
        --set auth.strategy="anonymous" \
        --set deployment.ingress.enabled=false \
        --set external_services.tracing.enabled=true \
        --set external_services.tracing.use_grpc=false \
        --set external_services.tracing.internal_url="http://jaeger-query.monitoring:16686/jaeger" \
        --set external_services.tracing.external_url="http://localhost:16686/jaeger" \
        --set external_services.prometheus.url="http://prometheus-kube-prometheus-prometheus.monitoring:9090" \
	--set external_services.grafana.enabled=true \
        --set external_services.grafana.internal_url="http://prometheus-grafana.monitoring" \
        --set external_services.grafana.external_url="http://localhost:3000/" \
        --set external_services.grafana.auth.type=basic \
        --set external_services.grafana.auth.username=admin \
        --set external_services.grafana.auth.password=prom-operator \
        --wait
    
    # Install KServe Grafana dashboards
    log "Installing KServe Grafana dashboards..."

    success "Observability stack installation completed"
}

# Install Envoy Gateway and Envoy AI Gateway
install_envoy_gateway() {
    log "Installing Envoy Gateway v${ENVOY_GATEWAY_VERSION} and Envoy AI Gateway v${ENVOY_AI_GATEWAY_VERSION}..."
    
    kubectl config use-context kind-${CLUSTER_NAME}
    
    # Step 1: Install Envoy Gateway (prerequisite)
    log "Step 1: Installing Envoy Gateway v${ENVOY_GATEWAY_VERSION}..."
    helm upgrade --install envoy-gateway oci://docker.io/envoyproxy/gateway-helm \
        --version ${ENVOY_GATEWAY_VERSION} \
        --namespace envoy-gateway-system \
        --create-namespace
    
    # Wait for Envoy Gateway to be ready
    log "Waiting for Envoy Gateway to be ready..."
    kubectl wait --timeout=2m -n envoy-gateway-system deployment/envoy-gateway --for=condition=Available
}

install_envoy_ai_gateway() {
    # Step 2: Install Envoy AI Gateway
    log "Step 2: Installing Envoy AI Gateway v${ENVOY_AI_GATEWAY_VERSION}..."

    helm upgrade -i aieg-crd oci://docker.io/envoyproxy/ai-gateway-crds-helm \
        --version v${ENVOY_AI_GATEWAY_VERSION} \
        --namespace envoy-ai-gateway-system \
        --create-namespace

    helm upgrade -i aieg oci://docker.io/envoyproxy/ai-gateway-helm \
        --version v${ENVOY_AI_GATEWAY_VERSION} \
        --namespace envoy-ai-gateway-system \
        --create-namespace

    kubectl wait --timeout=2m -n envoy-ai-gateway-system deployment/ai-gateway-controller --for=condition=Available
    
    # Step 3: Configure Envoy Gateway for AI Gateway
    log "Step 3: Configuring Envoy Gateway for AI Gateway..."
    kubectl apply -f https://raw.githubusercontent.com/envoyproxy/ai-gateway/release/v0.2/manifests/envoy-gateway-config/redis.yaml
    kubectl apply -f https://raw.githubusercontent.com/envoyproxy/ai-gateway/release/v0.2/manifests/envoy-gateway-config/config.yaml
    kubectl apply -f https://raw.githubusercontent.com/envoyproxy/ai-gateway/release/v0.2/manifests/envoy-gateway-config/rbac.yaml
    
    # Restart Envoy Gateway and wait for it to be ready
    log "Restarting Envoy Gateway..."
    kubectl rollout restart -n envoy-gateway-system deployment/envoy-gateway
    kubectl wait --timeout=2m -n envoy-gateway-system deployment/envoy-gateway --for=condition=Available
    
    # Step 4: Deploy Gateway Configurations
    log "Step 4: Deploying AI Gateway configurations..."

    # Workaround for > Warning  FailedMount  15s (x6 over 31s)  kubelet            MountVolume.SetUp failed for volume "ai-gateway-ai-inference-gateway-envoy-gateway-system" : secret "ai-inference-gateway-envoy-gateway-system" not found
    kubectl create secret generic ai-inference-gateway-envoy-gateway-system -n envoy-gateway-system
    
    # Apply Gateway foundation configurations
    kubectl apply -f ${PROJECT_DIR}/configs/envoy-gateway/gateway/gatewayclass.yaml
    kubectl apply -f ${PROJECT_DIR}/configs/envoy-gateway/gateway/ai-gateway.yaml
    
    # Apply Backend resources
    kubectl apply -f ${PROJECT_DIR}/configs/envoy-gateway/backends/backends.yaml
    #kubectl apply -f ${PROJECT_DIR}/configs/envoy-gateway/backends/ai-service-backends.yaml
    
    # Apply Security policies

    kubectl apply -f ${PROJECT_DIR}/configs/envoy-gateway/security/jwt-security-policy.yaml
    #kubectl apply -f ${PROJECT_DIR}/configs/envoy-gateway/security/backend-security-policy.yaml
    
    # Apply Routing configuration
    kubectl apply -f ${PROJECT_DIR}/configs/envoy-gateway/routing/httproute.yaml
    #kubectl apply -f ${PROJECT_DIR}/configs/envoy-gateway/routing/ai-gatewayroute.yaml
    
    # Apply Traffic policies
    kubectl apply -f ${PROJECT_DIR}/configs/envoy-gateway/policies/rate-limiting.yaml
    
    # Apply Observability configurations (optional)
    # kubectl apply -f ${PROJECT_DIR}/configs/envoy-gateway/observability/telemetry-config.yaml
    
    # Wait for gateway to be ready
    log "Waiting for AI Gateway to be ready..."
    kubectl wait pods --timeout=2m -l gateway.envoyproxy.io/owning-gateway-name=ai-inference-gateway -n envoy-gateway-system --for=condition=Ready
    
    # Verify installation
    log "Verifying complete installation..."
    echo "Envoy Gateway pods:"
    kubectl get pods -n envoy-gateway-system
    echo "Envoy AI Gateway pods:"
    kubectl get pods -n envoy-ai-gateway-system
    echo "Gateway configurations:"
    kubectl get gatewayclass,gateway,httproute -n envoy-gateway-system
    
    success "Envoy Gateway and AI Gateway installation completed"
}

# Deploy authentication and supporting services
deploy_auth_services() {
    log "Deploying authentication and supporting services..."
    
    kubectl config use-context kind-${CLUSTER_NAME}
    
    # Deploy TLS certificates
    log "Creating TLS certificates..."
    kubectl apply -f ${PROJECT_DIR}/configs/certs/tls-certificates.yaml
    
    # Wait for certificates to be ready
    log "Waiting for certificates to be issued..."
    kubectl wait --timeout=120s -n envoy-gateway-system certificate/ai-gateway-tls --for=condition=Ready || warn "AI Gateway TLS certificate may still be provisioning"
    kubectl wait --timeout=120s -n istio-system certificate/inference-gateway-tls --for=condition=Ready || warn "Inference Gateway TLS certificate may still be provisioning"
    
    # Deploy JWT server
    log "Deploying JWT server..."
    kubectl apply -f ${PROJECT_DIR}/configs/auth/jwt-server.yaml
    
    # Wait for JWT server to be ready
    log "Waiting for JWT server to be ready..."
    kubectl wait --timeout=120s -n default deployment/jwt-server --for=condition=Available
    
    # Verify JWT server is responding
    log "Verifying JWT server connectivity..."
    kubectl run jwt-test --image=curlimages/curl --rm -i --restart=Never -- \
        curl -f http://jwt-server.default.svc.cluster.local:8080/.well-known/jwks.json || \
        warn "JWT server may not be fully ready"
    
    success "Authentication and supporting services deployed"
}

# Setup multi-tenant namespaces
setup_multitenancy() {
    log "Setting up multi-tenant namespaces..."
    
    kubectl config use-context kind-${CLUSTER_NAME}
    
    # Create tenant namespaces
    kubectl create namespace tenant-a 2>/dev/null || true
    kubectl create namespace tenant-b 2>/dev/null || true
    kubectl create namespace tenant-c 2>/dev/null || true
    
    # Enable Istio injection for tenant namespaces
    kubectl label namespace tenant-a istio-injection=enabled --overwrite
    kubectl label namespace tenant-b istio-injection=enabled --overwrite
    kubectl label namespace tenant-c istio-injection=enabled --overwrite
    
    # Apply ReferenceGrants for multi-tenant access
    kubectl apply -f ${PROJECT_DIR}/configs/envoy-gateway/security/reference-grants.yaml

    success "Multi-tenant namespaces setup completed"
}

# Deploy consolidated management service
deploy_management_services() {
    log "Deploying consolidated management service..."
    
    kubectl config use-context kind-${CLUSTER_NAME}
    
    # Deploy Management Service (consolidated)
    log "Deploying Management Service..."
    kubectl apply -f ${PROJECT_DIR}/configs/management/management-registry.yaml
    
    # Wait for Management Service to be ready
    log "Waiting for Management Service to be ready..."
    kubectl wait --timeout=300s -n default deployment/management-service --for=condition=Available
    
    success "Consolidated management service deployed"
}

# Deploy sample models
deploy_sample_models() {
    log "Deploying sample models..."
    
    kubectl config use-context kind-${CLUSTER_NAME}
    
    # Apply sample model configurations
    log "Deploying example models..."
    kubectl apply -f ${PROJECT_DIR}/configs/kserve/models/sklearn-iris.yaml
    kubectl apply -f ${PROJECT_DIR}/configs/kserve/models/llm-runtime-tiny-llm.yaml
    kubectl apply -f ${PROJECT_DIR}/configs/kserve/models/pytorch-resnet.yaml
    
    # Wait for models to be ready
    log "Waiting for models to be ready..."
    kubectl wait --for=condition=ready --timeout=600s inferenceservice/sklearn-iris -n tenant-a 2>/dev/null || warn "sklearn-iris model may still be starting up"
    #TODO: kserve llmrun does not work on arm, disable for now
    #kubectl wait --for=condition=ready --timeout=600s inferenceservice/llm-runtime-tiny-llm -n tenant-b 2>/dev/null || warn "llm-runtime-tiny-llm model may still be starting up"
    kubectl wait --for=condition=ready --timeout=600s inferenceservice/pytorch-resnet -n tenant-c 2>/dev/null || warn "pytorch-resnet model may still be starting up"
    
    success "Sample models deployed"
}

# Configure access management (placeholder for future implementation)
configure_access_management() {
    log "Configuring access management..."
    
    kubectl config use-context kind-${CLUSTER_NAME}
    
    # Check if access management configs exist, apply if available
    if [ -f "${PROJECT_DIR}/configs/access-management/rate-limiting.yaml" ]; then
        log "Applying rate limiting configuration..."
        kubectl apply -f ${PROJECT_DIR}/configs/access-management/rate-limiting.yaml
    else
        warn "Rate limiting configuration not found - skipping"
    fi
    
    if [ -f "${PROJECT_DIR}/configs/access-management/authentication.yaml" ]; then
        log "Applying authentication configuration..."
        kubectl apply -f ${PROJECT_DIR}/configs/access-management/authentication.yaml
    else
        warn "Authentication configuration not found - skipping"
    fi
    
    if [ -f "${PROJECT_DIR}/configs/access-management/authorization.yaml" ]; then
        log "Applying authorization policies..."
        kubectl apply -f ${PROJECT_DIR}/configs/access-management/authorization.yaml
    else
        warn "Authorization policies not found - skipping"
    fi
    
    success "Access management configuration completed"
}

# Validate deployment readiness
validate_deployment() {
    log "Validating deployment readiness..."
    
    kubectl config use-context kind-${CLUSTER_NAME}
    
    # Check core services
    log "Checking core services..."
    
    # Check JWT server
    if kubectl get deployment jwt-server -n default &>/dev/null; then
        if kubectl wait --timeout=30s -n default deployment/jwt-server --for=condition=Available &>/dev/null; then
            success "✓ JWT Server is ready"
        else
            warn "⚠ JWT Server may not be fully ready"
        fi
    else
        error "✗ JWT Server is not deployed"
    fi
    
    # Check AI Gateway
    if kubectl get gateway ai-inference-gateway -n envoy-gateway-system &>/dev/null; then
        success "✓ AI Gateway is configured"
    else
        warn "⚠ AI Gateway configuration not found"
    fi
    
    # Check models
    log "Checking model readiness..."
    for model in "sklearn-iris" "pytorch-resnet"; do
        ns=""
        case $model in
            "sklearn-iris") ns="tenant-a" ;;
            "pytorch-resnet") ns="tenant-c" ;;
        esac
        
        if kubectl get inferenceservice $model -n $ns &>/dev/null; then
            status=$(kubectl get inferenceservice $model -n $ns -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null)
            if [[ "$status" == "True" ]]; then
                success "✓ Model $model is ready"
            else
                warn "⚠ Model $model may still be starting"
            fi
        else
            error "✗ Model $model is not deployed"
        fi
    done
    
    # Check observability
    log "Checking observability services..."
    for service in "prometheus-grafana" "prometheus-kube-prometheus-prometheus" "kiali"; do
        if kubectl get service $service -n monitoring &>/dev/null; then
            success "✓ $service is available"
        else
            warn "⚠ $service is not available"
        fi
    done
    
    # Test JWT server endpoint
    log "Testing JWT server connectivity..."
    if kubectl run jwt-connectivity-test --image=curlimages/curl --rm -i --restart=Never --timeout=30s -- \
        curl -f -s http://jwt-server.default.svc.cluster.local:8080/.well-known/jwks.json >/dev/null 2>&1; then
        success "✓ JWT server is responding"
    else
        warn "⚠ JWT server connectivity test failed"
    fi
    
    success "Deployment validation completed"
}

# Main execution
main() {
    log "Starting Inference-in-a-Box setup..."
    
    # Process command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --ci-mode)
                CI_MODE=true
                log "CI mode enabled: Running limited installation for testing"
                shift
                ;;
            *)
                log "Unknown option: $1"
                shift
                ;;
        esac
    done
    
    # Check if we're running in CI environment
    if [[ "$CI" == "true" ]]; then
        CI_MODE=true
        log "CI environment detected: Running limited installation for testing"
    fi
    
    # Check prerequisites
    check_prerequisites
    
    # Create cluster
    create_cluster
    
    # Install Istio
    install_istio
    
    # Install KServe with Serverless support
    install_kserve

    # Install Envoy Gateway and AI Gateway
    install_envoy_gateway

    # Deploy authentication services
    deploy_auth_services

    # Install Envoy Gateway and AI Gateway
    install_envoy_ai_gateway
    
    # Install observability stack
    install_observability

    # If not in CI mode, install additional components
    if [[ "$CI_MODE" == "false" ]]; then
        
        # Setup multi-tenant namespaces
        setup_multitenancy
        
        # Deploy management services
        deploy_management_services
        
        # Deploy sample models
        deploy_sample_models
        
        # Configure access management
        configure_access_management
        
        # Validate all services are ready
        validate_deployment
    else
        log "CI mode: Skipping observability, AI Gateway, and model deployment"
        # Only setup tenant namespaces in CI mode for minimal testing
        setup_multitenancy
    fi


    
    log "Setup completed! Services available at:"
    log "📊 Grafana: http://localhost:3000 (admin/prom-operator)"
    log "📈 Prometheus: http://localhost:9090"
    log "🗺️ Kiali: http://localhost:20001"
    log "🗺️ Jaeger: http://localhost:16686"
    log "🤖 AI Gateway: http://localhost:8080"
    log "🔧 Management Service: http://localhost:8085 (API & UI)"
    log ""
    log "🔑 JWT Tokens available at: kubectl port-forward -n default svc/jwt-server 8081:8080"
    log "   Then visit: http://localhost:8081/tokens"
    log ""  
    log "To access services, run:"
    log "kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80 &"
    log "kubectl port-forward -n envoy-gateway-system svc/envoy-ai-gateway 8080:80 &"
    log "kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-prometheus 9090:9090 &"
    log "kubectl port-forward -n monitoring svc/kiali 20001:20001 &"
    log "kubectl port-forward -n monitoring svc/jaeger-query 16686:16686 &"
    log "kubectl port-forward -n default svc/management-service 8085:80 &"

    log ""
    success "🎉 Inference-in-a-Box setup complete!"
}

# Run main function
main "$@"
