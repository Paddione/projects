import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthApi, type AdminUser, type AppAccess } from '../services/authApi';

export default function Admin() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [apps, setApps] = useState<AppAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  useEffect(() => {
    let isMounted = true;

    const loadUsers = async () => {
      try {
        const result = await AuthApi.getAdminUsers();
        if (!isMounted) return;
        setUsers(result);
        if (result.length > 0) {
          setSelectedUser(result[0]);
        }
      } catch (err) {
        if (!isMounted) return;
        const status = (err as Error & { status?: number }).status;
        if (status === 401 || status === 403) {
          navigate('/apps', { replace: true });
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to load users');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadUsers();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  useEffect(() => {
    let isMounted = true;

    const loadAccess = async () => {
      if (!selectedUser) return;

      try {
        setLoading(true);
        const response = await AuthApi.getAdminUserApps(selectedUser.id);
        if (!isMounted) return;
        setApps(response.apps);
      } catch (err) {
        if (!isMounted) return;
        const status = (err as Error & { status?: number }).status;
        if (status === 401 || status === 403) {
          navigate('/apps', { replace: true });
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to load user access');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadAccess();

    return () => {
      isMounted = false;
    };
  }, [selectedUser, navigate]);

  const toggleAccess = (appId: number) => {
    if (selectedUser?.role === 'ADMIN') {
      return;
    }

    setApps((prevApps) =>
      prevApps.map((app) =>
        app.id === appId ? { ...app, hasAccess: !app.hasAccess } : app
      )
    );
  };

  const handleSave = async () => {
    if (!selectedUser) return;
    setSaving(true);
    setError('');

    try {
      const appIds = apps.filter((app) => app.hasAccess).map((app) => app.id);
      await AuthApi.updateAdminUserApps(selectedUser.id, appIds);
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      if (status === 401 || status === 403) {
        navigate('/apps', { replace: true });
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to update access');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-xl p-6 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Access Control</h1>
            <p className="text-gray-600 mt-1">Assign app access for each user.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/apps"
              className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              Back to Apps
            </Link>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Users
            </h2>
            <div className="space-y-2">
              {users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => setSelectedUser(user)}
                  className={`w-full text-left px-3 py-2 rounded-lg border text-sm ${
                    selectedUser?.id === user.id
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-transparent hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <div className="font-semibold">{user.username}</div>
                  <div className="text-xs text-gray-500">
                    {user.email} · {user.role}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {selectedUser ? `Access for ${selectedUser.username}` : 'Select a user'}
                </h2>
                {selectedUser?.role === 'ADMIN' && (
                  <p className="text-sm text-gray-500 mt-1">Admins always have full access.</p>
                )}
              </div>
              <button
                onClick={handleSave}
                disabled={saving || !selectedUser || selectedUser.role === 'ADMIN'}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </div>

            {loading && <p className="text-gray-600">Loading access...</p>}

            {!loading && selectedUser && (
              <div className="space-y-3">
                {apps.map((app) => (
                  <label
                    key={app.id}
                    className={`flex items-start justify-between border rounded-lg p-4 ${
                      selectedUser.role === 'ADMIN' ? 'opacity-60' : 'hover:border-indigo-300'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-gray-900">{app.name}</div>
                      <p className="text-sm text-gray-600 mt-1">
                        {app.description || 'No description available.'}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">{app.url}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={app.hasAccess}
                      onChange={() => toggleAccess(app.id)}
                      disabled={selectedUser.role === 'ADMIN'}
                      className="h-4 w-4 mt-1"
                    />
                  </label>
                ))}
              </div>
            )}

            {!loading && selectedUser && apps.length === 0 && (
              <p className="text-gray-600">No apps configured yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
