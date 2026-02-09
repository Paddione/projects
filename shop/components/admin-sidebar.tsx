'use client'

import { useState, useEffect } from 'react'

export default function AdminSidebar({ children }: { children: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false)

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth > 768) setIsOpen(false)
        }
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => { document.body.style.overflow = '' }
    }, [isOpen])

    return (
        <>
            <button
                className="payment-admin-sidebar-toggle"
                onClick={() => setIsOpen(!isOpen)}
                aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
                aria-expanded={isOpen}
            >
                ☰ Menu
            </button>
            <aside className={`payment-admin-sidebar ${isOpen ? 'payment-admin-sidebar-open' : ''}`}>
                <div onClick={() => setIsOpen(false)}>
                    {children}
                </div>
            </aside>
            {isOpen && <div className="payment-admin-mobile-backdrop" onClick={() => setIsOpen(false)} />}
        </>
    )
}
