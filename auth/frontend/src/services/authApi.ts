const API_URL = import.meta.env.VITE_API_URL || '';

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  name?: string;
}

export interface LoginData {
  usernameOrEmail: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: number;
    email: string;
    username: string;
    role: string;
    name?: string;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
  message?: string;
}

export interface ForgotPasswordResponse {
  message: string;
  resetToken?: string;
}

export interface ResetPasswordResponse {
  message: string;
}

export interface AppAccess {
  id: number;
  key: string;
  name: string;
  description?: string | null;
  url: string;
  isActive: boolean;
  hasAccess: boolean;
}

export interface AppsResponse {
  user: {
    id: number;
    email: string;
    username: string;
    role: string;
    name?: string | null;
  };
  apps: AppAccess[];
}

export interface AdminUser {
  id: number;
  email: string;
  username: string;
  role: string;
  name?: string | null;
  isActive: boolean;
}

export class AuthApi {
  static async register(data: RegisterData): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Registration failed');
    }

    return response.json();
  }

  static async login(data: LoginData): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    return response.json();
  }

  static async logout(): Promise<void> {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  }

  static async requestPasswordReset(email: string): Promise<ForgotPasswordResponse> {
    const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Password reset request failed');
    }

    return response.json();
  }

  static async resetPassword(token: string, newPassword: string): Promise<ResetPasswordResponse> {
    const response = await fetch(`${API_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, newPassword }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Password reset failed');
    }

    return response.json();
  }

  static async getApps(): Promise<AppsResponse> {
    const response = await fetch(`${API_URL}/api/apps`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const message = error.error || 'Failed to fetch apps';
      const err = new Error(message) as Error & { status?: number };
      err.status = response.status;
      throw err;
    }

    return response.json();
  }

  static async getAdminUsers(): Promise<AdminUser[]> {
    const response = await fetch(`${API_URL}/api/admin/users`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const message = error.error || 'Failed to fetch users';
      const err = new Error(message) as Error & { status?: number };
      err.status = response.status;
      throw err;
    }

    const data = await response.json();
    return data.users as AdminUser[];
  }

  static async getAdminUserApps(userId: number): Promise<{ userId: number; role: string; apps: AppAccess[] }> {
    const response = await fetch(`${API_URL}/api/admin/users/${userId}/apps`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const message = error.error || 'Failed to fetch user access';
      const err = new Error(message) as Error & { status?: number };
      err.status = response.status;
      throw err;
    }

    return response.json();
  }

  static async updateAdminUserApps(userId: number, appIds: number[]): Promise<void> {
    const response = await fetch(`${API_URL}/api/admin/users/${userId}/apps`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ appIds }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const message = error.error || 'Failed to update access';
      const err = new Error(message) as Error & { status?: number };
      err.status = response.status;
      throw err;
    }
  }
}
