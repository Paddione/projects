import { requireAuth } from '@/lib/actions/auth'
import { stripe } from '@/lib/stripe'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
    const user = await requireAuth().catch(() => null)
    if (!user) {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    const { amount } = await req.json()
    // Amount in GoldCoins. 1 GC = 1 euro cent. 100 GC = 1 EUR.

    if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 100 || amount > 10000) {
        return new NextResponse('Invalid amount', { status: 400 })
    }

    const checkoutSession = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
            {
                price_data: {
                    currency: 'eur',
                    product_data: {
                        name: 'GoldCoins',
                    },
                    unit_amount: 1, // 1 euro cent per GoldCoin
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
