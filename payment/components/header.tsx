import Link from 'next/link'
import { auth } from '@/auth'
// auth helpers are usually server side. For a client header with dynamic login state, we need a client component or hybrid.
// Let's make a server component that fetches session.

export default async function Header() {
    const session = await auth()

    return (
        <header className="bg-purple-900 text-white p-4 shadow-md">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
                <Link href="/" className="text-2xl font-bold hover:text-purple-200">
                    PatrickCoin
                </Link>

                <nav className="space-x-4">
                    <Link href="/shop" className="hover:text-purple-200">Shop</Link>
                    {session?.user ? (
                        <>
                            <Link href="/wallet" className="hover:text-purple-200">Wallet</Link>
                            <Link href="/orders" className="hover:text-purple-200">Orders</Link>
                            {session.user.role === 'ADMIN' && (
                                <Link href="/admin" className="hover:text-purple-200 font-bold border-l pl-4 border-purple-700">Admin</Link>
                            )}
                            <span className="text-gray-300 mx-2">|</span>
                            <span className="font-semibold">{session.user.email}</span>
                            <Link href="/api/auth/signout" className="bg-purple-700 px-3 py-1 rounded hover:bg-purple-600 text-sm ml-4">
                                Sign Out
                            </Link>
                        </>
                    ) : (
                        <Link href="/login" className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 font-bold">
                            Login
                        </Link>
                    )}
                </nav>
            </div>
        </header>
    )
}
