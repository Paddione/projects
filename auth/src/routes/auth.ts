import express, { type Request, type Response } from 'express';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { AuthService } from '../services/AuthService.js';
import { TokenService } from '../services/TokenService.js';
import { authenticate } from '../middleware/authenticate.js';
import { db } from '../config/database.js';
import { apps, userAppAccess } from '../db/schema.js';
import type { LoginCredentials, RegisterData } from '../types/auth.js';

const router = express.Router();
const authService = new AuthService();
const tokenService = new TokenService();

// Validation schemas
const registerSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

const loginSchema = z.object({
  usernameOrEmail: z.string().min(1),
  password: z.string().min(1),
});

const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

const resendVerificationSchema = z.object({
  email: z.string().email(),
});

const requestPasswordResetSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const data = registerSchema.parse(req.body) as RegisterData;

    const result = await authService.register(data);

    // Set tokens in cookies
    res.cookie('accessToken', result.tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
      domain: process.env.COOKIE_DOMAIN || undefined,
    });

    res.cookie('refreshToken', result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      domain: process.env.COOKIE_DOMAIN || undefined,
    });

    res.status(201).json({
      user: result.user,
      message: 'Registration successful. Please check your email to verify your account.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }

    res.status(400).json({ error: error instanceof Error ? error.message : 'Registration failed' });
  }
});

/**
 * POST /api/auth/login
 * Login with credentials
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const credentials = loginSchema.parse(req.body) as LoginCredentials;

    const result = await authService.login(credentials);

    // Set tokens in cookies
    res.cookie('accessToken', result.tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
      domain: process.env.COOKIE_DOMAIN || undefined,
    });

    res.cookie('refreshToken', result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      domain: process.env.COOKIE_DOMAIN || undefined,
    });

    res.status(200).json({
      user: result.user,
      message: 'Login successful',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }

    res.status(401).json({ error: error instanceof Error ? error.message : 'Login failed' });
  }
});

/**
 * POST /api/auth/logout
 * Logout and blacklist token
 */
router.post('/logout', authenticate, async (req: Request, res: Response) => {
  try {
    const accessToken = req.headers.authorization?.substring(7) || req.cookies?.accessToken;
    const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;

    // Blacklist both access and refresh tokens
    const blacklistPromises: Promise<void>[] = [];
    if (accessToken) {
      blacklistPromises.push(tokenService.blacklistToken(accessToken));
    }
    if (refreshToken) {
      blacklistPromises.push(tokenService.blacklistToken(refreshToken));
    }
    await Promise.all(blacklistPromises);

    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    res.status(200).json({ message: 'Logout successful' });
  } catch (error) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;

    if (!refreshToken) {
      res.status(401).json({ error: 'Refresh token required' });
      return;
    }

    // Check if refresh token is blacklisted
    const isBlacklisted = await tokenService.isTokenBlacklisted(refreshToken);
    if (isBlacklisted) {
      res.status(401).json({ error: 'Refresh token has been revoked' });
      return;
    }

    // Verify refresh token
    const payload = tokenService.verifyRefreshToken(refreshToken);

    // Get user
    const user = await authService.getUserById(payload.userId);

    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    // Generate new tokens
    const tokens = tokenService.generateTokens({ ...user, password_hash: null } as any);

    // Set new tokens in cookies
    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
      domain: process.env.COOKIE_DOMAIN || undefined,
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      domain: process.env.COOKIE_DOMAIN || undefined,
    });

    res.status(200).json({ message: 'Token refreshed' });
  } catch (error) {
    res.status(401).json({ error: 'Token refresh failed' });
  }
});

/**
 * GET /api/auth/verify
 * Verify token validity
 * Query params:
 *   - requireAdmin: if set, requires ADMIN role
 *   - app: if set, checks user has access to the specified app (by key)
 */
router.get('/verify', authenticate, async (req: Request, res: Response) => {
  // Check if admin role is required
  const requireAdminRole = req.query.requireAdmin === 'true';
  const appKey = req.query.app as string | undefined;

  if (requireAdminRole && req.user?.role !== 'ADMIN') {
    res.status(403).json({
      error: 'Admin access required',
      valid: false
    });
    return;
  }

  // Check app-level access if app param is provided
  if (appKey && req.user?.role !== 'ADMIN') {
    const [access] = await db
      .select({ id: userAppAccess.id })
      .from(userAppAccess)
      .innerJoin(apps, eq(apps.id, userAppAccess.app_id))
      .where(
        and(
          eq(userAppAccess.user_id, req.user!.userId),
          eq(apps.key, appKey),
          eq(apps.is_active, true)
        )
      )
      .limit(1);

    if (!access) {
      res.status(403).json({
        error: 'Access denied to this application',
        valid: false,
        app: appKey,
      });
      return;
    }
  }

  // Set headers for Traefik ForwardAuth
  if (req.user) {
    res.setHeader('X-Auth-User', req.user.username || '');
    res.setHeader('X-Auth-Email', req.user.email || '');
    res.setHeader('X-Auth-Role', req.user.role || '');
    res.setHeader('X-Auth-User-Id', req.user.userId?.toString() || '');
  }

  res.status(200).json({
    valid: true,
    user: req.user,
  });
});

/**
 * POST /api/auth/verify-email
 * Verify email with token
 */
router.post('/verify-email', async (req: Request, res: Response) => {
  try {
    const { token } = verifyEmailSchema.parse(req.body);

    await authService.verifyEmail(token);

    res.status(200).json({ message: 'Email verified successfully' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Verification failed' });
  }
});

/**
 * POST /api/auth/resend-verification
 * Resend verification email
 */
router.post('/resend-verification', async (req: Request, res: Response) => {
  try {
    const { email } = resendVerificationSchema.parse(req.body);

    await authService.resendEmailVerification(email);

    res.status(200).json({ message: 'Verification email resent successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }

    res.status(400).json({ error: error instanceof Error ? error.message : 'Resend failed' });
  }
});

/**
 * POST /api/auth/forgot-password
 * Request password reset
 */
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = requestPasswordResetSchema.parse(req.body);

    const resetToken = await authService.requestPasswordReset(email);

    res.status(200).json({
      message: 'If the email exists, a password reset link has been sent',
      // TODO: Remove token from response in production (only for development)
      ...(process.env.NODE_ENV === 'development' && { resetToken }),
    });
  } catch (error) {
    res.status(500).json({ error: 'Password reset request failed' });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = resetPasswordSchema.parse(req.body);

    await authService.resetPassword(token, newPassword);

    res.status(200).json({ message: 'Password reset successful' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Password reset failed' });
  }
});

/**
 * POST /api/auth/change-password
 * Change password (authenticated)
 */
router.post('/change-password', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

    await authService.changePassword(req.user!.userId, currentPassword, newPassword);

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Password change failed' });
  }
});

export default router;
