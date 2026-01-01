/**
 * OAuth 2.0 Type Definitions
 * Defines types for OAuth 2.0 Authorization Code Flow
 */

// ============================================================================
// OAuth Authorization Request
// ============================================================================
export interface OAuthAuthorizeRequest {
  client_id: string;
  redirect_uri: string;
  response_type: 'code';
  state: string;  // CSRF protection
  scope?: string;
}

// ============================================================================
// OAuth Token Request
// ============================================================================
export interface OAuthTokenRequest {
  grant_type: 'authorization_code' | 'refresh_token';
  code?: string;              // For authorization_code grant
  refresh_token?: string;     // For refresh_token grant
  client_id: string;
  client_secret: string;
  redirect_uri: string;
}

// ============================================================================
// OAuth Token Response
// ============================================================================
export interface OAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;  // Seconds
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

// ============================================================================
// OAuth Validate Request
// ============================================================================
export interface OAuthValidateRequest {
  access_token: string;
  client_id: string;
}

// ============================================================================
// OAuth Validate Response
// ============================================================================
export interface OAuthValidateResponse {
  valid: boolean;
  user?: {
    userId: number;
    email: string;
    username: string;
    name: string | null;
    role: string;
    emailVerified: boolean;
    avatarUrl?: string | null;
  };
  error?: string;
}

// ============================================================================
// OAuth Revoke Request
// ============================================================================
export interface OAuthRevokeRequest {
  token: string;
  token_type_hint?: 'access_token' | 'refresh_token';
  client_id: string;
}

// ============================================================================
// Authorization Code Data
// ============================================================================
export interface AuthorizationCodeData {
  userId: number;
  clientId: string;
  redirectUri: string;
  scope: string;
}

// ============================================================================
// OAuth Client Validation Result
// ============================================================================
export interface OAuthClientValidation {
  valid: boolean;
  client?: {
    id: number;
    client_id: string;
    name: string;
    redirect_uris: string[];
    grant_types: string[];
    is_active: boolean;
  };
  error?: string;
}

// ============================================================================
// OAuth Error Response
// ============================================================================
export interface OAuthErrorResponse {
  error: 'invalid_request' | 'invalid_client' | 'invalid_grant' | 'unauthorized_client' | 'unsupported_grant_type' | 'invalid_scope';
  error_description?: string;
  error_uri?: string;
}
