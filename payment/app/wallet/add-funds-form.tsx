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
        <div className="payment-form">
            <div className="payment-form-group">
                <label className="payment-form-label">Amount (PC)</label>
                <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="payment-form-input"
                />
                <p className="payment-form-hint">1 PC = $1.00 USD</p>
            </div>
            <button
                onClick={handleCheckout}
                className="payment-btn-submit"
            >
                Pay with Card (Stripe)
            </button>
            <button
                disabled
                className="payment-btn-submit"
                style={{ opacity: 0.5, cursor: 'not-allowed', background: 'var(--cv-glass-3)', border: '1px solid var(--cv-border-1)', color: 'var(--cv-text-muted)' }}
            >
                Pay with PayPal (Coming Soon)
            </button>
        </div>
    )
}
