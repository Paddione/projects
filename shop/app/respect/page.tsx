export const dynamic = 'force-dynamic'

import { getCurrentUser } from '@/lib/actions/auth'
import { headers } from 'next/headers'
import { getAuthLoginUrlFromHeaders } from '@/lib/actions/auth'
import BuyButton from './buy-button'

const RESPECT_PACKS = [
    {
        id: 'respect_500',
        name: 'Starter Pack',
        respect: 500,
        priceInCents: 499,
        popular: false,
        icon: '⚡',
        description: 'Get started in the arena',
    },
    {
        id: 'respect_1200',
        name: 'Popular Pack',
        respect: 1200,
        priceInCents: 999,
        popular: true,
        icon: '🔥',
        description: 'Best value — most popular choice',
    },
    {
        id: 'respect_3000',
        name: 'Premium Pack',
        respect: 3000,
        priceInCents: 1999,
        popular: false,
        icon: '💎',
        description: 'Serious players choose Premium',
    },
    {
        id: 'respect_7500',
        name: 'Ultimate Pack',
        respect: 7500,
        priceInCents: 4499,
        popular: false,
        icon: '👑',
        description: 'Dominate the arena completely',
    },
]

function formatPrice(cents: number): string {
    return (cents / 100).toFixed(2)
}

export default async function RespectPage({
    searchParams,
}: {
    searchParams: Promise<{ success?: string; canceled?: string }>
}) {
    const user = await getCurrentUser()
    const headersList = await headers()
    const loginUrl = await getAuthLoginUrlFromHeaders(headersList)
    const params = await searchParams

    // Fetch Respect balance from auth service if logged in
    let respectBalance: number | null = null
    if (user?.authUserId) {
        try {
            const authUrl =
                process.env.AUTH_SERVICE_URL || 'https://auth.korczewski.de'
            const res = await fetch(`${authUrl}/api/profile`, {
                headers: {
                    // Forward the user's session cookie from the incoming request
                    cookie: headersList.get('cookie') || '',
                },
                cache: 'no-store',
            })
            if (res.ok) {
                const profile = await res.json()
                respectBalance = profile.respect_balance ?? null
            }
        } catch {
            // Non-fatal — show page without balance
        }
    }

    return (
        <div className="shop-respect-container">
            <div className="shop-respect-hero">
                <h1 className="shop-respect-title">Respect Store</h1>
                <p className="shop-respect-subtitle">
                    Power up your arena presence with Respect — the currency of champions
                </p>
                {user && respectBalance !== null && (
                    <div className="shop-respect-balance-badge">
                        <span className="shop-respect-balance-icon">⚡</span>
                        <span className="shop-respect-balance-value">
                            {respectBalance.toLocaleString()} Respect
                        </span>
                    </div>
                )}
            </div>

            {params.success && (
                <div className="shop-respect-alert shop-respect-alert-success">
                    Purchase successful! Your Respect has been credited to your arena account.
                </div>
            )}
            {params.canceled && (
                <div className="shop-respect-alert shop-respect-alert-cancel">
                    Purchase canceled. No charge was made.
                </div>
            )}

            {!user && (
                <div className="shop-respect-login-prompt">
                    <p>You need to be logged in to purchase Respect packs.</p>
                    <a href={loginUrl} className="shop-btn-primary">
                        Login to Buy
                    </a>
                </div>
            )}

            <div className="shop-respect-packs-grid">
                {RESPECT_PACKS.map((pack) => (
                    <div
                        key={pack.id}
                        className={`shop-respect-pack-card${pack.popular ? ' shop-respect-pack-popular' : ''}`}
                    >
                        {pack.popular && (
                            <div className="shop-respect-popular-badge">Most Popular</div>
                        )}
                        <div className="shop-respect-pack-icon">{pack.icon}</div>
                        <h2 className="shop-respect-pack-name">{pack.name}</h2>
                        <p className="shop-respect-pack-description">{pack.description}</p>
                        <div className="shop-respect-pack-amount">
                            <span className="shop-respect-pack-number">
                                {pack.respect.toLocaleString()}
                            </span>
                            <span className="shop-respect-pack-label">Respect</span>
                        </div>
                        <div className="shop-respect-pack-price">
                            €{formatPrice(pack.priceInCents)}
                        </div>
                        {user ? (
                            <BuyButton packId={pack.id} />
                        ) : (
                            <a href={loginUrl} className="shop-respect-buy-btn">
                                Login to Buy
                            </a>
                        )}
                    </div>
                ))}
            </div>

            <div className="shop-respect-footer-note">
                <p>
                    Payments are processed securely by Stripe. Respect is credited to your
                    arena account immediately after payment confirmation.
                </p>
            </div>
        </div>
    )
}
