import { requireAuth } from '@/lib/actions/auth'
import { db } from '@/lib/db'
import { format } from 'date-fns'

export default async function AppointmentsPage() {
    const user = await requireAuth()

    const bookings = await db.booking.findMany({
        where: { userId: user.id },
        orderBy: { startTime: 'desc' }
    })

    const serviceIds = bookings.map(b => b.serviceId).filter(id => id !== null) as string[]
    const products = await db.product.findMany({
        where: { id: { in: serviceIds } }
    })

    const productsMap = new Map(products.map(p => [p.id, p]))

    return (
        <div className="payment-appointments-container">
            <h1 className="payment-wallet-title">My Appointments</h1>

            {bookings.length === 0 ? (
                <div className="payment-alert-message">
                    No appointments scheduled.
                </div>
            ) : (
                <div className="payment-booking-list">
                    {bookings.map(booking => {
                        const product = booking.serviceId ? productsMap.get(booking.serviceId) : null
                        return (
                            <div key={booking.id} className="payment-appointment-card">
                                <div className="payment-appointment-info">
                                    <span className="payment-appointment-service">
                                        {product ? product.title : 'General Service'}
                                    </span>
                                    <span className="payment-appointment-time">
                                        {format(booking.startTime, 'PPPP')} at {format(booking.startTime, 'p')} - {format(booking.endTime, 'p')}
                                    </span>
                                </div>
                                <span className={`payment-appointment-status ${booking.status === 'CONFIRMED' ? 'status-confirmed' : 'status-cancelled'}`}>
                                    {booking.status}
                                </span>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
