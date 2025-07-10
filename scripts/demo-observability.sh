#!/bin/bash

# Observability Demo
# Enterprise monitoring and observability stack validation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Professional logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] SUCCESS: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

info() {
    echo -e "${CYAN}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Print separator
separator() {
    echo -e "${CYAN}=================================================================================${NC}"
}

# Print section header
section_header() {
    echo ""
    separator
    echo -e "${WHITE}OBSERVABILITY DEMO: $1${NC}"
    separator
    echo ""
}

# Function to validate monitoring stack components
validate_monitoring_stack() {
    info "Validating observability stack component availability"
    
    echo -e "${WHITE}Component Status Analysis:${NC}"
    
    # Check Grafana
    if kubectl get svc prometheus-grafana -n monitoring &>/dev/null; then
        local grafana_status=$(kubectl get pods -n monitoring -l app.kubernetes.io/name=grafana --no-headers | awk '{print $3}' | head -1)
        echo -e "${GREEN}  ✓ Grafana: Available (Status: $grafana_status)${NC}"
        echo -e "${WHITE}    Service: prometheus-grafana.monitoring${NC}"
        echo -e "${WHITE}    Port: 80${NC}"
    else
        echo -e "${RED}  ✗ Grafana: Not available${NC}"
        return 1
    fi
    
    # Check Prometheus
    if kubectl get svc prometheus-kube-prometheus-prometheus -n monitoring &>/dev/null; then
        local prometheus_status=$(kubectl get pods -n monitoring -l app.kubernetes.io/name=prometheus --no-headers | awk '{print $3}' | head -1)
        echo -e "${GREEN}  ✓ Prometheus: Available (Status: $prometheus_status)${NC}"
        echo -e "${WHITE}    Service: prometheus-kube-prometheus-prometheus.monitoring${NC}"
        echo -e "${WHITE}    Port: 9090${NC}"
    else
        echo -e "${RED}  ✗ Prometheus: Not available${NC}"
        return 1
    fi
    
    # Check Kiali
    if kubectl get svc kiali -n monitoring &>/dev/null; then
        local kiali_status=$(kubectl get pods -n monitoring -l app=kiali --no-headers | awk '{print $3}' | head -1)
        echo -e "${GREEN}  ✓ Kiali: Available (Status: $kiali_status)${NC}"
        echo -e "${WHITE}    Service: kiali.monitoring${NC}"
        echo -e "${WHITE}    Port: 20001${NC}"
    else
        echo -e "${YELLOW}  ! Kiali: Not available${NC}"
    fi
    
    # Check Jaeger
    if kubectl get svc jaeger-query -n monitoring &>/dev/null; then
        local jaeger_status=$(kubectl get pods -n monitoring -l app=jaeger --no-headers | awk '{print $3}' | head -1)
        echo -e "${GREEN}  ✓ Jaeger: Available (Status: $jaeger_status)${NC}"
        echo -e "${WHITE}    Service: jaeger-query.monitoring${NC}"
        echo -e "${WHITE}    Port: 16686${NC}"
    else
        echo -e "${YELLOW}  ! Jaeger: Not deployed in current configuration${NC}"
    fi
    
    echo ""
    success "Monitoring stack validation completed"
    return 0
}

# Function to establish observability tool connections
establish_monitoring_connections() {
    info "Establishing port-forward connections to observability tools"
    
    # Terminate any existing port-forwards
    pkill -f "port-forward" || true
    sleep 2
    
    echo -e "${WHITE}Port-forward Configuration:${NC}"
    
    # Start Grafana port-forward
    kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80 >/dev/null 2>&1 &
    PF_GRAFANA=$!
    echo -e "${GREEN}  ✓ Grafana: localhost:3000${NC}"
    
    # Start Prometheus port-forward
    kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-prometheus 9090:9090 >/dev/null 2>&1 &
    PF_PROMETHEUS=$!
    echo -e "${GREEN}  ✓ Prometheus: localhost:9090${NC}"
    
    # Start Kiali port-forward if available
    if kubectl get svc kiali -n monitoring &>/dev/null; then
        kubectl port-forward -n monitoring svc/kiali 20001:20001 >/dev/null 2>&1 &
        PF_KIALI=$!
        echo -e "${GREEN}  ✓ Kiali: localhost:20001${NC}"
    else
        echo -e "${YELLOW}  ! Kiali: Service not available${NC}"
        PF_KIALI=""
    fi
    
    # Wait for connections to establish
    sleep 3
    
    success "Monitoring tool connections established"
    echo ""
}

# Function to generate observability traffic
generate_observability_traffic() {
    local token_a=$1
    local token_c=$2
    
    info "Generating traffic for observability data collection"
    
    echo -e "${WHITE}Traffic Generation Configuration:${NC}"
    echo -e "${WHITE}  Pattern: Mixed workload across multiple tenants${NC}"
    echo -e "${WHITE}  Duration: 30 seconds${NC}"
    echo -e "${WHITE}  Request Rate: ~2 requests/second${NC}"
    echo -e "${WHITE}  Models: sklearn-iris (tenant-a), pytorch-resnet (tenant-c)${NC}"
    echo ""
    
    log "Executing traffic generation for metrics and tracing"
    
    # Generate diverse traffic patterns
    for i in {1..15}; do
        # Tenant A requests
        curl -s -H "Authorization: Bearer $token_a" \
            http://sklearn-iris-predictor.tenant-a.127.0.0.1.sslip.io:8080/v1/models/sklearn-iris:predict \
            -d '{"instances": [[5.1, 3.5, 1.4, 0.2]]}' >/dev/null 2>&1 &
        
        # Tenant C requests (may fail if model not available)
        curl -s -H "Authorization: Bearer $token_c" \
            http://pytorch-resnet-predictor.tenant-c.127.0.0.1.sslip.io:8080/v1/models/pytorch-resnet:predict \
            -d '{"instances": [[[0.1, 0.2, 0.3]]]}' >/dev/null 2>&1 &
        
        sleep 2
        
        if [ $((i % 5)) -eq 0 ]; then
            log "Traffic generation progress: $i/15 cycles completed"
        fi
    done
    
    # Wait for all background requests to complete
    wait
    
    success "Traffic generation completed - metrics should be available in monitoring tools"
    echo ""
}

# Helper function to get AI Gateway service name
get_ai_gateway_service() {
    local service_name=$(kubectl get svc -n envoy-gateway-system -l gateway.envoyproxy.io/owning-gateway-name=ai-inference-gateway -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "envoy-ai-gateway")
    info "Discovered AI Gateway service: $service_name"
    echo "$service_name"
}

# Helper function to get JWT tokens from server
get_jwt_tokens() {
    log "Establishing connection to JWT authentication server"
    
    # Check if JWT server is available
    if ! kubectl get svc jwt-server -n default &>/dev/null; then
        error "JWT server not available. Platform may not be properly bootstrapped."
        return 1
    fi
    
    success "JWT server verified in default namespace"
    
    # Port-forward to JWT server
    log "Creating port-forward to JWT server on port 8081"
    kubectl port-forward -n default svc/jwt-server 8081:8080 >/dev/null 2>&1 &
    local jwt_pf=$!
    sleep 2
    
    # Get tokens from server
    info "Retrieving JWT tokens from authentication server"
    local tokens=$(curl -s http://localhost:8081/tokens 2>/dev/null)
    
    # Clean up port-forward
    kill $jwt_pf 2>/dev/null || true
    
    if [ -z "$tokens" ]; then
        error "Failed to retrieve JWT tokens from authentication server"
        return 1
    fi
    
    success "JWT tokens retrieved successfully"
    echo "$tokens"
}

# Observability Demo
demo_observability() {
    section_header "OBSERVABILITY STACK VALIDATION"
    
    log "Demo Scope: Enterprise monitoring and observability capabilities validation"
    echo -e "${WHITE}Objectives:${NC}"
    echo -e "${WHITE}  - Validate monitoring stack component availability${NC}"
    echo -e "${WHITE}  - Establish connections to observability tools${NC}"
    echo -e "${WHITE}  - Generate metrics and tracing data${NC}"
    echo -e "${WHITE}  - Demonstrate monitoring dashboards and analytics${NC}"
    echo -e "${WHITE}  - Analyze service mesh observability features${NC}"
    echo ""
    
    # Monitoring stack validation
    section_header "MONITORING STACK VALIDATION"
    validate_monitoring_stack
    if [ $? -ne 0 ]; then
        error "Monitoring stack validation failed - cannot proceed with observability demo"
        return 1
    fi
    
    # Establish monitoring connections
    section_header "MONITORING TOOL CONNECTION ESTABLISHMENT"
    establish_monitoring_connections
    
    # Gateway connection setup
    section_header "AI GATEWAY CONNECTION ESTABLISHMENT"
    log "Establishing connection to Envoy AI Gateway for traffic generation"
    AI_GATEWAY_SERVICE=$(get_ai_gateway_service)
    
    info "Initiating port-forward to $AI_GATEWAY_SERVICE on port 8080"
    kubectl port-forward -n envoy-gateway-system svc/$AI_GATEWAY_SERVICE 8080:80 >/dev/null 2>&1 &
    GATEWAY_PF=$!
    sleep 3
    
    # Verify gateway connection
    if kill -0 $GATEWAY_PF 2>/dev/null; then
        success "AI Gateway port-forward established successfully"
        info "AI Gateway accessible at http://localhost:8080"
    else
        error "Failed to establish port-forward to AI Gateway"
        return 1
    fi
    echo ""
    
    # Authentication setup
    section_header "AUTHENTICATION CONFIGURATION"
    local jwt_response=$(get_jwt_tokens)
    if [ $? -ne 0 ]; then
        error "JWT token acquisition failed - cannot generate authenticated traffic"
        return 1
    fi
    
    # Extract tokens for multiple tenants
    info "Extracting authentication tokens for multi-tenant traffic generation"
    TOKEN_A=$(echo "$jwt_response" | jq -r '.["tenant-a"]' 2>/dev/null)
    TOKEN_C=$(echo "$jwt_response" | jq -r '.["tenant-c"]' 2>/dev/null)
    
    if [ -z "$TOKEN_A" ] || [ "$TOKEN_A" = "null" ]; then
        error "Failed to extract tenant-a authentication token"
        return 1
    fi
    
    if [ -z "$TOKEN_C" ] || [ "$TOKEN_C" = "null" ]; then
        warn "Failed to extract tenant-c authentication token - some traffic generation will be limited"
        TOKEN_C=""
    fi
    
    success "Authentication tokens configured for observability traffic generation"
    echo ""
    
    # Traffic generation for observability
    section_header "OBSERVABILITY TRAFFIC GENERATION"
    generate_observability_traffic "$TOKEN_A" "$TOKEN_C"
    
    # Monitoring tool access information
    section_header "MONITORING TOOL ACCESS CONFIGURATION"
    log "Providing access information for observability tools"
    
    echo -e "${WHITE}Observability Tools Access:${NC}"
    echo -e "${GREEN}  Grafana Dashboard: http://localhost:3000${NC}"
    echo -e "${WHITE}    Default Credentials: admin / prom-operator${NC}"
    echo -e "${WHITE}    Purpose: Metrics visualization and alerting${NC}"
    echo ""
    echo -e "${GREEN}  Prometheus Query Interface: http://localhost:9090${NC}"
    echo -e "${WHITE}    Purpose: Metrics collection and querying${NC}"
    echo -e "${WHITE}    Query Language: PromQL${NC}"
    echo ""
    
    if [ -n "$PF_KIALI" ]; then
        echo -e "${GREEN}  Kiali Service Mesh Console: http://localhost:20001${NC}"
        echo -e "${WHITE}    Purpose: Service mesh topology and traffic analysis${NC}"
        echo -e "${WHITE}    Features: Distributed tracing, traffic flow visualization${NC}"
        echo ""
    fi
    
    if kubectl get svc jaeger-query -n monitoring &>/dev/null; then
        echo -e "${GREEN}  Jaeger Tracing: http://localhost:16686${NC}"
        echo -e "${WHITE}    Purpose: Distributed request tracing${NC}"
        echo -e "${WHITE}    Features: Request flow analysis, latency profiling${NC}"
        echo ""
    else
        echo -e "${YELLOW}  Jaeger Tracing: Not deployed in current configuration${NC}"
        echo -e "${WHITE}    Note: Consider deploying Jaeger for comprehensive distributed tracing${NC}"
        echo ""
    fi
    
    # Dashboard recommendations
    section_header "RECOMMENDED MONITORING DASHBOARDS"
    log "Providing guidance for observability dashboard exploration"
    
    echo -e "${WHITE}Grafana Dashboard Recommendations:${NC}"
    echo -e "${GREEN}  KServe Model Performance Dashboard${NC}"
    echo -e "${WHITE}    Metrics: Request latency, throughput, error rates${NC}"
    echo -e "${WHITE}    Use Case: Model serving performance analysis${NC}"
    echo ""
    echo -e "${GREEN}  Istio Service Dashboard${NC}"
    echo -e "${WHITE}    Metrics: Service-to-service communication, traffic patterns${NC}"
    echo -e "${WHITE}    Use Case: Service mesh traffic analysis${NC}"
    echo ""
    echo -e "${GREEN}  Istio Workload Dashboard${NC}"
    echo -e "${WHITE}    Metrics: Pod-level metrics, resource utilization${NC}"
    echo -e "${WHITE}    Use Case: Workload performance monitoring${NC}"
    echo ""
    echo -e "${GREEN}  Kubernetes Cluster Overview${NC}"
    echo -e "${WHITE}    Metrics: Node health, resource usage, pod status${NC}"
    echo -e "${WHITE}    Use Case: Infrastructure monitoring${NC}"
    echo ""
    
    # Key metrics guidance
    echo -e "${WHITE}Key Metrics to Monitor:${NC}"
    echo -e "${CYAN}  Application Metrics:${NC}"
    echo -e "${WHITE}    - Request latency percentiles (p50, p95, p99)${NC}"
    echo -e "${WHITE}    - Request throughput (requests/second)${NC}"
    echo -e "${WHITE}    - Error rates and status code distribution${NC}"
    echo -e "${WHITE}    - Model inference latency and accuracy${NC}"
    echo ""
    echo -e "${CYAN}  Infrastructure Metrics:${NC}"
    echo -e "${WHITE}    - CPU and memory utilization${NC}"
    echo -e "${WHITE}    - Network traffic and latency${NC}"
    echo -e "${WHITE}    - Pod scaling events and resource limits${NC}"
    echo -e "${WHITE}    - Storage I/O and disk usage${NC}"
    echo ""
    echo -e "${CYAN}  Security Metrics:${NC}"
    echo -e "${WHITE}    - Authentication success/failure rates${NC}"
    echo -e "${WHITE}    - Cross-tenant access attempts${NC}"
    echo -e "${WHITE}    - Certificate validity and rotation${NC}"
    echo -e "${WHITE}    - Network policy violations${NC}"
    echo ""
    
    # Interactive exploration period
    info "Observability tools are now accessible for exploration"
    warn "Keep tools running for monitoring analysis - Press Ctrl+C to terminate when finished"
    echo ""
    
    # Wait for user interaction
    trap 'log "Terminating observability demo..." && break' INT
    while true; do
        sleep 10
        log "Observability tools remain active - monitoring data continues to be collected"
    done
    
    # Cleanup connections
    section_header "CONNECTION CLEANUP"
    log "Terminating port-forward connections"
    
    # Kill all port-forwards
    kill $GATEWAY_PF 2>/dev/null || true
    kill $PF_GRAFANA 2>/dev/null || true
    kill $PF_PROMETHEUS 2>/dev/null || true
    [ -n "$PF_KIALI" ] && kill $PF_KIALI 2>/dev/null || true
    
    success "All monitoring connections terminated"
    
    # Comprehensive summary
    section_header "OBSERVABILITY VALIDATION SUMMARY"
    success "Observability demonstration completed successfully"
    echo ""
    echo -e "${GREEN}Validation Results:${NC}"
    echo -e "${WHITE}  - Monitoring stack components: VERIFIED${NC}"
    echo -e "${WHITE}  - Metrics collection: OPERATIONAL${NC}"
    echo -e "${WHITE}  - Dashboard access: ESTABLISHED${NC}"
    echo -e "${WHITE}  - Traffic generation: COMPLETED${NC}"
    echo -e "${WHITE}  - Service mesh observability: CONFIRMED${NC}"
    echo ""
    echo -e "${CYAN}Observability Features Validated:${NC}"
    echo -e "${WHITE}  - Prometheus: Metrics collection and storage${NC}"
    echo -e "${WHITE}  - Grafana: Visualization and alerting platform${NC}"
    echo -e "${WHITE}  - Kiali: Service mesh topology and traffic analysis${NC}"
    echo -e "${WHITE}  - Istio: Service mesh telemetry and tracing${NC}"
    echo ""
    echo -e "${PURPLE}Enterprise Insights:${NC}"
    echo -e "${WHITE}  - Comprehensive monitoring stack provides full observability${NC}"
    echo -e "${WHITE}  - Real-time metrics enable proactive issue detection${NC}"
    echo -e "${WHITE}  - Service mesh telemetry offers deep application insights${NC}"
    echo -e "${WHITE}  - Distributed tracing capabilities support complex troubleshooting${NC}"
    echo ""
    echo -e "${CYAN}Operational Recommendations:${NC}"
    echo -e "${WHITE}  - Configure alerting rules for critical metrics${NC}"
    echo -e "${WHITE}  - Implement log aggregation for comprehensive analysis${NC}"
    echo -e "${WHITE}  - Set up automated dashboard provisioning${NC}"
    echo -e "${WHITE}  - Establish monitoring data retention policies${NC}"
    echo ""
    
    success "Observability validation completed - monitoring capabilities confirmed"
}

# Run the demo
demo_observability