import { requireAdmin } from '@/lib/actions/auth'
import { db } from '@/lib/db'
import { format } from 'date-fns'
import { cancelBooking } from '@/lib/actions/booking'

export default async function AdminBookingsPage() {
    await requireAdmin()

    const bookings = await db.booking.findMany({
        include: { user: true },
        orderBy: { startTime: 'desc' }
    })

    const serviceIds = bookings.map(b => b.serviceId).filter(id => id !== null) as string[]
    const products = await db.product.findMany({
        where: { id: { in: serviceIds } }
    })

    const productsMap = new Map(products.map(p => [p.id, p]))

    return (
        <div className="shop-admin-container">
            <div className="shop-admin-header">
                <h1 className="shop-admin-title">Booking Management</h1>
            </div>

            <div className="shop-admin-table-container">
                <table className="shop-admin-table">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Service</th>
                            <th>Time Slot</th>
                            <th>Status</th>
                            <th className="shop-admin-table-actions-header">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {bookings.map(booking => {
                            const product = booking.serviceId ? productsMap.get(booking.serviceId) : null
                            return (
                                <tr key={booking.id}>
                                    <td>
                                        <div className="shop-admin-table-product-info">
                                            <span className="shop-admin-table-product-title">{booking.user.name || booking.user.email}</span>
                                            <span className="shop-admin-table-product-description">{booking.user.email}</span>
                                        </div>
                                    </td>
                                    <td>{product ? product.title : 'General Service'}</td>
                                    <td>
                                        <div style={{ display: 'flex', flexDirection: 'column', fontSize: 'var(--cv-text-sm)' }}>
                                            <span>{format(booking.startTime, 'MMM d, yyyy')}</span>
                                            <span style={{ color: 'var(--cv-text-dim)' }}>{format(booking.startTime, 'p')} - {format(booking.endTime, 'p')}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`shop-appointment-status ${booking.status === 'CONFIRMED' ? 'status-confirmed' : 'status-cancelled'}`}>
                                            {booking.status}
                                        </span>
                                    </td>
                                    <td className="shop-admin-table-actions">
                                        {booking.status === 'CONFIRMED' && (
                                            <form action={cancelBooking.bind(null, booking.id)}>
                                                <button type="submit" className="shop-admin-btn-delete">
                                                    Cancel
                                                </button>
                                            </form>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                        {bookings.length === 0 && (
                            <tr>
                                <td colSpan={5} style={{ textAlign: 'center', padding: 'var(--cv-space-8)', color: 'var(--cv-text-dim)' }}>
                                    No bookings found in the system.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
