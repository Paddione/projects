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
        <div className="payment-shop-container">
            <h1 className="payment-shop-title">PatrickCoin Shop</h1>
            <p className="payment-shop-subtitle">
                Exclusive digital goods, premium services, and expert consultations
            </p>

            <div className="payment-products-grid">
                {products.map((product) => (
                    <div
                        key={product.id}
                        className="payment-product-card"
                        tabIndex={0}
                        role="link"
                        aria-label={`View details for ${product.title}`}
                    >
                        {product.imageUrl ? (
                            <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={product.imageUrl} alt={product.title} className="payment-product-image" />
                            </>
                        ) : (
                            <div className="payment-product-image-placeholder">No Image</div>
                        )}
                        <div className="payment-product-content">
                            <div className="payment-product-header">
                                <h2 className="payment-product-title">{product.title}</h2>
                                {product.isService && (
                                    <span className="cv-badge cv-badge-purple">Service</span>
                                )}
                            </div>
                            <p className="payment-product-description">{product.description}</p>
                            <div className="payment-product-footer">
                                <span className="payment-product-price">{product.price.toString()} PC</span>
                                <ViewDetailsLink href={`/shop/${product.id}`} className="payment-btn-view-details">
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
