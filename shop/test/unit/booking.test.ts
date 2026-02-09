import { describe, it, expect, vi } from 'vitest'
import { isBusinessHour } from '@/lib/booking'
import { setHours, setDay } from 'date-fns'

// Mock db
vi.mock('@/lib/db', () => ({
    db: {
        booking: {
            findFirst: vi.fn(),
            create: vi.fn(),
        }
    }
}))

describe('Booking Logic', () => {
    it('identifies business hours correctly', () => {
        // Mon 10:00
        const mondayMorning = setHours(setDay(new Date(), 1), 10)
        expect(isBusinessHour(mondayMorning)).toBe(true)

        // Sun 10:00
        const sundayMorning = setHours(setDay(new Date(), 0), 10)
        expect(isBusinessHour(sundayMorning)).toBe(false) // Weekend

        // Mon 20:00
        const mondayNight = setHours(setDay(new Date(), 1), 20)
        expect(isBusinessHour(mondayNight)).toBe(false) // After hours
    })
})
