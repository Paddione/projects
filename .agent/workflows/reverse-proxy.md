---
description: Manage and Configure Reverse Proxy (Traefik)
---

This workflow explains how to manage the Traefik reverse proxy configuration.

## Overview
Traefik is now the primary reverse proxy, replacing Nginx Proxy Manager.

### Architecture
- **Traefik**: Running as Docker container on ports 80, 443, 8080
- **Docker Provider**: Auto-discovers services with Traefik labels
- **File Provider**: Static configuration for local services (fallback)
- **Location**: `/home/patrick/projects/reverse-proxy`

## Configuration Files

### Static Configuration
- `docker-compose.yml`: Traefik container configuration
- `.env`: Environment variables (credentials, email)

### Dynamic Configuration
Located in `config/dynamic/`:
- `auth.yml`: Auth service routing (legacy, can be removed)
- `middlewares.yml`: Security headers, rate limiting, etc.
- `tls.yml`: TLS/SSL configuration
- `local-services.yml`: Fallback routes for local services

## Managing Traefik

### 1. View Logs
```bash
docker logs traefik --tail 50
```

### 2. Restart Traefik
```bash
cd /home/patrick/projects/reverse-proxy
docker compose restart
```

### 3. Rebuild Traefik
```bash
cd /home/patrick/projects/reverse-proxy
docker compose up -d --force-recreate
```

### 4. Access Dashboard
Open browser to: `https://traefik.korczewski.de`
(Requires authentication - credentials in `.env`)

## Adding New Services

### Option 1: Docker Service (Recommended)
Add Traefik labels to your docker-compose.yml:

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.myservice.rule=Host(`myservice.korczewski.de`)"
  - "traefik.http.routers.myservice.entrypoints=websecure"
  - "traefik.http.routers.myservice.tls=true"
  - "traefik.http.services.myservice.loadbalancer.server.port=8080"
```

### Option 2: Local Service (Fallback)
Edit `config/dynamic/local-services.yml` and add:

```yaml
http:
  routers:
    myservice-local:
      rule: "Host(`myservice.korczewski.de`)"
      entryPoints:
        - websecure
      service: myservice-local
      tls: true
      priority: 5
  
  services:
    myservice-local:
      loadBalancer:
        servers:
          - url: "http://172.17.0.1:8080"
```

## Port Forwarding
For external access, ensure your router forwards:
- Port 80 → 10.10.0.3:80
- Port 443 → 10.10.0.3:443

## Troubleshooting

### Check if Traefik is running
```bash
docker ps | grep traefik
```

### View routing configuration
```bash
curl http://localhost:8080/api/http/routers | jq
```

### Test service locally
```bash
curl -H "Host: myservice.korczewski.de" http://localhost/
```

## Migration Notes
- ✅ Migrated from Nginx Proxy Manager (10.0.0.46) to Traefik
- ✅ All services now use Traefik for routing
- ✅ Hybrid setup: Docker containers + local services supported
