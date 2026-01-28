import { db } from '@/lib/db'
import Link from 'next/link'
import { deleteProduct } from '@/lib/actions/product'

import { Product } from '@prisma/client'

export default async function AdminProductsPage() {
    const products = await db.product.findMany({ orderBy: { createdAt: 'desc' } })

    return (
        <div className="payment-admin-container">
            <div className="payment-admin-header">
                <div>
                    <h1 className="payment-admin-title">Products & Services</h1>
                    <p className="payment-admin-subtitle">Manage your shop inventory</p>
                </div>
                <Link href="/admin/products/new" className="cv-btn cv-btn-primary">
                    + Add New Item
                </Link>
            </div>

            <div className="payment-admin-table-container">
                <table className="payment-admin-table">
                    <thead>
                        <tr>
                            <th>Image</th>
                            <th>Name</th>
                            <th>Price (PC)</th>
                            <th>Stock</th>
                            <th>Type</th>
                            <th className="payment-admin-table-actions-header">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {products.map((product: Product) => (
                            <tr key={product.id}>
                                <td>
                                    {product.imageUrl && (
                                        <>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={product.imageUrl} alt={product.title} className="payment-admin-table-image" />
                                        </>
                                    )}
                                </td>
                                <td>
                                    <div className="payment-admin-table-product-info">
                                        <div className="payment-admin-table-product-title">{product.title}</div>
                                        <div className="payment-admin-table-product-description">{product.description}</div>
                                    </div>
                                </td>
                                <td>
                                    <span className="payment-admin-table-price">{product.price.toString()}</span>
                                </td>
                                <td>
                                    <span className={product.stock > 0 ? 'cv-badge cv-badge-success' : 'cv-badge cv-badge-danger'}>
                                        {product.stock}
                                    </span>
                                </td>
                                <td>
                                    {product.isService ? (
                                        <span className="cv-badge cv-badge-purple">Service</span>
                                    ) : (
                                        <span className="cv-badge cv-badge-cyan">Product</span>
                                    )}
                                </td>
                                <td className="payment-admin-table-actions">
                                    <form action={deleteProduct.bind(null, product.id)}>
                                        <button type="submit" className="payment-admin-btn-delete">Delete</button>
                                    </form>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
