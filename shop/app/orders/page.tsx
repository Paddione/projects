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
        <div className="shop-orders-container">
            <h1 className="shop-wallet-title">Order History</h1>

            {orders.length === 0 ? (
                <div className="shop-alert-message">
                    No orders recorded in your history.
                </div>
            ) : (
                <div className="shop-orders-list">
                    {orders.map(order => (
                        <div key={order.id} className="shop-order-card">
                            <div className="shop-order-header">
                                <div>
                                    <span className="shop-order-id">Order #{order.id.slice(-6)}</span>
                                    <span className="shop-order-date">{format(order.createdAt, 'PPP p')}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="cv-badge cv-badge-success">{order.status}</span>
                                    <span className="shop-order-total">{order.total.toString()} GC</span>
                                </div>
                            </div>
                            <ul className="shop-order-items">
                                {order.items.map(item => (
                                    <li key={item.id} className="shop-order-item">
                                        <span className="shop-order-item-title">{item.product.title} x {item.quantity}</span>
                                        <span className="shop-order-item-price">{item.price.toString()} GC</span>
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
