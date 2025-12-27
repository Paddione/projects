import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthApi, type AppAccess, type AppsResponse } from '../services/authApi';

export default function Apps() {
  const [apps, setApps] = useState<AppAccess[]>([]);
  const [user, setUser] = useState<AppsResponse['user'] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const hasTokens = searchParams.get('accessToken') || searchParams.get('refreshToken');
    if (hasTokens) {
      navigate('/apps', { replace: true });
    }
  }, [searchParams, navigate]);

  useEffect(() => {
    let isMounted = true;

    const loadApps = async () => {
      try {
        const response = await AuthApi.getApps();
        if (!isMounted) return;
        setUser(response.user);
        setApps(response.apps);
      } catch (err) {
        if (!isMounted) return;
        const message = err instanceof Error ? err.message : 'Failed to load apps';
        const status = (err as Error & { status?: number }).status;
        if (status === 401 || status === 403) {
          navigate('/login', { replace: true });
          return;
        }
        setError(message);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadApps();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  const handleLogout = async () => {
    await AuthApi.logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-lg shadow-xl p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Your Apps</h1>
              <p className="text-gray-600 mt-1">Choose where you want to go next.</p>
              {user && (
                <p className="text-sm text-gray-500 mt-2">
                  Signed in as <span className="font-semibold text-gray-700">{user.username}</span>
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {user?.role === 'ADMIN' && (
                <Link
                  to="/admin"
                  className="px-4 py-2 rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                >
                  Admin Panel
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>

        {loading && (
          <div className="bg-white rounded-lg shadow p-6 text-gray-600">Loading apps...</div>
        )}

        {error && !loading && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {apps.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-6 text-gray-600">
                No apps are available yet. Ask an admin to grant access.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {apps.map((app) => (
                  <div
                    key={app.id}
                    className={`border rounded-lg p-5 bg-white shadow-sm ${
                      app.hasAccess ? 'border-transparent' : 'border-gray-200 opacity-70'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">{app.name}</h2>
                        <p className="text-sm text-gray-600 mt-1">
                          {app.description || 'No description available.'}
                        </p>
                      </div>
                      {!app.isActive && (
                        <span className="text-xs uppercase tracking-wide text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          Offline
                        </span>
                      )}
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <p className="text-xs text-gray-500">{app.url}</p>
                      {app.hasAccess && app.isActive ? (
                        <a
                          href={app.url}
                          className="text-indigo-600 font-semibold hover:text-indigo-500"
                        >
                          Open
                        </a>
                      ) : (
                        <span className="text-xs text-gray-500">
                          {app.isActive ? 'No access' : 'Unavailable'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
