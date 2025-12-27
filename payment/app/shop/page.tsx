import { db } from '@/lib/db'
export const dynamic = 'force-dynamic'
import Link from 'next/link'

export default async function ShopPage() {
    const products = await db.product.findMany({
        where: { stock: { gt: 0 } },
        orderBy: { createdAt: 'desc' }
    })

    return (
        <div className="max-w-6xl mx-auto p-8">
            <h1 className="text-4xl font-bold mb-8 text-center text-purple-700">PatrickCoin Shop</h1>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
                {products.map((product) => (
                    <div key={product.id} className="bg-white rounded-lg shadow-lg overflow-hidden transition hover:scale-105">
                        {product.imageUrl ? (
                            <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={product.imageUrl} alt={product.title} className="w-full h-48 object-cover" />
                            </>
                        ) : (
                            <div className="w-full h-48 bg-gray-200 flex items-center justify-center text-gray-500">No Image</div>
                        )}
                        <div className="p-6">
                            <h2 className="text-xl font-bold mb-2">{product.title}</h2>
                            <p className="text-gray-600 mb-4 line-clamp-2">{product.description}</p>
                            <div className="flex justify-between items-center">
                                <span className="text-2xl font-bold text-green-600">{product.price.toString()} PC</span>
                                <Link href={`/shop/${product.id}`} className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700">
                                    View Details
                                </Link>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
