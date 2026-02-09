import Link from 'next/link'
import { headers } from 'next/headers'
import { getAuthLoginUrlFromHeaders, getCurrentUser } from '@/lib/actions/auth'
import MobileNav from './mobile-nav'
import NotificationBell from './notification-bell'

export default async function Header() {
    const user = await getCurrentUser()
    const headersList = await headers()
    const loginUrl = await getAuthLoginUrlFromHeaders(headersList)

    return (
        <header className="shop-header">
            <div className="shop-header-content">
                <Link href="/" className="shop-logo">
                    GoldCoins
                </Link>

                <MobileNav>
                    <Link href="/shop" className="shop-nav-link">Shop</Link>
                    {user ? (
                        <>
                            <Link href="/wallet" className="shop-nav-link">Wallet</Link>
                            <Link href="/orders" className="shop-nav-link">Orders</Link>
                            <Link href="/appointments" className="shop-nav-link">Appointments</Link>
                            {user.role === 'ADMIN' && (
                                <>
                                    <Link href="/admin" className="shop-nav-link shop-nav-admin">Admin</Link>
                                    <NotificationBell />
                                </>
                            )}
                            <span className="shop-nav-user">{user.email}</span>
                            <a href={`${process.env.AUTH_SERVICE_URL || 'https://auth.korczewski.de'}/logout`} className="shop-btn-signout">
                                Sign Out
                            </a>
                        </>
                    ) : (
                        <a href={loginUrl} className="shop-btn-login">
                            Login
                        </a>
                    )}
                </MobileNav>
            </div>
        </header>
    )
}
