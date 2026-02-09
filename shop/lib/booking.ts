import { db } from '@/lib/db'
import { addHours, isWeekend, getHours } from 'date-fns'

// Business Hours: Mon-Fri, 09:00 - 17:00
const BUSINESS_START_HOUR = 9
const BUSINESS_END_HOUR = 17

export function isBusinessHour(date: Date): boolean {
    if (isWeekend(date)) return false
    const hour = getHours(date)
    return hour >= BUSINESS_START_HOUR && hour < BUSINESS_END_HOUR
}

export async function checkAvailability(serviceId: string, startTime: Date, endTime: Date) {
    // 1. Check Business Hours
    // Check start and end time. Assuming bookings don't span multiple days for now.
    if (!isBusinessHour(startTime) || !isBusinessHour(addHours(endTime, -0.01))) {
        return { available: false, reason: 'Outside business hours' }
    }

    // 2. Check overlap
    const conflict = await db.booking.findFirst({
        where: {
            serviceId,
            status: 'CONFIRMED',
            OR: [
                {
                    startTime: { lt: endTime },
                    endTime: { gt: startTime }
                }
            ]
        }
    })

    if (conflict) {
        return { available: false, reason: 'Slot already booked' }
    }

    return { available: true }
}

export async function createBooking(userId: string, serviceId: string, startTime: Date) {
    const endTime = addHours(startTime, 1) // Assume 1 hour default for now

    const availability = await checkAvailability(serviceId, startTime, endTime)
    if (!availability.available) {
        throw new Error(availability.reason)
    }

    return await db.booking.create({
        data: {
            userId,
            serviceId,
            startTime,
            endTime,
            status: 'CONFIRMED'
        }
    })
}
