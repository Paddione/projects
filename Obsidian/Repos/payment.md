# Payment

## Purpose
Payment platform with Stripe integration for handling subscriptions, one-time payments, and invoice management. Built with Next.js 16 and integrated with centralized auth.

## Stack
- **Framework**: Next.js 16 (App Router)
- **ORM**: Prisma
- **Auth**: NextAuth v5
- **Payment**: Stripe API
- **Database**: PostgreSQL (via shared-infrastructure)
- **Testing**: Vitest, Playwright

## Architecture

### System Overview

```mermaid
graph TB
    subgraph "Frontend"
        UI[Next.js Pages]
        StripeJS[Stripe.js]
    end

    subgraph "Next.js Backend :3004"
        API[API Routes]
        Actions[Server Actions]
        Auth[NextAuth]
    end

    subgraph "Database"
        DB[(payment_db)]
    end

    subgraph "External Services"
        Stripe[Stripe API]
        AuthService[Auth Service<br/>:5500]
    end

    UI --> API
    UI --> Actions
    UI --> StripeJS

    StripeJS <--> Stripe

    API --> Auth
    Auth --> AuthService
    Auth --> DB

    API --> Stripe
    Actions --> DB

    Stripe -->|Webhooks| API

    style Stripe fill:#ffe1e1
    style DB fill:#e1f5ff
```

### Application Structure

```mermaid
graph LR
    subgraph "App Router"
        Pages[Pages]
        API[API Routes]
        Actions[Server Actions]
    end

    subgraph "Prisma"
        Schema[Schema]
        Client[Prisma Client]
    end

    subgraph "Stripe Integration"
        SDK[Stripe SDK]
        Webhooks[Webhook Handlers]
    end

    subgraph "Auth"
        NextAuth[NextAuth v5]
        Sessions[Session Management]
    end

    Pages --> Actions
    Pages --> NextAuth

    API --> SDK
    API --> Client

    Actions --> Client
    Actions --> SDK

    SDK --> Webhooks

    NextAuth --> Sessions
    Sessions --> Client

    style Client fill:#e1f5ff
```

**Key Directories:**
- `app/` - Next.js App Router pages and layouts
- `app/api/` - API routes (webhooks, endpoints)
- `prisma/` - Database schema and migrations
- `lib/` - Utility functions and helpers
- `components/` - React components
- `test/` - Vitest and Playwright tests

## Payment Flow

### One-time Payment

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant API
    participant Stripe
    participant Webhook
    participant DB

    User->>UI: Initiate Payment
    UI->>API: POST /api/create-payment-intent
    API->>Stripe: Create Payment Intent
    Stripe-->>API: Client Secret
    API-->>UI: Client Secret

    UI->>Stripe: Confirm Payment<br/>(Stripe.js)
    Stripe-->>UI: Payment Success

    Stripe->>Webhook: payment_intent.succeeded
    Webhook->>DB: Update Order Status
    Webhook-->>Stripe: 200 OK

    UI->>API: GET /api/order/:id
    API->>DB: Fetch Order
    DB-->>API: Order Data
    API-->>UI: Order Confirmed
    UI-->>User: Success Message

    style Stripe fill:#ffe1e1
    style DB fill:#e1f5ff
```

### Subscription Flow

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant API
    participant Stripe
    participant Webhook
    participant DB

    User->>UI: Select Plan
    UI->>API: POST /api/create-subscription
    API->>Stripe: Create Customer
    API->>Stripe: Create Subscription
    Stripe-->>API: Subscription Object
    API->>DB: Store Subscription
    DB-->>API: Success
    API-->>UI: Client Secret

    UI->>Stripe: Confirm Payment
    Stripe-->>UI: Subscription Active

    Stripe->>Webhook: customer.subscription.created
    Webhook->>DB: Update Subscription Status
    Webhook-->>Stripe: 200 OK

    Note over Stripe,Webhook: Monthly billing cycle

    Stripe->>Webhook: invoice.payment_succeeded
    Webhook->>DB: Record Payment
    Webhook-->>Stripe: 200 OK

    style Stripe fill:#ffe1e1
    style DB fill:#e1f5ff
```

## Key Features

### Payment Processing
- One-time payments via Payment Intents
- Recurring subscriptions
- Multiple payment methods (card, bank transfer)
- 3D Secure authentication
- Payment refunds

### Subscription Management
- Multiple subscription tiers
- Plan upgrades/downgrades
- Prorated billing
- Trial periods
- Cancellation handling

### Invoice Management
- Automatic invoice generation
- PDF invoice downloads
- Payment reminders
- Failed payment retry logic

### Webhook Handling
- Stripe event processing
- Idempotency handling
- Event signature verification
- Async event processing

## Run Locally

```bash
cd payment

# Development mode
npm run dev        # http://localhost:3004

# With Stripe webhook forwarding
stripe listen --forward-to localhost:3004/api/webhooks/stripe
```

## Build & Production

```bash
cd payment

# Build for production
npm run build

# Start production server
npm run start      # http://localhost:3004
```

## Testing

```mermaid
graph TB
    subgraph "Unit Tests"
        U1[API Routes]
        U2[Server Actions]
        U3[Utilities]
    end

    subgraph "Integration Tests"
        I1[Stripe Integration]
        I2[Webhook Handlers]
        I3[Database Operations]
    end

    subgraph "E2E Tests"
        E1[Payment Flow]
        E2[Subscription Flow]
        E3[Stripe Test Mode]
    end

    U1 --> I1
    U2 --> I2
    I1 --> E1
    I2 --> E2
    I3 --> E1

    style I3 fill:#e1f5ff
    style E3 fill:#ffe1e1
```

### Test Commands

```bash
cd payment

# All tests
npm test

# E2E tests
npm run test:e2e

# Lint
npm run lint

# Type check
npm run typecheck
```

### Stripe Test Mode

All tests use Stripe test mode with test keys:

```bash
# Test card numbers
4242 4242 4242 4242  # Success
4000 0000 0000 9995  # Decline
4000 0025 0000 3155  # 3D Secure required
```

## Database

### Prisma Migrations

```bash
cd payment

# Create migration in development
npx prisma migrate dev --name migration_name

# Apply to production
npx prisma migrate deploy

# Reset database (CAUTION: deletes all data)
npx prisma migrate reset

# View database in GUI
npx prisma studio  # http://localhost:5555
```

### Schema

See [[Database Architecture#Payment Database (payment_db)]] for detailed schema.

Key models:
- `User` - User accounts with Stripe customer ID
- `Order` - Order records
- `OrderItem` - Line items in orders
- `Payment` - Payment transactions
- `Subscription` - Subscription records
- `Invoice` - Invoice records

## Environment Setup

### Required Variables

```bash
# Database
DATABASE_URL=postgresql://payment_user:password@shared-postgres:5432/payment_db?schema=public

# NextAuth
NEXTAUTH_URL=http://localhost:3004
NEXTAUTH_SECRET=<32-char-hex>
AUTH_SECRET=<32-char-hex>

# Stripe
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Centralized Auth Integration
AUTH_SERVICE_URL=http://localhost:5500
AUTH_SERVICE_SECRET=<shared-secret>
```

### Generate Secrets

```bash
# NextAuth secrets
openssl rand -hex 32
```

### Stripe Setup

1. Create Stripe account at https://stripe.com
2. Get API keys from Dashboard → Developers → API keys
3. Set up webhook endpoint:
   - URL: `https://payment.korczewski.de/api/webhooks/stripe`
   - Events: `payment_intent.succeeded`, `customer.subscription.created`, etc.
4. Copy webhook signing secret

## Ports

| Environment | Port | URL |
|-------------|------|-----|
| Development | 3004 | http://localhost:3004 |
| Production | 3005 | https://payment.korczewski.de |

## API Routes

### Payment Endpoints

```
POST   /api/create-payment-intent
POST   /api/confirm-payment
GET    /api/payment/:id
POST   /api/refund

POST   /api/create-subscription
POST   /api/cancel-subscription
POST   /api/update-subscription
GET    /api/subscription/:id

POST   /api/webhooks/stripe
GET    /api/invoice/:id
POST   /api/invoice/:id/download
```

### NextAuth Endpoints

```
GET    /api/auth/signin
POST   /api/auth/signout
GET    /api/auth/session
GET    /api/auth/callback/:provider
```

## Webhook Events

**Handled Events:**
- `payment_intent.succeeded` - Payment completed
- `payment_intent.payment_failed` - Payment failed
- `customer.subscription.created` - New subscription
- `customer.subscription.updated` - Subscription changed
- `customer.subscription.deleted` - Subscription cancelled
- `invoice.payment_succeeded` - Invoice paid
- `invoice.payment_failed` - Invoice payment failed

**Event Processing:**
```mermaid
flowchart LR
    A[Stripe Event] --> B{Verify Signature}
    B -->|Invalid| C[Return 400]
    B -->|Valid| D{Check Idempotency}
    D -->|Duplicate| E[Return 200]
    D -->|New| F[Process Event]
    F --> G[Update Database]
    G --> H[Send Confirmation]
    H --> I[Return 200]

    style C fill:#ffe1e1
    style E fill:#fff4e1
    style I fill:#e1ffe1
```

## Security

### Payment Security
- PCI compliance via Stripe.js (no card data touches server)
- 3D Secure (SCA) authentication
- Webhook signature verification
- Idempotent webhook processing

### Authentication
- NextAuth v5 for session management
- Integration with centralized auth service
- HTTP-only cookies for token storage
- CSRF protection

### Environment Variables
- Never commit secrets to git
- Use `.env.local` for development
- Secure vault for production secrets

## Stripe Integration Details

### Stripe Elements

```javascript
// Example: Payment form
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

export function CheckoutForm() {
  return (
    <Elements stripe={stripePromise}>
      <PaymentForm />
    </Elements>
  );
}
```

### Payment Intent Creation

```javascript
// app/api/create-payment-intent/route.ts
import { stripe } from '@/lib/stripe';

export async function POST(request: Request) {
  const { amount } = await request.json();

  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency: 'usd',
    automatic_payment_methods: { enabled: true },
  });

  return Response.json({ clientSecret: paymentIntent.client_secret });
}
```

### Webhook Handler

```javascript
// app/api/webhooks/stripe/route.ts
import { stripe } from '@/lib/stripe';
import { headers } from 'next/headers';

export async function POST(request: Request) {
  const body = await request.text();
  const signature = headers().get('stripe-signature')!;

  const event = stripe.webhooks.constructEvent(
    body,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  );

  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentSuccess(event.data.object);
      break;
    // ... other events
  }

  return Response.json({ received: true });
}
```

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Webhook not firing | Check Stripe Dashboard → Webhooks → Logs |
| Payment failing | Verify Stripe test keys are used in dev |
| Database connection error | Check DATABASE_URL and shared-infrastructure |
| NextAuth error | Verify NEXTAUTH_SECRET and NEXTAUTH_URL |
| Webhook signature verification fails | Check STRIPE_WEBHOOK_SECRET is correct |

### Debug Mode

```bash
# Enable Next.js debug logs
DEBUG=* npm run dev

# Stripe CLI webhook forwarding (verbose)
stripe listen --forward-to localhost:3004/api/webhooks/stripe --log-level debug

# Check Stripe logs
stripe logs tail
```

### Test Webhook Locally

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3004/api/webhooks/stripe

# Trigger test event
stripe trigger payment_intent.succeeded
```

## Monitoring

### Key Metrics
- Payment success rate
- Failed payment reasons
- Subscription churn rate
- Average order value
- Webhook processing time

### Stripe Dashboard
- Monitor in real-time at https://dashboard.stripe.com
- View payment analytics
- Check webhook delivery status
- Manage subscriptions

## Links

- [[Architecture Overview]] - System architecture
- [[Database Architecture]] - Database details
- [[Testing Strategy]] - Testing approach
- [[Deployment Architecture]] - Deployment guide
- [[Repos/auth|Auth Details]] - Auth integration
- [[Repository Index]] - Back to index
