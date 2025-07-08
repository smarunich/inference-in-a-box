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

# Demo Functions

# Demo 1: Security & Authentication
demo_security() {
    log "Running Security & Authentication Demo"
    
    # Set up JWT tokens for demo
    TOKEN_USER_A="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWEiLCJuYW1lIjoiVGVuYW50IEEgVXNlciIsInRlbmFudCI6InRlbmFudC1hIn0.8Xtgw_eSO-fTZexLFVXME5AQ_jJOf615P7VQGahNdDk"
    TOKEN_USER_B="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWIiLCJuYW1lIjoiVGVuYW50IEIgVXNlciIsInRlbmFudCI6InRlbmFudC1iIn0.xYKzRQIxgFcQguz4sBDt1M6ZaRPFBEPjjOvpwfEKjaE"
    
    # Show JWT token contents
    log "JWT Token for Tenant A User:"
    echo $TOKEN_USER_A | cut -d "." -f2 | base64 -d 2>/dev/null | jq . 2>/dev/null || echo "JWT: {\"sub\":\"user-a\",\"name\":\"Tenant A User\",\"tenant\":\"tenant-a\"}"
    
    log "JWT Token for Tenant B User:"
    echo $TOKEN_USER_B | cut -d "." -f2 | base64 -d 2>/dev/null | jq . 2>/dev/null || echo "JWT: {\"sub\":\"user-b\",\"name\":\"Tenant B User\",\"tenant\":\"tenant-b\"}"
    
    # Start port-forward for gateway
    log "Starting port-forward for Istio gateway..."
    kubectl port-forward -n istio-system svc/istio-ingressgateway 8080:80 &
    GATEWAY_PF=$!
    sleep 3
    
    # Make authorized request to tenant A model
    log "Making authorized request to Tenant A model with correct token"
    curl -s -H "Authorization: Bearer $TOKEN_USER_A" \
        -H "Host: sklearn-iris.tenant-a.127.0.0.1.sslip.io" \
        http://localhost:8080/v1/models/sklearn-iris:predict \
        -d '{"instances": [[5.1, 3.5, 1.4, 0.2]]}' | jq . 2>/dev/null || echo "Request completed"
    
    # Make unauthorized request to tenant C model with tenant A token  
    log "Making unauthorized request to Tenant C model with Tenant A token (should fail)"
    curl -s -H "Authorization: Bearer $TOKEN_USER_A" \
        -H "Host: pytorch-resnet.tenant-c.127.0.0.1.sslip.io" \
        http://localhost:8080/v1/models/pytorch-resnet:predict \
        -d '{"instances": [[[0.1, 0.2, 0.3]]]}' | jq . 2>/dev/null || echo "Request failed as expected"
    
    # Clean up port-forward
    kill $GATEWAY_PF 2>/dev/null || true
    
    success "Security & Authentication Demo completed"
}

# Demo 2: Auto-scaling
demo_autoscaling() {
    log "Running Auto-scaling Demo"
    
    # Monitor pods before load
    log "Current pods before load:"
    kubectl get pods -n tenant-a -l serving.kserve.io/inferenceservice=sklearn-iris
    
    # Generate load in background
    log "Generating load to trigger auto-scaling for 60 seconds..."
    
    # Run load in background for 60 seconds
    TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWEiLCJuYW1lIjoiVGVuYW50IEEgVXNlciIsInRlbmFudCI6InRlbmFudC1hIn0.8Xtgw_eSO-fTZexLFVXME5AQ_jJOf615P7VQGahNdDk"
    
    # Use background process for load generation
    for i in {1..600}; do
        curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8080/v2/models/sklearn-iris/infer \
            -d '{"instances": [[5.1, 3.5, 1.4, 0.2]]}' > /dev/null &
        sleep 0.1
    done &
    LOAD_PID=$!
    
    # Monitor pods during scaling events
    log "Monitoring pod scaling (press Ctrl+C to stop):"
    echo "Waiting 10 seconds for scaling to begin..."
    sleep 10
    kubectl get pods -n tenant-a -l serving.kserve.io/inferenceservice=sklearn-iris
    sleep 10
    log "After 20 seconds:"
    kubectl get pods -n tenant-a -l serving.kserve.io/inferenceservice=sklearn-iris
    sleep 10
    log "After 30 seconds:"
    kubectl get pods -n tenant-a -l serving.kserve.io/inferenceservice=sklearn-iris
    
    # Wait for load generation to complete
    wait $LOAD_PID || true
    
    log "Load generation completed, waiting for scale down..."
    sleep 30
    log "Pod status after load removed (should be scaling down):"
    kubectl get pods -n tenant-a -l serving.kserve.io/inferenceservice=sklearn-iris
    
    success "Auto-scaling Demo completed"
}

# Demo 3: Canary Deployment
demo_canary() {
    log "Running Canary Deployment Demo"
    
    # Check if the demo model exists
    if ! kubectl get inferenceservice tensorflow-mnist -n tenant-b &>/dev/null; then
        error "tensorflow-mnist model not found in tenant-b namespace"
        return 1
    fi
    
    # Create canary version of the model (v2)
    log "Creating canary version (v2) of tensorflow-mnist model with 10% traffic"
    kubectl apply -f ${PROJECT_DIR}/examples/traffic-scenarios/canary-deployment.yaml
    
    # Wait for the canary deployment to be ready
    log "Waiting for canary deployment to be ready..."
    kubectl wait --for=condition=Ready inferenceservice tensorflow-mnist-v2 -n tenant-b --timeout=300s
    
    # Show virtual service configuration
    log "VirtualService traffic split configuration:"
    kubectl get virtualservice -n tenant-b -l serving.kserve.io/inferenceservice=tensorflow-mnist -o yaml | grep -A10 "weight"
    
    # Make requests to demonstrate traffic splitting
    log "Making 10 requests to show traffic splitting between main and canary:"
    TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWIiLCJuYW1lIjoiVGVuYW50IEIgVXNlciIsInRlbmFudCI6InRlbmFudC1iIn0.xYKzRQIxgFcQguz4sBDt1M6ZaRPFBEPjjOvpwfEKjaE"
    
    for i in {1..10}; do
        echo -n "Request $i: "
        RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8080/v2/models/tensorflow-mnist/infer \
            -d '{"instances": [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0]]}')
        echo "$RESPONSE" | grep -o '"model_name":[^,]*' || echo "Error in response"
        sleep 1
    done
    
    # Clean up canary if desired
    log "Canary deployment complete. To promote canary to 100%:"
    echo "kubectl apply -f \${PROJECT_DIR}/examples/traffic-scenarios/canary-promotion.yaml"
    
    success "Canary Deployment Demo completed"
}

# Demo 4: Multi-tenant Isolation
demo_multitenancy() {
    log "Running Multi-tenant Isolation Demo"
    
    # Show namespaces and their labels
    log "Tenant namespaces and their labels:"
    kubectl get namespaces --show-labels | grep tenant-
    
    # Show network policies for isolation
    log "Network policies ensuring tenant isolation:"
    kubectl get networkpolicy --all-namespaces
    
    # Show resource quotas for multi-tenancy
    log "Resource quotas for each tenant:"
    kubectl get resourcequota --all-namespaces
    
    # Show models deployed in each tenant
    log "Models deployed in Tenant A:"
    kubectl get inferenceservice -n tenant-a
    
    log "Models deployed in Tenant B:"
    kubectl get inferenceservice -n tenant-b
    
    log "Models deployed in Tenant C:"
    kubectl get inferenceservice -n tenant-c
    
    success "Multi-tenant Isolation Demo completed"
}

# Demo 5: Observability
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
    
    # Generate some traffic for metrics/traces
    log "Generating sample traffic for metrics and traces..."
    TOKEN_A="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWEiLCJuYW1lIjoiVGVuYW50IEEgVXNlciIsInRlbmFudCI6InRlbmFudC1hIn0.8Xtgw_eSO-fTZexLFVXME5AQ_jJOf615P7VQGahNdDk"
    TOKEN_B="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWIiLCJuYW1lIjoiVGVuYW50IEIgVXNlciIsInRlbmFudCI6InRlbmFudC1iIn0.xYKzRQIxgFcQguz4sBDt1M6ZaRPFBEPjjOvpwfEKjaE"
    
    for i in {1..10}; do
        curl -s -H "Authorization: Bearer $TOKEN_A" http://localhost:8080/v2/models/sklearn-iris/infer \
            -d '{"instances": [[5.1, 3.5, 1.4, 0.2]]}' > /dev/null
        curl -s -H "Authorization: Bearer $TOKEN_B" http://localhost:8080/v2/models/tensorflow-mnist/infer \
            -d '{"instances": [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0]]}' > /dev/null
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
    wait $PF1 $PF2 $PF3
}

# Main menu
main() {
    clear
    log "🚀 Inference-in-a-Box Demo Menu"
    echo ""
    echo "1) 🔒 Security & Authentication Demo"
    echo "2) ⚡ Auto-scaling Demo"
    echo "3) 🚦 Canary Deployment Demo"
    echo "4) 🌐 Multi-tenant Isolation Demo"
    echo "5) 📊 Observability Demo"
    echo "6) 🧪 Run All Demos"
    echo "7) 🚪 Exit"
    echo ""
    read -p "Select a demo to run [1-7]: " choice
    
    case $choice in
        1) demo_security ;;
        2) demo_autoscaling ;;
        3) demo_canary ;;
        4) demo_multitenancy ;;
        5) demo_observability ;;
        6)
            demo_security
            demo_autoscaling
            demo_canary
            demo_multitenancy
            demo_observability
            ;;
        7) 
            log "Exiting demo"
            # Kill any background processes
            pkill -f "port-forward" || true
            exit 0
            ;;
        *)
            warn "Invalid selection"
            main
            ;;
    esac
    
    echo ""
    read -p "Press Enter to return to main menu..."
    main
}

# Execute main menu
main
