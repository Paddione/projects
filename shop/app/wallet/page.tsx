import { requireAuth } from '@/lib/actions/auth'
import { db } from '@/lib/db'
import AddFundsForm from './add-funds-form'

export default async function WalletPage() {
    const user = await requireAuth()

    const wallet = await db.wallet.findUnique({
        where: { userId: user.id }
    })

    return (
        <div className="shop-wallet-container">
            <h1 className="shop-wallet-title">My Wallet</h1>

            <div className="shop-balance-card">
                <h2 className="shop-balance-label">Current Balance</h2>
                <p className="shop-balance-amount">{wallet?.balance.toString()} GC</p>
            </div>

            <div className="shop-add-funds-card">
                <h2 className="shop-card-title">Add Funds</h2>
                <AddFundsForm />
            </div>
        </div>
    )
}
