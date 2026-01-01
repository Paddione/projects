import express, { type Request, type Response } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/AuthService.js';
import { TokenService } from '../services/TokenService.js';
import { authenticate } from '../middleware/authenticate.js';
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
      tokens: result.tokens,
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
      tokens: result.tokens,
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
    const token = req.headers.authorization?.substring(7) || req.cookies?.accessToken;

    if (token) {
      await tokenService.blacklistToken(token);
    }

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

    res.status(200).json({ tokens });
  } catch (error) {
    res.status(401).json({ error: 'Token refresh failed' });
  }
});

/**
 * GET /api/auth/verify
 * Verify token validity
 */
router.get('/verify', authenticate, async (req: Request, res: Response) => {
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
