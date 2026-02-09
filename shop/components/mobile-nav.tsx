'use client'

import { useState, useEffect } from 'react'

export default function MobileNav({ children }: { children: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false)

    // Close menu on route change (resize)
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth > 768) setIsOpen(false)
        }
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    // Prevent body scroll when menu is open
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
                className="shop-mobile-menu-toggle"
                onClick={() => setIsOpen(!isOpen)}
                aria-label={isOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={isOpen}
            >
                <span className={`shop-hamburger ${isOpen ? 'open' : ''}`}>
                    <span />
                    <span />
                    <span />
                </span>
            </button>
            <nav className={`shop-nav ${isOpen ? 'shop-nav-open' : ''}`}>
                <div onClick={() => setIsOpen(false)}>
                    {children}
                </div>
            </nav>
            {isOpen && <div className="shop-mobile-backdrop" onClick={() => setIsOpen(false)} />}
        </>
    )
}
