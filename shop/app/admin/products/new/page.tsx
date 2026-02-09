import { createProduct } from '@/lib/actions/product'

export default function NewProductPage() {
    return (
        <div className="shop-admin-container" style={{ maxWidth: '800px' }}>
            <h1 className="shop-admin-title" style={{ marginBottom: 'var(--cv-space-8)' }}>Create New Item</h1>

            <form action={createProduct} className="shop-form">
                <div className="shop-form-group">
                    <label className="shop-form-label">Title</label>
                    <input name="title" required className="shop-form-input" placeholder="e.g. Quantum Core" />
                </div>

                <div className="shop-form-group">
                    <label className="shop-form-label">Description</label>
                    <textarea name="description" required rows={3} className="shop-form-input" placeholder="Describe the item or service..." style={{ minHeight: '100px' }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--cv-space-6)' }}>
                    <div className="shop-form-group">
                        <label className="shop-form-label">Price (GoldCoins)</label>
                        <input name="price" type="number" step="0.01" required className="shop-form-input" placeholder="0.00" />
                    </div>
                    <div className="shop-form-group">
                        <label className="shop-form-label">Stock</label>
                        <input name="stock" type="number" required className="shop-form-input" placeholder="100" />
                    </div>
                </div>

                <div className="shop-form-group">
                    <label className="shop-form-label">Image URL</label>
                    <input name="imageUrl" type="url" placeholder="https://..." className="shop-form-input" />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--cv-space-3)', padding: 'var(--cv-space-2) 0' }}>
                    <input id="isService" name="isService" type="checkbox" style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
                    <label htmlFor="isService" className="shop-form-label" style={{ textTransform: 'none', cursor: 'pointer' }}>
                        This is a Service (Booking required)
                    </label>
                </div>

                <div style={{ paddingTop: 'var(--cv-space-4)' }}>
                    <button type="submit" className="shop-btn-new-product" style={{ width: '100%', padding: 'var(--cv-space-4)' }}>
                        Create Item
                    </button>
                </div>
            </form>
        </div>
    )
}
