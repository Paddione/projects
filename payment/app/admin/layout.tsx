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
        <div className="payment-admin-layout">
            <AdminSidebar>
                <h2 className="payment-admin-sidebar-title">Master Control</h2>
                <nav className="payment-admin-nav">
                    <Link href="/admin" className="payment-admin-nav-link">
                        📊 Dashboard
                    </Link>
                    <Link href="/admin/products" className="payment-admin-nav-link">
                        📦 Products & Services
                    </Link>
                    <Link href="/admin/users" className="payment-admin-nav-link">
                        👥 User Management
                    </Link>
                    <Link href="/" className="payment-admin-nav-link payment-admin-nav-link-secondary">
                        ← Back to Public Site
                    </Link>
                </nav>
            </AdminSidebar>
            <main className="payment-admin-main">
                {children}
            </main>
        </div>
    );
}
