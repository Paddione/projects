'use client'
import { useState } from 'react'

const PRESETS = [100, 500, 1000, 5000, 10000]
const MIN = 100
const MAX = 10000
const STEP = 100

export default function AddFundsForm() {
    const [amount, setAmount] = useState(500)

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
        <div className="shop-form">
            {/* Preset quick-buy buttons */}
            <div className="shop-preset-buttons">
                {PRESETS.map((preset) => (
                    <button
                        key={preset}
                        className={`shop-preset-btn ${amount === preset ? 'active' : ''}`}
                        onClick={() => setAmount(preset)}
                        type="button"
                    >
                        {preset.toLocaleString()} GC
                    </button>
                ))}
            </div>

            {/* Range slider */}
            <div className="shop-form-group">
                <label className="shop-form-label">Custom Amount</label>
                <input
                    type="range"
                    min={MIN}
                    max={MAX}
                    step={STEP}
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="shop-slider"
                />
                <div className="shop-slider-labels">
                    <span>{MIN} GC</span>
                    <span>{MAX.toLocaleString()} GC</span>
                </div>
            </div>

            {/* Live conversion display */}
            <div className="shop-conversion-display">
                <span className="shop-conversion-amount">{amount.toLocaleString()} GC</span>
                <span className="shop-conversion-equals">=</span>
                <span className="shop-conversion-eur">{(amount / 100).toFixed(2)} EUR</span>
            </div>

            <button
                onClick={handleCheckout}
                className="shop-btn-submit"
            >
                Pay {(amount / 100).toFixed(2)} EUR with Card (Stripe)
            </button>
        </div>
    )
}
