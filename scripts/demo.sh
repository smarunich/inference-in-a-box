#!/bin/bash

# AI/ML Inference Platform Demo Suite
# Enterprise demonstration of platform capabilities

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
CLUSTER_NAME="inference-in-a-box"

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

# Make individual demo scripts executable
chmod +x ${SCRIPT_DIR}/demo-*.sh

# Demo Functions - delegate to separate scripts

# Demo 1: Security & Authentication
demo_security() {
    log "Launching Security & Authentication validation"
    ${SCRIPT_DIR}/demo-security.sh
}

# Demo 2: Auto-scaling
demo_autoscaling() {
    log "Launching Auto-scaling validation"
    ${SCRIPT_DIR}/demo-autoscaling.sh
}

# Demo 3: Canary Deployment
demo_canary() {
    log "Launching Canary Deployment validation"
    ${SCRIPT_DIR}/demo-canary.sh
}

# Demo 4: Multi-tenant Isolation
demo_multitenancy() {
    log "Launching Multi-tenant Isolation validation"
    ${SCRIPT_DIR}/demo-multitenancy.sh
}

# Demo 5: Observability
demo_observability() {
    log "Launching Observability validation"
    ${SCRIPT_DIR}/demo-observability.sh
}

# Main menu
main() {
    clear
    echo -e "${CYAN}=================================================================================${NC}"
    echo -e "${WHITE}           AI/ML INFERENCE PLATFORM - ENTERPRISE DEMONSTRATION SUITE${NC}"
    echo -e "${CYAN}=================================================================================${NC}"
    echo ""
    echo -e "${WHITE}Platform: Inference-in-a-Box${NC}"
    echo -e "${WHITE}Version: Enterprise Edition${NC}"
    echo -e "${WHITE}Cluster: $CLUSTER_NAME${NC}"
    echo ""
    echo -e "${CYAN}Available Demonstrations:${NC}"
    echo ""
    echo -e "${GREEN}1) Security & Authentication Validation${NC}"
    echo -e "${WHITE}   JWT-based authentication, tenant isolation, zero-trust networking${NC}"
    echo ""
    echo -e "${GREEN}2) Serverless Auto-scaling Validation${NC}"
    echo -e "${WHITE}   Scale-to-zero, automatic pod scaling, load-based optimization${NC}"
    echo ""
    echo -e "${GREEN}3) Canary Deployment Validation${NC}"
    echo -e "${WHITE}   Progressive deployment, traffic splitting, risk mitigation${NC}"
    echo ""
    echo -e "${GREEN}4) Multi-tenant Isolation Validation${NC}"
    echo -e "${WHITE}   Namespace separation, resource quotas, network policies${NC}"
    echo ""
    echo -e "${GREEN}5) Observability Stack Validation${NC}"
    echo -e "${WHITE}   Monitoring, metrics, dashboards, distributed tracing${NC}"
    echo ""
    echo -e "${GREEN}6) Comprehensive Platform Validation${NC}"
    echo -e "${WHITE}   Execute all demonstrations in sequence${NC}"
    echo ""
    echo -e "${GREEN}7) Exit Demo Suite${NC}"
    echo ""
    echo -e "${CYAN}=================================================================================${NC}"
    read -p "Select demonstration [1-7]: " choice
    
    case $choice in
        1) 
            log "Initiating Security & Authentication validation"
            demo_security 
            ;;
        2) 
            log "Initiating Auto-scaling validation"
            demo_autoscaling 
            ;;
        3) 
            log "Initiating Canary Deployment validation"
            demo_canary 
            ;;
        4) 
            log "Initiating Multi-tenant Isolation validation"
            demo_multitenancy 
            ;;
        5) 
            log "Initiating Observability validation"
            demo_observability 
            ;;
        6)
            log "Initiating Comprehensive Platform validation"
            echo ""
            echo -e "${CYAN}=================================================================================${NC}"
            echo -e "${WHITE}                    COMPREHENSIVE PLATFORM VALIDATION${NC}"
            echo -e "${CYAN}=================================================================================${NC}"
            echo ""
            
            log "Executing Security & Authentication validation..."
            demo_security
            echo ""
            
            log "Executing Auto-scaling validation..."
            demo_autoscaling
            echo ""
            
            log "Executing Canary Deployment validation..."
            demo_canary
            echo ""
            
            log "Executing Multi-tenant Isolation validation..."
            demo_multitenancy
            echo ""
            
            log "Executing Observability validation..."
            demo_observability
            echo ""
            
            echo -e "${CYAN}=================================================================================${NC}"
            echo -e "${WHITE}                    COMPREHENSIVE VALIDATION COMPLETED${NC}"
            echo -e "${CYAN}=================================================================================${NC}"
            success "All platform capabilities validated successfully"
            ;;
        7) 
            log "Exiting demonstration suite"
            # Kill any background processes
            pkill -f "port-forward" || true
            echo ""
            echo -e "${CYAN}=================================================================================${NC}"
            echo -e "${WHITE}           Thank you for using the AI/ML Inference Platform Demo Suite${NC}"
            echo -e "${CYAN}=================================================================================${NC}"
            exit 0
            ;;
        *)
            warn "Invalid selection. Please choose 1-7."
            sleep 2
            main
            ;;
    esac
    
    echo ""
    echo -e "${CYAN}=================================================================================${NC}"
    read -p "Press Enter to return to main menu..."
    main
}

# Parse command line arguments
if [ $# -eq 0 ]; then
    # Interactive mode
    main
elif [ "$1" = "--demo" ] && [ $# -eq 2 ]; then
    # Non-interactive mode for CI/CD
    case "$2" in
        "security") 
            log "Executing Security & Authentication validation (non-interactive)"
            demo_security
            success "Security validation completed successfully"
            ;;
        "autoscaling") 
            log "Executing Auto-scaling validation (non-interactive)"
            demo_autoscaling
            success "Auto-scaling validation completed successfully"
            ;;
        "canary") 
            log "Executing Canary Deployment validation (non-interactive)"
            demo_canary
            success "Canary deployment validation completed successfully"
            ;;
        "multitenancy") 
            log "Executing Multi-tenant Isolation validation (non-interactive)"
            demo_multitenancy
            success "Multi-tenancy validation completed successfully"
            ;;
        "observability") 
            log "Executing Observability validation (non-interactive)"
            demo_observability
            success "Observability validation completed successfully"
            ;;
        "all")
            log "Executing Comprehensive Platform validation (non-interactive)"
            demo_security
            demo_autoscaling
            demo_canary
            demo_multitenancy
            demo_observability
            success "Comprehensive platform validation completed successfully"
            ;;
        *)
            error "Invalid demonstration name: $2"
            echo "Available demonstrations: security, autoscaling, canary, multitenancy, observability, all"
            exit 1
            ;;
    esac
    
    # Kill any background processes
    pkill -f "port-forward" || true
    exit 0
else
    echo "Usage: $0 [--demo <demo-name>]"
    echo ""
    echo "Available demonstrations:"
    echo "  --demo security       Security & Authentication validation"
    echo "  --demo autoscaling    Serverless Auto-scaling validation"
    echo "  --demo canary         Canary Deployment validation"
    echo "  --demo multitenancy   Multi-tenant Isolation validation"
    echo "  --demo observability  Observability Stack validation"
    echo "  --demo all            Comprehensive Platform validation"
    echo ""
    echo "Run without arguments for interactive mode"
    exit 1
fi