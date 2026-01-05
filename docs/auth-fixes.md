# Auth and OAuth Fixes (Consolidated)

This document consolidates the auth-related fixes that were previously split across multiple summary files.

## Cookie Persistence Fix (Cross-Subdomain Cookies)

### Problem
Login did not persist even on the same page, and cookies were not shared across subdomains.

### Root Cause
The auth service was setting cookies without a domain attribute, so cookies were scoped to the exact host (`auth.korczewski.de`) and not shared with `l2p.korczewski.de`, `payment.korczewski.de`, etc.

### Fix
- Add `COOKIE_DOMAIN` to auth env files.
- Set the cookie `domain` option on all auth-set cookies.

Env changes:
```
# auth/.env-prod
COOKIE_DOMAIN=.korczewski.de

# auth/.env-dev
# COOKIE_DOMAIN=localhost
```

Code changes (examples):
```ts
res.cookie('accessToken', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 15 * 60 * 1000,
  domain: process.env.COOKIE_DOMAIN || undefined,
});
```

Files updated:
- `auth/src/routes/auth.ts`
- `auth/src/routes/oauth.ts`
- `auth/.env-prod`
- `auth/.env-dev`

### Deployment
1. Rebuild and restart the auth service.
2. Verify `Set-Cookie` includes `Domain=.korczewski.de`.

### Verification Checklist
- Login persists on refresh at `auth.korczewski.de`.
- Authenticated state is shared across subdomains.
- Browser cookies show `Domain=.korczewski.de`.

## JWT Claims Standardization

### Problem
Auth and L2P used different JWT issuer and audience claims, preventing local token validation in L2P.

### Fix
Standardize claims across both services:
- `issuer`: `unified-auth`
- `audience`: `korczewski-services`

Files updated:
- `auth/src/services/TokenService.ts`
- `l2p/backend/src/services/AuthService.ts`

### Impact
Existing tokens issued with old claims become invalid. Users will need to log in again after deployment.

### Deployment Options
- Zero-downtime: deploy auth first, wait for access tokens to expire, then deploy L2P.
- Fast rollout: deploy both together and accept re-authentication.

### Verification
Decode a token and confirm `iss` and `aud` values match the standardized claims.

## OAuth Login DB Propagation Fix

### Problem
OAuth login succeeded, but L2P users could not access game data because the profile linkage was missing.

### Root Causes
1. `oauthAuthenticate` middleware in `l2p/backend/src/middleware/oauth-auth.ts` was a stub returning 501.
2. OAuth flow did not reliably create a `user_game_profiles` row for the auth user.

### Fix
- Implement OAuth token verification against the auth service (`/api/auth/verify`).
- Attach auth user data to `req.user` in the middleware.
- Ensure the game profile is created during OAuth token exchange.

Supporting assets:
- `l2p/backend/scripts/test-oauth-flow.sh`
- `l2p/backend/scripts/verify-oauth-db-propagation.sql`

### Post-Fix Flow (Summary)
1. Auth service issues tokens.
2. L2P exchanges the OAuth code for tokens.
3. L2P creates or fetches the game profile for the auth user.
4. OAuth-protected endpoints combine auth data with game profile data.

### Testing
Automated:
```
cd l2p/backend
./scripts/test-oauth-flow.sh
```

Manual verification (example):
```sql
SELECT COUNT(*) FROM user_game_profiles;
SELECT * FROM user_game_profiles ORDER BY created_at DESC LIMIT 1;
```

## Notes
- For local development, leave `COOKIE_DOMAIN` unset so cookies default to `localhost`.
- If token validation fails after deployment, clear cookies and re-login.
