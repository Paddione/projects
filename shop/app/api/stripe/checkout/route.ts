import { requireAuth } from '@/lib/actions/auth'
import { stripe } from '@/lib/stripe'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
    const user = await requireAuth().catch(() => null)
    if (!user) {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    const { amount } = await req.json()
    // Amount in PatrickCoins. 1 PC = 1 USD.

    const checkoutSession = await stripe.checkout.sessions.create({
        payment_method_types: ['card'], // PayPal requires different setup or checking 'paypal' here if supported in Stripe account
        line_items: [
            {
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: 'PatrickCoin',
                    },
                    unit_amount: 100, // $1.00 in cents
                },
                quantity: amount,
            },
        ],
        mode: 'payment',
        success_url: `${process.env.NEXTAUTH_URL}/wallet?success=1`,
        cancel_url: `${process.env.NEXTAUTH_URL}/wallet?canceled=1`,
        metadata: {
            userId: user.id,
            amountCoins: amount.toString(),
        },
    })

    return NextResponse.json({ url: checkoutSession.url })
}
