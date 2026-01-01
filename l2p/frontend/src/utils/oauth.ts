/**
 * OAuth 2.0 Utility Functions
 * Helpers for OAuth authorization code flow
 */

/**
 * Generate a cryptographically secure random state for CSRF protection
 */
export function generateRandomState(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback for older browsers
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Build OAuth authorization URL
 */
export function buildAuthorizationUrl(
  authServiceUrl: string,
  clientId: string,
  redirectUri: string,
  state: string,
  scope?: string
): string {
  const trimmed = authServiceUrl.trim().replace(/\/+$/, '');
  const baseUrl = trimmed.endsWith('/api') ? trimmed.slice(0, -4) : trimmed;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
    scope: scope || 'openid profile email'
  });

  return `${baseUrl}/api/oauth/l2p/authorize?${params.toString()}`;
}

/**
 * Validate state parameter (CSRF protection)
 */
export function validateState(receivedState: string, storedState: string | null): boolean {
  if (!storedState) {
    return false;
  }
  return receivedState === storedState;
}

/**
 * Store OAuth state in session storage
 */
export function storeOAuthState(state: string): void {
  sessionStorage.setItem('oauth_state', state);
}

/**
 * Get OAuth state from session storage
 */
export function getOAuthState(): string | null {
  return sessionStorage.getItem('oauth_state');
}

/**
 * Clear OAuth state from session storage
 */
export function clearOAuthState(): void {
  sessionStorage.removeItem('oauth_state');
}

/**
 * Extract OAuth parameters from URL
 */
export function extractOAuthParams(): { code: string | null; state: string | null } {
  const params = new URLSearchParams(window.location.search);
  return {
    code: params.get('code'),
    state: params.get('state')
  };
}

/**
 * Clear OAuth parameters from URL (without page reload)
 */
export function clearOAuthParamsFromUrl(): void {
  window.history.replaceState({}, document.title, window.location.pathname);
}
