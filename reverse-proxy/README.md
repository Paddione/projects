# Traefik Reverse Proxy Setup

This directory contains the Traefik v3 reverse proxy configuration for all services in the repository. Traefik uses a pre-issued wildcard TLS certificate and routes traffic to each service.

## Overview

### Services Routed by Traefik

| Service | Domain | Port (Internal) | Description |
| --- | --- | --- | --- |
| L2P Frontend | l2p.korczewski.de | 80 | Learn2Play frontend |
| L2P Backend | l2p.korczewski.de/api | 3001 | Learn2Play API + Socket.io |
| VideoVault | videovault.korczewski.de (alias: video.korczewski.de) | 5000 | Video management app |
| Payment | payment.korczewski.de | 3000 | Payment service |
| Auth | auth.korczewski.de | 5500 | Unified authentication service |
| Traefik | traefik.korczewski.de | 8080 | Traefik dashboard |

### Network Architecture

All services connect to the `traefik-public` Docker network, allowing Traefik to route traffic to them. Each service also maintains its own internal network for database connectivity.

```
Internet -> Traefik (443) -> traefik-public network -> Services
                                                 |
                                                 -> Internal networks
```

## Prerequisites

1. Docker and Docker Compose installed
2. DNS records configured for:
   - traefik.korczewski.de
   - l2p.korczewski.de
   - videovault.korczewski.de
   - video.korczewski.de
   - payment.korczewski.de
   - auth.korczewski.de
3. Ports 80 and 443 open on your firewall
4. Wildcard certificate issued for `korczewski.de` and `*.korczewski.de`

## Quick Start

### One-time setup

```bash
cd reverse-proxy
./scripts/setup.sh
```

This script will:
- Create required Docker networks
- Create necessary directories (`logs`, `config/dynamic`)
- Generate dashboard password hash
- Check DNS configuration

### Environment Configuration (Production)

```bash
cd reverse-proxy
cp .env.example .env-prod
```

Required values:
- `TRAEFIK_DASHBOARD_PASSWORD_HASH` (generate via `htpasswd`, use the hash after the colon)

### Start services

Option 1: Start everything in order
```bash
cd reverse-proxy
./scripts/start-all.sh
```

Option 2: Start services individually
```bash
# 1) Traefik
cd reverse-proxy
docker-compose --env-file .env-prod up -d

# 2) Auth
cd ../auth
docker-compose up -d

# 3) L2P (production)
cd ../l2p
docker-compose --profile production up -d

# 4) VideoVault
cd ../VideoVault
docker-compose up -d videovault-dev

# 5) Payment
cd ../payment
docker-compose up -d
```

### Stop services

```bash
cd reverse-proxy
./scripts/stop-all.sh
```

## Access Your Services

- Traefik Dashboard: https://traefik.korczewski.de
- L2P: https://l2p.korczewski.de
- VideoVault: https://videovault.korczewski.de (alias: https://video.korczewski.de)
- Payment: https://payment.korczewski.de
- Auth: https://auth.korczewski.de

## Verification

### Traefik Dashboard

Visit https://traefik.korczewski.de and log in with your dashboard credentials. All services should appear under HTTP Routers and Services.

### Certificate Check

```bash
openssl x509 -in /etc/ssl/korczewski.de/cert.pem -noout -dates
```

## Configuration Details

### TLS Certificates

- Issued via `acme.sh` with DNS-01 (IPv64)
- Installed on the host at `/etc/ssl/korczewski.de`
- Loaded by Traefik via `config/dynamic/tls.yml`

### SSL/TLS

- HTTP traffic redirects to HTTPS
- Certificates renewed by `acme.sh` cron
- Renewals reload Traefik via the `acme.sh` deploy hook

### Security Headers

The `default-chain@file` middleware applies:
- X-Frame-Options: SAMEORIGIN
- X-Content-Type-Options: nosniff
- Strict-Transport-Security (HSTS)
- X-XSS-Protection

### Logging

Traefik logs are stored in `./logs/`:
- `traefik.log`
- `access.log`

## Maintenance

### View logs

```bash
# Traefik logs
docker-compose --env-file .env-prod logs -f traefik

# Individual service logs
cd /path/to/service
docker-compose logs -f service-name
```

### Restart Traefik

```bash
docker-compose --env-file .env-prod restart traefik
```

### Update Traefik

```bash
docker-compose --env-file .env-prod pull traefik
docker-compose --env-file .env-prod up -d traefik
```

### Reload configuration

Traefik auto-reloads when:
- Docker labels change on containers
- Files in `config/dynamic/` are modified

## Troubleshooting

### Service not accessible

1. Check if service is running: `docker ps | grep service-name`
2. Check if service is on `traefik-public` network:
   ```bash
   docker network inspect traefik-public
   ```
3. Check Traefik dashboard for router/service status
4. Check service logs: `docker logs service-name`

### Certificate issues

1. Verify DNS records and firewall ports (80/443)
2. Check Traefik logs: `docker logs traefik`
3. Wait for DNS-01 propagation if a new cert is being issued

### Regenerate certificates

```bash
sudo -H /root/.acme.sh/acme.sh --issue --dns dns_ipv64 --dnssleep 120 -d korczewski.de -d "*.korczewski.de"
```

### Dashboard not accessible

1. Verify the password hash format in `.env-prod`
2. Check Traefik logs for auth errors
3. Temporarily remove dashboard middleware to debug

## Advanced Configuration

### Add a new service

1. Add labels in the service `docker-compose.yml`:

```yaml
services:
  myservice:
    image: myimage
    networks:
      - traefik-public
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=traefik-public"
      - "traefik.http.routers.myservice.rule=Host(`myservice.korczewski.de`)"
      - "traefik.http.routers.myservice.entrypoints=websecure"
      - "traefik.http.routers.myservice.tls=true"
      - "traefik.http.services.myservice.loadbalancer.server.port=8080"
```

2. Start your service:

```bash
docker-compose up -d
```

### Custom middlewares

Define in `config/dynamic/middlewares.yml` and reference with `@file`.

### Wildcard certificates

The wildcard cert is managed by `acme.sh` and deployed to `/etc/ssl/korczewski.de`.

## Backup

Important files to backup:
- `./config/`
- `docker-compose.yml`

```bash
tar -czf traefik-backup-$(date +%Y%m%d).tar.gz config/ docker-compose.yml
```

## Security Best Practices

1. Change the dashboard password from default
2. Restrict dashboard access by IP if possible
3. Monitor logs for suspicious activity
4. Keep Traefik updated
5. Use strong passwords and secrets
6. Enable rate limiting for public services

## Additional Resources

- Traefik documentation: https://doc.traefik.io/traefik/
- acme.sh documentation: https://github.com/acmesh-official/acme.sh
- Docker network documentation: https://docs.docker.com/network/
