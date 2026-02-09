import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { headers } from 'next/headers'
import { processTransaction } from '@/lib/ledger'

export async function POST(req: Request) {
    const body = await req.text()
    const headersList = await headers()
    const signature = headersList.get('Stripe-Signature') as string

    let event
    try {
        event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown Error';
        return new Response(`Webhook Error: ${message}`, { status: 400 })
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.userId
        const amountCoins = parseFloat(session.metadata?.amountCoins || '0')

        if (!session.metadata || !userId) {
            console.error('Missing metadata in webhook session', session.id)
            return new Response('Missing metadata', { status: 400 })
        }

        await processTransaction({
            userId,
            amount: amountCoins, // Positive for deposit
            type: 'DEPOSIT',
            referenceId: session.id,
            description: 'Stripe Deposit'
        })
    }

    return new Response(null, { status: 200 })
}
