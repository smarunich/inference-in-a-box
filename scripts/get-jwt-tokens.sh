#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔑 JWT Tokens for Demo${NC}"
echo "=================================="

# Check if JWT server is available
if ! kubectl get svc jwt-server -n default &>/dev/null; then
    echo -e "${YELLOW}⚠ JWT server not found. Make sure bootstrap.sh has been run successfully.${NC}"
    exit 1
fi

# Start port-forward in background
echo "Starting port-forward to JWT server..."
kubectl port-forward -n default svc/jwt-server 8081:8080 &
PF_PID=$!

# Wait for port-forward to establish
sleep 3

# Get tokens
echo -e "\n${GREEN}Available JWT Tokens:${NC}"
echo "====================="

# Try to get tokens from JWT server
if curl -f -s http://localhost:8081/tokens >/dev/null 2>&1; then
    TOKENS=$(curl -s http://localhost:8081/tokens)
    
    echo -e "\n${GREEN}Tenant A Token:${NC}"
    echo "$(echo "$TOKENS" | jq -r '.["tenant-a"]')"
    
    echo -e "\n${GREEN}Tenant B Token:${NC}" 
    echo "$(echo "$TOKENS" | jq -r '.["tenant-b"]')"
    
    echo -e "\n${GREEN}Tenant C Token:${NC}"
    echo "$(echo "$TOKENS" | jq -r '.["tenant-c"]')"
    
    echo -e "\n${BLUE}Usage Example:${NC}"
    echo "curl -H \"Authorization: Bearer \$(echo '$TOKENS' | jq -r '.[\\"tenant-a\\"]')\" \\"
    echo "     http://localhost:8080/v1/models/sklearn-iris:predict \\"
    echo "     -d '{\"instances\": [[5.1, 3.5, 1.4, 0.2]]}'"
    
else
    echo -e "${YELLOW}⚠ Could not connect to JWT server. Check if it's running.${NC}"
    exit 1
fi

if [ ! -z "$TOKENS" ]; then
    echo -e "\n${BLUE}To set as environment variables:${NC}"
    echo "export TOKEN_A=\"$(echo "$TOKENS" | jq -r '.["tenant-a"]')\""
    echo "export TOKEN_B=\"$(echo "$TOKENS" | jq -r '.["tenant-b"]')\""
    echo "export TOKEN_C=\"$(echo "$TOKENS" | jq -r '.["tenant-c"]')\""
fi

# Cleanup
kill $PF_PID 2>/dev/null || true

echo -e "\n${GREEN}✓ Done!${NC}"