# Auth Service

Unified authentication service for the monorepo. Provides JWT-based auth, session handling, and Google OAuth support.

## Quick Start

```bash
npm install
cp .env.example .env-dev
cp .env.example .env-prod

docker-compose --env-file .env-dev up -d
```

## Environment Configuration

Recommended structure:
- `.env.example` (template)
- `.env-dev` (development)
- `.env-prod` (production)

Required values:
- `DATABASE_URL` (points to `shared-postgres:5432/auth_db`)
- `AUTH_DB_USER`, `AUTH_DB_PASSWORD` (match `shared-infrastructure/.env`)
- `JWT_SECRET`, `JWT_REFRESH_SECRET` (32-char hex, unique per env)
- `SESSION_SECRET` (32-char hex, unique per env)
- SMTP settings (dev placeholders OK, prod real creds)
- Google OAuth client + secret

OAuth redirect URIs:
- Dev: `http://localhost:5500/api/oauth/google/callback`
- Prod: `https://auth.korczewski.de/api/oauth/google/callback`

## Docker

```bash
# Start
 docker-compose up -d

# Stop
 docker-compose down
```

## Notes

- Production uses the centralized Postgres instance from `shared-infrastructure`.
- Use different secrets for dev/prod.
