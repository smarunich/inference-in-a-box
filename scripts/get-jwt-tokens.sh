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
    # Fallback to hardcoded tokens
    echo -e "${YELLOW}Using hardcoded demo tokens:${NC}"
    
    echo -e "\n${GREEN}Tenant A Token:${NC}"
    echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWEiLCJuYW1lIjoiVGVuYW50IEEgVXNlciIsInRlbmFudCI6InRlbmFudC1hIiwiaXNzIjoiaW5mZXJlbmNlLWluLWEtYm94IiwiYXVkIjoidGVuYW50LWEiLCJleHAiOjk5OTk5OTk5OTl9.8Xtgw_eSO-fTZexLFVXME5AQ_jJOf615P7VQGahNdDk"
    
    echo -e "\n${GREEN}Tenant B Token:${NC}"
    echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWIiLCJuYW1lIjoiVGVuYW50IEIgVXNlciIsInRlbmFudCI6InRlbmFudC1iIiwiaXNzIjoiaW5mZXJlbmNlLWluLWEtYm94IiwiYXVkIjoidGVuYW50LWIiLCJleHAiOjk5OTk5OTk5OTl9.xYKzRQIxgFcQguz4sBDt1M6ZaRPFBEPjjOvpwfEKjaE"
    
    echo -e "\n${GREEN}Tenant C Token:${NC}"
    echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWMiLCJuYW1lIjoiVGVuYW50IEMgVXNlciIsInRlbmFudCI6InRlbmFudC1jIiwiaXNzIjoiaW5mZXJlbmNlLWluLWEtYm94IiwiYXVkIjoidGVuYW50LWMiLCJleHAiOjk5OTk5OTk5OTl9.YGKj3n_OnUsLaJUBo-xF-_kGOOjwlwn4GWmgdP8kxQ4"
fi

echo -e "\n${BLUE}To set as environment variables:${NC}"
echo "export TOKEN_A=\"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWEiLCJuYW1lIjoiVGVuYW50IEEgVXNlciIsInRlbmFudCI6InRlbmFudC1hIiwiaXNzIjoiaW5mZXJlbmNlLWluLWEtYm94IiwiYXVkIjoidGVuYW50LWEiLCJleHAiOjk5OTk5OTk5OTl9.8Xtgw_eSO-fTZexLFVXME5AQ_jJOf615P7VQGahNdDk\""
echo "export TOKEN_B=\"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWIiLCJuYW1lIjoiVGVuYW50IEIgVXNlciIsInRlbmFudCI6InRlbmFudC1iIiwiaXNzIjoiaW5mZXJlbmNlLWluLWEtYm94IiwiYXVkIjoidGVuYW50LWIiLCJleHAiOjk5OTk5OTk5OTl9.xYKzRQIxgFcQguz4sBDt1M6ZaRPFBEPjjOvpwfEKjaE\""
echo "export TOKEN_C=\"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWMiLCJuYW1lIjoiVGVuYW50IEMgVXNlciIsInRlbmFudCI6InRlbmFudC1jIiwiaXNzIjoiaW5mZXJlbmNlLWluLWEtYm94IiwiYXVkIjoidGVuYW50LWMiLCJleHAiOjk5OTk5OTk5OTl9.YGKj3n_OnUsLaJUBo-xF-_kGOOjwlwn4GWmgdP8kxQ4\""

# Cleanup
kill $PF_PID 2>/dev/null || true

echo -e "\n${GREEN}✓ Done!${NC}"