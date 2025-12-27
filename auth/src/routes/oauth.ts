import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { OAuthService } from '../services/OAuthService.js';
import { authenticate } from '../middleware/authenticate.js';

const router = express.Router();
const oauthService = new OAuthService();

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
      const redirectUrl = (req.session as any)?.oauthRedirect || 'http://localhost:5500/apps';
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

export default router;
