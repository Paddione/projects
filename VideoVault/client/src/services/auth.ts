const authServiceUrlRaw = (import.meta as any)?.env?.VITE_AUTH_SERVICE_URL || 'http://localhost:5500';
const authServiceUrl = authServiceUrlRaw.replace(/\/+$/, '');
const AUTH_SERVICE_API_URL = authServiceUrl.endsWith('/api')
  ? authServiceUrl
  : `${authServiceUrl}/api`;

type Listener = (isAdmin: boolean) => void;

export class AuthService {
  private static admin = false;
  private static listeners = new Set<Listener>();
  private static tokenKey = 'accessToken';
  private static refreshTokenKey = 'refreshToken';

  static subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private static notify() {
    Array.from(this.listeners).forEach((l) => l(this.admin));
  }

  static get cachedIsAdmin() { return this.admin; }

  private static getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(this.tokenKey);
  }

  private static getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(this.refreshTokenKey);
  }

  private static setTokens(tokens: { accessToken: string; refreshToken?: string }) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(this.tokenKey, tokens.accessToken);
    if (tokens.refreshToken) {
      window.localStorage.setItem(this.refreshTokenKey, tokens.refreshToken);
    }
  }

  private static clearTokens() {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(this.tokenKey);
    window.localStorage.removeItem(this.refreshTokenKey);
  }

  private static async refreshTokens(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${AUTH_SERVICE_API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) return false;
      const data = await response.json().catch(() => null);
      if (!data?.tokens?.accessToken) return false;
      this.setTokens({
        accessToken: data.tokens.accessToken,
        refreshToken: data.tokens.refreshToken,
      });
      return true;
    } catch {
      return false;
    }
  }

  private static async refreshInternal(allowRefresh: boolean): Promise<boolean> {
    try {
      const accessToken = this.getAccessToken();
      if (!accessToken) {
        this.admin = false;
        this.notify();
        return this.admin;
      }

      const response = await fetch(`${AUTH_SERVICE_API_URL}/auth/verify`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        if (allowRefresh && response.status === 401) {
          const refreshed = await this.refreshTokens();
          if (refreshed) {
            return this.refreshInternal(false);
          }
        }
        this.admin = false;
        this.notify();
        return this.admin;
      }

      const data = await response.json().catch(() => null);
      this.admin = data?.user?.role === 'ADMIN';
    } catch (e: any) {
      this.admin = false;
    }
    this.notify();
    return this.admin;
  }

  static async refresh(): Promise<boolean> {
    return this.refreshInternal(true);
  }

  static async login(username: string, password: string): Promise<{ ok: boolean; message?: string }> {
    try {
      const response = await fetch(`${AUTH_SERVICE_API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail: username, password }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        const msg = (error?.message as string) || (error?.error as string) || 'Login failed';
        this.admin = false;
        this.notify();
        return { ok: false, message: msg };
      }

      const data = await response.json().catch(() => null);
      if (!data?.tokens?.accessToken) {
        this.admin = false;
        this.notify();
        return { ok: false, message: 'Login failed' };
      }

      this.setTokens({
        accessToken: data.tokens.accessToken,
        refreshToken: data.tokens.refreshToken,
      });

      this.admin = data?.user?.role === 'ADMIN';
      this.notify();
      return { ok: true };
    } catch (e: any) {
      this.admin = false;
      this.notify();
      const msg = (e?.body?.message as string) || 'Login failed';
      return { ok: false, message: msg };
    }
  }

  static async logout(): Promise<void> {
    const accessToken = this.getAccessToken();
    if (accessToken) {
      try {
        await fetch(`${AUTH_SERVICE_API_URL}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      } catch {}
    }
    this.clearTokens();
    this.admin = false;
    this.notify();
  }

  static async promptAndLogin(): Promise<boolean> {
    const u = window.prompt('Admin username:', 'admin');
    if (!u) return false;
    const p = window.prompt('Admin password:', '');
    if (p == null) return false;
    const res = await this.login(u, p);
    if (!res.ok) alert(res.message || 'Login failed');
    return res.ok;
  }
}
