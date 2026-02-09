import { requireAdmin } from '@/lib/actions/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
    const user = await requireAdmin().catch(() => null)
    if (!user) {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    const [notifications, unreadCount] = await Promise.all([
        db.notification.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' },
            take: 20,
        }),
        db.notification.count({
            where: { userId: user.id, read: false },
        }),
    ])

    return NextResponse.json({ notifications, unreadCount })
}
