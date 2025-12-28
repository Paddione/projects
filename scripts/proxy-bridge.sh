#!/bin/bash

# Configuration
REMOTE_HOST="10.0.0.46"
REMOTE_USER="patrick"
REMOTE_PATH="/home/patrick/nginxproxymanager/data/appdata"
LOCAL_PATH="/home/patrick/projects/reverse-proxy"

# Ensure local path exists
mkdir -p "$LOCAL_PATH"

function usage() {
    echo "Usage: $0 {pull|push|reload|mount}"
    exit 1
}

function pull() {
    echo "Pulling configurations from $REMOTE_HOST..."
    rsync -azP --delete "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/" "$LOCAL_PATH/"
}

function push() {
    echo "Pushing configuration changes to $REMOTE_HOST..."
    rsync -azP "$LOCAL_PATH/" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/"
}

function reload() {
    echo "Reloading Nginx Proxy Manager on $REMOTE_HOST..."
    ssh "$REMOTE_USER@$REMOTE_HOST" "docker exec nginx-proxy-manager nginx -s reload"
}

function mount_sshfs() {
    echo "Mounting remote path $REMOTE_PATH via SSHFS..."
    # Check if already mounted
    if mountpoint -q "$LOCAL_PATH"; then
        echo "Already mounted at $LOCAL_PATH"
    else
        sshfs "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH" "$LOCAL_PATH"
        echo "Mounted successfully at $LOCAL_PATH"
    fi
}

case "$1" in
    pull) pull ;;
    push) push ;;
    reload) reload ;;
    mount) mount_sshfs ;;
    *) usage ;;
esac
