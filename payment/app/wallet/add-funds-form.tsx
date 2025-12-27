'use client'
import { useState } from 'react'

export default function AddFundsForm() {
    const [amount, setAmount] = useState(10)

    const handleCheckout = async () => {
        const res = await fetch('/api/stripe/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount }),
        })
        const data = await res.json()
        if (data.url) {
            window.location.href = data.url
        }
    }

    return (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700">Amount (PC)</label>
                <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                />
                <p className="text-sm text-gray-500 mt-1">1 PC = $1.00 USD</p>
            </div>
            <button
                onClick={handleCheckout}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-full"
            >
                Pay with Card (Stripe)
            </button>
            <button
                disabled
                className="bg-gray-300 text-gray-600 px-4 py-2 rounded w-full cursor-not-allowed"
            >
                Pay with PayPal (Coming Soon)
            </button>
        </div>
    )
}
