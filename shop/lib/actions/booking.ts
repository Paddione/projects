'use server'
import { requireAdmin } from '@/lib/actions/auth'
import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function cancelBooking(bookingId: string) {
    await requireAdmin()
    await db.booking.update({
        where: { id: bookingId },
        data: { status: 'CANCELLED' }
    })
    revalidatePath('/admin/bookings')
    revalidatePath('/appointments')
}
