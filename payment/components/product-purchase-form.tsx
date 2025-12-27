'use client'
import { purchaseProduct } from '@/lib/actions/order'
import { useState } from 'react'

// Define minimal interface to avoid Prisma imports issues in client component
interface ProductProps {
    id: string
    isService: boolean
    price: string | number | { toString: () => string }
}

export default function ProductPurchaseForm({ product }: { product: ProductProps }) {
    const [loading, setLoading] = useState(false)
    const [date, setDate] = useState('')
    const [error, setError] = useState('')

    async function handleSubmit() {
        console.log('Submitting purchase...')
        setLoading(true)
        setError('')
        try {
            if (product.isService && !date) {
                throw new Error('Please select a booking time.')
            }

            const bookingDate = date ? new Date(date) : undefined
            await purchaseProduct(product.id, 1, bookingDate)
            // Redirect handled by server action
        } catch (e: unknown) {
            console.error(e)
            const message = e instanceof Error ? e.message : 'Something went wrong'
            setError(message)
            setLoading(false)
        }
    }

    return (
        <div className="space-y-4">
            {product.isService && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Booking Time</label>
                    <input
                        type="datetime-local"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm border p-2"
                    />
                    <p className="text-xs text-gray-500 mt-1">Business Hours: Mon-Fri 09:00 - 17:00</p>
                </div>
            )}

            <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full bg-purple-600 text-white font-bold py-3 px-4 rounded hover:bg-purple-700 disabled:opacity-50"
            >
                {loading ? 'Processing...' : `Purchase for ${product.price} PC`}
            </button>

            {error && <p className="text-red-600 font-semibold">{error}</p>}
        </div>
    )
}
