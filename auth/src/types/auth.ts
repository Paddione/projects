export interface TokenPayload {
  userId: number;
  username: string;
  email: string;
  role: string;
  selectedCharacter?: string;
  characterLevel?: number;
  iat?: number;
  exp?: number;
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

/**
 * Safe user object with sensitive internal fields stripped.
 * Only fields safe for client exposure are included.
 */
export interface SafeUser {
  id: number;
  email: string;
  username: string;
  name: string | null;
  avatar_url: string | null;
  timezone: string | null;
  role: string;
  selected_character: string | null;
  character_level: number;
  experience_points: number;
  preferences: unknown;
  notification_settings: unknown;
  email_verified: boolean;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  last_login: Date | null;
}

export interface AuthResult {
  user: SafeUser;
  tokens: AuthTokens;
}

export interface OAuthUserInfo {
  email: string;
  name?: string;
  picture?: string;
  verified_email?: boolean;
  id: string;
}

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  id_token?: string;
}
