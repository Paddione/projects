import { requireAdmin } from "@/lib/actions/auth";
import Link from "next/link";

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const user = await requireAdmin(); // Throws if not admin, redirects handled by ForwardAuth

    return (
        <div className="flex min-h-screen">
            <aside className="w-64 bg-gray-900 text-white p-6">
                <h2 className="text-2xl font-bold mb-8 text-yellow-400">Master Control</h2>
                <nav className="space-y-4">
                    <Link href="/admin" className="block p-2 hover:bg-gray-800 rounded">
                        Dashboard
                    </Link>
                    <Link href="/admin/products" className="block p-2 hover:bg-gray-800 rounded">
                        Products & Services
                    </Link>
                    <Link href="/admin/users" className="block p-2 hover:bg-gray-800 rounded">
                        User Management
                    </Link>
                    <Link href="/" className="block p-2 hover:bg-gray-800 rounded text-gray-400 mt-8">
                        Back to Public Site
                    </Link>
                </nav>
            </aside>
            <main className="flex-1 p-8 bg-gray-100">
                {children}
            </main>
        </div>
    );
}
