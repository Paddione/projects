import { db } from '@/lib/db'
export const dynamic = 'force-dynamic'
import Link from 'next/link'

export default async function ShopPage() {
    const products = await db.product.findMany({
        where: { stock: { gt: 0 } },
        orderBy: { createdAt: 'desc' }
    })

    return (
        <div className="payment-shop-container">
            <h1 className="payment-shop-title">PatrickCoin Shop</h1>

            <div className="payment-products-grid">
                {products.map((product) => (
                    <div key={product.id} className="payment-product-card">
                        {product.imageUrl ? (
                            <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={product.imageUrl} alt={product.title} className="payment-product-image" />
                            </>
                        ) : (
                            <div className="payment-product-image-placeholder">No Image</div>
                        )}
                        <div className="payment-product-content">
                            <h2 className="payment-product-title">{product.title}</h2>
                            <p className="payment-product-description">{product.description}</p>
                            <div className="payment-product-footer">
                                <span className="payment-product-price">{product.price.toString()} PC</span>
                                <Link href={`/shop/${product.id}`} className="payment-btn-view-details">
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
