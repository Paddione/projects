import { requireAuth } from '@/lib/actions/auth'
import { db } from '@/lib/db'
import AddFundsForm from './add-funds-form'

export default async function WalletPage() {
    const user = await requireAuth()

    const wallet = await db.wallet.findUnique({
        where: { userId: user.id }
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
