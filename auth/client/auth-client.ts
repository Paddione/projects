/**
 * Auth Client Library
 *
 * Shared client for integrating with the unified auth service.
 * Can be used by l2p, VideoVault, and payment projects.
 *
 * Usage in frontend:
 *   import { AuthClient } from '@/lib/auth-client';
 *   const authClient = new AuthClient('http://localhost:5500');
 *   const user = await authClient.getCurrentUser();
 *
 * Usage in backend (Express middleware):
 *   import { authMiddleware } from '@/lib/auth-client';
 *   app.use(authMiddleware('http://localhost:5500'));
 */

export interface User {
  userId: number;
  email: string;
  username: string;
  name?: string;
  role: string;
  emailVerified: boolean;
  avatarUrl?: string;
  selectedCharacter?: string;
  characterLevel?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginCredentials {
  usernameOrEmail: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  name?: string;
}

export class AuthClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor(baseUrl: string = 'http://localhost:5500') {
    this.baseUrl = baseUrl;

    // Load tokens from storage (browser)
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('accessToken');
      this.refreshToken = localStorage.getItem('refreshToken');
    }
  }

  /**
   * Get auth headers for API requests
   */
  private getAuthHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    return headers;
  }

  /**
   * Save tokens to storage
   */
  private saveTokens(tokens: AuthTokens) {
    this.accessToken = tokens.accessToken;
    this.refreshToken = tokens.refreshToken;

    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
    }
  }

  /**
   * Clear tokens from storage
   */
  private clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;

    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
  }

  /**
   * Redirect to central login page
   */
  redirectToLogin(redirectUrl?: string) {
    if (typeof window !== 'undefined') {
      const currentUrl = redirectUrl || window.location.href;
      window.location.href = `${this.baseUrl}/login?redirect=${encodeURIComponent(currentUrl)}`;
    }
  }

  /**
   * Redirect to central register page
   */
  redirectToRegister(redirectUrl?: string) {
    if (typeof window !== 'undefined') {
      const currentUrl = redirectUrl || window.location.href;
      window.location.href = `${this.baseUrl}/register?redirect=${encodeURIComponent(currentUrl)}`;
    }
  }

  /**
   * Login with credentials (for embedded login forms)
   */
  async login(credentials: LoginCredentials): Promise<{ user: User; tokens: AuthTokens }> {
    const response = await fetch(`${this.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    const data = await response.json();
    this.saveTokens(data.tokens);

    return data;
  }

  /**
   * Register new user (for embedded register forms)
   */
  async register(data: RegisterData): Promise<{ user: User; tokens: AuthTokens }> {
    const response = await fetch(`${this.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Registration failed');
    }

    const data_1 = await response.json();
    this.saveTokens(data_1.tokens);

    return data_1;
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearTokens();
    }
  }

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/user/me`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Try to refresh token
          const refreshed = await this.refreshAccessToken();
          if (refreshed) {
            // Retry with new token
            return this.getCurrentUser();
          }
        }
        return null;
      }

      const data = await response.json();
      return data.user;
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  }

  /**
   * Verify token validity
   */
  async verifyToken(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/verify`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
        credentials: 'include',
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (!response.ok) {
        this.clearTokens();
        return false;
      }

      const data = await response.json();
      this.saveTokens(data.tokens);

      return true;
    } catch (error) {
      console.error('Token refresh error:', error);
      this.clearTokens();
      return false;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(updates: Partial<User>): Promise<User> {
    const response = await fetch(`${this.baseUrl}/api/user/profile`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Profile update failed');
    }

    const data = await response.json();
    return data.user;
  }

  /**
   * Change password
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/auth/change-password`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Password change failed');
    }
  }

  /**
   * Get access token
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Set tokens manually (useful after redirect from central auth)
   */
  setTokens(tokens: AuthTokens) {
    this.saveTokens(tokens);
  }
}

/**
 * Express middleware for verifying auth tokens
 *
 * Usage:
 *   import { authMiddleware } from './auth-client';
 *   app.use(authMiddleware('http://localhost:5500'));
 *
 *   // Or with custom options
 *   app.use(authMiddleware('http://localhost:5500', { required: false }));
 */
export function authMiddleware(authServiceUrl: string, options: { required?: boolean } = {}) {
  return async (req: any, res: any, next: any) => {
    try {
      // Extract token from Authorization header or cookies
      let token: string | undefined;

      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else if (req.cookies?.accessToken) {
        token = req.cookies.accessToken;
      }

      if (!token) {
        if (options.required !== false) {
          return res.status(401).json({ error: 'No authentication token provided' });
        }
        return next();
      }

      // Verify token with auth service
      const response = await fetch(`${authServiceUrl}/api/auth/verify`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (options.required !== false) {
          return res.status(401).json({ error: 'Invalid or expired token' });
        }
        return next();
      }

      const data = await response.json();
      req.user = data.user;

      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      if (options.required !== false) {
        return res.status(401).json({ error: 'Authentication failed' });
      }
      next();
    }
  };
}

// Export singleton instance for convenience
export const authClient = new AuthClient();
