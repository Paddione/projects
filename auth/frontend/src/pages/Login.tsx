import { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { AuthApi } from '../services/authApi';

type LoginView = 'login' | 'forgot' | 'reset';

export default function Login() {
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<LoginView>('login');
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const redirectParamValue = searchParams.get('redirect_uri') || searchParams.get('redirect') || '';
  const redirectParamKey = searchParams.get('redirect_uri') ? 'redirect_uri' : (searchParams.get('redirect') ? 'redirect' : '');
  const redirectUri = redirectParamValue;
  const project = searchParams.get('project') || '';
  const accessToken = searchParams.get('accessToken');
  const refreshToken = searchParams.get('refreshToken');
  const resetTokenParam = searchParams.get('reset_token') || searchParams.get('token') || searchParams.get('resetToken') || '';

  useEffect(() => {
    if (!accessToken || !refreshToken) {
      return;
    }

    if (redirectUri) {
      const url = new URL(redirectUri);
      url.searchParams.set('accessToken', accessToken);
      url.searchParams.set('refreshToken', refreshToken);
      window.location.href = url.toString();
      return;
    }

    navigate('/apps', { replace: true });
  }, [accessToken, refreshToken, redirectUri, navigate]);

  useEffect(() => {
    if (!resetTokenParam) {
      return;
    }

    setResetToken(resetTokenParam);
    setView('reset');
  }, [resetTokenParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await AuthApi.login({ usernameOrEmail, password });

      // Redirect back to the project with tokens
      if (redirectUri) {
        const url = new URL(redirectUri);
        url.searchParams.set('auth_token', response.tokens.accessToken);
        url.searchParams.set('refresh_token', response.tokens.refreshToken);
        window.location.href = url.toString();
      } else {
        navigate('/apps', { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotMessage('');
    setForgotLoading(true);

    try {
      const response = await AuthApi.requestPasswordReset(resetEmail);
      setForgotMessage(response.message);

      if (response.resetToken) {
        setResetToken(response.resetToken);
        setResetMessage('Reset token generated. Set your new password below.');
        setResetSuccess(false);
        setView('reset');
      }
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : 'Password reset request failed');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetMessage('');

    if (!resetToken.trim()) {
      setResetError('Reset token is required.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match.');
      return;
    }

    setResetLoading(true);

    try {
      const response = await AuthApi.resetPassword(resetToken.trim(), newPassword);
      setResetMessage(response.message || 'Password reset successful. You can now sign in.');
      setResetSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Password reset failed');
    } finally {
      setResetLoading(false);
    }
  };

  const handleShowForgot = () => {
    setError('');
    setForgotError('');
    setForgotMessage('');
    setResetError('');
    setResetMessage('');
    setResetSuccess(false);

    if (!resetEmail && usernameOrEmail.includes('@')) {
      setResetEmail(usernameOrEmail);
    }

    setView('forgot');
  };

  const handleBackToLogin = () => {
    setForgotError('');
    setForgotMessage('');
    setResetError('');
    setResetMessage('');
    setResetSuccess(false);
    setView('login');
  };

  const handleGoogleLogin = () => {
    const googleAuthUrl = `/api/oauth/google?redirect=${encodeURIComponent(redirectUri)}`;
    window.location.href = googleAuthUrl;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {view === 'login' ? 'Welcome Back' : (view === 'forgot' ? 'Reset your password' : 'Choose a new password')}
          </h1>
          <p className="text-gray-600 mt-2">
            {view === 'login'
              ? 'Sign in to your account'
              : (view === 'forgot' ? 'Enter your email to receive a reset link' : 'Enter a new password for your account')}
          </p>
          {project && view === 'login' && (
            <p className="text-sm text-indigo-600 mt-1">
              Logging in for: <span className="font-semibold">{project}</span>
            </p>
          )}
        </div>

        {view === 'login' && (
          <>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="usernameOrEmail" className="block text-sm font-medium text-gray-700 mb-2">
                  Username or Email
                </label>
                <input
                  id="usernameOrEmail"
                  type="text"
                  value={usernameOrEmail}
                  onChange={(e) => setUsernameOrEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                  autoComplete="username"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={handleShowForgot}
                    className="text-sm text-indigo-600 hover:text-indigo-500"
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Or continue with</span>
                </div>
              </div>

              <button
                onClick={handleGoogleLogin}
                className="mt-4 w-full flex items-center justify-center gap-3 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
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
                Sign in with Google
              </button>
            </div>

            <p className="mt-6 text-center text-sm text-gray-600">
              Don't have an account?{' '}
              <Link
                to={`/register${redirectParamKey && redirectUri ? `?${redirectParamKey}=${encodeURIComponent(redirectUri)}&project=${project}` : ''}`}
                className="text-indigo-600 hover:text-indigo-500 font-semibold"
              >
                Sign up
              </Link>
            </p>
          </>
        )}

        {view === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="space-y-6">
            {(forgotError || forgotMessage) && (
              <div
                className={`${forgotError ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'} border px-4 py-3 rounded`}
              >
                {forgotError || forgotMessage}
              </div>
            )}

            <div>
              <label htmlFor="resetEmail" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                id="resetEmail"
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
                autoComplete="email"
              />
            </div>

            <button
              type="submit"
              disabled={forgotLoading}
              className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {forgotLoading ? 'Sending...' : 'Send reset link'}
            </button>

            <button
              type="button"
              onClick={handleBackToLogin}
              className="w-full text-indigo-600 border border-indigo-200 py-2 px-4 rounded-lg hover:bg-indigo-50"
            >
              Back to Sign In
            </button>
          </form>
        )}

        {view === 'reset' && (
          <form onSubmit={handleResetPassword} className="space-y-6">
            {(resetError || resetMessage) && (
              <div
                className={`${resetError ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'} border px-4 py-3 rounded`}
              >
                {resetError || resetMessage}
              </div>
            )}

            {resetSuccess ? (
              <button
                type="button"
                onClick={handleBackToLogin}
                className="w-full text-indigo-600 border border-indigo-200 py-2 px-4 rounded-lg hover:bg-indigo-50"
              >
                Back to Sign In
              </button>
            ) : (
              <>
                <div>
                  <label htmlFor="resetToken" className="block text-sm font-medium text-gray-700 mb-2">
                    Reset Token
                  </label>
                  <input
                    id="resetToken"
                    type="text"
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                    autoComplete="off"
                  />
                </div>

                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                    New Password
                  </label>
                  <input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                    autoComplete="new-password"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Must be 8+ characters with uppercase, lowercase, number, and special character (@$!%*?&)
                  </p>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                    autoComplete="new-password"
                  />
                </div>

                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resetLoading ? 'Resetting...' : 'Reset Password'}
                </button>

                <button
                  type="button"
                  onClick={handleBackToLogin}
                  className="w-full text-indigo-600 border border-indigo-200 py-2 px-4 rounded-lg hover:bg-indigo-50"
                >
                  Back to Sign In
                </button>
              </>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
