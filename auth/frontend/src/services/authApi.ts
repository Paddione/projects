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
  emailVerified?: boolean;
  createdAt?: string;
  lastLogin?: string | null;
}

export interface FullUser {
  id: number;
  email: string;
  username: string;
  role: string;
  name?: string | null;
  avatar_url?: string | null;
  timezone?: string;
  is_active: boolean;
  email_verified: boolean;
  selected_character?: string;
  character_level?: number;
  experience_points?: number;
  preferences?: Record<string, unknown>;
  notification_settings?: Record<string, unknown>;
  failed_login_attempts?: number;
  last_failed_login?: string | null;
  account_locked_until?: string | null;
  created_at: string;
  updated_at: string;
  last_login?: string | null;
}

export interface AccessRequest {
  id: number;
  appId: number;
  appName: string;
  appKey: string;
  reason?: string | null;
  status: 'pending' | 'approved' | 'denied';
  adminResponse?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
}

export interface AdminAccessRequest extends AccessRequest {
  userId: number;
  username: string;
  userEmail: string;
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

  // Access Requests
  static async createAccessRequest(appId: number, reason?: string): Promise<{ request: AccessRequest }> {
    const response = await fetch(`${API_URL}/api/access-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ appId, reason }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const err = new Error(error.error || 'Failed to create request') as Error & { status?: number };
      err.status = response.status;
      throw err;
    }

    return response.json();
  }

  static async getAccessRequests(): Promise<{ requests: AccessRequest[] }> {
    const response = await fetch(`${API_URL}/api/access-requests`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const err = new Error(error.error || 'Failed to fetch requests') as Error & { status?: number };
      err.status = response.status;
      throw err;
    }

    return response.json();
  }

  static async getAdminAccessRequests(status: string = 'pending'): Promise<{ requests: AdminAccessRequest[] }> {
    const response = await fetch(`${API_URL}/api/access-requests/admin?status=${status}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const err = new Error(error.error || 'Failed to fetch requests') as Error & { status?: number };
      err.status = response.status;
      throw err;
    }

    return response.json();
  }

  static async reviewAccessRequest(id: number, status: 'approved' | 'denied', response?: string): Promise<void> {
    const res = await fetch(`${API_URL}/api/access-requests/admin/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status, response }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      const err = new Error(error.error || 'Failed to review request') as Error & { status?: number };
      err.status = res.status;
      throw err;
    }
  }

  // Full user management
  static async getAdminUser(userId: number): Promise<{ user: FullUser; appAccess: { appId: number; appKey: string; appName: string }[] }> {
    const response = await fetch(`${API_URL}/api/admin/users/${userId}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const err = new Error(error.error || 'Failed to fetch user') as Error & { status?: number };
      err.status = response.status;
      throw err;
    }

    return response.json();
  }

  static async updateAdminUser(userId: number, data: Partial<FullUser>): Promise<void> {
    const response = await fetch(`${API_URL}/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const err = new Error(error.error || 'Failed to update user') as Error & { status?: number };
      err.status = response.status;
      throw err;
    }
  }

  static async deleteAdminUser(userId: number): Promise<void> {
    const response = await fetch(`${API_URL}/api/admin/users/${userId}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const err = new Error(error.error || 'Failed to delete user') as Error & { status?: number };
      err.status = response.status;
      throw err;
    }
  }

  static async getAppUsers(appId: number): Promise<{ app: { id: number; name: string }; users: AdminUser[] }> {
    const response = await fetch(`${API_URL}/api/admin/apps/${appId}/users`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const err = new Error(error.error || 'Failed to fetch app users') as Error & { status?: number };
      err.status = response.status;
      throw err;
    }

    return response.json();
  }
}
