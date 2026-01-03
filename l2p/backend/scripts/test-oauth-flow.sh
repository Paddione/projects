#!/bin/bash

# Test OAuth Flow and Database Propagation
# This script tests the complete OAuth authentication flow including database propagation

set -e

echo "======================================"
echo "OAuth Flow & Database Propagation Test"
echo "======================================"
echo ""

# Configuration
AUTH_SERVICE_URL="${AUTH_SERVICE_URL:-http://localhost:5500}"
L2P_BACKEND_URL="${L2P_BACKEND_URL:-http://localhost:5000}"
L2P_DB_NAME="${L2P_DB_NAME:-l2p_db}"
DB_USER="${DB_USER:-l2p_user}"
DB_PASSWORD="${DB_PASSWORD:-06752fc9637d5fe896cd88b858d2cf2eff112de5cf4769e69927009f5d45d581}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

# Generate random user credentials
RANDOM_NUM=$RANDOM
TEST_USERNAME="oauthtest${RANDOM_NUM}"
TEST_EMAIL="oauthtest${RANDOM_NUM}@example.com"
TEST_PASSWORD="TestPass123@"

echo "Test Configuration:"
echo "  Auth Service: $AUTH_SERVICE_URL"
echo "  L2P Backend: $L2P_BACKEND_URL"
echo "  Test User: $TEST_USERNAME"
echo "  Test Email: $TEST_EMAIL"
echo ""

# Step 1: Register user in auth service
echo "Step 1: Registering user in auth service..."
REGISTER_RESPONSE=$(curl -s -X POST "$AUTH_SERVICE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"$TEST_USERNAME\",
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\"
  }")

echo "Register Response: $REGISTER_RESPONSE"

# Extract user ID from auth service
AUTH_USER_ID=$(echo "$REGISTER_RESPONSE" | jq -r '.user.id // .user.userId // .data.user.id // .data.user.userId // empty')
if [ -z "$AUTH_USER_ID" ]; then
  echo "❌ Failed to register user in auth service"
  echo "Response: $REGISTER_RESPONSE"
  exit 1
fi

echo "✓ User registered in auth service (userId: $AUTH_USER_ID)"
echo ""

# Step 2: Login to get tokens
echo "Step 2: Logging in to get tokens..."
LOGIN_RESPONSE=$(curl -s -X POST "$AUTH_SERVICE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"usernameOrEmail\": \"$TEST_USERNAME\",
    \"password\": \"$TEST_PASSWORD\"
  }")

echo "Login Response: $LOGIN_RESPONSE"

ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.tokens.accessToken // .data.tokens.accessToken // empty')
REFRESH_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.tokens.refreshToken // .data.tokens.refreshToken // empty')

if [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ Failed to get access token"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✓ Logged in successfully"
echo "  Access Token: ${ACCESS_TOKEN:0:20}..."
echo ""

# Step 3: Check if user exists in l2p database (should NOT exist yet)
echo "Step 3: Checking l2p database (before OAuth exchange)..."
BEFORE_CHECK=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$L2P_DB_NAME" -t -c \
  "SELECT COUNT(*) FROM user_game_profiles WHERE auth_user_id = $AUTH_USER_ID;" 2>&1 || echo "0")

BEFORE_COUNT=$(echo "$BEFORE_CHECK" | tr -d ' ' | head -1)
echo "  Game profiles before OAuth exchange: $BEFORE_COUNT"

if [ "$BEFORE_COUNT" != "0" ]; then
  echo "⚠️  Warning: User already exists in l2p database (expected 0)"
fi
echo ""

# Step 4: Simulate OAuth exchange (this should create the game profile)
echo "Step 4: Simulating OAuth code exchange..."

# First, get OAuth config from l2p backend
OAUTH_CONFIG=$(curl -s "$L2P_BACKEND_URL/api/auth/oauth/config")
echo "OAuth Config: $OAUTH_CONFIG"

# For testing, we'll directly call the exchange endpoint with a simulated code
# In real flow, we'd get this code from the authorization redirect
# Since we already have tokens, we'll use the OAuthService.exchangeCode logic

# Instead, let's test the /oauth/me endpoint which should create the profile
echo ""
echo "Step 5: Testing /auth/oauth/me endpoint..."
ME_RESPONSE=$(curl -s -X GET "$L2P_BACKEND_URL/api/auth/oauth/me" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Me Response: $ME_RESPONSE"

# Check if we got user data back
ME_USER_ID=$(echo "$ME_RESPONSE" | jq -r '.user.userId // empty')
if [ -z "$ME_USER_ID" ]; then
  echo "❌ Failed to get user from /auth/oauth/me"
  echo "Response: $ME_RESPONSE"

  # Check if it's the 501 error (not implemented)
  ERROR_MSG=$(echo "$ME_RESPONSE" | jq -r '.error // empty')
  if [ "$ERROR_MSG" = "OAuth authentication not yet implemented" ]; then
    echo ""
    echo "⚠️  OAuth authentication middleware was not implemented"
    echo "This has been fixed - please restart the backend server"
  fi
  exit 1
fi

echo "✓ Successfully called /auth/oauth/me"
echo ""

# Step 6: Check if user NOW exists in l2p database
echo "Step 6: Verifying database propagation..."
AFTER_CHECK=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$L2P_DB_NAME" -t -c \
  "SELECT COUNT(*) FROM user_game_profiles WHERE auth_user_id = $AUTH_USER_ID;" 2>&1 || echo "0")

AFTER_COUNT=$(echo "$AFTER_CHECK" | tr -d ' ' | head -1)
echo "  Game profiles after OAuth flow: $AFTER_COUNT"

if [ "$AFTER_COUNT" = "0" ]; then
  echo "❌ User game profile was NOT created in l2p database"
  exit 1
fi

echo "✓ Game profile created successfully"
echo ""

# Step 7: Verify game profile data
echo "Step 7: Verifying game profile data..."
PROFILE_DATA=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$L2P_DB_NAME" -t -c \
  "SELECT auth_user_id, selected_character, character_level, experience_points FROM user_game_profiles WHERE auth_user_id = $AUTH_USER_ID;")

echo "  Profile Data: $PROFILE_DATA"

# Parse the profile data
SELECTED_CHAR=$(echo "$PROFILE_DATA" | awk '{print $3}')
CHAR_LEVEL=$(echo "$PROFILE_DATA" | awk '{print $5}')

echo "  Selected Character: $SELECTED_CHAR"
echo "  Character Level: $CHAR_LEVEL"

if [ -z "$SELECTED_CHAR" ]; then
  echo "❌ Failed to retrieve game profile data"
  exit 1
fi

echo "✓ Game profile data verified"
echo ""

# Step 8: Test authenticated API call to verify user can access protected resources
echo "Step 8: Testing authenticated API call..."
CHARACTERS_RESPONSE=$(curl -s -X GET "$L2P_BACKEND_URL/api/characters/profile" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Characters Response: $CHARACTERS_RESPONSE"

CHAR_PROFILE_LEVEL=$(echo "$CHARACTERS_RESPONSE" | jq -r '.data.level // empty')
if [ -z "$CHAR_PROFILE_LEVEL" ]; then
  echo "❌ Failed to access protected resource with OAuth token"
  echo "Response: $CHARACTERS_RESPONSE"
  exit 1
fi

echo "✓ Successfully accessed protected resource"
echo "  Character Level from API: $CHAR_PROFILE_LEVEL"
echo ""

# Cleanup
echo "Step 9: Cleanup..."
echo "  Removing test user from l2p database..."
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$L2P_DB_NAME" -c \
  "DELETE FROM user_game_profiles WHERE auth_user_id = $AUTH_USER_ID;" > /dev/null 2>&1

echo "  Test user removed from l2p database"
echo ""

# Summary
echo "======================================"
echo "✅ All OAuth Flow Tests Passed!"
echo "======================================"
echo ""
echo "Summary:"
echo "  ✓ User registered in auth service"
echo "  ✓ User logged in and received tokens"
echo "  ✓ OAuth /me endpoint accessible"
echo "  ✓ Game profile created in l2p database"
echo "  ✓ Game profile data populated correctly"
echo "  ✓ Protected resources accessible with OAuth token"
echo ""
echo "The OAuth flow and database propagation are working correctly!"
