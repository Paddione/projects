import { auth } from '@/auth'
import { db } from '@/lib/db'
import AddFundsForm from './add-funds-form'
// Separating client component for interactivity

export default async function WalletPage() {
    const session = await auth()
    if (!session?.user) return <div>Please login</div>

    const wallet = await db.wallet.findUnique({
        where: { userId: session.user.id }
    })

    return (
        <div className="payment-wallet-container">
            <h1 className="payment-wallet-title">My Wallet</h1>

            <div className="payment-balance-card">
                <h2 className="payment-balance-label">Current Balance</h2>
                <p className="payment-balance-amount">{wallet?.balance.toString()} PC</p>
            </div>

            <div className="payment-add-funds-card">
                <h2 className="payment-card-title">Add Funds</h2>
                <AddFundsForm />
            </div>
        </div>
    )
}
