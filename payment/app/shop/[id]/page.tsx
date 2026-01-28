import { db } from '@/lib/db'
import ProductPurchaseForm from '@/components/product-purchase-form'
import { notFound } from 'next/navigation'

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const product = await db.product.findUnique({ where: { id } })

    if (!product) notFound()

    return (
        <div className="payment-product-detail-container">
            <div className="payment-product-detail-card">
                <div className="payment-product-detail-image-section">
                    {product.imageUrl ? (
                        <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={product.imageUrl} alt={product.title} className="payment-product-detail-image" />
                        </>
                    ) : (
                        <div className="payment-product-detail-image-placeholder">No Image</div>
                    )}
                </div>
                <div className="payment-product-detail-content">
                    <div className="payment-product-detail-header">
                        <h1 className="payment-product-detail-title">{product.title}</h1>
                        <div className="payment-product-detail-badges">
                            {product.isService ? (
                                <span className="cv-badge cv-badge-purple">Service</span>
                            ) : (
                                <span className="cv-badge cv-badge-cyan">Product</span>
                            )}
                            <span className="cv-badge cv-badge-success">
                                {product.stock} in stock
                            </span>
                        </div>
                    </div>
                    <p className="payment-product-detail-description">{product.description}</p>

                    <div className="payment-product-detail-purchase">
                        <ProductPurchaseForm product={{ ...product, price: Number(product.price) }} />
                    </div>
                </div>
            </div>
        </div>
    )
}
