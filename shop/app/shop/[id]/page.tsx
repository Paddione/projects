import { db } from '@/lib/db'
import ProductPurchaseForm from '@/components/product-purchase-form'
import { notFound } from 'next/navigation'

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const product = await db.product.findUnique({ where: { id } })

    if (!product) notFound()

    return (
        <div className="shop-product-detail-container">
            <div className="shop-product-detail-card">
                <div className="shop-product-detail-image-section">
                    {product.imageUrl ? (
                        <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={product.imageUrl} alt={product.title} className="shop-product-detail-image" />
                        </>
                    ) : (
                        <div className="shop-product-detail-image-placeholder">No Image</div>
                    )}
                </div>
                <div className="shop-product-detail-content">
                    <div className="shop-product-detail-header">
                        <h1 className="shop-product-detail-title">{product.title}</h1>
                        <div className="shop-product-detail-badges">
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
                    <p className="shop-product-detail-description">{product.description}</p>

                    <div className="shop-product-detail-purchase">
                        <ProductPurchaseForm product={{ ...product, price: Number(product.price) }} />
                    </div>
                </div>
            </div>
        </div>
    )
}
