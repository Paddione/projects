# Payment Service

Next.js 16 payment platform with Stripe integration, NextAuth v5 authentication, and Prisma ORM.

## Overview

- **Framework**: Next.js 16 (App Router)
- **Auth**: NextAuth v5 (beta)
- **Database**: PostgreSQL via Prisma
- **Payments**: Stripe (Checkout hosted page)

## Quick Start

```bash
npm install
cp .env.example .env-dev
cp .env.example .env-prod

npx prisma migrate dev      # Run database migrations
npm run dev                  # Start dev server at http://localhost:3004
```

## Environment Configuration

File structure:
- `.env.example` (template)
- `.env-dev` (development, gitignored)
- `.env-prod` (production, gitignored)

Required variables:
- `DATABASE_URL` - points to `shared-postgres:5432/payment_db`
- `NEXTAUTH_SECRET` - 32-char hex, unique per env
- `AUTH_SECRET` - 32-char hex, unique per env
- `NEXTAUTH_URL` - dev: `http://localhost:3004`, prod: `https://payment.korczewski.de`
- `AUTH_SERVICE_URL` - dev: `http://localhost:5500`, prod: `https://auth.korczewski.de`
- Stripe keys (test keys in dev, production keys in prod)
- `STRIPE_WEBHOOK_SECRET` - required for webhook signature validation
- `AUTH_TRUST_HOST=true` (production)

## Commands

```bash
npm run dev                  # Development server (port 3004)
npm run build                # Production build
npm run start                # Start production server
npm test                     # Vitest tests
npm run test:e2e             # Playwright E2E tests
npm run lint                 # Lint

npx prisma migrate dev       # Create/apply dev migrations
npx prisma migrate deploy    # Apply migrations in production
npx prisma studio            # Database GUI
```

## Critical Constraints

- Prisma migrations require a valid `DATABASE_URL`
- NextAuth requires `NEXTAUTH_SECRET` and `NEXTAUTH_URL`
- Stripe webhooks require `STRIPE_WEBHOOK_SECRET`
- Stripe initialization is deferred at build time (no `STRIPE_SECRET_KEY` available during `next build`)

## Important Files

- `compose.yaml` - Database stack
- `auth.config.ts`, `auth.ts` - NextAuth configuration
- `lib/stripe.ts` - Stripe client (conditional initialization)

## Deployment

### Docker

```bash
# Build image
docker build -t payment-service .

# Run container
docker run -d --name payment-service \
  --env-file .env-prod \
  -p 3004:3000 \
  --network traefik-public \
  payment-service
```

Container details:
- **Port mapping**: 3004 (host) to 3000 (container)
- **Network**: `traefik-public`
- **Environment**: `.env-prod`

### Docker Management

```bash
docker logs payment-service          # View logs
docker logs payment-service -f       # Follow logs
docker restart payment-service       # Restart
docker stop payment-service          # Stop

# Rebuild after code changes
docker build -t payment-service .
docker stop payment-service && docker rm payment-service
docker run -d --name payment-service --env-file .env-prod -p 3004:3000 --network traefik-public payment-service
```

### Kubernetes

Deployed via `./k8s/scripts/deploy/deploy-all.sh`. See `k8s/services/` for manifests.

### Stripe Webhook Setup

**Development** (Stripe CLI):
```bash
stripe login
stripe listen --forward-to localhost:3004/api/stripe/webhook
stripe trigger checkout.session.completed
```

**Production** (Stripe Dashboard):
1. Go to https://dashboard.stripe.com/test/webhooks
2. Add endpoint: `https://payment.korczewski.de/api/stripe/webhook`
3. Select events: `checkout.session.completed`
4. Copy signing secret to `.env-prod`

Test card: `4242 4242 4242 4242` (any future expiry, any 3-digit CVC).

## Keyboard Shortcuts

### Universal

| Shortcut | Action |
|----------|--------|
| `Tab` | Move focus to next element |
| `Shift+Tab` | Move focus to previous element |
| `Enter` | Activate button/link or submit form |
| `Space` | Activate button |
| `Esc` | Close modal, cancel transaction |

### Key Page Shortcuts

| Page | Tab Order |
|------|-----------|
| Home | Header nav, Hero CTAs, Features |
| Shop | Product cards (left to right, top to bottom) |
| Product Detail | Price, Description, Quantity, Purchase |
| Wallet | Balance, Add Funds, Amount, Pay button |
| Orders | Order list, Order details, Actions |
| Admin | Section nav, Product list, CRUD actions |

### Stripe Checkout

The payment flow uses Stripe Checkout (hosted page), which has full keyboard accessibility:
- Tab through card number, expiry, CVC, ZIP
- Enter to submit payment
- Escape to cancel

## Troubleshooting

- **Container won't start**: check `docker logs payment-service` and verify `.env-prod` exists
- **Webhook signature fails**: verify `STRIPE_WEBHOOK_SECRET` matches Stripe Dashboard; check test vs live mode
- **Database connection errors**: verify `DATABASE_URL` and ensure Postgres container is running
- **Build error "Neither apiKey nor config.authenticator"**: Stripe client initializes conditionally; ensure `lib/stripe.ts` handles missing keys at build time
