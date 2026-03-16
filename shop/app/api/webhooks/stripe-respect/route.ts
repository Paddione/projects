import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { headers } from 'next/headers'

const AUTH_SERVICE_URL =
    process.env.AUTH_SERVICE_URL || 'https://auth.korczewski.de'

export async function POST(req: Request) {
    const body = await req.text()
    const headersList = await headers()
    const signature = headersList.get('Stripe-Signature') as string

    let event
    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!,
        )
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown Error'
        return new Response(`Webhook Error: ${message}`, { status: 400 })
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session

        // Only process Respect pack purchases (they have auth_user_id in metadata)
        const authUserId = session.metadata?.auth_user_id
        const respectAmount = parseInt(session.metadata?.respect_amount || '0', 10)
        const packId = session.metadata?.pack_id

        if (!authUserId || !respectAmount || !packId) {
            // Not a Respect purchase — ignore silently
            return new Response(null, { status: 200 })
        }

        try {
            const response = await fetch(
                `${AUTH_SERVICE_URL}/api/internal/respect/credit`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: parseInt(authUserId, 10),
                        amount: respectAmount,
                        metadata: {
                            source: 'shop_stripe',
                            pack_id: packId,
                            stripe_session_id: session.id,
                        },
                    }),
                },
            )

            if (!response.ok) {
                const text = await response.text()
                console.error(
                    `[stripe-respect webhook] respect/credit failed: ${response.status} ${text}`,
                )
                // Return 500 so Stripe retries the webhook
                return new Response('Failed to credit respect', { status: 500 })
            }

            console.log(
                `[stripe-respect webhook] Credited ${respectAmount} Respect to auth user ${authUserId} (pack: ${packId}, session: ${session.id})`,
            )
        } catch (err) {
            console.error('[stripe-respect webhook] Network error:', err)
            return new Response('Internal error', { status: 500 })
        }
    }

    return new Response(null, { status: 200 })
}
