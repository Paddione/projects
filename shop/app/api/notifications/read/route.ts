import { requireAdmin } from '@/lib/actions/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST() {
    const user = await requireAdmin().catch(() => null)
    if (!user) {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    await db.notification.updateMany({
        where: { userId: user.id, read: false },
        data: { read: true },
    })

    return NextResponse.json({ success: true })
}
