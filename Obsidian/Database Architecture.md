# Database Architecture

Detailed guide to the centralized database architecture and data models across services.

## Centralized PostgreSQL Strategy

```mermaid
graph TB
    subgraph "shared-postgres Container :5432"
        direction TB
        PG[PostgreSQL 15+]

        subgraph "Isolated Databases"
            Auth_DB[(auth_db)]
            L2P_DB[(l2p_db)]
            Payment_DB[(payment_db)]
            VV_DB[(videovault_db)]
        end

        PG --> Auth_DB
        PG --> L2P_DB
        PG --> Payment_DB
        PG --> VV_DB
    end

    subgraph "Database Users"
        Auth_User[auth_user]
        L2P_User[l2p_user]
        Payment_User[payment_user]
        VV_User[videovault_user]
    end

    subgraph "Services"
        Auth[Auth Service<br/>:5500]
        L2P[L2P Backend<br/>:3001]
        Payment[Payment Service<br/>:3004]
        VV[VideoVault<br/>:5100]
    end

    Auth_User --> Auth_DB
    L2P_User --> L2P_DB
    Payment_User --> Payment_DB
    VV_User --> VV_DB

    Auth --> Auth_User
    L2P --> L2P_User
    Payment --> Payment_User
    VV --> VV_User

    style Auth_DB fill:#e1f5ff
    style L2P_DB fill:#e1f5ff
    style Payment_DB fill:#e1f5ff
    style VV_DB fill:#e1f5ff
```

## Benefits of Centralized Approach

| Benefit | Description |
|---------|-------------|
| **Single Container** | One Postgres container instead of 4+ |
| **Resource Efficiency** | Shared memory and CPU allocation |
| **Simplified Backups** | One backup process for all services |
| **Easy Management** | Single connection pool configuration |
| **Database Isolation** | Logical separation with dedicated users |
| **Cost Effective** | Reduced infrastructure costs |

## Connection String Format

```bash
# Standard format
postgresql://<user>:<password>@shared-postgres:5432/<database>

# Examples
postgresql://auth_user:password@shared-postgres:5432/auth_db
postgresql://l2p_user:password@shared-postgres:5432/l2p_db
postgresql://payment_user:password@shared-postgres:5432/payment_db?schema=public
postgresql://videovault_user:password@shared-postgres:5432/videovault_db
```

**Critical:** Always use `shared-postgres` as hostname in Docker environment, `localhost` for local development.

## Database Schemas

### Auth Database (auth_db)

```mermaid
erDiagram
    USERS ||--o{ SESSIONS : has
    USERS ||--o{ OAUTH_ACCOUNTS : has
    USERS {
        uuid id PK
        string email UK
        string password_hash
        string username UK
        boolean email_verified
        timestamp created_at
        timestamp updated_at
    }
    SESSIONS {
        uuid id PK
        uuid user_id FK
        string refresh_token UK
        timestamp expires_at
        timestamp created_at
    }
    OAUTH_ACCOUNTS {
        uuid id PK
        uuid user_id FK
        string provider
        string provider_account_id
        string access_token
        timestamp expires_at
    }
```

**Key Features:**
- JWT-based authentication
- OAuth integration (Google)
- Session management with refresh tokens
- Email verification system

### L2P Database (l2p_db)

```mermaid
erDiagram
    USERS ||--o{ LOBBIES : creates
    USERS ||--o{ LOBBY_PLAYERS : joins
    LOBBIES ||--o{ LOBBY_PLAYERS : contains
    LOBBIES ||--o{ GAMES : has
    GAMES ||--o{ GAME_PARTICIPANTS : includes
    GAMES ||--o{ QUESTIONS : contains
    QUESTIONS ||--o{ ANSWERS : has
    GAME_PARTICIPANTS ||--o{ ANSWERS : submits

    USERS {
        uuid id PK
        string username UK
        string email UK
        string password_hash
        integer rating
        timestamp created_at
    }

    LOBBIES {
        uuid id PK
        uuid creator_id FK
        string name
        integer max_players
        string status
        json settings
        timestamp created_at
    }

    LOBBY_PLAYERS {
        uuid id PK
        uuid lobby_id FK
        uuid user_id FK
        boolean is_ready
        timestamp joined_at
    }

    GAMES {
        uuid id PK
        uuid lobby_id FK
        string status
        integer current_question
        timestamp started_at
        timestamp ended_at
    }

    GAME_PARTICIPANTS {
        uuid id PK
        uuid game_id FK
        uuid user_id FK
        integer score
        integer correct_answers
    }

    QUESTIONS {
        uuid id PK
        uuid game_id FK
        string question_text
        json options
        string correct_answer
        integer points
        integer order_index
    }

    ANSWERS {
        uuid id PK
        uuid participant_id FK
        uuid question_id FK
        string answer
        boolean is_correct
        integer time_taken_ms
        timestamp submitted_at
    }
```

**Key Features:**
- Multi-lobby support
- Real-time game state tracking
- Scoring and leaderboards
- Question/answer history
- Player statistics

### Payment Database (payment_db)

```mermaid
erDiagram
    USERS ||--o{ ORDERS : places
    ORDERS ||--o{ ORDER_ITEMS : contains
    ORDERS ||--|| PAYMENTS : has

    USERS {
        uuid id PK
        string email UK
        string name
        string stripe_customer_id UK
        timestamp created_at
    }

    ORDERS {
        uuid id PK
        uuid user_id FK
        string status
        decimal total_amount
        string currency
        timestamp created_at
        timestamp updated_at
    }

    ORDER_ITEMS {
        uuid id PK
        uuid order_id FK
        string product_name
        integer quantity
        decimal unit_price
        decimal total_price
    }

    PAYMENTS {
        uuid id PK
        uuid order_id FK
        string stripe_payment_intent_id UK
        string status
        decimal amount
        string currency
        string payment_method
        timestamp paid_at
        timestamp created_at
    }
```

**Key Features:**
- Stripe integration
- Order management
- Payment tracking
- Webhook handling

### VideoVault Database (videovault_db)

```mermaid
erDiagram
    VIDEOS ||--o{ TAGS : has
    VIDEOS ||--o{ WATCH_HISTORY : tracked_in

    VIDEOS {
        uuid id PK
        string file_path UK
        string file_name
        bigint file_size
        string mime_type
        integer duration_seconds
        json metadata
        string hash
        timestamp created_at
        timestamp updated_at
    }

    TAGS {
        uuid id PK
        uuid video_id FK
        string tag_name
        string tag_category
        timestamp created_at
    }

    WATCH_HISTORY {
        uuid id PK
        uuid video_id FK
        integer position_seconds
        boolean completed
        timestamp watched_at
    }
```

**Key Features:**
- Optional persistence (falls back to IndexedDB)
- File metadata storage
- Tag management
- Watch history tracking

## Migration Strategy

```mermaid
flowchart LR
    A[Write Migration] --> B{Environment}
    B -->|Development| C[npm run db:migrate]
    B -->|Production| D[npx prisma migrate deploy]

    C --> E[Apply to Dev DB]
    D --> F[Apply to Prod DB]

    E --> G[Test Locally]
    F --> H[Verify Production]

    G --> I{Success?}
    H --> J{Success?}

    I -->|No| K[Rollback]
    I -->|Yes| L[Commit Migration]

    J -->|No| M[Emergency Rollback]
    J -->|Yes| N[Monitor]

    style K fill:#ffe1e1
    style M fill:#ffe1e1
    style L fill:#e1ffe1
    style N fill:#e1ffe1
```

### L2P Migrations

```bash
cd l2p/backend

# Create new migration
npm run db:migrate:create -- migration_name

# Run migrations
npm run db:migrate

# Check status
npm run db:status

# Rollback last migration
npm run db:rollback
```

### Payment Migrations (Prisma)

```bash
cd payment

# Create migration in development
npx prisma migrate dev --name migration_name

# Apply to production
npx prisma migrate deploy

# Reset database (CAUTION)
npx prisma migrate reset

# View database in GUI
npx prisma studio
```

## Database Users and Permissions

```mermaid
graph TB
    subgraph "PostgreSQL Roles"
        Admin[postgres<br/>Superuser]

        Auth[auth_user<br/>Limited to auth_db]
        L2P[l2p_user<br/>Limited to l2p_db]
        Payment[payment_user<br/>Limited to payment_db]
        VV[videovault_user<br/>Limited to videovault_db]
    end

    Admin -->|Creates| Auth
    Admin -->|Creates| L2P
    Admin -->|Creates| Payment
    Admin -->|Creates| VV

    Auth -->|CRUD| Auth_DB[(auth_db)]
    L2P -->|CRUD| L2P_DB[(l2p_db)]
    Payment -->|CRUD| Payment_DB[(payment_db)]
    VV -->|CRUD| VV_DB[(videovault_db)]

    style Admin fill:#ffe1e1
    style Auth_DB fill:#e1f5ff
    style L2P_DB fill:#e1f5ff
    style Payment_DB fill:#e1f5ff
    style VV_DB fill:#e1f5ff
```

**Security Principles:**
- Each service has its own database user
- Users can only access their designated database
- No cross-database queries allowed
- Strong, unique passwords per environment

## Connection Pooling

```mermaid
flowchart LR
    subgraph "Application"
        A1[Request 1]
        A2[Request 2]
        A3[Request 3]
        A4[Request 4]
    end

    subgraph "Connection Pool"
        P1[Conn 1]
        P2[Conn 2]
        P3[Conn 3]
    end

    subgraph "Database"
        DB[(PostgreSQL)]
    end

    A1 --> P1
    A2 --> P2
    A3 --> P3
    A4 -.->|Wait| P1

    P1 --> DB
    P2 --> DB
    P3 --> DB

    style P1 fill:#e1ffe1
    style P2 fill:#e1ffe1
    style P3 fill:#e1ffe1
```

**Configuration:**
```javascript
// Example pool config
{
  min: 2,           // Minimum connections
  max: 10,          // Maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
}
```

## Backup Strategy

```mermaid
flowchart TB
    A[Scheduled Backup] --> B{Backup Type}
    B -->|Daily| C[Full Backup]
    B -->|Hourly| D[Incremental]

    C --> E[pg_dump All Databases]
    D --> F[WAL Archiving]

    E --> G[Compress]
    F --> G

    G --> H[Encrypt]
    H --> I[Upload to S3/Cloud]

    I --> J[Retention Policy]
    J --> K[Delete Old Backups]

    style I fill:#e1f5ff
    style H fill:#ffe1e1
```

### Backup Commands

```bash
# Backup all databases
cd shared-infrastructure
docker-compose exec shared-postgres pg_dumpall -U postgres > backup_all.sql

# Backup single database
docker-compose exec shared-postgres pg_dump -U postgres -d l2p_db > l2p_backup.sql

# Restore single database
docker-compose exec -T shared-postgres psql -U postgres -d l2p_db < l2p_backup.sql
```

## Performance Optimization

### Indexes Strategy

```sql
-- Example indexes for l2p_db

-- User lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

-- Lobby queries
CREATE INDEX idx_lobbies_status ON lobbies(status);
CREATE INDEX idx_lobbies_creator ON lobbies(creator_id);

-- Game performance
CREATE INDEX idx_games_lobby ON games(lobby_id);
CREATE INDEX idx_games_status ON games(status);

-- Answer queries
CREATE INDEX idx_answers_participant ON answers(participant_id);
CREATE INDEX idx_answers_question ON answers(question_id);
```

### Query Performance Monitoring

```mermaid
flowchart LR
    A[Slow Query] --> B[pg_stat_statements]
    B --> C[Identify Bottleneck]
    C --> D{Issue Type}

    D -->|Missing Index| E[Add Index]
    D -->|Complex Join| F[Optimize Query]
    D -->|Large Dataset| G[Add Pagination]
    D -->|N+1 Problem| H[Use JOIN/Eager Load]

    E --> I[Test Performance]
    F --> I
    G --> I
    H --> I

    I --> J{Improved?}
    J -->|Yes| K[Deploy]
    J -->|No| L[Investigate Further]

    style K fill:#e1ffe1
    style L fill:#ffe1e1
```

## Starting the Database

```bash
# Start shared-infrastructure
cd shared-infrastructure
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f shared-postgres

# Access PostgreSQL shell
docker-compose exec shared-postgres psql -U postgres

# Stop database
docker-compose down
```

## Database Health Checks

```bash
# L2P health check
cd l2p
npm run db:health

# Check connections
docker-compose exec shared-postgres psql -U postgres -c "SELECT * FROM pg_stat_activity;"

# Check database sizes
docker-compose exec shared-postgres psql -U postgres -c "SELECT pg_database.datname, pg_size_pretty(pg_database_size(pg_database.datname)) FROM pg_database;"
```

## Troubleshooting

### Common Issues

| Issue | Symptom | Solution |
|-------|---------|----------|
| Connection refused | `ECONNREFUSED` | Start `shared-infrastructure` first |
| Password mismatch | Auth error | Check `.env` matches `shared-infrastructure/.env` |
| Database not found | `database "xyz_db" does not exist` | Run migrations or create database |
| Too many connections | `FATAL: sorry, too many clients` | Adjust pool size or increase max_connections |
| Slow queries | High response time | Add indexes, optimize queries |

## Links

- [[Architecture Overview]] - System architecture
- [[Repos/shared-infrastructure|Shared Infrastructure]] - Database container details
- [[Repos/l2p|L2P Details]] - L2P database specifics
- [[Repos/payment|Payment Details]] - Payment database details
- [[Operations]] - Day-to-day operations
