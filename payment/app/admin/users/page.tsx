import { requireAdmin } from "@/lib/actions/auth";
import { db } from "@/lib/db";
import Link from "next/link";

export default async function AdminUsersPage() {
    await requireAdmin();

    const users = await db.user.findMany({
        include: {
            wallet: true,
        },
        orderBy: {
            createdAt: 'desc',
        },
    });

    return (
        <div className="payment-admin-container">
            <div className="payment-admin-header">
                <Link href="/admin" className="payment-admin-back-link">
                    ← Back to Dashboard
                </Link>
                <h1 className="payment-admin-title">User Management</h1>
            </div>

            <div className="payment-admin-table-container">
                <table className="payment-admin-table">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Wallet Balance</th>
                            <th>Joined</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((user) => (
                            <tr key={user.id}>
                                <td>
                                    <div className="payment-user-info">
                                        <div className="payment-user-avatar">
                                            {user.name?.[0] || user.email[0]}
                                        </div>
                                        <span>{user.name || 'No Name'}</span>
                                    </div>
                                </td>
                                <td>{user.email}</td>
                                <td>
                                    <span className={`payment-role-badge ${user.role.toLowerCase()}`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td>
                                    <span className="payment-balance-preview">
                                        {user.wallet?.balance?.toString() || '0.00'} PC
                                    </span>
                                </td>
                                <td>
                                    {new Date(user.createdAt).toLocaleDateString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
