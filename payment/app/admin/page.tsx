import { auth } from "@/auth";

export default async function AdminDashboard() {
    const session = await auth();

    return (
        <div>
            <h1 className="text-3xl font-bold mb-4">Welcome, Master {session?.user?.name}</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded shadow">
                    <h3 className="text-lg font-semibold mb-2">System Status</h3>
                    <p className="text-green-600 font-bold">Operational</p>
                </div>
                <div className="bg-white p-6 rounded shadow">
                    <h3 className="text-lg font-semibold mb-2">Total Users</h3>
                    <p className="text-3xl font-bold">2</p>
                    {/* TODO: Fetch real count */}
                </div>
                <div className="bg-white p-6 rounded shadow">
                    <h3 className="text-lg font-semibold mb-2">Total Products</h3>
                    <p className="text-3xl font-bold">0</p>
                    {/* TODO: Fetch real count */}
                </div>
            </div>
        </div>
    );
}
