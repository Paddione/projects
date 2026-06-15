#!/bin/bash
# =============================================================================
# Branch Protection Setup
# =============================================================================
# Configures required status checks on the master branch.
# Uses GitHub CLI — ensure GH_TOKEN is set.
#
# Usage: ./scripts/branch-protition.sh [--dry-run]
# =============================================================================

set -euo pipefail

DRY_RUN=false
for arg in "$@"; do
  case $arg in
    --dry-run) DRY_RUN=true ;;
  esac
done

REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner' 2>/dev/null || echo "")

if [ -z "$REPO" ]; then
  echo "Error: Not a GitHub repository or gh not authenticated."
  exit 1
fi

echo "Configuring branch protection for $REPO:master"

CHECKS=(
  "ci-status"
  "commitlint"
  "secrets-scan"
  "semgrep"
  "trivy"
)

if [ "$DRY_RUN" = true ]; then
  echo "Dry-run mode. Would set these checks as required:"
  for check in "${CHECKS[@]}"; do
    echo "  - $check"
  done
  exit 0
fi

gh api "repos/$REPO/branches/master/protection" \
  --method PUT \
  --silent \
  --field "required_status_checks[strict]=true" \
  --field "required_status_checks[contexts][]" "${CHECKS[@]}" \
  --field "enforce_admins=true" \
  --field "required_pull_request_reviews[required_approving_review_count]=1" \
  --field "required_pull_request_reviews[dismiss_stale_reviews]=true" \
  --field "restrictions=null" \
  2>/dev/null || {
    echo "Warning: Could not set branch protection. Ensure GH_TOKEN has admin:repo_hook scope."
    echo "You may need to configure manually in repository settings."
    exit 0
  }

echo "Branch protection enabled with ${#CHECKS[@]} required checks."
echo ""
echo "Manual verification:"
echo "  gh api repos/$REPO/branches/master/protection --jq '.required_status_checks.contexts'"
