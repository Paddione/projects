# Payment

## Purpose
Payment platform with Stripe integration.

## Stack
Next.js 16 (App Router), Prisma, NextAuth.

## Key folders
- `payment/app/` - Next.js App Router
- `payment/prisma/` - schema and migrations
- `payment/test/` - Vitest + Playwright tests

## Run locally
```bash
cd payment
npm run dev        # http://localhost:3004
```

## Build
```bash
cd payment
npm run build
```

## Tests
```bash
cd payment
npm test
npm run test:e2e
```

## Environment notes
- Requires `DATABASE_URL`, `NEXTAUTH_SECRET`, `AUTH_SECRET`.
- Stripe keys and webhook secret required for full flows.

## Ports
- App: 3004
