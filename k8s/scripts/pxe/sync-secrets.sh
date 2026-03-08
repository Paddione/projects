#!/bin/bash
# =============================================================================
# Sync k8s secrets and deploy key to the PXE server.
# Run from dev machine (where secrets are generated).
# =============================================================================
set -euo pipefail

PXE_HOST="patrick@10.10.0.4"
PXE_SECRETS="/srv/pxe/http/secrets"
PXE_KEYS="/srv/pxe/http/keys"
LOCAL_SECRETS="/home/patrick/projects/k8s/secrets"
ENV_FILE="/home/patrick/projects/.env"

echo "=== Syncing secrets to PXE server ==="

if [ ! -d "${LOCAL_SECRETS}" ]; then
    echo "ERROR: ${LOCAL_SECRETS} not found. Run generate-secrets.sh first."
    exit 1
fi

# Sync secret YAMLs
rsync -av --delete "${LOCAL_SECRETS}/" "${PXE_HOST}:${PXE_SECRETS}/"

# Write SMB password as a standalone file (used by storage-setup.sh on new nodes)
if [ -f "${ENV_FILE}" ]; then
    SMB_PASS=$(grep "^SMB_PASSWORD=" "${ENV_FILE}" | cut -d= -f2-)
    echo "${SMB_PASS}" | ssh "${PXE_HOST}" "cat > ${PXE_SECRETS}/smb-password.txt"
    echo "SMB password synced"
else
    echo "WARN: ${ENV_FILE} not found, skipping SMB password"
fi

echo "=== Syncing deploy key ==="

DEPLOY_KEY="/home/patrick/.ssh/github_deploy_key"
if [ ! -f "${DEPLOY_KEY}" ]; then
    echo "No deploy key found at ${DEPLOY_KEY}"
    echo "Generate one with:"
    echo "  ssh-keygen -t ed25519 -f ${DEPLOY_KEY} -N '' -C 'deploy@korczewski.de'"
    echo "Then add the public key as a read-only deploy key at:"
    echo "  https://github.com/Paddione/projects/settings/keys"
    exit 1
fi

scp "${DEPLOY_KEY}" "${PXE_HOST}:${PXE_KEYS}/deploy_key"
ssh "${PXE_HOST}" "chmod 644 ${PXE_KEYS}/deploy_key"

echo "=== Done ==="
echo "Secrets: $(ssh ${PXE_HOST} "ls ${PXE_SECRETS}" | wc -l) files"
echo "Deploy key: synced"
