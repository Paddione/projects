import { ApiClient } from '@/services/api-client';

type Listener = (isAdmin: boolean) => void;

export class AuthService {
  private static admin = false;
  private static listeners = new Set<Listener>();

  static subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private static notify() {
    Array.from(this.listeners).forEach((l) => l(this.admin));
  }

  static get cachedIsAdmin() { return this.admin; }

  static async refresh(): Promise<boolean> {
    try {
      // Query public auth status endpoint (does not log 401s)
      const res = await ApiClient.get<{ isAdmin: boolean }>('/api/auth/status');
      this.admin = !!res?.isAdmin;
    } catch (e: any) {
      this.admin = false;
    }
    this.notify();
    return this.admin;
  }

  static async login(username: string, password: string): Promise<{ ok: boolean; message?: string }> {
    try {
      await ApiClient.post('/api/auth/login', { username, password });
      this.admin = true;
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
    try { await ApiClient.post('/api/auth/logout'); } catch {}
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
