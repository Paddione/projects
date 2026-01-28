'use client'

import { useEffect } from 'react'

/**
 * KeyboardNavigation component
 * 
 * Provides global keyboard event handlers to improve accessibility:
 * 1. Allows 'Space' key to activate links that have role="button" or specific button classes.
 * 2. Ensures 'Enter' key activates non-native interactive elements (role="button" or role="link").
 */
export default function KeyboardNavigation() {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // 1. Handle Space key for links acting as buttons
            if (e.key === ' ' || e.code === 'Space') {
                const activeElement = document.activeElement;

                if (activeElement instanceof HTMLAnchorElement) {
                    const hasButtonRole = activeElement.getAttribute('role') === 'button';
                    const hasButtonClass = Array.from(activeElement.classList).some(cls =>
                        cls.includes('btn') || cls.includes('button') || cls.includes('card')
                    );

                    if (hasButtonRole || hasButtonClass) {
                        e.preventDefault();
                        activeElement.click();
                    }
                }
            }

            // 2. Handle Enter key for non-interactive elements that have role="button" or role="link"
            if (e.key === 'Enter') {
                const activeElement = document.activeElement;
                if (activeElement instanceof HTMLElement &&
                    (activeElement.getAttribute('role') === 'button' || activeElement.getAttribute('role') === 'link') &&
                    !(activeElement instanceof HTMLButtonElement) &&
                    !(activeElement instanceof HTMLAnchorElement)) {

                    // For product cards, we might want to click the first link inside them
                    const mainLink = activeElement.querySelector('a');
                    if (mainLink) {
                        e.preventDefault();
                        mainLink.click();
                    } else {
                        e.preventDefault();
                        activeElement.click();
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return null;
}
