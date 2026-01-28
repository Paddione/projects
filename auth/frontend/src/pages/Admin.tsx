import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AuthApi,
  type AdminUser,
  type AppAccess,
  type AdminAccessRequest,
  type FullUser,
} from '../services/authApi';

type TabType = 'requests' | 'users' | 'access';

interface ReviewModalProps {
  request: AdminAccessRequest;
  onClose: () => void;
  onSubmit: (status: 'approved' | 'denied', response?: string) => Promise<void>;
}

function ReviewModal({ request, onClose, onSubmit }: ReviewModalProps) {
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (status: 'approved' | 'denied') => {
    setLoading(true);
    setError('');
    try {
      await onSubmit(status, response || undefined);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to review request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="hub-modal-overlay" onClick={onClose}>
      <div className="hub-modal admin-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="hub-modal-title">Review Access Request</h3>
        <div className="admin-review-info">
          <p><strong>User:</strong> {request.username} ({request.userEmail})</p>
          <p><strong>App:</strong> {request.appName}</p>
          {request.reason && <p><strong>Reason:</strong> "{request.reason}"</p>}
        </div>
        {error && <div className="auth-message auth-message-error">{error}</div>}
        <div className="auth-form-group">
          <label className="auth-label">Response (optional)</label>
          <textarea
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            className="hub-textarea"
            placeholder="Add a note for the user..."
            rows={2}
            maxLength={500}
          />
        </div>
        <div className="hub-modal-actions admin-modal-actions">
          <button type="button" onClick={onClose} className="auth-btn-secondary" disabled={loading}>
            Cancel
          </button>
          <button
            onClick={() => handleSubmit('denied')}
            disabled={loading}
            className="admin-btn-deny"
          >
            Deny
          </button>
          <button
            onClick={() => handleSubmit('approved')}
            disabled={loading}
            className="admin-btn-approve"
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}

interface UserEditorProps {
  userId: number;
  onClose: () => void;
  onSave: () => void;
}

function UserEditor({ userId, onClose, onSave }: UserEditorProps) {
  const [user, setUser] = useState<FullUser | null>(null);
  const [apps, setApps] = useState<AppAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<Partial<FullUser>>({});
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        const [userData, appsData] = await Promise.all([
          AuthApi.getAdminUser(userId),
          AuthApi.getAdminUserApps(userId),
        ]);
        setUser(userData.user);
        setApps(appsData.apps);
        setFormData({});
      } catch (err) {
        const status = (err as Error & { status?: number }).status;
        if (status === 401 || status === 403) {
          navigate('/hub', { replace: true });
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to load user');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId, navigate]);

  const handleChange = (field: keyof FullUser, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (Object.keys(formData).length === 0) {
      onClose();
      return;
    }
    setSaving(true);
    setError('');
    try {
      await AuthApi.updateAdminUser(userId, formData);
      onSave();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }
    setSaving(true);
    try {
      await AuthApi.deleteAdminUser(userId);
      onSave();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
      setSaving(false);
    }
  };

  const handleAppAccessChange = async (appIds: number[]) => {
    setSaving(true);
    try {
      await AuthApi.updateAdminUserApps(userId, appIds);
      setApps((prev) =>
        prev.map((app) => ({ ...app, hasAccess: appIds.includes(app.id) }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update access');
    } finally {
      setSaving(false);
    }
  };

  const toggleApp = (appId: number) => {
    if (user?.role === 'ADMIN') return;
    const newAppIds = apps
      .map((app) => (app.id === appId ? { ...app, hasAccess: !app.hasAccess } : app))
      .filter((app) => app.hasAccess)
      .map((app) => app.id);
    handleAppAccessChange(newAppIds);
  };

  if (loading) {
    return (
      <div className="hub-modal-overlay" onClick={onClose}>
        <div className="hub-modal admin-modal-large" onClick={(e) => e.stopPropagation()}>
          <div className="hub-loading"><div className="hub-spinner"></div></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="hub-modal-overlay" onClick={onClose}>
        <div className="hub-modal" onClick={(e) => e.stopPropagation()}>
          <p className="auth-message auth-message-error">User not found</p>
          <button onClick={onClose} className="auth-btn-secondary">Close</button>
        </div>
      </div>
    );
  }

  const getValue = (field: keyof FullUser) => {
    return formData[field] !== undefined ? formData[field] : user[field];
  };

  return (
    <div className="hub-modal-overlay" onClick={onClose}>
      <div className="hub-modal admin-modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="admin-editor-header">
          <h3 className="hub-modal-title">Edit User: {user.username}</h3>
          <button onClick={onClose} className="admin-close-btn">&times;</button>
        </div>

        {error && <div className="auth-message auth-message-error">{error}</div>}

        <div className="admin-editor-content">
          {/* Identity Section */}
          <fieldset className="admin-fieldset">
            <legend>Identity</legend>
            <div className="admin-field-grid">
              <div className="auth-form-group">
                <label className="auth-label">Username</label>
                <input
                  type="text"
                  value={getValue('username') as string}
                  onChange={(e) => handleChange('username', e.target.value)}
                  className="auth-input"
                />
              </div>
              <div className="auth-form-group">
                <label className="auth-label">Email</label>
                <input
                  type="email"
                  value={getValue('email') as string}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="auth-input"
                />
              </div>
              <div className="auth-form-group">
                <label className="auth-label">Display Name</label>
                <input
                  type="text"
                  value={(getValue('name') as string) || ''}
                  onChange={(e) => handleChange('name', e.target.value || null)}
                  className="auth-input"
                />
              </div>
              <div className="auth-form-group">
                <label className="auth-label">Role</label>
                <select
                  value={getValue('role') as string}
                  onChange={(e) => handleChange('role', e.target.value)}
                  className="auth-input admin-select"
                >
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
            </div>
          </fieldset>

          {/* Status Section */}
          <fieldset className="admin-fieldset">
            <legend>Account Status</legend>
            <div className="admin-field-grid">
              <div className="admin-checkbox-group">
                <label className="admin-checkbox-label">
                  <input
                    type="checkbox"
                    checked={getValue('is_active') as boolean}
                    onChange={(e) => handleChange('is_active', e.target.checked)}
                  />
                  <span>Active</span>
                </label>
              </div>
              <div className="admin-checkbox-group">
                <label className="admin-checkbox-label">
                  <input
                    type="checkbox"
                    checked={getValue('email_verified') as boolean}
                    onChange={(e) => handleChange('email_verified', e.target.checked)}
                  />
                  <span>Email Verified</span>
                </label>
              </div>
              <div className="auth-form-group">
                <label className="auth-label">Failed Login Attempts</label>
                <input
                  type="number"
                  min="0"
                  value={getValue('failed_login_attempts') as number}
                  onChange={(e) => handleChange('failed_login_attempts', parseInt(e.target.value) || 0)}
                  className="auth-input"
                />
              </div>
              <div className="auth-form-group">
                <label className="auth-label">Locked Until</label>
                <input
                  type="datetime-local"
                  value={user.account_locked_until ? new Date(user.account_locked_until).toISOString().slice(0, 16) : ''}
                  onChange={(e) => handleChange('account_locked_until', e.target.value ? new Date(e.target.value).toISOString() : null)}
                  className="auth-input"
                />
              </div>
            </div>
          </fieldset>

          {/* L2P Stats Section */}
          <fieldset className="admin-fieldset">
            <legend>L2P Character</legend>
            <div className="admin-field-grid">
              <div className="auth-form-group">
                <label className="auth-label">Character</label>
                <select
                  value={(getValue('selected_character') as string) || 'student'}
                  onChange={(e) => handleChange('selected_character', e.target.value)}
                  className="auth-input admin-select"
                >
                  <option value="student">Student</option>
                  <option value="professor">Professor</option>
                  <option value="librarian">Librarian</option>
                  <option value="researcher">Researcher</option>
                  <option value="dean">Dean</option>
                  <option value="graduate">Graduate</option>
                </select>
              </div>
              <div className="auth-form-group">
                <label className="auth-label">Level</label>
                <input
                  type="number"
                  min="1"
                  value={getValue('character_level') as number}
                  onChange={(e) => handleChange('character_level', parseInt(e.target.value) || 1)}
                  className="auth-input"
                />
              </div>
              <div className="auth-form-group">
                <label className="auth-label">XP</label>
                <input
                  type="number"
                  min="0"
                  value={getValue('experience_points') as number}
                  onChange={(e) => handleChange('experience_points', parseInt(e.target.value) || 0)}
                  className="auth-input"
                />
              </div>
            </div>
          </fieldset>

          {/* App Access Section */}
          <fieldset className="admin-fieldset">
            <legend>App Access</legend>
            {user.role === 'ADMIN' && (
              <p className="admin-note">Admins always have full access to all apps.</p>
            )}
            <div className="admin-apps-list">
              {apps.map((app) => (
                <label
                  key={app.id}
                  className={`admin-app-toggle ${user.role === 'ADMIN' ? 'disabled' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={app.hasAccess}
                    onChange={() => toggleApp(app.id)}
                    disabled={user.role === 'ADMIN'}
                  />
                  <span className="admin-app-name">{app.name}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Timestamps */}
          <fieldset className="admin-fieldset">
            <legend>Timestamps</legend>
            <div className="admin-timestamps">
              <p><strong>Created:</strong> {new Date(user.created_at).toLocaleString()}</p>
              <p><strong>Updated:</strong> {new Date(user.updated_at).toLocaleString()}</p>
              <p><strong>Last Login:</strong> {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}</p>
            </div>
          </fieldset>
        </div>

        <div className="admin-editor-footer">
          <button onClick={handleDelete} className="admin-btn-delete" disabled={saving}>
            Delete User
          </button>
          <div className="admin-editor-actions">
            <button onClick={onClose} className="auth-btn-secondary" disabled={saving}>
              Cancel
            </button>
            <button onClick={handleSave} className="auth-btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Admin() {
  const [activeTab, setActiveTab] = useState<TabType>('requests');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [apps, setApps] = useState<AppAccess[]>([]);
  const [requests, setRequests] = useState<AdminAccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewingRequest, setReviewingRequest] = useState<AdminAccessRequest | null>(null);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [selectedAppId, setSelectedAppId] = useState<number | null>(null);
  const [appUsers, setAppUsers] = useState<AdminUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, requestsRes, appsRes] = await Promise.all([
        AuthApi.getAdminUsers(),
        AuthApi.getAdminAccessRequests('pending'),
        AuthApi.getApps(),
      ]);
      setUsers(usersRes);
      setRequests(requestsRes.requests);
      setApps(appsRes.apps);
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      if (status === 401 || status === 403) {
        navigate('/hub', { replace: true });
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [navigate]);

  useEffect(() => {
    if (selectedAppId && activeTab === 'access') {
      AuthApi.getAppUsers(selectedAppId)
        .then((res) => setAppUsers(res.users))
        .catch((err) => setError(err.message));
    }
  }, [selectedAppId, activeTab]);

  const handleReview = async (status: 'approved' | 'denied', response?: string) => {
    if (!reviewingRequest) return;
    await AuthApi.reviewAccessRequest(reviewingRequest.id, status, response);
    setRequests((prev) => prev.filter((r) => r.id !== reviewingRequest.id));
  };

  const filteredUsers = users.filter(
    (u) =>
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pendingCount = requests.length;

  return (
    <div className="admin-page">
      {/* Header */}
      <header className="admin-header">
        <div className="admin-header-content">
          <div className="admin-header-title">
            <svg viewBox="0 0 80 80" className="admin-logo">
              <defs>
                <linearGradient id="adminGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#00f2ff"/>
                  <stop offset="100%" stopColor="#bc13fe"/>
                </linearGradient>
              </defs>
              <path d="M40 4L68 18v24c0 14-12 26-28 30C24 68 12 56 12 42V18L40 4z"
                stroke="url(#adminGrad)" strokeWidth="2" fill="none"/>
              <text x="27" y="48" fontFamily="Orbitron, sans-serif" fontSize="20" fontWeight="bold" fill="url(#adminGrad)">CV</text>
            </svg>
            <div>
              <h1>Admin Panel</h1>
              <p>Manage users, access requests, and permissions</p>
            </div>
          </div>
          <Link to="/hub" className="admin-back-btn">
            <svg viewBox="0 0 20 20" fill="currentColor" className="hub-icon">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd"/>
            </svg>
            Back to Hub
          </Link>
        </div>
      </header>

      {error && <div className="auth-message auth-message-error admin-error">{error}</div>}

      {/* Tabs */}
      <nav className="admin-tabs">
        <button
          className={`admin-tab ${activeTab === 'requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          Access Requests
          {pendingCount > 0 && <span className="admin-tab-badge">{pendingCount}</span>}
        </button>
        <button
          className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Users
          <span className="admin-tab-count">{users.length}</span>
        </button>
        <button
          className={`admin-tab ${activeTab === 'access' ? 'active' : ''}`}
          onClick={() => setActiveTab('access')}
        >
          Access List
        </button>
      </nav>

      {/* Content */}
      <main className="admin-content">
        {loading ? (
          <div className="hub-loading">
            <div className="hub-spinner"></div>
            <p>Loading...</p>
          </div>
        ) : (
          <>
            {/* Access Requests Tab */}
            {activeTab === 'requests' && (
              <div className="admin-requests">
                {requests.length === 0 ? (
                  <div className="admin-empty">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="admin-empty-icon">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                    </svg>
                    <p>No pending access requests</p>
                  </div>
                ) : (
                  <div className="admin-requests-list">
                    {requests.map((req) => (
                      <div key={req.id} className="admin-request-card">
                        <div className="admin-request-user">
                          <span className="admin-request-username">{req.username}</span>
                          <span className="admin-request-email">{req.userEmail}</span>
                        </div>
                        <div className="admin-request-app">
                          <span className="admin-request-arrow">→</span>
                          <span className="admin-request-appname">{req.appName}</span>
                        </div>
                        {req.reason && (
                          <p className="admin-request-reason">"{req.reason}"</p>
                        )}
                        <div className="admin-request-actions">
                          <span className="admin-request-date">
                            {new Date(req.createdAt).toLocaleDateString()}
                          </span>
                          <button
                            onClick={() => setReviewingRequest(req)}
                            className="admin-btn-review"
                          >
                            Review
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
              <div className="admin-users">
                <div className="admin-search">
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="auth-input admin-search-input"
                  />
                </div>
                <div className="admin-users-grid">
                  {filteredUsers.map((user) => (
                    <div key={user.id} className="admin-user-card">
                      <div className="admin-user-info">
                        <span className="admin-user-name">{user.username}</span>
                        <span className="admin-user-email">{user.email}</span>
                      </div>
                      <div className="admin-user-meta">
                        <span className={`hub-badge hub-badge-${user.role.toLowerCase()}`}>
                          {user.role}
                        </span>
                        {!user.isActive && (
                          <span className="hub-badge hub-badge-offline">Inactive</span>
                        )}
                      </div>
                      <button
                        onClick={() => setEditingUserId(user.id)}
                        className="admin-btn-edit"
                      >
                        Edit
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Access List Tab */}
            {activeTab === 'access' && (
              <div className="admin-access">
                <div className="admin-access-sidebar">
                  <h3>Apps</h3>
                  <div className="admin-access-apps">
                    {apps.map((app) => (
                      <button
                        key={app.id}
                        className={`admin-access-app ${selectedAppId === app.id ? 'active' : ''}`}
                        onClick={() => setSelectedAppId(app.id)}
                      >
                        {app.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="admin-access-main">
                  {selectedAppId ? (
                    <>
                      <h3>Users with access to {apps.find((a) => a.id === selectedAppId)?.name}</h3>
                      {appUsers.length === 0 ? (
                        <p className="admin-note">No users have explicit access. Admins always have access.</p>
                      ) : (
                        <div className="admin-access-users">
                          {appUsers.map((user) => (
                            <div key={user.id} className="admin-access-user">
                              <span className="admin-access-username">{user.username}</span>
                              <span className="admin-access-email">{user.email}</span>
                              <span className={`hub-badge hub-badge-${user.role.toLowerCase()}`}>
                                {user.role}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="admin-note">Select an app to view users with access.</p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {reviewingRequest && (
        <ReviewModal
          request={reviewingRequest}
          onClose={() => setReviewingRequest(null)}
          onSubmit={handleReview}
        />
      )}

      {editingUserId && (
        <UserEditor
          userId={editingUserId}
          onClose={() => setEditingUserId(null)}
          onSave={loadData}
        />
      )}
    </div>
  );
}
