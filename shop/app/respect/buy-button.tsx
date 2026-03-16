'use client'

import { useState } from 'react'

interface BuyButtonProps {
    packId: string
}

export default function BuyButton({ packId }: BuyButtonProps) {
    const [loading, setLoading] = useState(false)

    const handleBuy = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ packId }),
            })
            if (res.status === 401) {
                // Not logged in — let the page reload handle redirect
                window.location.reload()
                return
            }
            const data = await res.json()
            if (data.url) {
                window.location.href = data.url
            }
        } catch {
            // silently reset
        } finally {
            setLoading(false)
        }
    }

    return (
        <button
            onClick={handleBuy}
            disabled={loading}
            className="shop-respect-buy-btn"
        >
            {loading ? 'Redirecting...' : 'Buy Now'}
        </button>
    )
}
