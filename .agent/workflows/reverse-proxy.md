---
description: Manage and Configure Reverse Proxy (Nginx Proxy Manager)
---

This workflow explains how to manage the Nginx Proxy Manager configuration located on the remote host `10.0.0.46`.

## Setup
The configuration is bridged to the local directory `/home/patrick/projects/reverse-proxy`.

## Commands
A helper script is provided at `scripts/proxy-bridge.sh`.

### 1. Synchronize Configs
Always pull the latest state before making changes:
// turbo
```bash
./scripts/proxy-bridge.sh pull
```

### 2. Apply Changes
After editing files in `reverse-proxy/`, push them to the remote host:
// turbo
```bash
./scripts/proxy-bridge.sh push
```

### 3. Reload Nginx
Trigger a reload to apply the new configuration without downtime:
// turbo
```bash
./scripts/proxy-bridge.sh reload
```

### 4. Interactive Mounting (Optional)
If you prefer a live mount:
// turbo
```bash
./scripts/proxy-bridge.sh mount
```

## Directory Structure
- `reverse-proxy/nginx/proxy_host/`: Contains the specific proxy host listener configurations.
- `reverse-proxy/logs/`: Remote logs (if synced).
