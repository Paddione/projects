import { requireAdmin } from "@/lib/actions/auth";
import { db } from "@/lib/db";
import Link from "next/link";

export default async function AdminDashboard() {
    const user = await requireAdmin();

    // Fetch real statistics
    const [userCount, productCount, orderCount, bookingCount] = await Promise.all([
        db.user.count(),
        db.product.count(),
        db.order.count(),
        db.booking.count(),
    ]);

    return (
        <div className="shop-admin-container">
            <h1 className="shop-admin-title">Admin Command Center</h1>
            <p className="shop-admin-subtitle">Welcome back, {user.name || user.email}</p>

            <div className="shop-admin-stats-grid">
                <div className="shop-admin-stat-card">
                    <div className="shop-admin-stat-icon">👥</div>
                    <div className="shop-admin-stat-content">
                        <h3 className="shop-admin-stat-label">Total Users</h3>
                        <p className="shop-admin-stat-value">{userCount}</p>
                    </div>
                </div>
                <div className="shop-admin-stat-card">
                    <div className="shop-admin-stat-icon">📦</div>
                    <div className="shop-admin-stat-content">
                        <h3 className="shop-admin-stat-label">Total Products</h3>
                        <p className="shop-admin-stat-value">{productCount}</p>
                    </div>
                </div>
                <div className="shop-admin-stat-card">
                    <div className="shop-admin-stat-icon">🛒</div>
                    <div className="shop-admin-stat-content">
                        <h3 className="shop-admin-stat-label">Total Orders</h3>
                        <p className="shop-admin-stat-value">{orderCount}</p>
                    </div>
                </div>
                <div className="shop-admin-stat-card">
                    <div className="shop-admin-stat-icon">📅</div>
                    <div className="shop-admin-stat-content">
                        <h3 className="shop-admin-stat-label">Total Bookings</h3>
                        <p className="shop-admin-stat-value">{bookingCount}</p>
                    </div>
                </div>
            </div>

            <div className="shop-admin-actions">
                <Link href="/admin/products" className="shop-btn-new-product">
                    Manage Products
                </Link>
                <Link href="/admin/bookings" className="shop-btn-new-product">
                    Manage Bookings
                </Link>
                <Link href="/admin/products/new" className="shop-btn-new-product" style={{ background: 'var(--cv-purple-50)', color: 'var(--cv-text-primary)', borderColor: 'var(--cv-border-1)' }}>
                    Add New Product
                </Link>
            </div>
        </div>
    );
}
