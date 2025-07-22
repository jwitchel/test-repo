#!/bin/bash

set -e

API_BASE="http://localhost:3002"
EMAIL="test1@example.com"
PASSWORD="password123"

echo "🧪 Testing Style API Endpoints with CURL"
echo ""

# Step 1: Sign in and get session cookie
echo "1️⃣ Signing in..."
SIGNIN_RESPONSE=$(curl -s -c cookies.txt -w "\nHTTP_CODE:%{http_code}" -X POST "$API_BASE/api/auth/sign-in" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
  
echo "Response: $SIGNIN_RESPONSE"

# Check if signin was successful
if [[ ! -f cookies.txt ]]; then
  echo "❌ Failed to sign in"
  exit 1
fi

echo "✅ Signed in successfully"
echo "Cookies received:"
cat cookies.txt
echo ""
echo ""

# Step 2: Test GET /api/style/relationships
echo "2️⃣ Testing GET /api/style/relationships..."
RELATIONSHIPS=$(curl -s -b cookies.txt "$API_BASE/api/style/relationships")
echo "Response: $RELATIONSHIPS"
echo ""

# Step 3: Test GET /api/style/aggregated/colleague
echo "3️⃣ Testing GET /api/style/aggregated/colleague..."
AGGREGATED=$(curl -s -b cookies.txt "$API_BASE/api/style/aggregated/colleague")
echo "Response: $AGGREGATED"
echo ""

# Step 4: Test GET /api/style/profile/sarah@company.com
echo "4️⃣ Testing GET /api/style/profile/sarah@company.com..."
PROFILE=$(curl -s -b cookies.txt "$API_BASE/api/style/profile/sarah@company.com")
echo "Response: $PROFILE"
echo ""

# Step 5: Test POST /api/style/aggregate/colleague
echo "5️⃣ Testing POST /api/style/aggregate/colleague..."
AGGREGATE=$(curl -s -b cookies.txt -X POST "$API_BASE/api/style/aggregate/colleague" \
  -H "Content-Type: application/json" \
  -d "{}")
echo "Response: $AGGREGATE"
echo ""

# Clean up
rm -f cookies.txt

echo "✅ All tests completed!"