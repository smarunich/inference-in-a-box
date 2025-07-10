#!/bin/bash

# Canary Deployment Demo
# This script demonstrates advanced traffic management and progressive deployment

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

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Enhanced logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] 📋 $1${NC}"
}

success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✅ $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ❌ $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️  $1${NC}"
}

info() {
    echo -e "${CYAN}[$(date +'%Y-%m-%d %H:%M:%S')] ℹ️  $1${NC}"
}

highlight() {
    echo -e "${WHITE}[$(date +'%Y-%m-%d %H:%M:%S')] ⭐ $1${NC}"
}

progress() {
    echo -e "${PURPLE}[$(date +'%Y-%m-%d %H:%M:%S')] 🔄 $1${NC}"
}

# Print separator
separator() {
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════════${NC}"
}

# Print section header
section_header() {
    echo ""
    separator
    echo -e "${WHITE}🚦 $1${NC}"
    separator
    echo ""
}

# Function to display deployment status
display_deployment_status() {
    local namespace=$1
    local service_name=$2
    local description=$3
    
    info "$description"
    
    # Get inference service status
    local inference_services=$(kubectl get inferenceservice -n $namespace --no-headers 2>/dev/null | grep $service_name || true)
    
    if [ -z "$inference_services" ]; then
        warn "No inference services found for $service_name"
        return 1
    fi
    
    echo -e "${WHITE}📊 Inference Service Status:${NC}"
    
    while IFS= read -r service_line; do
        if [ -n "$service_line" ]; then
            local name=$(echo "$service_line" | awk '{print $1}')
            local url=$(echo "$service_line" | awk '{print $2}')
            local ready=$(echo "$service_line" | awk '{print $3}')
            local prev=$(echo "$service_line" | awk '{print $4}')
            local latest=$(echo "$service_line" | awk '{print $5}')
            local prevrolledout=$(echo "$service_line" | awk '{print $6}')
            local latestready=$(echo "$service_line" | awk '{print $7}')
            local age=$(echo "$service_line" | awk '{print $8}')
            
            # Color code based on ready status
            if [ "$ready" = "True" ]; then
                echo -e "${GREEN}   🟢 $name${NC}"
            else
                echo -e "${YELLOW}   🟡 $name${NC}"
            fi
            
            echo -e "${WHITE}      Ready: $ready | Age: $age${NC}"
            echo -e "${WHITE}      URL: $url${NC}"
            echo -e "${WHITE}      Latest: $latest | Previous: $prev${NC}"
        fi
    done <<< "$inference_services"
    
    echo ""
}

# Function to display virtual service traffic configuration
display_traffic_config() {
    local namespace=$1
    local service_name=$2
    
    info "🔍 Analyzing traffic split configuration..."
    
    # Get virtual service configuration
    local vs_config=$(kubectl get virtualservice -n $namespace -l serving.kserve.io/inferenceservice=$service_name -o yaml 2>/dev/null)
    
    if [ -z "$vs_config" ]; then
        warn "No virtual service found for $service_name"
        return 1
    fi
    
    echo -e "${WHITE}📊 Virtual Service Traffic Configuration:${NC}"
    
    # Extract traffic weights
    local weights=$(echo "$vs_config" | grep -A 10 "weight:" | grep "weight:" | awk '{print $2}')
    
    if [ -n "$weights" ]; then
        local weight_count=0
        while IFS= read -r weight; do
            weight_count=$((weight_count + 1))
            if [ $weight_count -eq 1 ]; then
                echo -e "${GREEN}   🎯 Main version: ${weight}% traffic${NC}"
            else
                echo -e "${YELLOW}   🧪 Canary version: ${weight}% traffic${NC}"
            fi
        done <<< "$weights"
    else
        echo -e "${CYAN}   📋 Traffic configuration not yet available${NC}"
    fi
    
    echo ""
}

# Function to make prediction request with analysis
make_prediction_request() {
    local url=$1
    local token=$2
    local data=$3
    local request_num=$4
    local description=$5
    
    local response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" \
        "$url" -d "$data" 2>/dev/null)
    
    local http_code=$(echo "$response" | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
    local response_body=$(echo "$response" | sed -e 's/HTTPSTATUS\:.*//g')
    
    if [ "$http_code" -eq 200 ]; then
        # Try to extract prediction value
        local prediction=$(echo "$response_body" | jq -r '.predictions[0] // "N/A"' 2>/dev/null)
        
        # Determine which version served the request (simplified heuristic)
        local version_indicator="v1"
        if [[ "$prediction" =~ ^[0-9]+\.[0-9]+$ ]]; then
            # If prediction is a simple float, likely v1
            version_indicator="v1"
        elif [[ "$prediction" =~ ^[0-9]+$ ]]; then
            # If prediction is an integer, might be v2
            version_indicator="v2"
        fi
        
        echo -e "${GREEN}   ✅ Request $request_num: HTTP $http_code${NC}"
        echo -e "${WHITE}      Prediction: $prediction${NC}"
        echo -e "${CYAN}      Likely version: $version_indicator${NC}"
        
        # Store version for statistics
        echo "$version_indicator" >> /tmp/canary_versions.txt
    else
        echo -e "${RED}   ❌ Request $request_num: HTTP $http_code${NC}"
        echo -e "${WHITE}      Error: $response_body${NC}"
        echo "error" >> /tmp/canary_versions.txt
    fi
}

# Function to analyze traffic distribution
analyze_traffic_distribution() {
    local total_requests=$1
    
    if [ ! -f /tmp/canary_versions.txt ]; then
        warn "No traffic data available for analysis"
        return 1
    fi
    
    local v1_count=$(grep -c "v1" /tmp/canary_versions.txt 2>/dev/null || echo 0)
    local v2_count=$(grep -c "v2" /tmp/canary_versions.txt 2>/dev/null || echo 0)
    local error_count=$(grep -c "error" /tmp/canary_versions.txt 2>/dev/null || echo 0)
    
    echo -e "${WHITE}📊 Traffic Distribution Analysis:${NC}"
    echo -e "${GREEN}   🎯 Main version (v1): $v1_count requests ($(( v1_count * 100 / total_requests ))%)${NC}"
    echo -e "${YELLOW}   🧪 Canary version (v2): $v2_count requests ($(( v2_count * 100 / total_requests ))%)${NC}"
    echo -e "${RED}   ❌ Failed requests: $error_count requests ($(( error_count * 100 / total_requests ))%)${NC}"
    
    # Clean up
    rm -f /tmp/canary_versions.txt
    
    echo ""
}

# Helper function to get AI Gateway service name dynamically
get_ai_gateway_service() {
    local service_name=$(kubectl get svc -n envoy-gateway-system -l gateway.envoyproxy.io/owning-gateway-name=ai-inference-gateway -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "envoy-ai-gateway")
    info "Detected AI Gateway service: $service_name"
    echo "$service_name"
}

# Helper function to get JWT tokens from server
get_jwt_tokens() {
    progress "Connecting to JWT token server..."
    
    # Check if JWT server is available
    if ! kubectl get svc jwt-server -n default &>/dev/null; then
        error "JWT server not found. Please ensure the platform is properly bootstrapped."
        info "💡 Tip: Run './scripts/bootstrap.sh' to set up the platform"
        return 1
    fi
    
    success "JWT server found in default namespace"
    
    # Port-forward to JWT server in background
    progress "Establishing port-forward to JWT server (port 8081)..."
    kubectl port-forward -n default svc/jwt-server 8081:8080 >/dev/null 2>&1 &
    local jwt_pf=$!
    sleep 2
    
    # Get tokens from server
    info "Fetching JWT tokens from http://localhost:8081/tokens"
    local tokens=$(curl -s http://localhost:8081/tokens 2>/dev/null)
    
    # Clean up port-forward
    kill $jwt_pf 2>/dev/null || true
    
    if [ -z "$tokens" ]; then
        error "Failed to retrieve JWT tokens from server"
        info "💡 Tip: Check if the JWT server is running correctly"
        return 1
    fi
    
    success "JWT tokens retrieved successfully"
    echo "$tokens"
}

# Canary Deployment Demo
demo_canary() {
    section_header "CANARY DEPLOYMENT DEMONSTRATION"
    
    highlight "🎯 Demo Objectives:"
    echo -e "${WHITE}   • Deploy canary version alongside main version${NC}"
    echo -e "${WHITE}   • Configure traffic splitting (90% main, 10% canary)${NC}"
    echo -e "${WHITE}   • Demonstrate progressive deployment strategy${NC}"
    echo -e "${WHITE}   • Show traffic routing and load balancing${NC}"
    echo ""
    
    # Check if the main model exists
    section_header "PREREQUISITE VALIDATION"
    info "🔍 Checking if main sklearn-iris model exists..."
    
    if ! kubectl get inferenceservice sklearn-iris -n tenant-a &>/dev/null; then
        error "sklearn-iris model not found in tenant-a namespace"
        info "💡 Tip: Ensure the main model is deployed before running canary demo"
        return 1
    fi
    
    success "Main sklearn-iris model found in tenant-a namespace"
    display_deployment_status "tenant-a" "sklearn-iris" "📊 Current main model deployment status"
    
    # Deploy canary version
    section_header "CANARY DEPLOYMENT"
    highlight "🚀 Deploying canary version (v2) with 10% traffic allocation"
    
    info "📋 Canary deployment configuration:"
    echo -e "${WHITE}   • Main version: sklearn-iris (90% traffic)${NC}"
    echo -e "${WHITE}   • Canary version: sklearn-iris-v2 (10% traffic)${NC}"
    echo -e "${WHITE}   • Strategy: Blue-Green with traffic splitting${NC}"
    echo -e "${WHITE}   • Rollback: Automatic if health checks fail${NC}"
    echo ""
    
    progress "Applying canary deployment configuration..."
    
    if [ -f "${PROJECT_DIR}/examples/traffic-scenarios/sklearn-iris-canary.yaml" ]; then
        kubectl apply -f ${PROJECT_DIR}/examples/traffic-scenarios/sklearn-iris-canary.yaml
        success "Canary deployment configuration applied"
    else
        error "Canary deployment configuration file not found"
        info "Expected: ${PROJECT_DIR}/examples/traffic-scenarios/sklearn-iris-canary.yaml"
        return 1
    fi
    
    # Wait for canary deployment to be ready
    section_header "CANARY READINESS CHECK"
    progress "Waiting for canary deployment to become ready..."
    
    info "⏱️  Deployment timeline:"
    echo -e "${WHITE}   • Container image pull: 1-2 minutes${NC}"
    echo -e "${WHITE}   • Model loading: 30-60 seconds${NC}"
    echo -e "${WHITE}   • Health checks: 30 seconds${NC}"
    echo -e "${WHITE}   • Traffic routing: 10 seconds${NC}"
    echo ""
    
    # Monitor deployment progress
    local wait_time=0
    local max_wait=300  # 5 minutes
    
    while [ $wait_time -lt $max_wait ]; do
        if kubectl get inferenceservice sklearn-iris-v2 -n tenant-a &>/dev/null; then
            local ready_status=$(kubectl get inferenceservice sklearn-iris-v2 -n tenant-a -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "Unknown")
            
            if [ "$ready_status" = "True" ]; then
                success "Canary deployment is ready!"
                break
            else
                progress "Canary deployment status: $ready_status (waiting...)"
            fi
        else
            progress "Canary deployment not yet created (waiting...)"
        fi
        
        sleep 10
        wait_time=$((wait_time + 10))
    done
    
    if [ $wait_time -ge $max_wait ]; then
        warn "Canary deployment readiness check timed out"
        warn "Proceeding with demo - canary may still be starting up"
    fi
    
    # Display final deployment status
    display_deployment_status "tenant-a" "sklearn-iris" "📊 Final deployment status (main + canary)"
    
    # Show traffic configuration
    section_header "TRAFFIC SPLIT CONFIGURATION"
    display_traffic_config "tenant-a" "sklearn-iris"
    
    info "🔍 Technical details:"
    echo -e "${WHITE}   • Load balancer: Istio Virtual Service${NC}"
    echo -e "${WHITE}   • Routing: Weighted round-robin${NC}"
    echo -e "${WHITE}   • Session affinity: None (stateless)${NC}"
    echo -e "${WHITE}   • Health checks: HTTP readiness probes${NC}"
    echo ""
    
    # Get JWT tokens for testing
    section_header "AUTHENTICATION SETUP"
    local jwt_response=$(get_jwt_tokens)
    if [ $? -ne 0 ]; then
        error "Failed to retrieve JWT tokens - cannot continue demo"
        return 1
    fi
    
    # Extract tenant-a token using jq
    info "🔍 Extracting tenant-a authentication token..."
    TOKEN=$(echo "$jwt_response" | jq -r '.["tenant-a"]' 2>/dev/null)
    
    if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
        error "Failed to extract tenant-a token"
        return 1
    fi
    
    success "Authentication token extracted successfully"
    info "🎫 Token length: ${#TOKEN} characters"
    echo ""
    
    # Set up gateway connection
    section_header "GATEWAY CONNECTION SETUP"
    progress "Setting up connection to Envoy AI Gateway..."
    AI_GATEWAY_SERVICE=$(get_ai_gateway_service)
    
    info "Starting port-forward to $AI_GATEWAY_SERVICE on port 8080..."
    kubectl port-forward -n envoy-gateway-system svc/$AI_GATEWAY_SERVICE 8080:80 >/dev/null 2>&1 &
    GATEWAY_PF=$!
    sleep 3
    
    # Verify port-forward is working
    if kill -0 $GATEWAY_PF 2>/dev/null; then
        success "Port-forward established successfully"
        info "🌐 AI Gateway accessible at http://localhost:8080"
    else
        error "Failed to establish port-forward"
        return 1
    fi
    echo ""
    
    # Test traffic splitting
    section_header "TRAFFIC SPLITTING DEMONSTRATION"
    highlight "🎯 Making 20 requests to demonstrate traffic distribution"
    
    local target_url="http://sklearn-iris-predictor.tenant-a.127.0.0.1.sslip.io:8080/v1/models/sklearn-iris:predict"
    local test_data='{"instances": [[5.1, 3.5, 1.4, 0.2]]}'
    
    info "🎯 Target: sklearn-iris model (main + canary)"
    info "📊 Expected: ~18 requests to main, ~2 requests to canary"
    info "🔄 Traffic split: 90% main version, 10% canary version"
    echo ""
    
    # Clear previous test data
    rm -f /tmp/canary_versions.txt
    
    progress "Sending test requests..."
    echo ""
    
    # Make requests to demonstrate traffic splitting
    for i in {1..20}; do
        make_prediction_request "$target_url" "$TOKEN" "$test_data" "$i" "Traffic split test"
        sleep 0.5
    done
    
    echo ""
    
    # Analyze traffic distribution
    section_header "TRAFFIC ANALYSIS"
    analyze_traffic_distribution 20
    
    # Canary promotion options
    section_header "CANARY PROMOTION OPTIONS"
    highlight "🎛️  Canary deployment management options"
    
    info "📋 Available actions:"
    echo -e "${WHITE}   • Promote canary: Increase traffic to canary version${NC}"
    echo -e "${WHITE}   • Rollback canary: Remove canary and revert to main${NC}"
    echo -e "${WHITE}   • Full promotion: Make canary the new main version${NC}"
    echo -e "${WHITE}   • A/B testing: Run both versions with different traffic splits${NC}"
    echo ""
    
    echo -e "${CYAN}🔧 Promotion commands:${NC}"
    echo -e "${WHITE}   # Increase canary traffic to 50%${NC}"
    echo -e "${YELLOW}   kubectl patch inferenceservice sklearn-iris -n tenant-a --type='json' -p='[{\"op\": \"replace\", \"path\": \"/spec/canaryTrafficPercent\", \"value\": 50}]'${NC}"
    echo ""
    echo -e "${WHITE}   # Full promotion (100% to canary)${NC}"
    echo -e "${YELLOW}   kubectl patch inferenceservice sklearn-iris -n tenant-a --type='json' -p='[{\"op\": \"replace\", \"path\": \"/spec/canaryTrafficPercent\", \"value\": 100}]'${NC}"
    echo ""
    
    # Clean up gateway port-forward
    progress "Cleaning up port-forward..."
    kill $GATEWAY_PF 2>/dev/null || true
    success "Port-forward terminated"
    
    # Cleanup options
    section_header "CLEANUP OPTIONS"
    highlight "🧹 Canary deployment cleanup"
    
    info "📋 Cleanup information:"
    echo -e "${WHITE}   • Canary deployment is active and consuming resources${NC}"
    echo -e "${WHITE}   • Main model continues serving majority of traffic${NC}"
    echo -e "${WHITE}   • Cleanup removes canary and reverts to main only${NC}"
    echo ""
    
    echo -e "${CYAN}🔧 Manual cleanup command:${NC}"
    echo -e "${YELLOW}   kubectl delete -f ${PROJECT_DIR}/examples/traffic-scenarios/sklearn-iris-canary.yaml${NC}"
    echo ""
    
    # Interactive cleanup
    echo -e "${WHITE}Would you like to clean up the canary deployment now? (y/n): ${NC}"
    read -r cleanup_choice
    
    if [[ $cleanup_choice =~ ^[Yy]$ ]]; then
        progress "Cleaning up canary deployment..."
        
        if kubectl delete -f ${PROJECT_DIR}/examples/traffic-scenarios/sklearn-iris-canary.yaml 2>/dev/null; then
            success "Canary deployment cleaned up successfully"
            info "🔄 Traffic now routes 100% to main version"
        else
            warn "Cleanup may have failed or was already completed"
        fi
    else
        info "Canary deployment left active for further exploration"
        info "💡 Remember to clean up later to free resources"
    fi
    
    # Final summary
    section_header "CANARY DEPLOYMENT DEMO SUMMARY"
    highlight "🎉 Canary Deployment Demo Completed Successfully!"
    echo ""
    echo -e "${GREEN}✅ What we demonstrated:${NC}"
    echo -e "${WHITE}   • Canary deployment alongside main version${NC}"
    echo -e "${WHITE}   • Traffic splitting with weighted routing${NC}"
    echo -e "${WHITE}   • Progressive deployment strategy${NC}"
    echo -e "${WHITE}   • Load balancing across versions${NC}"
    echo ""
    echo -e "${CYAN}🚦 Traffic Management Features:${NC}"
    echo -e "${WHITE}   • Weighted routing: 90% main, 10% canary${NC}"
    echo -e "${WHITE}   • Instant rollback: Quick revert capability${NC}"
    echo -e "${WHITE}   • Health monitoring: Automatic failure detection${NC}"
    echo -e "${WHITE}   • Progressive promotion: Gradual traffic increase${NC}"
    echo ""
    echo -e "${PURPLE}💡 Key Insights:${NC}"
    echo -e "${WHITE}   • Zero-downtime deployments possible${NC}"
    echo -e "${WHITE}   • Risk mitigation through gradual rollout${NC}"
    echo -e "${WHITE}   • A/B testing capabilities built-in${NC}"
    echo -e "${WHITE}   • Istio provides advanced traffic management${NC}"
    echo ""
    echo -e "${CYAN}🔧 Technical Stack:${NC}"
    echo -e "${WHITE}   • Service mesh: Istio${NC}"
    echo -e "${WHITE}   • Traffic splitting: Virtual Service${NC}"
    echo -e "${WHITE}   • Load balancing: Envoy Proxy${NC}"
    echo -e "${WHITE}   • Model serving: KServe${NC}"
    echo ""
    
    success "Canary Deployment Demo completed successfully! 🎉"
}

# Run the demo
demo_canary