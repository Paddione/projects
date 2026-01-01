import axios from 'axios';

export interface OAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
  user: {
    userId: number;
    email: string;
    username: string;
    name: string | null;
    role: string;
    emailVerified: boolean;
    avatarUrl?: string | null;
  };
}

/**
 * OAuthService
 * Handles OAuth 2.0 client operations for L2P (communicates with auth service)
 */
export class OAuthService {
  private readonly authServiceBaseUrl: string;
  private readonly authServiceApiUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor() {
    const authServiceUrlRaw = (process.env.AUTH_SERVICE_URL || 'http://localhost:5500')
      .trim()
      .replace(/\/+$/, '');
    this.authServiceBaseUrl = authServiceUrlRaw.endsWith('/api')
      ? authServiceUrlRaw.slice(0, -4)
      : authServiceUrlRaw;
    this.authServiceApiUrl = `${this.authServiceBaseUrl}/api`;
    this.clientId = process.env.AUTH_SERVICE_CLIENT_ID || 'l2p_client_prod';
    this.clientSecret = process.env.AUTH_SERVICE_CLIENT_SECRET || '';
    this.redirectUri = process.env.OAUTH_REDIRECT_URI || 'http://localhost:5173/auth/callback';

    if (!this.clientSecret) {
      console.warn('WARNING: AUTH_SERVICE_CLIENT_SECRET not configured');
    }
  }

  /**
   * Exchange authorization code for access/refresh tokens
   */
  async exchangeCode(code: string): Promise<OAuthTokenResponse> {
    try {
      const response = await axios.post<OAuthTokenResponse>(
        `${this.authServiceApiUrl}/oauth/l2p/token`,
        {
          grant_type: 'authorization_code',
          code,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: this.redirectUri
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000 // 10 second timeout
        }
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error_description || error.response?.data?.error || error.message;
        throw new Error(`Failed to exchange authorization code: ${message}`);
      }
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<OAuthTokenResponse> {
    try {
      const response = await axios.post<OAuthTokenResponse>(
        `${this.authServiceApiUrl}/oauth/l2p/token`,
        {
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: this.redirectUri
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error_description || error.response?.data?.error || error.message;
        throw new Error(`Failed to refresh token: ${message}`);
      }
      throw error;
    }
  }

  /**
   * Revoke token (logout)
   */
  async revokeToken(token: string, tokenTypeHint?: 'access_token' | 'refresh_token'): Promise<void> {
    try {
      await axios.post(
        `${this.authServiceApiUrl}/oauth/revoke`,
        {
          token,
          token_type_hint: tokenTypeHint,
          client_id: this.clientId
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );
    } catch (error) {
      // OAuth spec says revoke should always succeed
      // Log error but don't throw
      console.error('Error revoking token:', error);
    }
  }

  /**
   * Validate access token with auth service
   */
  async validateToken(accessToken: string): Promise<{
    valid: boolean;
    user?: OAuthTokenResponse['user'];
    error?: string;
  }> {
    try {
      const response = await axios.post(
        `${this.authServiceApiUrl}/oauth/validate`,
        {
          access_token: accessToken,
          client_id: this.clientId
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 5000
        }
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return {
          valid: false,
          error: error.response?.data?.error || error.message
        };
      }
      return {
        valid: false,
        error: 'Unknown error'
      };
    }
  }

  /**
   * Build authorization URL for OAuth flow
   * Frontend redirects user to this URL to initiate OAuth
   */
  buildAuthorizationUrl(state: string, scope?: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      state,
      scope: scope || 'openid profile email'
    });

    return `${this.authServiceApiUrl}/oauth/l2p/authorize?${params.toString()}`;
  }

  /**
   * Get OAuth configuration (for frontend)
   */
  getConfig() {
    return {
      authServiceUrl: this.authServiceBaseUrl,
      clientId: this.clientId,
      redirectUri: this.redirectUri
    };
  }
}
