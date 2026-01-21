import Link from 'next/link'
import { getCurrentUser } from '@/lib/actions/auth'

export default async function Header() {
    const user = await getCurrentUser()

    return (
        <header className="payment-header">
            <div className="payment-header-content">
                <Link href="/" className="payment-logo">
                    PatrickCoin
                </Link>

                <nav className="payment-nav">
                    <Link href="/shop" className="payment-nav-link">Shop</Link>
                    {user ? (
                        <>
                            <Link href="/wallet" className="payment-nav-link">Wallet</Link>
                            <Link href="/orders" className="payment-nav-link">Orders</Link>
                            {user.role === 'ADMIN' && (
                                <Link href="/admin" className="payment-nav-link payment-nav-admin">Admin</Link>
                            )}
                            <span className="payment-nav-user">{user.email}</span>
                            <a href={`${process.env.AUTH_SERVICE_URL || 'https://auth.korczewski.de'}/logout`} className="payment-btn-signout">
                                Sign Out
                            </a>
                        </>
                    ) : (
                        <a href={`${process.env.AUTH_SERVICE_URL || 'https://auth.korczewski.de'}/login?redirect=${encodeURIComponent('https://shop.korczewski.de')}`} className="payment-btn-login">
                            Login
                        </a>
                    )}
                </nav>
            </div>
        </header>
    )
}
