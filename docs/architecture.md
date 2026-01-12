# Service Environment Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         INFRASTRUCTURE LAYER                                 │
│                         (Production Only)                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────┐              ┌──────────────────────────────┐    │
│  │   Traefik Proxy      │              │   Shared PostgreSQL          │    │
│  │   (traefik)          │              │   (shared-postgres)          │    │
│  │                      │              │                              │    │
│  │  • SSL Termination   │              │  • auth_db                   │    │
│  │  • Reverse Proxy     │              │  • l2p_db                    │    │
│  │  • Load Balancing    │              │  • payment_db                │    │
│  │                      │              │  • videovault_db             │    │
│  └──────────────────────┘              └──────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         APPLICATION SERVICES                                 │
│                    (Production + Development)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │ Auth Service                                                        │    │
│  ├────────────────────────────────────────────────────────────────────┤    │
│  │ PRODUCTION                    │ DEVELOPMENT                        │    │
│  │ • Container: auth-service     │ • npm run dev                      │    │
│  │ • URL: auth.korczewski.de     │ • Port: 5500                       │    │
│  │ • Database: auth_db           │ • Database: auth_db                │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │ L2P (Learn2Play)                                                    │    │
│  ├────────────────────────────────────────────────────────────────────┤    │
│  │ PRODUCTION                    │ DEVELOPMENT                        │    │
│  │ • Profile: production         │ • Profile: development             │    │
│  │ • Containers:                 │ • Containers:                      │    │
│  │   - l2p-app (frontend)        │   - l2p-frontend-dev               │    │
│  │   - l2p-api (backend)         │   - l2p-backend-dev                │    │
│  │ • URL: l2p.korczewski.de      │ • Ports: 3000, 3001                │    │
│  │ • Database: l2p_db            │ • Database: l2p_db                 │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │ Payment Service                                                     │    │
│  ├────────────────────────────────────────────────────────────────────┤    │
│  │ PRODUCTION                    │ DEVELOPMENT                        │    │
│  │ • Container: web              │ • npm run dev                      │    │
│  │ • URL: payment.korczewski.de  │ • Port: 3004                       │    │
│  │ • Database: payment_db        │ • Database: payment_db             │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │ VideoVault                                                          │    │
│  ├────────────────────────────────────────────────────────────────────┤    │
│  │ PRODUCTION                    │ DEVELOPMENT                        │    │
│  │ • Service: videovault         │ • Service: videovault-dev          │    │
│  │ • Container: videovault       │ • Container: videovault-dev        │    │
│  │ • URL: videovault.korczew.de  │ • Port: 5100                       │    │
│  │ • Database: videovault_db     │ • Database: videovault_db          │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         AI/ML SERVICES                                       │
│                    (Production + Development)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │ vLLM RAG Stack                                                      │    │
│  ├────────────────────────────────────────────────────────────────────┤    │
│  │ PRODUCTION                    │ DEVELOPMENT                        │    │
│  │ • vllm-rag                    │ • Infrastructure containers        │    │
│  │ • open-webui-rag              │   - qdrant-dev                     │    │
│  │ • qdrant-rag                  │   - infinity-dev                   │    │
│  │ • infinity-embeddings         │   - postgres-dev                   │    │
│  │ • postgres-rag                │ • Local npm servers:               │    │
│  │ • rag-ingest-engine           │   - vLLM (port 4100)               │    │
│  │ • vllm-dashboard              │   - Open WebUI (port 3005)         │    │
│  │                               │   - Dashboard (port 4242)          │    │
│  │ URLs:                         │                                    │    │
│  │ • vllm.korczewski.de          │                                    │    │
│  │ • dashboard.korczewski.de     │                                    │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         DEPLOYMENT CONTROL                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────┐      │
│  │ Dashboard (https://dashboard.korczewski.de)                       │      │
│  │                                                                   │      │
│  │  • Monitors all services                                          │      │
│  │  • Enforces single environment rule                               │      │
│  │  • Provides centralized control                                   │      │
│  │  • Tracks Docker environments                                     │      │
│  │  • Manages npm projects                                           │      │
│  └──────────────────────────────────────────────────────────────────┘      │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────┐      │
│  │ Deployment Scripts                                                │      │
│  │                                                                   │      │
│  │  • start-all-production.sh  - Start all production services       │      │
│  │  • stop-all.sh              - Stop all services                   │      │
│  │  • health-check.sh          - Check service health                │      │
│  └──────────────────────────────────────────────────────────────────┘      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         CONFIGURATION                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  /home/patrick/projects/.env                                                │
│  ├── Infrastructure variables (Traefik, PostgreSQL)                         │
│  ├── Auth service variables                                                 │
│  ├── L2P service variables                                                  │
│  ├── Payment service variables                                              │
│  ├── VideoVault service variables                                           │
│  └── vLLM/RAG service variables                                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

LEGEND:
  ┌─┐  Service/Component
  │ │  Container or Process
  └─┘  
  
  • Production: Accessible via *.korczewski.de
  • Development: Local ports or Docker profiles
  • Infrastructure: Shared across all services
  • Single Environment: ONE production + ONE development per service
```

## Key Principles

1. **Vertical Separation**: Infrastructure → Applications → AI/ML
2. **Horizontal Separation**: Production ↔ Development
3. **Single Instance**: Each service has exactly ONE production and ONE development
4. **Centralized Control**: Dashboard manages all environments
5. **Shared Resources**: Infrastructure services are shared (Traefik, PostgreSQL)

## Environment Types

- **Production**: Live services, accessible via `*.korczewski.de`, managed by Traefik
- **Development**: Local testing, uses Docker profiles or npm, ports on localhost
- **Infrastructure**: Shared services that support all other services

## Deployment Methods

- **Docker Compose**: Most services use Docker Compose for production
- **Docker Profiles**: L2P uses `--profile production|development`
- **Service Names**: VideoVault uses service names `videovault|videovault-dev`
- **npm**: Some services run via npm for development hot reload
- **Hybrid**: vLLM uses Docker for production, local for development
