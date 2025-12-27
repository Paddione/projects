import type { User } from '../db/schema.js';

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

export interface AuthResult {
  user: Omit<User, 'password_hash'>;
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
