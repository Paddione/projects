'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface Notification {
    id: string
    type: string
    message: string
    read: boolean
    createdAt: string
}

export default function NotificationBell() {
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    const fetchNotifications = useCallback(async () => {
        try {
            const res = await fetch('/api/notifications')
            if (!res.ok) return
            const data = await res.json()
            setNotifications(data.notifications)
            setUnreadCount(data.unreadCount)
        } catch {
            // silently fail
        }
    }, [])

    useEffect(() => {
        fetchNotifications()
        const interval = setInterval(fetchNotifications, 30000)
        return () => clearInterval(interval)
    }, [fetchNotifications])

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const markAllRead = async () => {
        try {
            await fetch('/api/notifications/read', { method: 'POST' })
            setUnreadCount(0)
            setNotifications(prev => prev.map(n => ({ ...n, read: true })))
        } catch {
            // silently fail
        }
    }

    const timeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime()
        const mins = Math.floor(diff / 60000)
        if (mins < 1) return 'just now'
        if (mins < 60) return `${mins}m ago`
        const hours = Math.floor(mins / 60)
        if (hours < 24) return `${hours}h ago`
        return `${Math.floor(hours / 24)}d ago`
    }

    return (
        <div className="shop-notification-wrapper" ref={dropdownRef}>
            <button
                className="shop-notification-bell"
                onClick={() => setIsOpen(!isOpen)}
                aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {unreadCount > 0 && (
                    <span className="shop-notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
            </button>

            {isOpen && (
                <div className="shop-notification-dropdown">
                    <div className="shop-notification-dropdown-header">
                        <span>Notifications</span>
                        {unreadCount > 0 && (
                            <button onClick={markAllRead} className="shop-notification-mark-read">
                                Mark all read
                            </button>
                        )}
                    </div>
                    <div className="shop-notification-list">
                        {notifications.length === 0 ? (
                            <div className="shop-notification-empty">No notifications</div>
                        ) : (
                            notifications.map(n => (
                                <div key={n.id} className={`shop-notification-item ${!n.read ? 'unread' : ''}`}>
                                    <p className="shop-notification-message">{n.message}</p>
                                    <span className="shop-notification-time">{timeAgo(n.createdAt)}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
