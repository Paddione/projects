import { useSearchParams, Link } from 'react-router-dom';

export default function AccessDenied() {
  const [searchParams] = useSearchParams();
  const app = searchParams.get('app');
  const reason = searchParams.get('reason');
  const redirect = searchParams.get('redirect') || '';

  const isAdminRequired = reason === 'admin_required';

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title">Access Denied</h1>
          <p className="auth-subtitle">
            {isAdminRequired
              ? 'This resource requires administrator privileges.'
              : app
                ? `You don't have access to ${app}.`
                : 'You don\'t have access to this resource.'}
          </p>
        </div>

        <div className="auth-form">
          {!isAdminRequired && app && (
            <p style={{ color: 'var(--cv-text-secondary)', textAlign: 'center', marginBottom: 'var(--cv-space-4)' }}>
              Contact an administrator to request access, or use the Hub to manage your apps.
            </p>
          )}

          <Link to="/hub" className="auth-btn-primary" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
            Go to Hub
          </Link>

          {redirect && (
            <button
              onClick={() => window.location.href = redirect}
              className="auth-btn-secondary"
              style={{ marginTop: 'var(--cv-space-2)', width: '100%' }}
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
