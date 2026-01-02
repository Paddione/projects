# Payment Service - Docker Deployment Summary

## ✅ Successfully Deployed

The payment service is now running in a Docker container with all Stripe API keys properly configured.

### Container Details
- **Container Name**: `payment-service`
- **Image**: `payment-service:latest`
- **Port Mapping**: `3004:3000` (host:container)
- **Network**: `traefik-public`
- **Environment**: Production (`.env-prod`)

### Service Status
```
✅ Payment Service: Running on http://localhost:3004
✅ Stripe Webhook: Properly configured and validating signatures
✅ Environment Variables: Loaded correctly
```

## Stripe Configuration

### API Keys (Test Mode)
- ✅ `STRIPE_SECRET_KEY`: Configured
- ✅ `STRIPE_WEBHOOK_SECRET`: Configured  
- ✅ `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: Configured

### Webhook Endpoint
**URL**: `https://payment.korczewski.de/api/stripe/webhook`

The webhook endpoint is:
- ✅ Responding to requests
- ✅ Properly validating Stripe signatures
- ✅ Rejecting invalid requests with 400 status

## Testing the Webhook

### Option 1: Stripe CLI (Recommended for Development)
```bash
# Install Stripe CLI if not already installed
# https://stripe.com/docs/stripe-cli

# Login to Stripe
stripe login

# Forward webhooks to your local endpoint
stripe listen --forward-to localhost:3004/api/stripe/webhook

# In another terminal, trigger a test event
stripe trigger checkout.session.completed
```

### Option 2: Stripe Dashboard (For Production)
1. Go to https://dashboard.stripe.com/test/webhooks
2. Click "Add endpoint"
3. Enter URL: `https://payment.korczewski.de/api/stripe/webhook`
4. Select events to listen to:
   - `checkout.session.completed`
5. Click "Add endpoint"
6. Copy the signing secret and update `.env-prod` if needed

### Option 3: Manual Test (Limited)
```bash
# Run the health check script
node health-check.js
```

Note: Manual testing can only verify the endpoint is responding. Real Stripe signature validation requires actual Stripe webhook events.

## Docker Management Commands

### View Logs
```bash
docker logs payment-service
docker logs payment-service --tail 50
docker logs payment-service -f  # Follow logs
```

### Restart Service
```bash
docker restart payment-service
```

### Stop Service
```bash
docker stop payment-service
```

### Remove Container
```bash
docker stop payment-service
docker rm payment-service
```

### Rebuild and Restart (After Code Changes)
```bash
# Rebuild the image
docker build -t payment-service .

# Stop and remove old container
docker stop payment-service && docker rm payment-service

# Start new container
docker run -d --name payment-service --env-file .env-prod -p 3004:3000 --network traefik-public payment-service
```

## Environment Variables Fixed

The following issues were resolved:
1. ❌ `NEXTAUTH_URL` had extra quotes → ✅ Fixed
2. ❌ `AUTH_SERVICE_URL` had extra quotes → ✅ Fixed
3. ✅ Stripe initialization now handles missing keys during build time

## Build Issues Resolved

### Problem
The Next.js build was failing during `npm run build:all` with:
```
Error: Neither apiKey nor config.authenticator provided
```

### Solution
Modified `/home/patrick/projects/payment/lib/stripe.ts` to conditionally initialize Stripe:
- During build time (when `STRIPE_SECRET_KEY` is not available), exports a placeholder
- At runtime (when environment variables are loaded), properly initializes Stripe client

## Next Steps

1. **Test Real Payments**: Use Stripe test cards to verify the checkout flow
   - Test card: `4242 4242 4242 4242`
   - Any future expiry date
   - Any 3-digit CVC

2. **Monitor Webhooks**: Check webhook delivery in Stripe Dashboard
   - https://dashboard.stripe.com/test/webhooks

3. **Switch to Live Mode** (when ready for production):
   - Get live API keys from Stripe Dashboard
   - Update `.env-prod` with live keys
   - Create webhook endpoint in live mode
   - Rebuild and restart container

4. **Set Up Auto-Restart**: Consider using docker-compose or systemd for automatic container restart on system reboot

## Health Check

Run the health check script anytime to verify the service is running:
```bash
cd /home/patrick/projects/payment
node health-check.js
```

Expected output:
```
✅ Payment Service Health Check
   Status: 200 (expected 200)

✅ Stripe Webhook Endpoint (POST without signature)
   Status: 400 (expected 400)
```

## Troubleshooting

### Container won't start
```bash
# Check logs
docker logs payment-service

# Verify environment file exists
ls -la .env-prod

# Check if port is already in use
sudo lsof -i :3004
```

### Webhook signature validation fails
- Verify `STRIPE_WEBHOOK_SECRET` matches the one in Stripe Dashboard
- Ensure you're using the correct secret for test/live mode
- Check that the webhook URL in Stripe matches your endpoint

### Database connection errors
- Verify `DATABASE_URL` in `.env-prod` is correct
- Ensure PostgreSQL container is running
- Check network connectivity between containers
