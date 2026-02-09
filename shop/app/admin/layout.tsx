import { requireAdmin } from "@/lib/actions/auth";
import Link from "next/link";
import AdminSidebar from "@/components/admin-sidebar";

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    await requireAdmin(); // Throws if not admin, redirects handled by ForwardAuth

    return (
        <div className="shop-admin-layout">
            <AdminSidebar>
                <h2 className="shop-admin-sidebar-title">Master Control</h2>
                <nav className="shop-admin-nav">
                    <Link href="/admin" className="shop-admin-nav-link">
                        📊 Dashboard
                    </Link>
                    <Link href="/admin/products" className="shop-admin-nav-link">
                        📦 Products & Services
                    </Link>
                    <Link href="/admin/users" className="shop-admin-nav-link">
                        👥 User Management
                    </Link>
                    <Link href="/" className="shop-admin-nav-link shop-admin-nav-link-secondary">
                        ← Back to Public Site
                    </Link>
                </nav>
            </AdminSidebar>
            <main className="shop-admin-main">
                {children}
            </main>
        </div>
    );
}
