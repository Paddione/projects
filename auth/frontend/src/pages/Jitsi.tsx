import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthApi } from '../services/authApi';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function Jitsi() {
  const [room, setRoom] = useState('');
  const [user, setUser] = useState<{ username: string; name?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteUrl, setInviteUrl] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    AuthApi.getApps()
      .then((res) => {
        setUser(res.user);
        setLoading(false);
      })
      .catch((err) => {
        const status = (err as Error & { status?: number }).status;
        if (status === 401 || status === 403) {
          navigate('/login', { replace: true });
        }
        setLoading(false);
      });
  }, [navigate]);

  const handleJoin = () => {
    const roomName = room.trim().toLowerCase().replace(/[^a-z0-9\-_]/g, '') || 'meeting';
    // Redirect to auth's own /api/jitsi/authorize which will mint JWT and redirect to Jitsi
    window.location.href = `${API_URL}/api/jitsi/authorize?redirect_uri=https://meet.korczewski.de/${roomName}`;
  };

  const handleCreateInvite = async () => {
    const roomName = room.trim().toLowerCase().replace(/[^a-z0-9\-_]/g, '') || 'meeting';
    setInviteLoading(true);
    setInviteError('');
    setInviteUrl('');
    setCopied(false);

    try {
      const response = await fetch(`${API_URL}/api/jitsi/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify({ room: roomName, expires_in: '2h' }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create invite');
      }

      const data = await response.json();
      setInviteUrl(data.url);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to create invite');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text
      const input = document.querySelector('.jitsi-invite-url') as HTMLInputElement;
      if (input) {
        input.select();
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  if (loading) {
    return (
      <div className="hub-page">
        <div className="hub-loading">
          <div className="hub-spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="hub-page">
      <div className="hub-hero">
        <div className="hub-hero-content">
          <div className="hub-hero-graphic">
            <svg viewBox="0 0 120 120" className="hub-hero-svg">
              <defs>
                <linearGradient id="jitsiGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#00f2ff"/>
                  <stop offset="100%" stopColor="#bc13fe"/>
                </linearGradient>
                <filter id="jitsiGlow">
                  <feGaussianBlur stdDeviation="3" result="blur"/>
                  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>
              {/* Video camera icon */}
              <rect x="25" y="35" width="45" height="35" rx="5" stroke="url(#jitsiGrad)" strokeWidth="2" fill="none" filter="url(#jitsiGlow)"/>
              <polygon points="75,42 95,32 95,78 75,68" stroke="url(#jitsiGrad)" strokeWidth="2" fill="none" filter="url(#jitsiGlow)"/>
              {/* Signal waves */}
              <path d="M50 25 C50 25 40 20 40 25" stroke="#00f2ff" strokeWidth="1" fill="none" opacity="0.4"/>
              <path d="M55 20 C55 20 42 13 42 20" stroke="#bc13fe" strokeWidth="1" fill="none" opacity="0.3"/>
              {/* Participant dots */}
              <circle cx="35" cy="90" r="4" fill="#00f2ff" opacity="0.6"/>
              <circle cx="50" cy="90" r="4" fill="#bc13fe" opacity="0.6"/>
              <circle cx="65" cy="90" r="4" fill="#00f2ff" opacity="0.6"/>
              <circle cx="80" cy="90" r="4" fill="#bc13fe" opacity="0.6"/>
            </svg>
          </div>
          <div className="hub-hero-text">
            <h1 className="hub-title">Jitsi Meet</h1>
            {user && (
              <p className="hub-user-greeting">
                Joining as <span className="hub-username">{user.name || user.username}</span>
              </p>
            )}
          </div>
        </div>
        <div className="hub-header-actions">
          <a href="/hub" className="hub-btn-admin">Back to Hub</a>
        </div>
      </div>

      <section className="hub-section">
        <h2 className="hub-section-title">
          <svg viewBox="0 0 20 20" fill="currentColor" className="hub-section-icon">
            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm12.553-1.106A1 1 0 0014 5.882v8.236a1 1 0 001.447.894l4-2a1 1 0 000-1.789l-4-2.236z"/>
          </svg>
          Join a Meeting
        </h2>

        <div style={{ maxWidth: '500px' }}>
          <div className="auth-form-group">
            <label className="auth-label">Room Name</label>
            <input
              type="text"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="e.g. family-call"
              className="auth-input"
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              autoFocus
            />
            <small style={{ color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
              Letters, numbers, hyphens, underscores. Leave empty for "meeting".
            </small>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button onClick={handleJoin} className="auth-btn-primary" style={{ flex: 1 }}>
              Join Meeting
            </button>
            <button onClick={handleCreateInvite} className="auth-btn-secondary" disabled={inviteLoading}>
              {inviteLoading ? 'Creating...' : 'Create Guest Invite'}
            </button>
          </div>

          {inviteError && (
            <div className="auth-message auth-message-error" style={{ marginTop: '12px' }}>
              {inviteError}
            </div>
          )}

          {inviteUrl && (
            <div style={{ marginTop: '16px', padding: '16px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <label className="auth-label">Guest Invite Link (expires in 2h)</label>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <input
                  type="text"
                  value={inviteUrl}
                  readOnly
                  className="auth-input jitsi-invite-url"
                  style={{ flex: 1, fontSize: '13px' }}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button onClick={handleCopy} className="auth-btn-primary" style={{ whiteSpace: 'nowrap' }}>
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <small style={{ color: 'var(--text-secondary)', marginTop: '8px', display: 'block' }}>
                Share this link with guests. They can join without an account.
              </small>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
