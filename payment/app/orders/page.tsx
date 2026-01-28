import { requireAuth } from '@/lib/actions/auth'
export const dynamic = 'force-dynamic'
import { db } from '@/lib/db'
import { format } from 'date-fns'

export default async function OrdersPage() {
    const user = await requireAuth()

    const orders = await db.order.findMany({
        where: { userId: user.id },
        include: { items: { include: { product: true } } },
        orderBy: { createdAt: 'desc' }
    })

    return (
        <div className="payment-orders-container">
            <h1 className="payment-wallet-title">Order History</h1>

            {orders.length === 0 ? (
                <div className="payment-alert-message">
                    No orders recorded in your history.
                </div>
            ) : (
                <div className="payment-orders-list">
                    {orders.map(order => (
                        <div key={order.id} className="payment-order-card">
                            <div className="payment-order-header">
                                <div>
                                    <span className="payment-order-id">Order #{order.id.slice(-6)}</span>
                                    <span className="payment-order-date">{format(order.createdAt, 'PPP p')}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="cv-badge cv-badge-success">{order.status}</span>
                                    <span className="payment-order-total">{order.total.toString()} PC</span>
                                </div>
                            </div>
                            <ul className="payment-order-items">
                                {order.items.map(item => (
                                    <li key={item.id} className="payment-order-item">
                                        <span className="payment-order-item-title">{item.product.title} x {item.quantity}</span>
                                        <span className="payment-order-item-price">{item.price.toString()} PC</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
