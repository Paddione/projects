import Stripe from 'stripe'

// During build time, STRIPE_SECRET_KEY might not be available
// We'll initialize it lazily at runtime
const isBuildTime = !process.env.STRIPE_SECRET_KEY

export const stripe = isBuildTime
    ? ({} as Stripe) // Placeholder during build
    : new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2024-11-20.acacia' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        typescript: true,
    })

