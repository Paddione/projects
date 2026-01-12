# Service Deployment Guide

## Overview
This document defines the **single source of truth** for deploying all services in the infrastructure. Each service has **exactly one** production environment and **exactly one** development environment.

## Environment Philosophy
- **Production**: One production deployment per service, accessible via `*.korczewski.de`
- **Development**: One development environment per service, typically running locally or via Docker profiles
- **No Duplicates**: Each service has a single, well-defined deployment path for each environment

---

## Infrastructure Services

### 1. Traefik Reverse Proxy
**Purpose**: SSL termination, routing, load balancing

**Production**:
```bash
cd /home/patrick/projects/reverse-proxy
docker compose up -d
```
- **URL**: https://traefik.korczewski.de
- **Container**: `traefik`
- **Project**: `shared`
- **Environment**: `infrastructure`

**Development**: N/A (infrastructure service, production only)

---

### 2. Shared PostgreSQL
**Purpose**: Centralized database for auth, l2p, payment, videovault

**Production**:
```bash
cd /home/patrick/projects/shared-infrastructure
docker compose up -d
```
- **Container**: `shared-postgres`
- **Port**: `5432`
- **Project**: `shared`
- **Environment**: `infrastructure`
- **Databases**: `auth_db`, `l2p_db`, `payment_db`, `videovault_db`

**Development**: N/A (shared infrastructure, production only)

---

## Application Services

### 3. Auth Service
**Purpose**: Central authentication and OAuth provider

**Production**:
```bash
cd /home/patrick/projects/auth
docker compose up -d
```
- **URL**: https://auth.korczewski.de
- **Container**: `auth-service`
- **Port**: `5500`
- **Project**: `auth`
- **Environment**: `production`
- **Database**: `auth_db` (on shared-postgres)

**Development**:
```bash
cd /home/patrick/projects/auth
npm install
npm run dev
```
- **Port**: `5500`
- **Database**: `auth_db` (on shared-postgres)
- **Hot Reload**: Yes

---

### 4. L2P (Learn2Play)
**Purpose**: AI-powered learning platform for gaming

**Production**:
```bash
cd /home/patrick/projects/l2p
docker compose --profile production up -d
```
- **URL**: https://l2p.korczewski.de
- **Containers**: 
  - `l2p-app` (frontend)
  - `l2p-api` (backend)
- **Project**: `l2p`
- **Environment**: `production`
- **Database**: `l2p_db` (on shared-postgres)
- **Profile**: `production`

**Development**:
```bash
cd /home/patrick/projects/l2p
docker compose --profile development up -d
```
- **Containers**:
  - `l2p-frontend-dev` (port 3000)
  - `l2p-backend-dev` (port 3001)
- **Profile**: `development`
- **Hot Reload**: Yes (via Docker volumes)
- **Database**: `l2p_db` (on shared-postgres)

---

### 5. Payment Service
**Purpose**: Subscription and payment processing with Stripe

**Production**:
```bash
cd /home/patrick/projects/payment
docker compose up -d
```
- **URL**: https://payment.korczewski.de
- **Container**: `web`
- **Port**: `3000` (internal)
- **Project**: `payment`
- **Environment**: `production`
- **Database**: `payment_db` (on shared-postgres)

**Development**:
```bash
cd /home/patrick/projects/payment
npm install
npm run dev
```
- **Port**: `3004`
- **Database**: `payment_db` (on shared-postgres)
- **Hot Reload**: Yes

---

### 6. VideoVault
**Purpose**: AI-powered media management and transcription

**Production**:
```bash
cd /home/patrick/projects/VideoVault
docker compose up videovault -d
```
- **URL**: https://videovault.korczewski.de
- **Container**: `videovault`
- **Port**: `5100` (internal)
- **Project**: `videovault`
- **Environment**: `production`
- **Database**: `videovault_db` (on shared-postgres)
- **Service**: `videovault`

**Development**:
```bash
cd /home/patrick/projects/VideoVault
docker compose up videovault-dev -d
```
- **Container**: `videovault-dev`
- **Port**: `5100`
- **Service**: `videovault-dev`
- **Hot Reload**: Yes (via Docker volumes)
- **Database**: `videovault_db` (on shared-postgres)

---

## AI/ML Services

### 7. vLLM RAG Stack
**Purpose**: AI inference, embeddings, vector search, chat interface

**Production**:
```bash
cd /home/patrick/projects/vllm/rag
docker compose up -d
```
- **Project**: `vllm`
- **Environment**: `production`
- **Containers**:
  - `vllm-rag` - LLM inference (port 4100)
  - `open-webui-rag` - Chat interface (https://vllm.korczewski.de)
  - `qdrant-rag` - Vector database (port 6333)
  - `infinity-embeddings` - Embedding service (port 7997)
  - `postgres-rag` - WebUI database (port 5438)
  - `rag-ingest-engine` - Document processing
  - `vllm-dashboard` - Control panel (https://dashboard.korczewski.de)

**Development**:
```bash
cd /home/patrick/projects/vllm
docker compose -f docker-compose.dev.yml up -d
```
- **Containers**: Infrastructure only (qdrant, infinity, postgres)
- **Run locally**: vLLM, Open WebUI, Dashboard (for hot reload)
- **Note**: See `vllm/docker-compose.dev.yml` for details

---

## Deployment Order

### Initial Setup (First Time)
```bash
# 1. Start infrastructure
cd /home/patrick/projects/reverse-proxy && docker compose up -d
cd /home/patrick/projects/shared-infrastructure && docker compose up -d

# 2. Start core services
cd /home/patrick/projects/auth && docker compose up -d
cd /home/patrick/projects/vllm/rag && docker compose up -d

# 3. Start application services
cd /home/patrick/projects/l2p && docker compose --profile production up -d
cd /home/patrick/projects/payment && docker compose up -d
cd /home/patrick/projects/VideoVault && docker compose up videovault -d
```

### Production Restart
```bash
# Restart all production services
cd /home/patrick/projects && ./scripts/restart-production.sh
```

### Development Environment
```bash
# Start development infrastructure
cd /home/patrick/projects/shared-infrastructure && docker compose up -d
cd /home/patrick/projects/reverse-proxy && docker compose up -d

# Start development services
cd /home/patrick/projects/l2p && docker compose --profile development up -d
cd /home/patrick/projects/VideoVault && docker compose up videovault-dev -d

# Or run locally with hot reload
cd /home/patrick/projects/auth && npm run dev
cd /home/patrick/projects/payment && npm run dev
```

---

## Service Matrix

| Service | Production Container(s) | Dev Container(s) | Production URL | Dev Port |
|---------|------------------------|------------------|----------------|----------|
| **Traefik** | `traefik` | N/A | https://traefik.korczewski.de | N/A |
| **Shared Postgres** | `shared-postgres` | N/A | localhost:5432 | N/A |
| **Auth** | `auth-service` | N/A (npm) | https://auth.korczewski.de | 5500 |
| **L2P** | `l2p-app`, `l2p-api` | `l2p-frontend-dev`, `l2p-backend-dev` | https://l2p.korczewski.de | 3000, 3001 |
| **Payment** | `web` | N/A (npm) | https://payment.korczewski.de | 3004 |
| **VideoVault** | `videovault` | `videovault-dev` | https://videovault.korczewski.de | 5100 |
| **vLLM** | `vllm-rag` | N/A (local) | N/A | 4100 |
| **Open WebUI** | `open-webui-rag` | N/A (local) | https://vllm.korczewski.de | 3005 |
| **Dashboard** | `vllm-dashboard` | N/A (npm) | https://dashboard.korczewski.de | 4242 |
| **Qdrant** | `qdrant-rag` | `qdrant-dev` | N/A | 6333 |
| **Infinity** | `infinity-embeddings` | `infinity-dev` | N/A | 7997 |
| **Postgres (WebUI)** | `postgres-rag` | `postgres-dev` | N/A | 5438 |
| **Ingest Engine** | `rag-ingest-engine` | N/A | N/A | N/A |

---

## Environment Variables

All services use the centralized `.env` file at `/home/patrick/projects/.env`.

### Key Variables:
- `NODE_ENV`: `production` or `development`
- `*_PORT`: Service-specific ports
- `*_DATABASE_URL`: Database connection strings
- `AUTH_SERVICE_URL`: https://auth.korczewski.de
- `COOKIE_DOMAIN`: .korczewski.de

---

## Health Checks

### Check All Services
```bash
# Via Dashboard
curl https://dashboard.korczewski.de/api/services

# Via Docker
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Via Script
cd /home/patrick/projects && ./scripts/health-check.sh
```

### Individual Service Health
```bash
# Auth
curl https://auth.korczewski.de/health

# L2P
curl https://l2p.korczewski.de/api/health

# Payment
curl https://payment.korczewski.de/api/health

# VideoVault
curl https://videovault.korczewski.de/api/health

# vLLM
curl http://localhost:4100/health

# Open WebUI
curl https://vllm.korczewski.de/health
```

---

## Troubleshooting

### Service Won't Start
```bash
# Check logs
docker compose logs [service-name]

# Check if port is in use
lsof -i :[port]

# Check database connection
docker exec shared-postgres psql -U postgres -l
```

### Database Issues
```bash
# Connect to shared postgres
docker exec -it shared-postgres psql -U postgres

# List databases
\l

# Connect to specific database
\c auth_db

# Check tables
\dt
```

### Network Issues
```bash
# Check Traefik routing
docker logs traefik

# Check network connectivity
docker network ls
docker network inspect traefik-public
```

---

## Backup and Restore

### Database Backup
```bash
# Backup all databases
docker exec shared-postgres pg_dumpall -U postgres > backup_$(date +%Y%m%d).sql

# Backup specific database
docker exec shared-postgres pg_dump -U postgres auth_db > auth_db_backup.sql
```

### Restore Database
```bash
# Restore all databases
docker exec -i shared-postgres psql -U postgres < backup_20260112.sql

# Restore specific database
docker exec -i shared-postgres psql -U postgres auth_db < auth_db_backup.sql
```

---

## Notes

1. **Single Source of Truth**: This document is the authoritative guide for all deployments
2. **No Duplicate Environments**: Each service has exactly one production and one development environment
3. **Centralized Configuration**: All services use `/home/patrick/projects/.env`
4. **Shared Infrastructure**: Traefik and PostgreSQL are shared across all services
5. **Docker Profiles**: L2P and VideoVault use profiles to separate production/development
6. **Dashboard Integration**: The vLLM dashboard at https://dashboard.korczewski.de manages all services

---

## Quick Reference

```bash
# Start everything (production)
cd /home/patrick/projects && ./scripts/start-all-production.sh

# Stop everything
cd /home/patrick/projects && ./scripts/stop-all.sh

# View all running containers
docker ps

# View all services status
curl https://dashboard.korczewski.de/api/services

# Restart a specific service
cd /home/patrick/projects/[service] && docker compose restart

# View logs
docker compose logs -f [service-name]
```
