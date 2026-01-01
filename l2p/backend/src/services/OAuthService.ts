// OAuth service for L2P - integrates with centralized auth service

export class OAuthService {
  private authServiceUrl: string;
  private clientId: string;
  private redirectUri: string;

  constructor() {
    this.authServiceUrl = process.env['AUTH_SERVICE_URL'] || 'https://auth.korczewski.de';
    // L2P is registered as a client in the auth service
    this.clientId = 'l2p_client_prod';
    this.redirectUri = `${process.env['FRONTEND_URL'] || 'https://l2p.korczewski.de'}/auth/callback`;
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
        client_id: this.clientId
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
