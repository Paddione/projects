#!/usr/bin/env bash
set -e

CHANGED=$(git diff --name-only HEAD origin/master 2>/dev/null || git diff --name-only HEAD HEAD~1 2>/dev/null || true)
if [ -z "$CHANGED" ]; then
  echo "No changes detected — running all tests"
  npm run test:all:legacy
  exit 0
fi

RUN_L2P=false; RUN_AUTH=false; RUN_SHOP=false; RUN_VV=false
RUN_SOS=false; RUN_ARENA=false; RUN_ASSETGEN=false

echo "$CHANGED" | grep -qE "^l2p/"          && RUN_L2P=true
echo "$CHANGED" | grep -qE "^auth/"         && RUN_AUTH=true
echo "$CHANGED" | grep -qE "^shop/"         && RUN_SHOP=true
echo "$CHANGED" | grep -qE "^VideoVault/"   && RUN_VV=true
echo "$CHANGED" | grep -qE "^SOS/"          && RUN_SOS=true
echo "$CHANGED" | grep -qE "^arena/"        && RUN_ARENA=true
echo "$CHANGED" | grep -qE "^Assetgenerator/" && RUN_ASSETGEN=true

FAIL=0

if [ "$RUN_L2P" = "true" ]; then
  echo "→ l2p changed: running tests"
  npm --prefix l2p run test:unit || { echo "✗ l2p tests failed"; FAIL=1; }
fi

if [ "$RUN_AUTH" = "true" ]; then
  echo "→ auth changed: running tests"
  npm --prefix auth test || { echo "✗ auth tests failed"; FAIL=1; }
fi

if [ "$RUN_SHOP" = "true" ]; then
  echo "→ shop changed: running tests"
  npm --prefix shop test || { echo "✗ shop tests failed"; FAIL=1; }
fi

if [ "$RUN_VV" = "true" ]; then
  echo "→ VideoVault changed: running tests"
  npm --prefix VideoVault test || { echo "✗ VideoVault tests failed"; FAIL=1; }
fi

if [ "$RUN_SOS" = "true" ]; then
  echo "→ SOS changed: running tests"
  npm --prefix SOS test || { echo "✗ SOS tests failed"; FAIL=1; }
fi

if [ "$RUN_ARENA" = "true" ]; then
  echo "→ arena changed: running tests"
  npm --prefix arena test || { echo "✗ arena tests failed"; FAIL=1; }
fi

if [ "$RUN_ASSETGEN" = "true" ]; then
  echo "→ Assetgenerator changed: running tests"
  npm --prefix Assetgenerator test || { echo "✗ Assetgenerator tests failed"; FAIL=1; }
fi

if [ "$FAIL" = "1" ]; then
  echo "Some tests failed"
  exit 1
fi

echo "✓ All changed-service tests passed"
