#!/bin/bash
#
# Cleanup All Test Data
#
# Scours all services in the monorepo for test data and removes it.
# Can be run after E2E tests or as part of CI/CD pipelines.
#
# Usage:
#   ./scripts/cleanup-all-test-data.sh [options]
#
# Options:
#   --dry-run     Show what would be deleted without deleting
#   --verbose     Show detailed output
#   --auth        Clean only auth service test data
#   --l2p         Clean only l2p service test data
#   --shop        Clean only shop service test data
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Parse arguments
DRY_RUN=""
VERBOSE=""
CLEAN_AUTH=true
CLEAN_L2P=true
CLEAN_SHOP=true

for arg in "$@"; do
  case $arg in
    --dry-run)
      DRY_RUN="--dry-run"
      ;;
    --verbose)
      VERBOSE="--verbose"
      ;;
    --auth)
      CLEAN_AUTH=true
      CLEAN_L2P=false
      CLEAN_SHOP=false
      ;;
    --l2p)
      CLEAN_AUTH=false
      CLEAN_L2P=true
      CLEAN_SHOP=false
      ;;
    --shop)
      CLEAN_AUTH=false
      CLEAN_L2P=false
      CLEAN_SHOP=true
      ;;
  esac
done

echo "========================================"
echo "  Monorepo Test Data Cleanup"
echo "========================================"
echo ""

if [ -n "$DRY_RUN" ]; then
  echo "  MODE: Dry Run (no changes will be made)"
  echo ""
fi

# Auth service cleanup
if [ "$CLEAN_AUTH" = true ]; then
  echo "----------------------------------------"
  echo "  Auth Service"
  echo "----------------------------------------"
  if [ -f "$PROJECT_ROOT/auth/scripts/cleanup-test-data.ts" ]; then
    cd "$PROJECT_ROOT/auth"
    npx tsx scripts/cleanup-test-data.ts $DRY_RUN $VERBOSE
  else
    echo "  Cleanup script not found, skipping..."
  fi
  echo ""
fi

# L2P service cleanup
if [ "$CLEAN_L2P" = true ]; then
  echo "----------------------------------------"
  echo "  L2P Service"
  echo "----------------------------------------"
  if [ -f "$PROJECT_ROOT/l2p/backend/scripts/cleanup-test-data.ts" ]; then
    cd "$PROJECT_ROOT/l2p/backend"
    npx tsx scripts/cleanup-test-data.ts $DRY_RUN $VERBOSE
  else
    echo "  Cleanup script not found, skipping..."
  fi
  echo ""
fi

# Shop service cleanup
if [ "$CLEAN_SHOP" = true ]; then
  echo "----------------------------------------"
  echo "  Shop Service"
  echo "----------------------------------------"
  if [ -f "$PROJECT_ROOT/shop/scripts/cleanup-test-data.ts" ]; then
    cd "$PROJECT_ROOT/shop"
    npx tsx scripts/cleanup-test-data.ts $DRY_RUN $VERBOSE
  else
    echo "  Cleanup script not found, skipping..."
  fi
  echo ""
fi

# Direct database cleanup for any remaining test data
echo "----------------------------------------"
echo "  Direct Database Cleanup"
echo "----------------------------------------"

# Check if we can access the database
if command -v psql &> /dev/null; then
  echo "  psql available, checking for test data patterns..."
elif kubectl get pods -n korczewski-infra postgres-0 &> /dev/null; then
  echo "  Using kubectl to access PostgreSQL..."

  if [ -z "$DRY_RUN" ]; then
    # Get postgres password
    PG_PASS=$(kubectl get secret -n korczewski-infra postgres-credentials -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d)

    # Clean test users from auth_db
    echo "  Cleaning test users from auth_db..."
    kubectl exec -n korczewski-infra postgres-0 -- bash -c "PGPASSWORD=$PG_PASS psql -U postgres -d auth_db -c \"
      -- First update reviewed_by to NULL for test users
      UPDATE auth.access_requests SET reviewed_by = NULL
      WHERE reviewed_by IN (SELECT id FROM auth.users WHERE username LIKE 'test_%' OR email LIKE 'test_%' OR email LIKE '%@test.local');

      -- Delete related data
      DELETE FROM auth.access_requests WHERE user_id IN (SELECT id FROM auth.users WHERE username LIKE 'test_%' OR email LIKE 'test_%' OR email LIKE '%@test.local');
      DELETE FROM auth.user_app_access WHERE user_id IN (SELECT id FROM auth.users WHERE username LIKE 'test_%' OR email LIKE 'test_%' OR email LIKE '%@test.local');
      DELETE FROM auth.sessions WHERE user_id IN (SELECT id FROM auth.users WHERE username LIKE 'test_%' OR email LIKE 'test_%' OR email LIKE '%@test.local');
      DELETE FROM auth.oauth_accounts WHERE user_id IN (SELECT id FROM auth.users WHERE username LIKE 'test_%' OR email LIKE 'test_%' OR email LIKE '%@test.local');

      -- Delete test users
      DELETE FROM auth.users WHERE username LIKE 'test_%' OR email LIKE 'test_%' OR email LIKE '%@test.local';

      -- Clean expired tokens
      DELETE FROM auth.token_blacklist WHERE expires_at < NOW();
      DELETE FROM auth.sessions WHERE expires < NOW();
      DELETE FROM auth.verification_tokens WHERE expires < NOW();
    \"" 2>&1 | grep -v "^Defaulted container"

    # Clean test data from l2p_db if it exists
    echo "  Cleaning test data from l2p_db..."
    kubectl exec -n korczewski-infra postgres-0 -- bash -c "PGPASSWORD=$PG_PASS psql -U postgres -d l2p_db -c \"
      DELETE FROM users WHERE username LIKE 'test_%' OR email LIKE 'test_%' OR email LIKE '%@test.local';
    \"" 2>&1 | grep -v "^Defaulted container" || echo "  l2p_db cleanup skipped (table may not exist)"

    # Clean test data from shop_db if it exists
    echo "  Cleaning test data from shop_db..."
    kubectl exec -n korczewski-infra postgres-0 -- bash -c "PGPASSWORD=$PG_PASS psql -U postgres -d shop_db -c \"
      DELETE FROM users WHERE email LIKE 'test_%' OR email LIKE '%@test.local';
    \"" 2>&1 | grep -v "^Defaulted container" || echo "  shop_db cleanup skipped (table may not exist)"

  else
    echo "  [Dry Run] Would clean test data from databases"
  fi
else
  echo "  No database access available, skipping direct cleanup"
fi

echo ""
echo "========================================"
echo "  Cleanup Complete"
echo "========================================"
