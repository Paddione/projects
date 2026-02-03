import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { AuthApi } from '../services/authApi';

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const redirectParamValue = searchParams.get('redirect_uri') || searchParams.get('redirect') || '';
  const redirectParamKey = searchParams.get('redirect_uri') ? 'redirect_uri' : (searchParams.get('redirect') ? 'redirect' : '');
  const redirectUri = redirectParamValue;
  const project = searchParams.get('project') || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await AuthApi.register({ username, email, password, name });

      // Redirect back to the project (cookies handle authentication)
      if (redirectUri) {
        window.location.href = redirectUri;
      } else {
        navigate('/apps', { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = () => {
    const googleAuthUrl = `/api/oauth/google?redirect=${encodeURIComponent(redirectUri)}`;
    window.location.href = googleAuthUrl;
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title auth-view-register">Create Account</h1>
          <p className="auth-subtitle">Sign up to get started</p>
          {project && (
            <div className="auth-project-badge">
              Registering for: <span className="auth-project-name">{project}</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && (
            <div className="auth-message auth-message-error">
              {error}
            </div>
          )}

          <div className="auth-form-group">
            <label htmlFor="name" className="auth-label">
              Full Name (optional)
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="auth-input"
              autoComplete="name"
            />
          </div>

          <div className="auth-form-group">
            <label htmlFor="username" className="auth-label">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="auth-input"
              required
              autoComplete="username"
            />
          </div>

          <div className="auth-form-group">
            <label htmlFor="email" className="auth-label">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input"
              required
              autoComplete="email"
            />
          </div>

          <div className="auth-form-group">
            <label htmlFor="password" className="auth-label">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-input"
              required
              autoComplete="new-password"
            />
            <span className="auth-input-hint">
              Must be 8+ characters with uppercase, lowercase, number, and special character (@$!%*?&)
            </span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`auth-btn-primary ${loading ? 'auth-loading' : ''}`}
          >
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        <div className="auth-divider">
          <div className="auth-divider-line"></div>
          <span className="auth-divider-text">Or continue with</span>
        </div>

        <div>
          <button
            onClick={handleGoogleRegister}
            className="auth-btn-oauth"
          >
            <svg className="auth-oauth-icon" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Sign up with Google
          </button>
        </div>

        <div className="auth-footer">
          Already have an account?{' '}
          <Link
            to={`/login${redirectParamKey && redirectUri ? `?${redirectParamKey}=${encodeURIComponent(redirectUri)}&project=${project}` : ''}`}
            className="auth-footer-link"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
