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
        <div className="max-w-4xl mx-auto p-8">
            <h1 className="text-3xl font-bold mb-8">Order History</h1>

            {orders.length === 0 ? (
                <p>No orders yet.</p>
            ) : (
                <div className="space-y-6">
                    {orders.map(order => (
                        <div key={order.id} className="bg-white rounded shadow p-6">
                            <div className="flex justify-between items-center mb-4 border-b pb-2">
                                <div>
                                    <span className="font-bold text-lg">Order #{order.id.slice(-6)}</span>
                                    <span className="text-gray-500 text-sm ml-2">{format(order.createdAt, 'PPP p')}</span>
                                </div>
                                <div>
                                    <span className="bg-green-100 text-green-800 text-sm font-medium mr-2 px-2.5 py-0.5 rounded">{order.status}</span>
                                    <span className="font-bold text-xl">{order.total.toString()} PC</span>
                                </div>
                            </div>
                            <ul className="space-y-2">
                                {order.items.map(item => (
                                    <li key={item.id} className="flex justify-between">
                                        <span>{item.product.title} x {item.quantity}</span>
                                        <span>{item.price.toString()} PC</span>
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
