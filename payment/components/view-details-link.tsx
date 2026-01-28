'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'

export default function ViewDetailsLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
    const router = useRouter()

    return (
        <Link
            href={href}
            className={className}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    router.push(href)
                }
            }}
        >
            {children}
        </Link>
    )
}
