import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { OAuthService } from '../services/OAuthService.js';
import { OAuthClientService } from '../services/OAuthClientService.js';
import { OAuthCodeService } from '../services/OAuthCodeService.js';
import { TokenService } from '../services/TokenService.js';
import { authenticate, optionalAuthenticate } from '../middleware/authenticate.js';
import { db } from '../config/database.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import type { OAuthAuthorizeRequest, OAuthTokenRequest, OAuthValidateRequest, OAuthRevokeRequest } from '../types/oauth.js';

const router = express.Router();
const oauthService = new OAuthService();
const oauthClientService = new OAuthClientService();
const oauthCodeService = new OAuthCodeService();
const tokenService = new TokenService();

// Configure Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5500/api/oauth/google/callback',
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Extract Google profile data
          const googleProfile = {
            id: profile.id,
            email: profile.emails?.[0]?.value || '',
            verified_email: profile.emails?.[0]?.verified || false,
            name: profile.displayName,
            given_name: profile.name?.givenName,
            family_name: profile.name?.familyName,
            picture: profile.photos?.[0]?.value,
          };

          // Handle OAuth callback
          const result = await oauthService.handleGoogleCallback(
            googleProfile,
            accessToken,
            refreshToken
          );

          // Pass the entire result in the user object (we'll extract it in the callback)
          done(null, result as any);
        } catch (error) {
          done(error as Error);
        }
      }
    )
  );
}

/**
 * GET /api/oauth/google
 * Initiate Google OAuth flow
 */
router.get('/google', (req: Request, res: Response, next) => {
  // Store redirect URL in session for callback
  const redirectUrl = req.query.redirect as string;
  if (redirectUrl) {
    (req.session as any).oauthRedirect = redirectUrl;
  }

  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })(req, res, next);
});

/**
 * GET /api/oauth/google/callback
 * Google OAuth callback
 */
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login?error=oauth_failed' }),
  async (req: Request, res: Response) => {
    try {
      const result = req.user as any;

      // Set tokens in cookies
      res.cookie('accessToken', result.tokens.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000, // 15 minutes
      });

      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      // Get redirect URL from session or default to auth service login page
      const redirectUrl = (req.session as any)?.oauthRedirect || `${process.env.APP_URL || 'http://localhost:5500'}/apps`;
      delete (req.session as any)?.oauthRedirect;

      // Redirect with tokens in URL (for cross-origin scenarios)
      const urlParams = new URLSearchParams({
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
      });

      res.redirect(`${redirectUrl}?${urlParams.toString()}`);
    } catch (error) {
      console.error('OAuth callback error:', error);
      res.redirect('/login?error=oauth_callback_failed');
    }
  }
);

/**
 * GET /api/oauth/providers
 * Get linked OAuth providers for current user
 */
router.get('/providers', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const providers = await oauthService.getLinkedProviders(req.user!.userId);
    res.status(200).json({ providers });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch providers' });
  }
});

/**
 * DELETE /api/oauth/providers/:provider
 * Unlink OAuth provider from account
 */
router.delete('/providers/:provider', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { provider } = req.params;

    if (!['google'].includes(provider)) {
      res.status(400).json({ error: 'Invalid provider' });
      return;
    }

    await oauthService.unlinkOAuthProvider(req.user!.userId, provider);
    res.status(200).json({ message: `${provider} account unlinked successfully` });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to unlink provider',
    });
  }
});

// ============================================================================
// L2P OAuth 2.0 Authorization Code Flow Endpoints
// ============================================================================

/**
 * GET /api/oauth/l2p/authorize
 * Initiate OAuth authorization flow for L2P
 * Query params: client_id, redirect_uri, response_type, state, scope (optional)
 */
router.get('/l2p/authorize', optionalAuthenticate, async (req: Request, res: Response) => {
  try {
    const { client_id, redirect_uri, response_type, state, scope } = req.query as Partial<OAuthAuthorizeRequest>;

    // Validate required parameters
    if (!client_id || !redirect_uri || !response_type || !state) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing required parameters'
      });
      return;
    }

    if (response_type !== 'code') {
      res.status(400).json({
        error: 'unsupported_response_type',
        error_description: 'Only authorization code flow is supported'
      });
      return;
    }

    // Validate client
    const clientValidation = await oauthClientService.validateClient(client_id);
    if (!clientValidation.valid) {
      res.status(400).json({
        error: 'invalid_client',
        error_description: clientValidation.error
      });
      return;
    }

    // Validate redirect URI
    const isRedirectValid = await oauthClientService.validateRedirectUri(client_id, redirect_uri);
    if (!isRedirectValid) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'Invalid redirect_uri'
      });
      return;
    }

    // Check if user is authenticated
    if (!req.user) {
      // Store OAuth params in session for after login
      (req.session as any).oauthParams = { client_id, redirect_uri, response_type, state, scope };

      // Redirect to auth service login page with OAuth indicator
      res.redirect(`/login?oauth=true&client=${encodeURIComponent(clientValidation.client!.name)}`);
      return;
    }

    // User is authenticated - generate authorization code
    const code = await oauthCodeService.createAuthorizationCode({
      userId: req.user.userId,
      clientId: client_id,
      redirectUri: redirect_uri,
      scope: (scope as string) || 'openid profile email'
    });

    // Redirect back to client with code
    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set('code', code);
    redirectUrl.searchParams.set('state', state);

    res.redirect(redirectUrl.toString());
  } catch (error) {
    console.error('OAuth authorize error:', error);
    res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error'
    });
  }
});

/**
 * POST /api/oauth/l2p/token
 * Exchange authorization code for access/refresh tokens
 * Body: grant_type, code, client_id, client_secret, redirect_uri
 */
router.post('/l2p/token', async (req: Request, res: Response) => {
  try {
    const { grant_type, code, refresh_token, client_id, client_secret, redirect_uri } = req.body as OAuthTokenRequest;

    // Validate required parameters
    if (!grant_type || !client_id || !client_secret) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing required parameters'
      });
      return;
    }

    // Validate client credentials
    const clientValidation = await oauthClientService.validateClientCredentials(client_id, client_secret);
    if (!clientValidation.valid) {
      res.status(401).json({
        error: 'invalid_client',
        error_description: 'Invalid client credentials'
      });
      return;
    }

    // Validate grant type
    const isGrantTypeValid = await oauthClientService.validateGrantType(client_id, grant_type);
    if (!isGrantTypeValid) {
      res.status(400).json({
        error: 'unsupported_grant_type',
        error_description: `Grant type '${grant_type}' is not supported for this client`
      });
      return;
    }

    if (grant_type === 'authorization_code') {
      // Exchange authorization code for tokens
      if (!code || !redirect_uri) {
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'Missing code or redirect_uri'
        });
        return;
      }

      // Validate and consume code
      const codeData = await oauthCodeService.validateAndConsumeCode(code, client_id, redirect_uri);
      if (!codeData) {
        res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Invalid, expired, or already used authorization code'
        });
        return;
      }

      // Get user data
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, codeData.userId))
        .limit(1);

      if (user.length === 0) {
        res.status(400).json({
          error: 'invalid_grant',
          error_description: 'User not found'
        });
        return;
      }

      // Generate tokens
      const tokens = tokenService.generateTokens(user[0]);

      res.json({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        token_type: 'Bearer',
        expires_in: 900, // 15 minutes
        user: {
          userId: user[0].id,
          email: user[0].email,
          username: user[0].username,
          name: user[0].name,
          role: user[0].role,
          emailVerified: user[0].email_verified,
          avatarUrl: user[0].avatar_url
        }
      });

    } else if (grant_type === 'refresh_token') {
      // Refresh access token
      if (!refresh_token) {
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'Missing refresh_token'
        });
        return;
      }

      // Verify refresh token
      const payload = tokenService.verifyRefreshToken(refresh_token);

      // Get user data
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, payload.userId))
        .limit(1);

      if (user.length === 0) {
        res.status(400).json({
          error: 'invalid_grant',
          error_description: 'User not found'
        });
        return;
      }

      // Generate new tokens
      const tokens = tokenService.generateTokens(user[0]);

      res.json({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        token_type: 'Bearer',
        expires_in: 900,
        user: {
          userId: user[0].id,
          email: user[0].email,
          username: user[0].username,
          name: user[0].name,
          role: user[0].role,
          emailVerified: user[0].email_verified,
          avatarUrl: user[0].avatar_url
        }
      });

    } else {
      res.status(400).json({
        error: 'unsupported_grant_type',
        error_description: `Grant type '${grant_type}' is not supported`
      });
    }
  } catch (error) {
    console.error('OAuth token error:', error);
    if (error instanceof Error && error.message.includes('expired')) {
      res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Refresh token expired'
      });
    } else {
      res.status(500).json({
        error: 'server_error',
        error_description: 'Internal server error'
      });
    }
  }
});

/**
 * POST /api/oauth/validate
 * Validate access token and return user info
 * Body: access_token, client_id
 */
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { access_token, client_id } = req.body as OAuthValidateRequest;

    if (!access_token || !client_id) {
      res.status(400).json({
        valid: false,
        error: 'Missing required parameters'
      });
      return;
    }

    // Validate client
    const clientValidation = await oauthClientService.validateClient(client_id);
    if (!clientValidation.valid) {
      res.status(400).json({
        valid: false,
        error: 'Invalid client'
      });
      return;
    }

    // Verify token
    try {
      const payload = tokenService.verifyAccessToken(access_token);

      // Check if token is blacklisted
      const isBlacklisted = await tokenService.isTokenBlacklisted(access_token);
      if (isBlacklisted) {
        res.json({
          valid: false,
          error: 'Token has been revoked'
        });
        return;
      }

      const userRows = await db
        .select()
        .from(users)
        .where(eq(users.id, payload.userId))
        .limit(1);

      if (userRows.length === 0 || !userRows[0].is_active) {
        res.json({
          valid: false,
          error: 'User not found'
        });
        return;
      }

      const user = userRows[0];

      res.json({
        valid: true,
        user: {
          userId: user.id,
          email: user.email,
          username: user.username,
          name: user.name,
          role: user.role,
          emailVerified: user.email_verified,
          avatarUrl: user.avatar_url
        }
      });
    } catch (error) {
      res.json({
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid token'
      });
    }
  } catch (error) {
    console.error('OAuth validate error:', error);
    res.status(500).json({
      valid: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/oauth/revoke
 * Revoke access or refresh token
 * Body: token, token_type_hint (optional), client_id
 */
router.post('/revoke', async (req: Request, res: Response) => {
  try {
    const { token, client_id } = req.body as OAuthRevokeRequest;

    if (!token || !client_id) {
      res.status(400).json({ error: 'Missing required parameters' });
      return;
    }

    // Validate client
    const clientValidation = await oauthClientService.validateClient(client_id);
    if (!clientValidation.valid) {
      res.status(400).json({ error: 'Invalid client' });
      return;
    }

    // Verify and blacklist token
    try {
      tokenService.verifyAccessToken(token);
      await tokenService.blacklistToken(token);

      res.json({ success: true, message: 'Token revoked successfully' });
    } catch (error) {
      // Even if token is invalid, return success (per OAuth spec)
      res.json({ success: true, message: 'Token revoked' });
    }
  } catch (error) {
    console.error('OAuth revoke error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
