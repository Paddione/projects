import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthApi } from '../services/authApi';

const API_URL = import.meta.env.VITE_API_URL || '';

interface Conference {
  id: string;
  room: string;
  name: string;
  createdBy: { userId: number; username: string; name: string | null };
  createdAt: string;
  guestUrl: string;
}

export default function Jitsi() {
  const [user, setUser] = useState<{ id: number; username: string; name?: string | null; role: string } | null>(null);
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchConferences = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/jitsi/conferences`, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'include',
      });
      if (res.status === 401) { navigate('/login', { replace: true }); return; }
      if (res.ok) {
        const data = await res.json();
        setConferences(data.conferences);
      }
    } catch { /* ignore */ }
  }, [navigate]);

  useEffect(() => {
    AuthApi.getApps()
      .then((res) => { setUser(res.user as typeof user); setLoading(false); })
      .catch((err) => {
        if ((err as Error & { status?: number }).status === 401) navigate('/login', { replace: true });
        setLoading(false);
      });
    fetchConferences();
    const interval = setInterval(fetchConferences, 15000); // poll every 15s
    return () => clearInterval(interval);
  }, [navigate, fetchConferences]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/jitsi/conferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'include',
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create conference');
      setNewName('');
      await fetchConferences();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = (room: string) => {
    window.location.href = `${API_URL}/api/jitsi/authorize?redirect_uri=https://meet.korczewski.de/${room}`;
  };

  const handleEnd = async (id: string) => {
    try {
      await fetch(`${API_URL}/api/jitsi/conferences/${id}`, {
        method: 'DELETE',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'include',
      });
      await fetchConferences();
    } catch { /* ignore */ }
  };

  const handleCopy = async (id: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.createElement('textarea');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="hub-page">
        <div className="hub-loading"><div className="hub-spinner"></div><p>Loading...</p></div>
      </div>
    );
  }

  return (
    <div className="hub-page">
      {/* Header */}
      <div className="hub-hero">
        <div className="hub-hero-content">
          <div className="hub-hero-graphic">
            <svg viewBox="0 0 120 120" className="hub-hero-svg">
              <defs>
                <linearGradient id="jitsiGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#00f2ff"/><stop offset="100%" stopColor="#bc13fe"/>
                </linearGradient>
                <filter id="jitsiGlow"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
              </defs>
              <rect x="25" y="35" width="45" height="35" rx="5" stroke="url(#jitsiGrad)" strokeWidth="2" fill="none" filter="url(#jitsiGlow)"/>
              <polygon points="75,42 95,32 95,78 75,68" stroke="url(#jitsiGrad)" strokeWidth="2" fill="none" filter="url(#jitsiGlow)"/>
              <circle cx="35" cy="90" r="4" fill="#00f2ff" opacity="0.6"/>
              <circle cx="50" cy="90" r="4" fill="#bc13fe" opacity="0.6"/>
              <circle cx="65" cy="90" r="4" fill="#00f2ff" opacity="0.6"/>
              <circle cx="80" cy="90" r="4" fill="#bc13fe" opacity="0.6"/>
            </svg>
          </div>
          <div className="hub-hero-text">
            <h1 className="hub-title">Jitsi Meet</h1>
            {user && <p className="hub-user-greeting">Signed in as <span className="hub-username">{user.name || user.username}</span></p>}
          </div>
        </div>
        <div className="hub-header-actions">
          <a href="/hub" className="hub-btn-admin">Back to Hub</a>
        </div>
      </div>

      {/* Create Conference */}
      <section className="hub-section">
        <h2 className="hub-section-title">
          <svg viewBox="0 0 20 20" fill="currentColor" className="hub-section-icon">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/>
          </svg>
          Create Conference
        </h2>
        <div style={{ display: 'flex', gap: '12px', maxWidth: '500px' }}>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="e.g. Family Call, Team Standup"
            className="auth-input"
            style={{ flex: 1 }}
            autoFocus
          />
          <button onClick={handleCreate} className="auth-btn-primary" disabled={creating || !newName.trim()}>
            {creating ? 'Creating...' : 'Create'}
          </button>
        </div>
        {error && <div className="auth-message auth-message-error" style={{ marginTop: '8px', maxWidth: '500px' }}>{error}</div>}
      </section>

      {/* Active Conferences */}
      <section className="hub-section">
        <h2 className="hub-section-title">
          <svg viewBox="0 0 20 20" fill="currentColor" className="hub-section-icon">
            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm12.553-1.106A1 1 0 0014 5.882v8.236a1 1 0 001.447.894l4-2a1 1 0 000-1.789l-4-2.236z"/>
          </svg>
          Active Conferences
          {conferences.length > 0 && <span className="hub-count-badge">{conferences.length}</span>}
        </h2>

        {conferences.length === 0 ? (
          <div className="hub-empty"><p>No active conferences. Create one above.</p></div>
        ) : (
          <div className="hub-apps-grid">
            {conferences.map((conf) => (
              <div key={conf.id} className="hub-app-card has-access">
                <div className="hub-app-header">
                  <h3 className="hub-app-name">{conf.name}</h3>
                  <span className="hub-badge" style={{ background: 'rgba(0,242,255,0.15)', color: '#00f2ff' }}>Live</span>
                </div>
                <p className="hub-app-description">
                  Created by {conf.createdBy.name || conf.createdBy.username}
                  {' '}&middot;{' '}
                  {new Date(conf.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
                <div className="hub-app-footer" style={{ flexWrap: 'wrap', gap: '8px' }}>
                  <button onClick={() => handleJoin(conf.room)} className="hub-btn-open">
                    Join
                    <svg viewBox="0 0 20 20" fill="currentColor" className="hub-icon-sm">
                      <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => handleCopy(conf.id, conf.guestUrl)}
                    className="hub-btn-request"
                    style={{ fontSize: '13px' }}
                  >
                    {copiedId === conf.id ? 'Copied!' : 'Copy Guest Link'}
                  </button>
                  {(user && (conf.createdBy.userId === user.id || user.role === 'ADMIN')) && (
                    <button
                      onClick={() => handleEnd(conf.id)}
                      style={{ background: 'none', border: '1px solid rgba(255,80,80,0.4)', color: '#ff5050', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                    >
                      End
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
