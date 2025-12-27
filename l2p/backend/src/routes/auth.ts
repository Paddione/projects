import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { AuthService, RegisterData, LoginCredentials } from '../services/AuthService.js';
import { authenticate, validateRefreshToken } from '../middleware/auth.js';

const router = Router();
const authService = new AuthService();

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
  username: Joi.string().required(),
  password: Joi.string().required()
});

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

    const credentials: LoginCredentials = value;

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
router.post('/refresh', validateRefreshToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const refreshToken = req.cookies?.['refreshToken'] || (req.body as Record<string, unknown>)['refreshToken'];

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
router.post('/logout', (req: Request, res: Response): void => {
  // Clear cookies
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/' });

  res.status(200).json({
    message: 'Logout successful'
  });
});

/**
 * GET /api/auth/me
 * Get current user information
 */
router.get('/me', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await authService.getUserByToken(
      req.cookies?.['accessToken'] || req.headers.authorization?.substring(7) || ''
    );

    if (!user) {
      res.status(404).json({
        error: 'User not found',
        message: 'Could not find user information'
      });
      return;
    }

    res.status(200).json({
      user
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
router.get('/validate', authenticate, (req: Request, res: Response): void => {
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

export default router;
