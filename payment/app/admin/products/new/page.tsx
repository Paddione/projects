import { createProduct } from '@/lib/actions/product'

export default function NewProductPage() {
    return (
        <div className="payment-admin-container" style={{ maxWidth: '800px' }}>
            <h1 className="payment-admin-title" style={{ marginBottom: 'var(--cv-space-8)' }}>Create New Item</h1>

            <form action={createProduct} className="payment-form">
                <div className="payment-form-group">
                    <label className="payment-form-label">Title</label>
                    <input name="title" required className="payment-form-input" placeholder="e.g. Quantum Core" />
                </div>

                <div className="payment-form-group">
                    <label className="payment-form-label">Description</label>
                    <textarea name="description" required rows={3} className="payment-form-input" placeholder="Describe the item or service..." style={{ minHeight: '100px' }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--cv-space-6)' }}>
                    <div className="payment-form-group">
                        <label className="payment-form-label">Price (PatrickCoins)</label>
                        <input name="price" type="number" step="0.01" required className="payment-form-input" placeholder="0.00" />
                    </div>
                    <div className="payment-form-group">
                        <label className="payment-form-label">Stock</label>
                        <input name="stock" type="number" required className="payment-form-input" placeholder="100" />
                    </div>
                </div>

                <div className="payment-form-group">
                    <label className="payment-form-label">Image URL</label>
                    <input name="imageUrl" type="url" placeholder="https://..." className="payment-form-input" />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--cv-space-3)', padding: 'var(--cv-space-2) 0' }}>
                    <input id="isService" name="isService" type="checkbox" style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
                    <label htmlFor="isService" className="payment-form-label" style={{ textTransform: 'none', cursor: 'pointer' }}>
                        This is a Service (Booking required)
                    </label>
                </div>

                <div style={{ paddingTop: 'var(--cv-space-4)' }}>
                    <button type="submit" className="payment-btn-new-product" style={{ width: '100%', padding: 'var(--cv-space-4)' }}>
                        Create Item
                    </button>
                </div>
            </form>
        </div>
    )
}
