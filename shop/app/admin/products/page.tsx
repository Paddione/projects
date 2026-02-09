import { db } from '@/lib/db'
import Link from 'next/link'
import { deleteProduct } from '@/lib/actions/product'

import { Product } from '@prisma/client'

export default async function AdminProductsPage() {
    const products = await db.product.findMany({ orderBy: { createdAt: 'desc' } })

    return (
        <div className="shop-admin-container">
            <div className="shop-admin-header">
                <div>
                    <h1 className="shop-admin-title">Products & Services</h1>
                    <p className="shop-admin-subtitle">Manage your shop inventory</p>
                </div>
                <Link href="/admin/products/new" className="cv-btn cv-btn-primary">
                    + Add New Item
                </Link>
            </div>

            <div className="shop-admin-table-container">
                <table className="shop-admin-table">
                    <thead>
                        <tr>
                            <th>Image</th>
                            <th>Name</th>
                            <th>Price (GC)</th>
                            <th>Stock</th>
                            <th>Type</th>
                            <th className="shop-admin-table-actions-header">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {products.map((product: Product) => (
                            <tr key={product.id}>
                                <td>
                                    {product.imageUrl && (
                                        <>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={product.imageUrl} alt={product.title} className="shop-admin-table-image" />
                                        </>
                                    )}
                                </td>
                                <td>
                                    <div className="shop-admin-table-product-info">
                                        <div className="shop-admin-table-product-title">{product.title}</div>
                                        <div className="shop-admin-table-product-description">{product.description}</div>
                                    </div>
                                </td>
                                <td>
                                    <span className="shop-admin-table-price">{product.price.toString()}</span>
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
                                <td className="shop-admin-table-actions">
                                    <Link href={`/admin/products/${product.id}/edit`} className="shop-admin-btn-edit">
                                        Edit
                                    </Link>
                                    <form action={deleteProduct.bind(null, product.id)} style={{ display: 'inline' }}>
                                        <button type="submit" className="shop-admin-btn-delete">Delete</button>
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
