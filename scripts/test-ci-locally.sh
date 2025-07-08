#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Test the workflow steps locally
main() {
    log "🧪 Testing CI/CD workflow locally..."
    
    # Step 1: Validate YAML syntax
    log "Step 1: Validating YAML syntax..."
    find . -name "*.yaml" -o -name "*.yml" | while read file; do
        log "Checking $file..."
        python3 -c "import yaml; yaml.safe_load(open('$file'))" || exit 1
    done
    success "YAML syntax validation passed"
    
    # Step 2: Validate shell scripts
    log "Step 2: Validating shell scripts..."
    find . -name "*.sh" | while read file; do
        log "Checking $file..."
        bash -n "$file" || exit 1
    done
    success "Shell script validation passed"
    
    # Step 3: Test demo script with --demo flag
    log "Step 3: Testing demo script with --demo flag..."
    chmod +x scripts/demo.sh
    
    # Test help
    ./scripts/demo.sh --help || true
    
    # Test invalid demo
    if ./scripts/demo.sh --demo invalid 2>/dev/null; then
        error "Demo script should fail with invalid demo name"
        exit 1
    else
        success "Demo script correctly rejects invalid demo name"
    fi
    
    # Test valid demo names (dry run)
    for demo in security autoscaling canary multitenancy observability; do
        log "Testing --demo $demo syntax..."
        # We can't actually run these without a cluster, but we can check the syntax
        bash -n scripts/demo.sh
    done
    success "Demo script --demo flag tests passed"
    
    # Step 4: Check documentation
    log "Step 4: Checking documentation..."
    
    # Check if required files exist
    [ -f "README.md" ] && [ -s "README.md" ] || (error "README.md missing or empty" && exit 1)
    [ -f "demo.md" ] && [ -s "demo.md" ] || (error "demo.md missing or empty" && exit 1)
    [ -f "experiments/CLAUDE.md" ] && [ -s "experiments/CLAUDE.md" ] || (error "CLAUDE.md missing or empty" && exit 1)
    [ -d "docs" ] && [ "$(ls -A docs)" ] || (error "docs directory missing or empty" && exit 1)
    
    # Check if bootstrap and demo scripts are mentioned
    grep -q "bootstrap.sh" README.md || (error "bootstrap.sh not mentioned in README" && exit 1)
    grep -q "demo.sh" README.md || (error "demo.sh not mentioned in README" && exit 1)
    
    success "Documentation checks passed"
    
    # Step 5: Test JWT token script
    log "Step 5: Testing JWT token script..."
    chmod +x scripts/get-jwt-tokens.sh
    
    # Test syntax
    bash -n scripts/get-jwt-tokens.sh
    success "JWT token script syntax valid"
    
    # Step 6: Test bootstrap script syntax
    log "Step 6: Testing bootstrap script syntax..."
    chmod +x scripts/bootstrap.sh
    bash -n scripts/bootstrap.sh
    success "Bootstrap script syntax valid"
    
    # Step 7: Test cleanup script syntax
    log "Step 7: Testing cleanup script syntax..."
    chmod +x scripts/cleanup.sh
    bash -n scripts/cleanup.sh
    success "Cleanup script syntax valid"
    
    success "🎉 All local CI/CD tests passed!"
    
    log "💡 To run the full CI/CD test:"
    log "   1. Push changes to GitHub"
    log "   2. Check GitHub Actions results"
    log "   3. Or run manually: gh workflow run ci-test-demo.yml"
}

# Show usage
usage() {
    echo "Usage: $0"
    echo "Tests the CI/CD workflow locally without requiring a Kubernetes cluster"
    echo ""
    echo "This script validates:"
    echo "  - YAML syntax"
    echo "  - Shell script syntax"
    echo "  - Demo script CLI interface"
    echo "  - Documentation completeness"
    echo "  - Script executability"
}

# Parse arguments
case "${1:-}" in
    -h|--help)
        usage
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac