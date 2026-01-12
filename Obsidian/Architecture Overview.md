# Architecture Overview

Visual guide to the monorepo architecture, service interactions, and data flows.

## System Architecture

```mermaid
graph TB
    subgraph "External"
        User[User Browser]
        Mobile[Mobile Client]
    end

    subgraph "Reverse Proxy Layer"
        Traefik[Traefik<br/>reverse-proxy<br/>:80/:443]
    end

    subgraph "Application Services"
        L2P_FE[L2P Frontend<br/>React<br/>:3000]
        L2P_BE[L2P Backend<br/>Express + Socket.io<br/>:3001]
        VV[VideoVault<br/>React + Express<br/>:5000/:5100]
        Payment[Payment<br/>Next.js 16<br/>:3004]
        Auth[Auth Service<br/>Node + JWT<br/>:5500]
        VLLM[VLLM MCP<br/>AI Inference<br/>:4100]
    end

    subgraph "Data Layer"
        SharedPG[(Shared Postgres<br/>:5432)]
        PG_MCP[Postgres MCP<br/>Server]
    end

    subgraph "External Services"
        Stripe[Stripe API]
        OAuth[Google OAuth]
        VLLM_API[vLLM Container]
    end

    User --> Traefik
    Mobile --> Traefik

    Traefik --> L2P_FE
    Traefik --> VV
    Traefik --> Payment
    Traefik --> Auth

    L2P_FE <--> L2P_BE
    L2P_BE --> SharedPG
    L2P_BE --> Auth

    VV --> SharedPG

    Payment --> SharedPG
    Payment --> Auth
    Payment --> Stripe

    Auth --> SharedPG
    Auth --> OAuth

    VLLM --> VLLM_API
    VLLM --> SharedPG

    PG_MCP --> SharedPG

    style SharedPG fill:#e1f5ff
    style Traefik fill:#ffe1e1
    style User fill:#f0f0f0
    style Mobile fill:#f0f0f0
```

## Database Architecture

The monorepo uses a **centralized PostgreSQL instance** with isolated databases per service.

```mermaid
graph LR
    subgraph "Shared Postgres Container<br/>:5432"
        Auth_DB[(auth_db<br/>user: auth_user)]
        L2P_DB[(l2p_db<br/>user: l2p_user)]
        Payment_DB[(payment_db<br/>user: payment_user)]
        VV_DB[(videovault_db<br/>user: videovault_user)]
    end

    subgraph "Services"
        Auth[Auth Service]
        L2P[L2P Backend]
        Payment[Payment Service]
        VV[VideoVault]
    end

    Auth --> Auth_DB
    L2P --> L2P_DB
    Payment --> Payment_DB
    VV --> VV_DB

    style Auth_DB fill:#e1f5ff
    style L2P_DB fill:#e1f5ff
    style Payment_DB fill:#e1f5ff
    style VV_DB fill:#e1f5ff
```

**Key Principles:**
- Single PostgreSQL container (`shared-postgres`)
- Isolated databases with dedicated users
- Prevents database sprawl
- Simplified backup and management
- Must start `shared-infrastructure` before other services

## Service Communication Patterns

```mermaid
sequenceDiagram
    participant User
    participant L2P_FE as L2P Frontend
    participant L2P_BE as L2P Backend
    participant Auth as Auth Service
    participant DB as Database

    User->>L2P_FE: Login Request
    L2P_FE->>Auth: POST /auth/login
    Auth->>DB: Validate Credentials
    DB-->>Auth: User Data
    Auth-->>L2P_FE: JWT Token

    L2P_FE->>L2P_BE: Connect WebSocket (with JWT)
    L2P_BE->>Auth: Verify JWT
    Auth-->>L2P_BE: Token Valid
    L2P_BE-->>L2P_FE: Socket Connected

    L2P_FE->>L2P_BE: Create Lobby (Socket.io)
    L2P_BE->>DB: Insert Lobby
    DB-->>L2P_BE: Lobby Created
    L2P_BE-->>L2P_FE: Lobby Joined (Socket.io)

    Note over L2P_FE,L2P_BE: Real-time game events via Socket.io
```

## Technology Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React, Vite, Next.js 16 (Payment) |
| **Backend** | Express, Node.js, Socket.io |
| **Database** | PostgreSQL 15+, Prisma, Drizzle |
| **Auth** | JWT, NextAuth v5, OAuth 2.0 |
| **Real-time** | Socket.io (WebSockets) |
| **Testing** | Jest, Vitest, Playwright, Testing Library |
| **Deployment** | Docker, Docker Compose, Traefik |
| **AI/ML** | vLLM, MCP (Model Context Protocol) |

## Port Allocation

| Service | Dev Port | Prod Port | Protocol |
|---------|----------|-----------|----------|
| L2P Frontend | 3000 | 3007 | HTTP |
| L2P Backend | 3001 | 3008 | HTTP + WS |
| Payment | 3004 | 3005 | HTTP |
| Auth | 5500 | 5501 | HTTP |
| VideoVault | 5100/5000 | 5001 | HTTP |
| VLLM Dashboard | 4242 | - | HTTP |
| Shared Postgres | 5432 | 5432 | TCP |
| Traefik | 80/443 | 80/443 | HTTP/HTTPS |

## Data Flow Patterns

### L2P Real-time Game Flow

```mermaid
flowchart TD
    A[User Creates Lobby] --> B{Socket.io Event}
    B --> C[Backend: Create Lobby]
    C --> D[Store in PostgreSQL]
    D --> E[Broadcast to All Clients]
    E --> F[Update UI State]

    F --> G{User Answers Question}
    G --> H[Socket.io: Submit Answer]
    H --> I[Backend: Validate Answer]
    I --> J[Update Score in DB]
    J --> K[Broadcast Score Update]
    K --> L[Real-time Leaderboard Update]

    style D fill:#e1f5ff
    style J fill:#e1f5ff
```

### VideoVault File Access Flow

```mermaid
flowchart LR
    A[User Selects Directory] --> B[File System Access API]
    B --> C{Browser Grants Permission?}
    C -->|Yes| D[Scan Directory]
    C -->|No| E[Show Error]
    D --> F[Extract Metadata]
    F --> G[Store in IndexedDB]
    G --> H[Display Video Grid]
    H --> I{Optional}
    I --> J[Persist to Postgres]

    style B fill:#ffe1e1
    style G fill:#e1f5ff
    style J fill:#e1f5ff
```

### Payment Stripe Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Stripe
    participant DB

    User->>Frontend: Initiate Payment
    Frontend->>Backend: Create Payment Intent
    Backend->>Stripe: POST /payment_intents
    Stripe-->>Backend: Client Secret
    Backend-->>Frontend: Client Secret

    Frontend->>Stripe: Confirm Payment (Stripe.js)
    Stripe-->>Frontend: Payment Success
    Frontend->>Backend: Confirm Success

    Stripe->>Backend: Webhook: payment_intent.succeeded
    Backend->>DB: Update Order Status
    Backend-->>Stripe: 200 OK

    style Stripe fill:#ffe1e1
    style DB fill:#e1f5ff
```

## Security Architecture

```mermaid
graph TB
    subgraph "Security Layers"
        A[Traefik TLS Termination]
        B[JWT Token Validation]
        C[CORS Middleware]
        D[Rate Limiting]
        E[Input Validation]
    end

    subgraph "Auth Flow"
        F[User Login]
        G[Issue JWT + Refresh Token]
        H[HTTP-only Cookies]
        I[Token Refresh Endpoint]
    end

    A --> B
    B --> C
    C --> D
    D --> E

    F --> G
    G --> H
    H --> I

    style A fill:#ffe1e1
    style H fill:#e1f5ff
```

**Security Features:**
- TLS/HTTPS via Traefik
- JWT-based authentication
- HTTP-only cookies for token storage
- Refresh token rotation
- CORS protection
- Rate limiting per route
- Input validation and sanitization
- Database user isolation

## Development vs Production

```mermaid
graph TB
    subgraph "Development"
        D1[Hot Reload: Vite/Nodemon]
        D2[Source Maps Enabled]
        D3[Verbose Logging]
        D4[Local .env-dev]
        D5[Test DB on :5433]
    end

    subgraph "Production"
        P1[Optimized Builds]
        P2[Minified Assets]
        P3[Error Logging Only]
        P4[Environment Secrets]
        P5[Production DB :5432]
        P6[Docker Compose]
    end

    D1 -.->|npm run build| P1
    D2 -.->|Build Process| P2
    D3 -.->|LOG_LEVEL=error| P3
    D4 -.->|Deploy Secrets| P4
    D5 -.->|Migrate| P5

    style D1 fill:#e1ffe1
    style D2 fill:#e1ffe1
    style P1 fill:#ffe1e1
    style P2 fill:#ffe1e1
```

## Links

- [[Repository Index]] - Service directory
- [[Testing Strategy]] - Testing architecture
- [[Database Architecture]] - Database details
- [[Deployment Architecture]] - Deployment guide
- [[Repos/l2p|L2P Details]]
- [[Repos/VideoVault|VideoVault Details]]
- [[Repos/payment|Payment Details]]
