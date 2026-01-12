# Deployment Architecture

Complete guide to deploying the monorepo stack in development and production environments.

## Deployment Overview

```mermaid
graph TB
    subgraph "Infrastructure Layer"
        DNS[DNS<br/>korczewski.de]
        Traefik[Traefik<br/>Reverse Proxy<br/>:80/:443]
    end

    subgraph "Application Layer"
        L2P_FE[L2P Frontend<br/>:3007]
        L2P_BE[L2P Backend<br/>:3008]
        Payment[Payment<br/>:3005]
        Auth[Auth<br/>:5501]
        VV[VideoVault<br/>:5001]
    end

    subgraph "Data Layer"
        Postgres[(Shared Postgres<br/>:5432)]
    end

    subgraph "External Services"
        Stripe[Stripe]
        OAuth[Google OAuth]
    end

    DNS --> Traefik

    Traefik -->|l2p.korczewski.de| L2P_FE
    Traefik -->|api.l2p.korczewski.de| L2P_BE
    Traefik -->|payment.korczewski.de| Payment
    Traefik -->|auth.korczewski.de| Auth
    Traefik -->|vault.korczewski.de| VV

    L2P_FE --> L2P_BE
    L2P_BE --> Postgres
    L2P_BE --> Auth

    Payment --> Postgres
    Payment --> Auth
    Payment --> Stripe

    Auth --> Postgres
    Auth --> OAuth

    VV --> Postgres

    style DNS fill:#e1f5ff
    style Traefik fill:#ffe1e1
    style Postgres fill:#e1f5ff
```

## Environment Comparison

| Aspect | Development | Production |
|--------|-------------|------------|
| **Domain** | localhost | korczewski.de |
| **HTTPS** | No (HTTP only) | Yes (TLS via Traefik) |
| **Env File** | `.env-dev` | `.env-prod` |
| **Builds** | Hot reload | Optimized builds |
| **Source Maps** | Enabled | Disabled |
| **Logging** | Verbose | Error only |
| **Database** | Separate test DB :5433 | Production :5432 |
| **Secrets** | Local only | Secure vault |

## Development Deployment

### Quick Start All Services

```bash
# From repository root
./scripts/start-all-services.sh
```

This starts:
1. Shared infrastructure (Postgres)
2. Auth service
3. L2P backend & frontend
4. Payment service
5. VideoVault
6. Reverse proxy

### Manual Service Start

```mermaid
flowchart TB
    A[1. Start Shared Infrastructure] --> B[2. Start Auth Service]
    B --> C[3. Start Application Services]

    C --> D[L2P Backend]
    C --> E[Payment]
    C --> F[VideoVault]

    D --> G[L2P Frontend]

    style A fill:#ffe1e1
    style B fill:#fff4e1
    style C fill:#e1ffe1
```

```bash
# 1. Shared infrastructure (MUST START FIRST)
cd shared-infrastructure
docker-compose --env-file .env-dev up -d

# 2. Auth service
cd auth
docker-compose --env-file .env-dev up -d

# 3. Individual services
cd l2p
npm run dev:backend    # Terminal 1
npm run dev:frontend   # Terminal 2

cd payment
npm run dev            # Terminal 3

cd VideoVault
npm run dev            # Terminal 4
```

### L2P Docker Development

```bash
cd l2p

# Start full stack
npm run deploy:dev

# View logs
npm run deploy:logs

# Stop stack
npm run deploy:down
```

**Access Points:**
- Frontend: http://localhost:3007
- Backend: http://localhost:3008

## Production Deployment

### Production Stack

```mermaid
flowchart LR
    subgraph "Build Phase"
        A[Git Push] --> B[Build Images]
        B --> C[Tag with Version]
        C --> D[Push to Registry]
    end

    subgraph "Deploy Phase"
        D --> E[Pull Images on Server]
        E --> F[Stop Old Containers]
        F --> G[Start New Containers]
        G --> H[Health Check]
    end

    H --> I{Healthy?}
    I -->|Yes| J[Complete]
    I -->|No| K[Rollback]

    style K fill:#ffe1e1
    style J fill:#e1ffe1
```

### Production Deployment Steps

```bash
# 1. Build all services
npm run build:all

# 2. Start production stack
./scripts/start-all-production.sh

# 3. Health check
./scripts/health-check.sh

# 4. Monitor logs
./scripts/monitor-logs.sh
```

### L2P Production Deployment

```bash
cd l2p

# Build production images
npm run deploy:prod

# Or use docker-compose directly
docker-compose -f docker-compose.prod.yml --env-file .env-prod up -d

# View production logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop production
docker-compose -f docker-compose.prod.yml down
```

## Docker Compose Architecture

### Development Stack

```yaml
# docker-compose.yml (simplified)
services:
  frontend:
    build:
      context: ./frontend
      target: development
    volumes:
      - ./frontend/src:/app/src  # Hot reload
    environment:
      - NODE_ENV=development

  backend:
    build:
      context: ./backend
      target: development
    volumes:
      - ./backend/src:/app/src   # Hot reload
    depends_on:
      - shared-postgres
```

### Production Stack

```yaml
# docker-compose.prod.yml (simplified)
services:
  frontend:
    build:
      context: ./frontend
      target: production
    environment:
      - NODE_ENV=production
    restart: unless-stopped

  backend:
    build:
      context: ./backend
      target: production
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    depends_on:
      - shared-postgres
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## Traefik Routing

```mermaid
flowchart LR
    subgraph "External"
        User[User]
    end

    subgraph "Traefik"
        Router[Router]
        TLS[TLS Termination]
    end

    subgraph "Services"
        L2P[l2p.korczewski.de<br/>:3007]
        API[api.l2p.korczewski.de<br/>:3008]
        Payment[payment.korczewski.de<br/>:3005]
        Auth[auth.korczewski.de<br/>:5501]
        VV[vault.korczewski.de<br/>:5001]
    end

    User -->|HTTPS| TLS
    TLS --> Router

    Router -->|Host: l2p| L2P
    Router -->|Host: api.l2p| API
    Router -->|Host: payment| Payment
    Router -->|Host: auth| Auth
    Router -->|Host: vault| VV

    style TLS fill:#ffe1e1
    style Router fill:#fff4e1
```

### Traefik Configuration

```yaml
# traefik.yml (simplified)
entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https

  websecure:
    address: ":443"

certificatesResolvers:
  letsencrypt:
    acme:
      email: admin@korczewski.de
      storage: /letsencrypt/acme.json
      httpChallenge:
        entryPoint: web
```

## Health Checks

```mermaid
sequenceDiagram
    participant HC as Health Check Script
    participant Services as Services
    participant DB as Database

    HC->>Services: GET /health
    Services->>DB: Check Connection
    DB-->>Services: Connection OK
    Services-->>HC: 200 OK

    loop Every 30s
        HC->>Services: Ping
        Services-->>HC: Status
    end

    HC->>HC: Aggregate Status
    HC-->>HC: Report Overall Health

    style DB fill:#e1f5ff
```

### Health Check Endpoints

```bash
# L2P Backend
curl http://localhost:3001/health

# Payment
curl http://localhost:3004/api/health

# Auth
curl http://localhost:5500/health

# VideoVault
curl http://localhost:5100/health
```

### Automated Health Check Script

```bash
./scripts/health-check.sh

# Output:
# ✓ L2P Backend: Healthy
# ✓ L2P Frontend: Healthy
# ✓ Payment: Healthy
# ✓ Auth: Healthy
# ✓ VideoVault: Healthy
# ✓ Shared Postgres: Healthy
```

## Environment Variables Management

```mermaid
flowchart TB
    A[Environment Template<br/>.env.example] --> B{Environment}

    B -->|Development| C[.env-dev]
    B -->|Production| D[.env-prod]

    C --> E[Local Machine]
    D --> F[Secure Vault]

    E --> G[Docker Compose Dev]
    F --> H[Docker Compose Prod]

    G --> I[Running Services]
    H --> I

    style F fill:#ffe1e1
    style A fill:#e1f5ff
```

### Environment Validation

```bash
# Validate all environment files
npm run validate:env

# Validate development
npm run validate:env:dev

# Validate production
npm run validate:env:prod
```

## Rolling Updates

```mermaid
flowchart LR
    A[New Version] --> B[Build Image]
    B --> C[Tag: v1.2.0]
    C --> D[Start New Container]

    D --> E{Health Check}
    E -->|Pass| F[Stop Old Container]
    E -->|Fail| G[Keep Old Running]

    F --> H[Update Load Balancer]
    G --> I[Alert Team]

    H --> J[Complete]

    style G fill:#ffe1e1
    style I fill:#ffe1e1
    style J fill:#e1ffe1
```

### Zero-Downtime Deployment

```bash
# 1. Build new version
docker build -t l2p-backend:v1.2.0 ./backend

# 2. Start new container (different name)
docker run -d --name l2p-backend-new l2p-backend:v1.2.0

# 3. Wait for health check
./scripts/wait-for-health.sh l2p-backend-new

# 4. Update load balancer to point to new container

# 5. Stop old container
docker stop l2p-backend-old
docker rm l2p-backend-old

# 6. Rename new container
docker rename l2p-backend-new l2p-backend
```

## Scaling Strategy

```mermaid
graph TB
    subgraph "Load Balancer"
        LB[Traefik]
    end

    subgraph "Application Instances"
        A1[Backend Instance 1]
        A2[Backend Instance 2]
        A3[Backend Instance 3]
    end

    subgraph "Shared Resources"
        DB[(Database)]
        Redis[(Redis Cache)]
    end

    LB --> A1
    LB --> A2
    LB --> A3

    A1 --> DB
    A2 --> DB
    A3 --> DB

    A1 --> Redis
    A2 --> Redis
    A3 --> Redis

    style LB fill:#ffe1e1
    style DB fill:#e1f5ff
    style Redis fill:#e1f5ff
```

### Horizontal Scaling

```bash
# Scale backend to 3 instances
docker-compose up -d --scale backend=3

# Traefik automatically load balances across instances
```

## Backup and Recovery

```mermaid
flowchart TB
    A[Scheduled Backup] --> B[Database Dump]
    B --> C[Application State]
    C --> D[Compress & Encrypt]
    D --> E[Upload to Cloud Storage]

    E --> F{Retention Policy}
    F -->|Daily| G[Keep 7 Days]
    F -->|Weekly| H[Keep 4 Weeks]
    F -->|Monthly| I[Keep 12 Months]

    J[Disaster] --> K[Download Backup]
    K --> L[Decrypt]
    L --> M[Restore Database]
    M --> N[Restart Services]
    N --> O[Verify Health]

    style J fill:#ffe1e1
    style E fill:#e1f5ff
```

### Backup Commands

```bash
# Full system backup
./scripts/backup-all.sh

# Database only
cd shared-infrastructure
docker-compose exec shared-postgres pg_dumpall -U postgres | gzip > backup_$(date +%Y%m%d).sql.gz

# Restore
gunzip -c backup_20260112.sql.gz | docker-compose exec -T shared-postgres psql -U postgres
```

## Monitoring and Logs

```mermaid
flowchart LR
    subgraph "Services"
        S1[L2P Backend]
        S2[Payment]
        S3[Auth]
    end

    subgraph "Log Aggregation"
        Docker[Docker Logs]
    end

    subgraph "Monitoring"
        Health[Health Checks]
        Metrics[Metrics]
    end

    S1 --> Docker
    S2 --> Docker
    S3 --> Docker

    S1 --> Health
    S2 --> Health
    S3 --> Health

    S1 --> Metrics
    S2 --> Metrics
    S3 --> Metrics

    Docker --> Dashboard[Monitoring Dashboard]
    Health --> Dashboard
    Metrics --> Dashboard

    style Dashboard fill:#e1ffe1
```

### Log Commands

```bash
# View all logs
docker-compose logs -f

# View specific service
docker-compose logs -f backend

# View last 100 lines
docker-compose logs --tail=100 backend

# View logs since timestamp
docker-compose logs --since 2026-01-12T10:00:00 backend
```

## CI/CD Pipeline

```mermaid
flowchart LR
    A[Git Push] --> B[GitHub Actions]

    B --> C[Run Tests]
    C --> D{Tests Pass?}

    D -->|No| E[Fail Build]
    D -->|Yes| F[Build Images]

    F --> G[Tag Images]
    G --> H[Push to Registry]

    H --> I{Branch?}

    I -->|main| J[Deploy to Production]
    I -->|dev| K[Deploy to Staging]
    I -->|feature/*| L[Skip Deploy]

    J --> M[Health Check]
    K --> M

    M --> N{Healthy?}
    N -->|Yes| O[Success]
    N -->|No| P[Rollback]

    style E fill:#ffe1e1
    style P fill:#ffe1e1
    style O fill:#e1ffe1
```

## Troubleshooting Deployments

### Common Issues

| Issue | Symptom | Solution |
|-------|---------|----------|
| Service won't start | Container exits immediately | Check logs: `docker-compose logs service_name` |
| Port already in use | `EADDRINUSE` | Stop conflicting service or change port |
| Database connection fails | `ECONNREFUSED` | Start `shared-infrastructure` first |
| Environment variable missing | Service crashes on start | Check `.env` file exists and is valid |
| Build fails | Docker build error | Clear cache: `docker-compose build --no-cache` |
| Health check fails | Container marked unhealthy | Check health endpoint responds correctly |

### Debug Commands

```bash
# Check running containers
docker ps

# Check container logs
docker logs <container_id>

# Enter container shell
docker exec -it <container_id> /bin/sh

# Check container environment
docker exec <container_id> env

# Restart service
docker-compose restart service_name

# Rebuild and restart
docker-compose up -d --build service_name
```

## Security Checklist

- [ ] HTTPS enabled via Traefik
- [ ] Environment secrets not committed
- [ ] Database passwords are strong and unique
- [ ] JWT secrets are 32+ characters
- [ ] CORS configured correctly
- [ ] Rate limiting enabled
- [ ] Input validation in place
- [ ] Docker containers run as non-root
- [ ] Firewall configured
- [ ] Regular security updates applied

## Links

- [[Architecture Overview]] - System architecture
- [[Database Architecture]] - Database details
- [[Operations]] - Daily operations
- [[Environment & Secrets]] - Environment management
- [[Repos/reverse-proxy|Traefik Details]]
- [[Repos/shared-infrastructure|Infrastructure Details]]
