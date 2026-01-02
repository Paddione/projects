// OAuth service for L2P - integrates with centralized auth service

export class OAuthService {
  private authServiceUrl: string;
  private clientId: string;
  private redirectUri: string;
  private clientSecret: string;

  constructor() {
    const nodeEnv = process.env['NODE_ENV'];
    const authServiceEnv = process.env['AUTH_SERVICE_URL'];
    const frontendEnv = process.env['FRONTEND_URL'];
    const isProduction = nodeEnv === 'production'
      || (!nodeEnv && ((authServiceEnv && authServiceEnv.startsWith('https://')) || (frontendEnv && frontendEnv.startsWith('https://'))));
    const defaultAuthServiceUrl = isProduction
      ? 'https://auth.korczewski.de'
      : 'http://localhost:5500';
    const rawAuthServiceUrl = authServiceEnv || defaultAuthServiceUrl;
    const trimmedAuthServiceUrl = rawAuthServiceUrl.trim().replace(/\/+$/, '');
    this.authServiceUrl = trimmedAuthServiceUrl.endsWith('/api')
      ? trimmedAuthServiceUrl.slice(0, -4)
      : trimmedAuthServiceUrl;

    // Use environment variables or defaults
    this.clientId = process.env['OAUTH_CLIENT_ID'] || 'l2p_client_prod';
    const defaultFrontendUrl = isProduction
      ? 'https://l2p.korczewski.de'
      : 'http://localhost:3000';
    this.redirectUri = process.env['OAUTH_REDIRECT_URI']
      || `${(process.env['FRONTEND_URL'] || defaultFrontendUrl).trim().replace(/\/+$/, '')}/auth/callback`;
    this.clientSecret = this.resolveClientSecret(nodeEnv);
  }

  private resolveClientSecret(nodeEnv?: string): string {
    const secret = process.env['OAUTH_CLIENT_SECRET'];
    if (secret && secret.trim()) {
      return secret.trim();
    }

    if (nodeEnv !== 'production') {
      // Development fallback matches the seeded OAuth client secret placeholder.
      return 'L2PclientSecretChangeInProduction12345';
    }

    return '';
  }

  private getClientSecret(): string {
    if (!this.clientSecret) {
      throw new Error('OAuth client secret is not configured');
    }
    return this.clientSecret;
  }


  async exchangeCode(code: string): Promise<any> {
    // Exchange authorization code for tokens via auth service
    const response = await fetch(`${this.authServiceUrl}/api/oauth/l2p/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        client_id: this.clientId,
        client_secret: this.getClientSecret(),
        redirect_uri: this.redirectUri
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to exchange code' }));
      throw new Error(error.error_description || error.error || 'Failed to exchange authorization code');
    }

    return response.json();
  }

  async refreshToken(refreshToken: string): Promise<any> {
    // Refresh access token via auth service
    const response = await fetch(`${this.authServiceUrl}/api/oauth/l2p/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.getClientSecret()
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to refresh token' }));
      throw new Error(error.error_description || error.error || 'Failed to refresh token');
    }

    return response.json();
  }

  async revokeToken(token: string, tokenType: string = 'access_token'): Promise<void> {
    // Revoke token via auth service
    const response = await fetch(`${this.authServiceUrl}/api/oauth/l2p/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        token,
        token_type_hint: tokenType,
        client_id: this.clientId
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to revoke token' }));
      throw new Error(error.error_description || error.error || 'Failed to revoke token');
    }
  }

  getConfig(): any {
    return {
      authServiceUrl: this.authServiceUrl,
      clientId: this.clientId,
      redirectUri: this.redirectUri,
      authorizationEndpoint: `${this.authServiceUrl}/api/oauth/l2p/authorize`,
      tokenEndpoint: `${this.authServiceUrl}/api/oauth/l2p/token`,
      revokeEndpoint: `${this.authServiceUrl}/api/oauth/l2p/revoke`
    };
  }
}
