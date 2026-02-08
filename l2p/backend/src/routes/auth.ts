import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { AuthService, RegisterData, LoginCredentials } from '../services/AuthService.js';
import { authenticate } from '../middleware/auth.js';
import { oauthAuthenticate } from '../middleware/oauth-auth.js';
import { OAuthService } from '../services/OAuthService.js';
import { GameProfileService } from '../services/GameProfileService.js';

const router = Router();
const authService = new AuthService();
const oauthService = new OAuthService();
const gameProfileService = new GameProfileService();
const authServiceUrlRaw = process.env['AUTH_SERVICE_URL'];
const authServiceUrl = authServiceUrlRaw ? authServiceUrlRaw.replace(/\/+$/, '') : '';
const authApiBaseUrl = authServiceUrl
  ? (authServiceUrl.endsWith('/api') ? authServiceUrl : `${authServiceUrl}/api`)
  : '';

// Validation schemas
const registerSchema = Joi.object({
  username: Joi.string()
    .alphanum()
    .min(3)
    .max(30)
    .required()
    .messages({
      'string.alphanum': 'Username must contain only alphanumeric characters',
      'string.min': 'Username must be at least 3 characters long',
      'string.max': 'Username must not exceed 30 characters'
    }),
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address'
    }),
  password: Joi.string()
    .min(8)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters long'
    }),
  selectedCharacter: Joi.string()
    .valid('professor', 'student', 'librarian', 'researcher', 'dean', 'graduate', 'lab_assistant', 'teaching_assistant')
    .default('student')
    .optional(),
  preferences: Joi.object({
    language: Joi.string().valid('en', 'de').default('en'),
    theme: Joi.string().valid('light', 'dark').default('light')
  }).optional()
});

const loginSchema = Joi.object({
  username: Joi.string().optional(),
  usernameOrEmail: Joi.string().optional(),
  password: Joi.string().required()
}).or('username', 'usernameOrEmail');

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).required()
});

const emailVerificationSchema = Joi.object({
  token: Joi.string().required()
});

const resendVerificationSchema = Joi.object({
  email: Joi.string().email().required()
});

const passwordResetRequestSchema = Joi.object({
  email: Joi.string().email().required()
});

const passwordResetCompleteSchema = Joi.object({
  token: Joi.string().required(),
  newPassword: Joi.string().min(8).required()
});

const forcePasswordChangeSchema = Joi.object({
  newPassword: Joi.string().min(8).required()
});

// Cookie configuration
const getCookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env['NODE_ENV'] === 'production',
  sameSite: 'lax' as const, // Changed from strict to lax for cross-subdomain support
  maxAge,
  path: '/',
  domain: process.env['COOKIE_DOMAIN'] || undefined // Allow sharing cookies across subdomains
});

const ACCESS_TOKEN_COOKIE_MAX_AGE = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

const hasCentralAuth = !!authApiBaseUrl;

const extractAccessToken = (req: Request): string | null => {
  const authHeader = req.headers?.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return req.cookies?.['accessToken'] || null;
};

const setAuthCookies = (res: Response, tokens?: { accessToken?: string; refreshToken?: string }) => {
  if (!tokens?.accessToken) {
    return;
  }

  res.cookie('accessToken', tokens.accessToken, getCookieOptions(ACCESS_TOKEN_COOKIE_MAX_AGE));
  if (tokens.refreshToken) {
    res.cookie('refreshToken', tokens.refreshToken, getCookieOptions(REFRESH_TOKEN_COOKIE_MAX_AGE));
  }
};

type AuthProxyOptions = {
  path: string;
  method?: string;
  body?: Record<string, unknown>;
  includeAuth?: boolean;
};

const proxyAuthService = async (
  req: Request,
  res: Response,
  options: AuthProxyOptions
): Promise<boolean> => {
  if (!hasCentralAuth) {
    return false;
  }

  const headers: Record<string, string> = {};
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  if (options.includeAuth) {
    const token = extractAccessToken(req);
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  // Forward X-Requested-With header for CSRF protection in destination service
  const xRequestedWith = req.headers['x-requested-with'];
  if (xRequestedWith) {
    headers['X-Requested-With'] = xRequestedWith as string;
  }

  try {
    const response = await fetch(`${authApiBaseUrl}${options.path}`, {
      method: options.method ?? req.method,
      headers,
      body: options.body ? JSON.stringify(options.body) : null
    });

    const data = await response.json().catch(() => null);

    if (data?.tokens?.accessToken) {
      setAuthCookies(res, data.tokens);
    }

    res.status(response.status).json(data ?? {});
    return true;
  } catch (error) {
    res.status(503).json({
      error: 'Authentication service unavailable',
      message: 'Authentication service unavailable'
    });
    return true;
  }
};

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request body
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: 'Validation failed',
        message: error.details[0]?.message || 'Validation error',
        details: error.details
      });
      return;
    }

    const registerData: RegisterData = value;

    if (hasCentralAuth) {
      const proxied = await proxyAuthService(req, res, {
        path: '/auth/register',
        method: 'POST',
        body: {
          username: registerData.username,
          email: registerData.email,
          password: registerData.password,
          name: (registerData as any).name
        }
      });
      if (proxied) {
        return;
      }
    }

    // Register user
    const result = await authService.register(registerData);

    // Set secure cookies
    res.cookie('accessToken', result.tokens.accessToken, getCookieOptions(ACCESS_TOKEN_COOKIE_MAX_AGE));
    res.cookie('refreshToken', result.tokens.refreshToken, getCookieOptions(REFRESH_TOKEN_COOKIE_MAX_AGE));

    // Return success response
    res.status(201).json({
      message: 'User registered successfully',
      user: result.user,
      tokens: result.tokens
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Username already exists' || error.message === 'Email already exists') {
        res.status(409).json({
          error: 'Registration failed',
          message: error.message
        });
        return;
      }

      if (error.message.includes('Password must')) {
        res.status(400).json({
          error: 'Password validation failed',
          message: error.message
        });
        return;
      }
    }

    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      message: 'An unexpected error occurred during registration'
    });
  }
});

/**
 * POST /api/auth/login
 * Login user with credentials
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request body
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: 'Validation failed',
        message: error.details[0]?.message || 'Validation error'
      });
      return;
    }

    const usernameOrEmail = value.usernameOrEmail || value.username;
    const credentials: LoginCredentials = {
      username: usernameOrEmail,
      password: value.password
    };

    if (hasCentralAuth) {
      const proxied = await proxyAuthService(req, res, {
        path: '/auth/login',
        method: 'POST',
        body: {
          usernameOrEmail,
          password: value.password
        }
      });
      if (proxied) {
        return;
      }
    }

    // Login user
    const result = await authService.login(credentials);

    // Set secure cookies
    res.cookie('accessToken', result.tokens.accessToken, getCookieOptions(ACCESS_TOKEN_COOKIE_MAX_AGE));
    res.cookie('refreshToken', result.tokens.refreshToken, getCookieOptions(REFRESH_TOKEN_COOKIE_MAX_AGE));

    // Return success response
    res.status(200).json({
      message: 'Login successful',
      user: result.user,
      tokens: result.tokens
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Invalid credentials' || error.message === 'Account is deactivated') {
        res.status(401).json({
          error: 'Login failed',
          message: error.message
        });
        return;
      }
    }

    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      message: 'An unexpected error occurred during login'
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const refreshToken = req.cookies?.['refreshToken'] || (req.body as Record<string, unknown>)['refreshToken'];

    if (hasCentralAuth) {
      if (!refreshToken) {
        res.status(401).json({
          error: 'Refresh token required',
          message: 'No refresh token provided'
        });
        return;
      }

      const proxied = await proxyAuthService(req, res, {
        path: '/auth/refresh',
        method: 'POST',
        body: { refreshToken }
      });
      if (proxied) {
        return;
      }
    }

    if (!refreshToken) {
      res.status(401).json({
        error: 'Refresh token required',
        message: 'No refresh token provided'
      });
      return;
    }

    // Refresh tokens
    const tokens = await authService.refreshToken(refreshToken);

    // Set new secure cookies
    res.cookie('accessToken', tokens.accessToken, getCookieOptions(ACCESS_TOKEN_COOKIE_MAX_AGE));
    res.cookie('refreshToken', tokens.refreshToken, getCookieOptions(REFRESH_TOKEN_COOKIE_MAX_AGE));

    // Return new tokens
    res.status(200).json({
      message: 'Tokens refreshed successfully',
      tokens
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Refresh token expired') {
        res.status(401).json({
          error: 'Refresh token expired',
          message: 'Refresh token has expired, please login again',
          code: 'REFRESH_TOKEN_EXPIRED'
        });
        return;
      }

      if (error.message === 'Invalid refresh token') {
        res.status(401).json({
          error: 'Invalid refresh token',
          message: 'Refresh token is invalid',
          code: 'REFRESH_TOKEN_INVALID'
        });
        return;
      }
    }

    console.error('Token refresh error:', error);
    res.status(401).json({
      error: 'Token refresh failed',
      message: 'Could not refresh tokens'
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user by clearing cookies
 */
router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  if (hasCentralAuth) {
    const token = extractAccessToken(req);
    if (token) {
      res.clearCookie('accessToken', { path: '/' });
      res.clearCookie('refreshToken', { path: '/' });
      try {
        await fetch(`${authApiBaseUrl}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch {
        // Ignore logout errors from auth service; local logout should still succeed.
      }
      res.status(200).json({
        message: 'Logout successful'
      });
      return;
    }
  }

  // Clear cookies
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/' });

  res.status(200).json({
    message: 'Logout successful'
  });
});

router.get('/me', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    // req.user is populated by authenticate middleware (handles both tokens and Traefik headers)
    if (!req.user) {
      res.status(401).json({
        error: 'Not authenticated',
        message: 'User session not found'
      });
      return;
    }

    // Return the user information that was already resolved by the middleware
    res.status(200).json({
      user: req.user
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      error: 'Failed to get user information',
      message: 'An unexpected error occurred'
    });
  }
});

/**
 * POST /api/auth/change-password
 * Change user password
 */
router.post('/change-password', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request body
    const { error, value } = changePasswordSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: 'Validation failed',
        message: error.details[0]?.message || 'Validation error'
      });
      return;
    }

    const { currentPassword, newPassword } = value;

    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated'
      });
      return;
    }

    if (hasCentralAuth) {
      const proxied = await proxyAuthService(req, res, {
        path: '/auth/change-password',
        method: 'POST',
        includeAuth: true,
        body: { currentPassword, newPassword }
      });
      if (proxied) {
        return;
      }
    }

    // Change password
    await authService.changePassword(req.user.userId, currentPassword, newPassword);

    res.status(200).json({
      message: 'Password changed successfully'
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Current password is incorrect') {
        res.status(400).json({
          error: 'Password change failed',
          message: error.message
        });
        return;
      }

      if (error.message.includes('Password must')) {
        res.status(400).json({
          error: 'Password validation failed',
          message: error.message
        });
        return;
      }
    }

    console.error('Change password error:', error);
    res.status(500).json({
      error: 'Password change failed',
      message: 'An unexpected error occurred'
    });
  }
});

/**
 * POST /api/auth/deactivate
 * Deactivate user account
 */
router.post('/deactivate', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    if (hasCentralAuth) {
      res.status(501).json({
        error: 'Not supported',
        message: 'Account deactivation is handled by the central auth service'
      });
      return;
    }

    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated'
      });
      return;
    }

    await authService.deactivateAccount(req.user.userId);

    // Clear cookies on deactivation
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/' });

    res.status(200).json({
      message: 'Account deactivated successfully'
    });
  } catch (error) {
    console.error('Account deactivation error:', error);
    res.status(500).json({
      error: 'Account deactivation failed',
      message: 'An unexpected error occurred'
    });
  }
});

/**
 * GET /api/auth/validate
 * Validate current token
 */
router.get('/validate', authenticate, async (req: Request, res: Response): Promise<void> => {
  if (hasCentralAuth) {
    const proxied = await proxyAuthService(req, res, {
      path: '/auth/verify',
      method: 'GET',
      includeAuth: true
    });
    if (proxied) {
      return;
    }
  }

  if (!req.user) {
    res.status(401).json({
      error: 'Authentication required',
      message: 'User not authenticated'
    });
    return;
  }

  res.status(200).json({
    valid: true,
    user: {
      userId: req.user.userId,
      username: req.user.username,
      email: req.user.email
    }
  });
});

/**
 * GET /api/auth/verify
 * Verify current token (alias for /validate)
 */
router.get('/verify', authenticate, async (req: Request, res: Response): Promise<void> => {
  if (hasCentralAuth) {
    const proxied = await proxyAuthService(req, res, {
      path: '/auth/verify',
      method: 'GET',
      includeAuth: true
    });
    if (proxied) {
      return;
    }
  }

  if (!req.user) {
    res.status(401).json({
      error: 'Authentication required',
      message: 'User not authenticated'
    });
    return;
  }

  res.status(200).json({
    valid: true,
    user: {
      userId: req.user.userId,
      username: req.user.username,
      email: req.user.email
    }
  });
});

/**
 * POST /api/auth/verify-email
 * Verify email address with token
 */
router.post('/verify-email', async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request body
    const { error, value } = emailVerificationSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: 'Validation failed',
        message: error.details[0]?.message || 'Validation error'
      });
      return;
    }

    const { token } = value;

    if (hasCentralAuth) {
      const proxied = await proxyAuthService(req, res, {
        path: '/auth/verify-email',
        method: 'POST',
        body: { token }
      });
      if (proxied) {
        return;
      }
    }

    // Verify email
    const user = await authService.verifyEmail(token);

    if (!user) {
      res.status(400).json({
        error: 'Email verification failed',
        message: 'Invalid or expired verification token'
      });
      return;
    }

    res.status(200).json({
      message: 'Email verified successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        email_verified: user.email_verified
      }
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Invalid or expired verification token') {
        res.status(400).json({
          error: 'Email verification failed',
          message: error.message
        });
        return;
      }
    }

    console.error('Email verification error:', error);
    res.status(500).json({
      error: 'Email verification failed',
      message: 'An unexpected error occurred'
    });
  }
});

/**
 * POST /api/auth/resend-verification
 * Resend email verification
 */
router.post('/resend-verification', async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request body
    const { error, value } = resendVerificationSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: 'Validation failed',
        message: error.details[0]?.message || 'Validation error'
      });
      return;
    }

    const { email } = value;

    if (hasCentralAuth) {
      const proxied = await proxyAuthService(req, res, {
        path: '/auth/resend-verification',
        method: 'POST',
        body: { email }
      });
      if (proxied) {
        return;
      }
    }

    // Resend verification email
    await authService.resendEmailVerification(email);

    res.status(200).json({
      message: 'Verification email sent successfully'
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'User not found') {
        res.status(404).json({
          error: 'Resend verification failed',
          message: 'Email address not found'
        });
        return;
      }

      if (error.message === 'Email is already verified') {
        res.status(400).json({
          error: 'Resend verification failed',
          message: error.message
        });
        return;
      }
    }

    console.error('Resend verification error:', error);
    res.status(500).json({
      error: 'Resend verification failed',
      message: 'An unexpected error occurred'
    });
  }
});

/**
 * POST /api/auth/forgot-password
 * Request password reset
 */
router.post('/forgot-password', async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request body
    const { error, value } = passwordResetRequestSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: 'Validation failed',
        message: error.details[0]?.message || 'Validation error'
      });
      return;
    }

    const { email } = value;

    if (hasCentralAuth) {
      const proxied = await proxyAuthService(req, res, {
        path: '/auth/forgot-password',
        method: 'POST',
        body: { email }
      });
      if (proxied) {
        return;
      }
    }

    // Request password reset
    await authService.requestPasswordReset(email);

    // Always return success to prevent email enumeration
    res.status(200).json({
      message: 'If the email address exists, a password reset email has been sent'
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Account is deactivated') {
        res.status(400).json({
          error: 'Password reset failed',
          message: error.message
        });
        return;
      }
    }

    console.error('Password reset request error:', error);
    res.status(500).json({
      error: 'Password reset failed',
      message: 'An unexpected error occurred'
    });
  }
});

/**
 * POST /api/auth/reset-password
 * Complete password reset with token
 */
router.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request body
    const { error, value } = passwordResetCompleteSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: 'Validation failed',
        message: error.details[0]?.message || 'Validation error'
      });
      return;
    }

    const { token, newPassword } = value;

    if (hasCentralAuth) {
      const proxied = await proxyAuthService(req, res, {
        path: '/auth/reset-password',
        method: 'POST',
        body: { token, newPassword }
      });
      if (proxied) {
        return;
      }
    }

    // Complete password reset
    await authService.completePasswordReset(token, newPassword);

    res.status(200).json({
      message: 'Password reset completed successfully'
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Invalid or expired reset token') {
        res.status(400).json({
          error: 'Password reset failed',
          message: error.message
        });
        return;
      }

      if (error.message.includes('Password must')) {
        res.status(400).json({
          error: 'Password validation failed',
          message: error.message
        });
        return;
      }
    }

    console.error('Password reset completion error:', error);
    res.status(500).json({
      error: 'Password reset failed',
      message: 'An unexpected error occurred'
    });
  }
});

/**
 * GET /api/auth/needs-password-change
 * Check if user needs to change password
 */
router.get('/needs-password-change', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    if (hasCentralAuth) {
      res.status(501).json({
        error: 'Not supported',
        message: 'Password change checks are handled by the central auth service'
      });
      return;
    }

    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated'
      });
      return;
    }

    const needsChange = await authService.needsPasswordChange(req.user.userId);

    res.status(200).json({
      needsPasswordChange: needsChange
    });
  } catch (error) {
    console.error('Check password change error:', error);
    res.status(500).json({
      error: 'Check failed',
      message: 'An unexpected error occurred'
    });
  }
});

/**
 * POST /api/auth/force-password-change
 * Force password change for users with reset tokens
 */
router.post('/force-password-change', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    if (hasCentralAuth) {
      res.status(501).json({
        error: 'Not supported',
        message: 'Password changes are handled by the central auth service'
      });
      return;
    }

    // Validate request body
    const { error, value } = forcePasswordChangeSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: 'Validation failed',
        message: error.details[0]?.message || 'Validation error'
      });
      return;
    }

    const { newPassword } = value;

    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated'
      });
      return;
    }

    // Force password change
    await authService.forcePasswordChange(req.user.userId, newPassword);

    res.status(200).json({
      message: 'Password changed successfully'
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'No active password reset required') {
        res.status(400).json({
          error: 'Password change failed',
          message: error.message
        });
        return;
      }

      if (error.message.includes('Password must')) {
        res.status(400).json({
          error: 'Password validation failed',
          message: error.message
        });
        return;
      }
    }

    console.error('Force password change error:', error);
    res.status(500).json({
      error: 'Password change failed',
      message: 'An unexpected error occurred'
    });
  }
});

/**
 * GET /api/auth/forward-auth
 * Simple endpoint for proxy forward authentication.
 * Returns 200 if authenticated, 401 otherwise.
 */
router.get('/forward-auth', authenticate, (req: Request, res: Response): void => {
  // If the authenticate middleware succeeded, we just return 200
  res.status(200).send('Authenticated');
});

// ============================================================================
// OAuth 2.0 Endpoints
// ============================================================================

/**
 * POST /api/auth/oauth/exchange
 * Exchange authorization code for tokens
 * This is called by the frontend after receiving the code from auth service
 */
router.post('/oauth/exchange', async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, state } = req.body;

    if (!code) {
      res.status(400).json({
        error: 'Validation failed',
        message: 'Authorization code is required'
      });
      return;
    }

    // Exchange code for tokens via OAuth service
    const tokenResponse = await oauthService.exchangeCode(code);

    // Resolve auth-service user to local L2P user so the frontend stores the correct local ID.
    // Without this, the frontend would store the auth-service ID which mismatches
    // the local L2P ID that socket middleware resolves, causing IDENTITY_MISMATCH errors.
    const localUser = await authService.getOrCreateUserFromUnifiedAuth({
      userId: tokenResponse.user.userId,
      username: tokenResponse.user.username,
      email: tokenResponse.user.email
    });

    // Create or update game profile for the local user
    await gameProfileService.getOrCreateProfile(localUser.id);

    // Set tokens in cookies
    res.cookie('accessToken', tokenResponse.access_token, getCookieOptions(ACCESS_TOKEN_COOKIE_MAX_AGE));
    res.cookie('refreshToken', tokenResponse.refresh_token, getCookieOptions(REFRESH_TOKEN_COOKIE_MAX_AGE));

    // Return tokens and user data with local L2P user ID
    res.status(200).json({
      message: 'OAuth login successful',
      user: {
        ...tokenResponse.user,
        userId: localUser.id
      },
      tokens: {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token
      }
    });
  } catch (error) {
    console.error('OAuth exchange error:', error);
    res.status(400).json({
      error: 'OAuth exchange failed',
      message: error instanceof Error ? error.message : 'Failed to exchange authorization code'
    });
  }
});

/**
 * POST /api/auth/oauth/refresh
 * Refresh access token using refresh token
 */
router.post('/oauth/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const refreshToken = req.cookies['refreshToken'] || req.body.refresh_token;

    if (!refreshToken) {
      res.status(400).json({
        error: 'Validation failed',
        message: 'Refresh token is required'
      });
      return;
    }

    // Refresh tokens via OAuth service
    const tokenResponse = await oauthService.refreshToken(refreshToken);

    // Resolve auth-service user to local L2P user (same fix as /oauth/exchange)
    let resolvedUser = tokenResponse.user;
    if (tokenResponse.user?.email) {
      try {
        const localUser = await authService.getOrCreateUserFromUnifiedAuth({
          userId: tokenResponse.user.userId,
          username: tokenResponse.user.username,
          email: tokenResponse.user.email
        });
        resolvedUser = { ...tokenResponse.user, userId: localUser.id };
      } catch (err) {
        console.warn('Failed to resolve refreshed user to local L2P user:', err instanceof Error ? err.message : err);
      }
    }

    // Set new tokens in cookies
    res.cookie('accessToken', tokenResponse.access_token, getCookieOptions(ACCESS_TOKEN_COOKIE_MAX_AGE));
    res.cookie('refreshToken', tokenResponse.refresh_token, getCookieOptions(REFRESH_TOKEN_COOKIE_MAX_AGE));

    // Return new tokens with local L2P user ID
    res.status(200).json({
      message: 'Tokens refreshed successfully',
      tokens: {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token
      },
      user: resolvedUser
    });
  } catch (error) {
    console.error('OAuth refresh error:', error);
    res.status(401).json({
      error: 'Token refresh failed',
      message: error instanceof Error ? error.message : 'Failed to refresh tokens'
    });
  }
});

/**
 * GET /api/auth/oauth/me
 * Get current user info with game profile (OAuth version)
 * Uses OAuth authentication middleware
 */
router.get('/oauth/me', oauthAuthenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated'
      });
      return;
    }

    // Get game profile
    const gameProfile = await gameProfileService.getOrCreateProfile(req.user.userId);

    // Combine auth user data with game profile
    res.status(200).json({
      user: {
        userId: req.user.userId,
        username: req.user.username,
        email: req.user.email,
        role: req.user.role,
        emailVerified: req.user.emailVerified,
        // Game-specific fields from profile
        selectedCharacter: gameProfile.selectedCharacter,
        characterLevel: gameProfile.characterLevel,
        experiencePoints: gameProfile.experiencePoints,
        preferences: gameProfile.preferences
      }
    });
  } catch (error) {
    console.error('OAuth me error:', error);
    res.status(500).json({
      error: 'Failed to get user info',
      message: 'An unexpected error occurred'
    });
  }
});

/**
 * POST /api/auth/oauth/logout
 * Logout user and revoke tokens
 */
router.post('/oauth/logout', async (req: Request, res: Response): Promise<void> => {
  try {
    const accessToken = req.cookies['accessToken'] || req.headers.authorization?.replace('Bearer ', '');

    // Revoke token with auth service
    if (accessToken) {
      await oauthService.revokeToken(accessToken, 'access_token');
    }

    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    res.status(200).json({
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('OAuth logout error:', error);
    // Still clear cookies even if revoke fails
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    res.status(200).json({
      message: 'Logged out successfully'
    });
  }
});

/**
 * GET /api/auth/oauth/config
 * Get OAuth configuration for frontend
 */
router.get('/oauth/config', (req: Request, res: Response): void => {
  const config = oauthService.getConfig();
  res.status(200).json(config);
});

export default router;
