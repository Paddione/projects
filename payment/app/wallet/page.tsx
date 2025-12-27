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
        <div className="max-w-4xl mx-auto p-8">
            <h1 className="text-3xl font-bold mb-8">My Wallet</h1>

            <div className="bg-white p-6 rounded shadow mb-8">
                <h2 className="text-xl font-semibold mb-2">Current Balance</h2>
                <p className="text-4xl font-bold text-green-600">{wallet?.balance.toString()} PC</p>
            </div>

            <div className="bg-white p-6 rounded shadow">
                <h2 className="text-xl font-semibold mb-4">Add Funds</h2>
                <AddFundsForm />
            </div>
        </div>
    )
}
