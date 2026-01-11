import Link from 'next/link'
import { auth } from '@/auth'
// auth helpers are usually server side. For a client header with dynamic login state, we need a client component or hybrid.
// Let's make a server component that fetches session.

export default async function Header() {
    const session = await auth()

    return (
        <header className="payment-header">
            <div className="payment-header-content">
                <Link href="/" className="payment-logo">
                    PatrickCoin
                </Link>

                <nav className="payment-nav">
                    <Link href="/shop" className="payment-nav-link">Shop</Link>
                    {session?.user ? (
                        <>
                            <Link href="/wallet" className="payment-nav-link">Wallet</Link>
                            <Link href="/orders" className="payment-nav-link">Orders</Link>
                            {session.user.role === 'ADMIN' && (
                                <Link href="/admin" className="payment-nav-link payment-nav-admin">Admin</Link>
                            )}
                            <span className="payment-nav-user">{session.user.email}</span>
                            <Link href="/api/auth/signout" className="payment-btn-signout">
                                Sign Out
                            </Link>
                        </>
                    ) : (
                        <Link href="/login" className="payment-btn-login">
                            Login
                        </Link>
                    )}
                </nav>
            </div>
        </header>
    )
}
