import { requireAuth } from '@/lib/actions/auth'
import { stripe } from '@/lib/stripe'
import { NextResponse } from 'next/server'

const RESPECT_PACKS = [
    { id: 'respect_500', name: 'Starter Pack', respect: 500, priceInCents: 499 },
    { id: 'respect_1200', name: 'Popular Pack', respect: 1200, priceInCents: 999 },
    { id: 'respect_3000', name: 'Premium Pack', respect: 3000, priceInCents: 1999 },
    { id: 'respect_7500', name: 'Ultimate Pack', respect: 7500, priceInCents: 4499 },
]

export async function POST(req: Request) {
    const user = await requireAuth().catch(() => null)
    if (!user) {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    if (!user.authUserId) {
        return new NextResponse('Auth user ID not available', { status: 400 })
    }

    const { packId } = await req.json()
    if (typeof packId !== 'string') {
        return new NextResponse('Missing packId', { status: 400 })
    }

    const pack = RESPECT_PACKS.find((p) => p.id === packId)
    if (!pack) {
        return new NextResponse('Unknown pack', { status: 400 })
    }

    const checkoutSession = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
            {
                price_data: {
                    currency: 'eur',
                    product_data: {
                        name: `${pack.name} — ${pack.respect.toLocaleString()} Respect`,
                        description: `Adds ${pack.respect.toLocaleString()} Respect to your arena account`,
                    },
                    unit_amount: pack.priceInCents,
                },
                quantity: 1,
            },
        ],
        mode: 'payment',
        success_url: `${process.env.NEXTAUTH_URL}/respect?success=1`,
        cancel_url: `${process.env.NEXTAUTH_URL}/respect?canceled=1`,
        metadata: {
            auth_user_id: user.authUserId.toString(),
            respect_amount: pack.respect.toString(),
            pack_id: pack.id,
        },
    })

    return NextResponse.json({ url: checkoutSession.url })
}
