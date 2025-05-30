#!/bin/bash

# Galactic Parallax API Test Script
# Usage: ./test-api.sh [JWT_TOKEN]

BASE_URL="http://localhost:8787"
JWT_TOKEN=${1:-"YOUR_JWT_TOKEN_HERE"}

echo "🚀 Testing Galactic Parallax API"
echo "================================="
echo "Base URL: $BASE_URL"
echo "JWT Token: ${JWT_TOKEN:0:20}..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to test endpoint
test_endpoint() {
    local name="$1"
    local method="$2"
    local url="$3"
    local headers="$4"
    
    echo -e "${BLUE}Testing: $name${NC}"
    echo "URL: $method $url"
    
    if [ -n "$headers" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" -H "$headers" "$url")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$url")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo -e "${GREEN}✅ Success ($http_code)${NC}"
    elif [ "$http_code" -ge 400 ] && [ "$http_code" -lt 500 ]; then
        echo -e "${YELLOW}⚠️  Client Error ($http_code)${NC}"
    else
        echo -e "${RED}❌ Error ($http_code)${NC}"
    fi
    
    echo "Response:"
    echo "$body" | jq . 2>/dev/null || echo "$body"
    echo ""
    echo "---"
    echo ""
}

# Test public endpoints
echo "📋 Testing Public Endpoints"
echo "============================"

test_endpoint "Root Endpoint" "GET" "$BASE_URL/"
test_endpoint "Health Check" "GET" "$BASE_URL/api/health"
test_endpoint "404 Test" "GET" "$BASE_URL/nonexistent"

# Test protected endpoints without auth (should fail)
echo "🔒 Testing Protected Endpoints (No Auth - Should Fail)"
echo "======================================================"

test_endpoint "Search Images (No Auth)" "GET" "$BASE_URL/api/search/images?q=test"
test_endpoint "Search Suggestions (No Auth)" "GET" "$BASE_URL/api/search/suggestions"

# Test protected endpoints with auth
if [ "$JWT_TOKEN" != "YOUR_JWT_TOKEN_HERE" ]; then
    echo "🔐 Testing Protected Endpoints (With Auth)"
    echo "=========================================="
    
    AUTH_HEADER="Authorization: Bearer $JWT_TOKEN"
    
    test_endpoint "Search Images - Landscape" "GET" "$BASE_URL/api/search/images?q=mountain%20sunset&orientation=landscape&count=3" "$AUTH_HEADER"
    test_endpoint "Search Images - Portrait" "GET" "$BASE_URL/api/search/images?q=abstract%20art&orientation=portrait&count=2" "$AUTH_HEADER"
    test_endpoint "Search Suggestions - General" "GET" "$BASE_URL/api/search/suggestions" "$AUTH_HEADER"
    test_endpoint "Search Suggestions - Landscape" "GET" "$BASE_URL/api/search/suggestions?category=landscape" "$AUTH_HEADER"
    test_endpoint "Search Health Check" "GET" "$BASE_URL/api/search/health" "$AUTH_HEADER"
    
    # Test edge cases
    echo "🧪 Testing Edge Cases"
    echo "===================="
    
    test_endpoint "Empty Query" "GET" "$BASE_URL/api/search/images?q=" "$AUTH_HEADER"
    test_endpoint "Invalid Orientation" "GET" "$BASE_URL/api/search/images?q=test&orientation=invalid" "$AUTH_HEADER"
    test_endpoint "Invalid Count" "GET" "$BASE_URL/api/search/images?q=test&count=20" "$AUTH_HEADER"
    test_endpoint "Invalid Category" "GET" "$BASE_URL/api/search/suggestions?category=invalid" "$AUTH_HEADER"
else
    echo -e "${YELLOW}⚠️  Skipping authenticated tests. Please provide JWT token as argument.${NC}"
    echo "Usage: ./test-api.sh YOUR_JWT_TOKEN"
fi

echo "🎉 Testing Complete!"
echo ""
echo "💡 Tips:"
echo "- Get JWT token from Auth0 Dashboard → Applications → Test tab"
echo "- Or use: curl --request POST --url https://YOUR_DOMAIN.auth0.com/oauth/token ..."
echo "- Make sure your environment variables are set: wrangler secret list" 