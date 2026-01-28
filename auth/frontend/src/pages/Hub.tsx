import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthApi, type AppAccess, type AppsResponse, type AccessRequest } from '../services/authApi';

interface RequestModalProps {
  app: AppAccess;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}

function RequestModal({ app, onClose, onSubmit }: RequestModalProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await onSubmit(reason);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="hub-modal-overlay" onClick={onClose}>
      <div className="hub-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="hub-modal-title">Request Access to {app.name}</h3>
        <form onSubmit={handleSubmit}>
          {error && <div className="auth-message auth-message-error">{error}</div>}
          <div className="auth-form-group">
            <label className="auth-label">Reason (optional)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="hub-textarea"
              placeholder="Why do you need access to this app?"
              rows={3}
              maxLength={500}
            />
          </div>
          <div className="hub-modal-actions">
            <button type="button" onClick={onClose} className="auth-btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="auth-btn-primary">
              {loading ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Hub() {
  const [apps, setApps] = useState<AppAccess[]>([]);
  const [user, setUser] = useState<AppsResponse['user'] | null>(null);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [requestModalApp, setRequestModalApp] = useState<AppAccess | null>(null);
  const [showRequests, setShowRequests] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const [appsRes, requestsRes] = await Promise.all([
          AuthApi.getApps(),
          AuthApi.getAccessRequests(),
        ]);
        if (!isMounted) return;
        setUser(appsRes.user);
        setApps(appsRes.apps);
        setRequests(requestsRes.requests);
      } catch (err) {
        if (!isMounted) return;
        const status = (err as Error & { status?: number }).status;
        if (status === 401 || status === 403) {
          navigate('/login', { replace: true });
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();
    return () => { isMounted = false; };
  }, [navigate]);

  const handleLogout = async () => {
    await AuthApi.logout();
    navigate('/login', { replace: true });
  };

  const handleRequestAccess = async (reason: string) => {
    if (!requestModalApp) return;
    await AuthApi.createAccessRequest(requestModalApp.id, reason || undefined);
    // Refresh requests
    const { requests: newRequests } = await AuthApi.getAccessRequests();
    setRequests(newRequests);
  };

  const getPendingRequest = (appId: number) => {
    return requests.find((r) => r.appId === appId && r.status === 'pending');
  };

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  return (
    <div className="hub-page">
      {/* Hero Section */}
      <div className="hub-hero">
        <div className="hub-hero-content">
          <div className="hub-hero-graphic">
            <svg viewBox="0 0 120 120" className="hub-hero-svg">
              <defs>
                <linearGradient id="hubGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#00f2ff"/>
                  <stop offset="100%" stopColor="#bc13fe"/>
                </linearGradient>
                <filter id="hubGlow">
                  <feGaussianBlur stdDeviation="3" result="blur"/>
                  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>
              {/* Shield */}
              <path d="M60 8L100 26v32c0 20-16 38-40 44C36 96 20 78 20 58V26L60 8z"
                stroke="url(#hubGrad)" strokeWidth="2" fill="none" filter="url(#hubGlow)"/>
              {/* Inner shield */}
              <path d="M60 18L88 32v24c0 14-12 28-28 34-16-6-28-20-28-34V32L60 18z"
                stroke="url(#hubGrad)" strokeWidth="1" fill="none" opacity="0.3"/>
              {/* Key icon */}
              <circle cx="60" cy="48" r="10" stroke="url(#hubGrad)" strokeWidth="2" fill="none" filter="url(#hubGlow)"/>
              <rect x="58" y="58" width="4" height="20" fill="url(#hubGrad)" filter="url(#hubGlow)"/>
              <rect x="62" y="68" width="8" height="4" fill="url(#hubGrad)"/>
              <rect x="62" y="74" width="6" height="4" fill="url(#hubGrad)"/>
              {/* Circuit lines */}
              <line x1="20" y1="40" x2="35" y2="40" stroke="#00f2ff" strokeWidth="1" opacity="0.4"/>
              <line x1="85" y1="40" x2="100" y2="40" stroke="#bc13fe" strokeWidth="1" opacity="0.4"/>
              <circle cx="20" cy="40" r="2" fill="#00f2ff" opacity="0.5"/>
              <circle cx="100" cy="40" r="2" fill="#bc13fe" opacity="0.5"/>
            </svg>
          </div>
          <div className="hub-hero-text">
            <h1 className="hub-title">Access Hub</h1>
            {user && (
              <p className="hub-user-greeting">
                Welcome back, <span className="hub-username">{user.username}</span>
              </p>
            )}
          </div>
        </div>
        <div className="hub-header-actions">
          {user?.role === 'ADMIN' && (
            <Link to="/admin" className="hub-btn-admin">
              <svg viewBox="0 0 20 20" fill="currentColor" className="hub-icon">
                <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/>
              </svg>
              Admin Panel
            </Link>
          )}
          <button onClick={handleLogout} className="hub-btn-logout">
            Sign Out
          </button>
        </div>
      </div>

      {loading && (
        <div className="hub-loading">
          <div className="hub-spinner"></div>
          <p>Loading your apps...</p>
        </div>
      )}

      {error && !loading && (
        <div className="auth-message auth-message-error">{error}</div>
      )}

      {!loading && !error && (
        <>
          {/* Apps Grid */}
          <section className="hub-section">
            <h2 className="hub-section-title">
              <svg viewBox="0 0 20 20" fill="currentColor" className="hub-section-icon">
                <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"/>
              </svg>
              Your Applications
            </h2>
            {apps.length === 0 ? (
              <div className="hub-empty">
                <p>No applications available. Contact an admin to request access.</p>
              </div>
            ) : (
              <div className="hub-apps-grid">
                {apps.map((app) => {
                  const pendingReq = getPendingRequest(app.id);
                  return (
                    <div
                      key={app.id}
                      className={`hub-app-card ${app.hasAccess ? 'has-access' : ''} ${!app.isActive ? 'offline' : ''}`}
                    >
                      <div className="hub-app-header">
                        <h3 className="hub-app-name">{app.name}</h3>
                        {!app.isActive && (
                          <span className="hub-badge hub-badge-offline">Offline</span>
                        )}
                        {pendingReq && (
                          <span className="hub-badge hub-badge-pending">Pending</span>
                        )}
                      </div>
                      <p className="hub-app-description">
                        {app.description || 'No description available.'}
                      </p>
                      <div className="hub-app-footer">
                        <span className="hub-app-url">{app.url}</span>
                        {app.hasAccess && app.isActive ? (
                          <a href={app.url} className="hub-btn-open">
                            Open
                            <svg viewBox="0 0 20 20" fill="currentColor" className="hub-icon-sm">
                              <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd"/>
                            </svg>
                          </a>
                        ) : pendingReq ? (
                          <span className="hub-status-pending">Request Pending</span>
                        ) : app.isActive && !app.hasAccess ? (
                          <button
                            onClick={() => setRequestModalApp(app)}
                            className="hub-btn-request"
                          >
                            Request Access
                          </button>
                        ) : (
                          <span className="hub-status-unavailable">Unavailable</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Your Requests Section */}
          {requests.length > 0 && (
            <section className="hub-section">
              <button
                className="hub-section-toggle"
                onClick={() => setShowRequests(!showRequests)}
              >
                <h2 className="hub-section-title">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="hub-section-icon">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
                  </svg>
                  Your Requests
                  {pendingCount > 0 && (
                    <span className="hub-count-badge">{pendingCount}</span>
                  )}
                </h2>
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className={`hub-chevron ${showRequests ? 'open' : ''}`}
                >
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
                </svg>
              </button>
              {showRequests && (
                <div className="hub-requests-list">
                  {requests.map((req) => (
                    <div key={req.id} className={`hub-request-item status-${req.status}`}>
                      <div className="hub-request-info">
                        <span className="hub-request-app">{req.appName}</span>
                        <span className={`hub-badge hub-badge-${req.status}`}>
                          {req.status}
                        </span>
                      </div>
                      {req.reason && (
                        <p className="hub-request-reason">"{req.reason}"</p>
                      )}
                      {req.adminResponse && (
                        <p className="hub-request-response">
                          <strong>Admin:</strong> {req.adminResponse}
                        </p>
                      )}
                      <span className="hub-request-date">
                        {new Date(req.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}

      {requestModalApp && (
        <RequestModal
          app={requestModalApp}
          onClose={() => setRequestModalApp(null)}
          onSubmit={handleRequestAccess}
        />
      )}
    </div>
  );
}
