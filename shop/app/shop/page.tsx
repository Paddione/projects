import { db } from '@/lib/db'
export const dynamic = 'force-dynamic'
import Link from 'next/link'
import ViewDetailsLink from '@/components/view-details-link'

export default async function ShopPage() {
    const products = await db.product.findMany({
        where: { stock: { gt: 0 } },
        orderBy: { createdAt: 'desc' }
    })

    return (
        <div className="shop-shop-container">
            <h1 className="shop-shop-title">GoldCoins Shop</h1>
            <p className="shop-shop-subtitle">
                Exclusive digital goods, premium services, and expert consultations
            </p>

            <div className="shop-products-grid">
                {products.map((product) => (
                    <div
                        key={product.id}
                        className="shop-product-card"
                        tabIndex={0}
                        role="link"
                        aria-label={`View details for ${product.title}`}
                    >
                        {product.imageUrl ? (
                            <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={product.imageUrl} alt={product.title} className="shop-product-image" />
                            </>
                        ) : (
                            <div className="shop-product-image-placeholder">No Image</div>
                        )}
                        <div className="shop-product-content">
                            <div className="shop-product-header">
                                <h2 className="shop-product-title">{product.title}</h2>
                                {product.isService && (
                                    <span className="cv-badge cv-badge-purple">Service</span>
                                )}
                            </div>
                            <p className="shop-product-description">{product.description}</p>
                            <div className="shop-product-footer">
                                <span className="shop-product-price">{product.price.toString()} GC</span>
                                <ViewDetailsLink href={`/shop/${product.id}`} className="shop-btn-view-details">
                                    View Details
                                </ViewDetailsLink>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
