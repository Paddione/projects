# Payment

Next.js 16 payment platform with Stripe integration, NextAuth v5 authentication, and Prisma ORM.

## Overview

- Framework: Next.js 16 (App Router)
- Auth: NextAuth v5 (beta)
- Database: PostgreSQL via Prisma
- Payments: Stripe

## Quick Start

```bash
npm install
cp .env.example .env-dev
cp .env.example .env-prod

# Development database migration
npx prisma migrate dev

# Start dev server (default: http://localhost:3004)
npm run dev
```

## Environment Configuration

Recommended structure:
- `.env.example` (template)
- `.env-dev` (development)
- `.env-prod` (production)

Required values:
- `DATABASE_URL` (points to shared Postgres: `shared-postgres:5432/payment_db`)
- `NEXTAUTH_SECRET` (32-char hex, unique per env)
- `AUTH_SECRET` (32-char hex, unique per env)
- `NEXTAUTH_URL` (dev: `http://localhost:3004`, prod: `https://payment.korczewski.de`)
- `AUTH_SERVICE_URL` (dev: `http://localhost:5500`, prod: `https://auth.korczewski.de`)
- Stripe keys (test keys in dev, production keys in prod)
- `STRIPE_WEBHOOK_SECRET` (required for webhooks)
- `AUTH_TRUST_HOST=true` (production)

## Commands

```bash
# Development
npm run dev

# Build & run production
npm run build
npm run start

# Testing
npm test
npm run test:e2e
npm run lint

# Prisma
npx prisma migrate dev
npx prisma migrate deploy
npx prisma studio
```

## Critical Constraints

- Prisma migrations require a valid `DATABASE_URL`.
- NextAuth requires `NEXTAUTH_SECRET` and `NEXTAUTH_URL`.
- Stripe webhooks require `STRIPE_WEBHOOK_SECRET`.

## Important Files

- `compose.yaml`: database stack
- `auth.config.ts` and `auth.ts`: NextAuth configuration

## Deployment

- Dev: `npm run dev`
- Production: `npm run build` then `npm run start`
- Use `.env-prod` for production settings
