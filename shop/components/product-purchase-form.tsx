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
        <div className="payment-purchase-form">
            {product.isService && (
                <div className="payment-form-group">
                    <label className="payment-form-label">Select Booking Time</label>
                    <input
                        type="datetime-local"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        className="payment-form-input"
                    />
                    <p className="payment-form-hint">Business Hours: Mon-Fri 09:00 - 17:00</p>
                </div>
            )}

            <button
                onClick={handleSubmit}
                disabled={loading}
                className="payment-btn-purchase"
            >
                {loading ? 'Processing...' : `Purchase for ${product.price} PC`}
            </button>

            {error && <p className="payment-error-message">{error}</p>}
        </div>
    )
}
