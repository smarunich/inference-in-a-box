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

# Make individual demo scripts executable
chmod +x ${SCRIPT_DIR}/demo-*.sh

# Demo Functions - now call separate scripts

# Demo 1: Security & Authentication
demo_security() {
    log "Running Security & Authentication Demo"
    ${SCRIPT_DIR}/demo-security.sh
}

# Demo 2: Auto-scaling
demo_autoscaling() {
    log "Running Auto-scaling Demo"
    ${SCRIPT_DIR}/demo-autoscaling.sh
}

# Demo 3: Canary Deployment
demo_canary() {
    log "Running Canary Deployment Demo"
    ${SCRIPT_DIR}/demo-canary.sh
}

# Demo 4: Multi-tenant Isolation
demo_multitenancy() {
    log "Running Multi-tenant Isolation Demo"
    ${SCRIPT_DIR}/demo-multitenancy.sh
}

# Demo 5: Observability
demo_observability() {
    log "Running Observability Demo"
    ${SCRIPT_DIR}/demo-observability.sh
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

# Parse command line arguments
if [ $# -eq 0 ]; then
    # Interactive mode
    main
elif [ "$1" = "--demo" ] && [ $# -eq 2 ]; then
    # Non-interactive mode for CI/CD
    case "$2" in
        "security") 
            demo_security
            success "Security demo completed successfully"
            ;;
        "autoscaling") 
            demo_autoscaling
            success "Auto-scaling demo completed successfully"
            ;;
        "canary") 
            demo_canary
            success "Canary deployment demo completed successfully"
            ;;
        "multitenancy") 
            demo_multitenancy
            success "Multi-tenancy demo completed successfully"
            ;;
        "observability") 
            demo_observability
            success "Observability demo completed successfully"
            ;;
        "all")
            demo_security
            demo_autoscaling
            demo_canary
            demo_multitenancy
            demo_observability
            success "All demos completed successfully"
            ;;
        *)
            error "Invalid demo name: $2"
            echo "Available demos: security, autoscaling, canary, multitenancy, observability, all"
            exit 1
            ;;
    esac
    
    # Kill any background processes
    pkill -f "port-forward" || true
    exit 0
else
    echo "Usage: $0 [--demo <demo-name>]"
    echo "  --demo security      Run security & authentication demo"
    echo "  --demo autoscaling   Run auto-scaling demo"
    echo "  --demo canary        Run canary deployment demo"
    echo "  --demo multitenancy  Run multi-tenant isolation demo"
    echo "  --demo observability Run observability demo"
    echo "  --demo all           Run all demos"
    echo ""
    echo "Run without arguments for interactive mode"
    exit 1
fi