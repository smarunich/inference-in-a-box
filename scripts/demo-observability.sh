#!/bin/bash

# Observability Demo
# This script demonstrates comprehensive monitoring and observability

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
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

# Helper function to get AI Gateway service name dynamically
get_ai_gateway_service() {
    kubectl get svc -n envoy-gateway-system -l gateway.envoyproxy.io/owning-gateway-name=ai-inference-gateway -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "envoy-ai-gateway"
}

# Helper function to get JWT tokens from server
get_jwt_tokens() {
    # Check if JWT server is available
    if ! kubectl get svc jwt-server -n default &>/dev/null; then
        error "JWT server not found. Please ensure the platform is properly bootstrapped."
        return 1
    fi
    
    # Port-forward to JWT server in background
    kubectl port-forward -n default svc/jwt-server 8081:8080 >/dev/null 2>&1 &
    local jwt_pf=$!
    sleep 2
    
    # Get tokens from server
    local tokens=$(curl -s http://localhost:8081/tokens 2>/dev/null)
    
    # Clean up port-forward
    kill $jwt_pf 2>/dev/null || true
    
    if [ -z "$tokens" ]; then
        error "Failed to retrieve JWT tokens from server"
        return 1
    fi
    
    echo "$tokens"
}

# Observability Demo
demo_observability() {
    log "Running Observability Demo"
    
    # Start port-forwarding for observability tools in background
    log "Starting port-forwarding for observability tools..."
    
    # Stop any existing port-forwards
    pkill -f "port-forward" || true
    sleep 2
    
    # Start new port-forwards with correct service names and namespaces
    kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80 &
    PF1=$!
    kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-prometheus 9090:9090 &
    PF2=$!
    kubectl port-forward -n monitoring svc/kiali 20001:20001 &
    PF3=$!
    
    # Note: Jaeger not deployed in current setup
    log "Note: Jaeger tracing not currently deployed in this setup"
    
    # Wait for port-forwards to establish
    sleep 3
    
    # Start gateway port-forward for traffic generation
    AI_GATEWAY_SERVICE=$(get_ai_gateway_service)
    kubectl port-forward -n envoy-gateway-system svc/$AI_GATEWAY_SERVICE 8080:80 &
    GATEWAY_PF=$!
    sleep 2
    
    # Generate some traffic for metrics/traces
    log "Generating sample traffic for metrics and traces..."
    
    # Get JWT tokens from server dynamically
    log "Retrieving JWT tokens from server..."
    local jwt_response=$(get_jwt_tokens)
    if [ $? -ne 0 ]; then
        error "Failed to retrieve JWT tokens"
        return 1
    fi
    
    # Extract tokens using jq
    TOKEN_A=$(echo "$jwt_response" | jq -r '.["tenant-a"]' 2>/dev/null)
    TOKEN_C=$(echo "$jwt_response" | jq -r '.["tenant-c"]' 2>/dev/null)
    
    if [ -z "$TOKEN_A" ] || [ "$TOKEN_A" = "null" ]; then
        error "Failed to extract tenant-a token"
        return 1
    fi
    
    if [ -z "$TOKEN_C" ] || [ "$TOKEN_C" = "null" ]; then
        error "Failed to extract tenant-c token"
        return 1
    fi
    
    for i in {1..10}; do
        curl -s -H "Authorization: Bearer $TOKEN_A" \
            http://sklearn-iris-predictor.tenant-a.127.0.0.1.sslip.io:8080/v1/models/sklearn-iris:predict \
            -d '{"instances": [[5.1, 3.5, 1.4, 0.2]]}' > /dev/null
        curl -s -H "Authorization: Bearer $TOKEN_C" \
            http://pytorch-resnet-predictor.tenant-c.127.0.0.1.sslip.io:8080/v1/models/pytorch-resnet:predict \
            -d '{"instances": [[[0.1, 0.2, 0.3]]]}' > /dev/null || true
        sleep 0.5
    done
    
    # Show access URLs
    log "📊 Observability tools are now accessible at:"
    echo "Grafana: http://localhost:3000 (admin/prom-operator)"
    echo "Prometheus: http://localhost:9090"
    echo "Kiali: http://localhost:20001"
    echo "Note: Jaeger not deployed in current setup"
    
    # Recommended dashboards
    log "Recommended Grafana dashboards to explore:"
    echo "- KServe Model Performance"
    echo "- Istio Service Dashboard"
    echo "- Istio Workload Dashboard"
    
    log "Press Ctrl+C when done exploring observability tools"
    
    # Wait for user to finish exploring
    wait $PF1 $PF2 $PF3 $GATEWAY_PF
}

# Run the demo
demo_observability