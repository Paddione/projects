# Unified Auth Service Integration Guide

This guide explains how to integrate the unified auth service with your projects (l2p, VideoVault, payment).

## Overview

The unified auth service provides:
- ✅ Centralized user authentication (JWT-based)
- ✅ Google OAuth integration
- ✅ Password reset & email verification
- ✅ Session management
- ✅ User profile management
- ✅ Character progression (for l2p)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Unified Auth Service                      │
│  (Port 5500)                                                 │
│  - Central login/register UI                                 │
│  - JWT token generation                                      │
│  - User database (PostgreSQL)                                │
│  - OAuth providers (Google)                                  │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
     ┌────▼────┐      ┌────▼────┐      ┌────▼────┐
     │   l2p   │      │VideoVault│      │ payment │
     │  :3002  │      │   :5100  │      │  :3004  │
     └─────────┘      └─────────┘      └─────────┘
```

## Quick Start

### 1. Copy Auth Client Library

Copy the auth client to your project:

```bash
# For l2p
cp auth/client/auth-client.ts l2p/frontend/src/lib/auth-client.ts

# For VideoVault
cp auth/client/auth-client.ts VideoVault/src/lib/auth-client.ts

# For payment
cp auth/client/auth-client.ts payment/src/lib/auth-client.ts
```

### 2. Install Dependencies

The auth client requires no additional dependencies - it uses native `fetch` API.

### 3. Configure Environment Variables

Add auth service URL to your `.env`:

```env
# .env
VITE_AUTH_SERVICE_URL=http://localhost:5500
```

For backend (Express):
```env
# .env
AUTH_SERVICE_URL=http://localhost:5500
```

## Frontend Integration

### Option 1: Redirect to Central Auth (Recommended)

This is the simplest approach - redirect users to the central login page:

```typescript
import { authClient } from '@/lib/auth-client';

// Redirect to login
authClient.redirectToLogin();

// Or with custom redirect URL
authClient.redirectToLogin('http://localhost:3002/dashboard');

// Redirect to register
authClient.redirectToRegister();
```

#### Handle Auth Callback

When users return from the central auth page, extract tokens from URL:

```typescript
// In your App.tsx or main component
import { useEffect } from 'react';
import { authClient } from '@/lib/auth-client';

function App() {
  useEffect(() => {
    // Check for auth tokens in URL (after redirect from auth service)
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');

    if (accessToken && refreshToken) {
      // Save tokens
      authClient.setTokens({ accessToken, refreshToken });

      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);

      // Redirect to dashboard or intended page
      window.location.href = '/dashboard';
    }
  }, []);

  return <YourApp />;
}
```

### Option 2: Embedded Login Form

If you want to keep users on your site, use the embedded login:

```typescript
import { authClient } from '@/lib/auth-client';

async function handleLogin(usernameOrEmail: string, password: string) {
  try {
    const { user, tokens } = await authClient.login({
      usernameOrEmail,
      password,
    });

    console.log('Logged in:', user);
    // Navigate to dashboard
  } catch (error) {
    console.error('Login failed:', error);
  }
}
```

### Get Current User

```typescript
import { authClient } from '@/lib/auth-client';

// Get current user
const user = await authClient.getCurrentUser();

if (user) {
  console.log('User:', user);
} else {
  // Not logged in, redirect to login
  authClient.redirectToLogin();
}
```

### Protect Routes

```typescript
import { useEffect, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { Navigate } from 'react-router-dom';

function ProtectedRoute({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      const currentUser = await authClient.getCurrentUser();
      setUser(currentUser);
      setLoading(false);
    }
    checkAuth();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return children;
}
```

### Logout

```typescript
import { authClient } from '@/lib/auth-client';

async function handleLogout() {
  await authClient.logout();
  window.location.href = '/';
}
```

## Backend Integration (Express)

### Add Auth Middleware

```typescript
import express from 'express';
import { authMiddleware } from './lib/auth-client';

const app = express();

// Add auth middleware to all routes
app.use(authMiddleware(process.env.AUTH_SERVICE_URL || 'http://localhost:5500', {
  required: false // Set to true to require auth on all routes
}));

// Or protect specific routes
app.get('/api/protected',
  authMiddleware(process.env.AUTH_SERVICE_URL || 'http://localhost:5500'),
  (req, res) => {
    // req.user is populated with user data
    res.json({ user: req.user });
  }
);
```

### Access User in Routes

```typescript
app.get('/api/user/profile', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = req.user.userId;
  // Fetch user-specific data
  res.json({ userId, data: '...' });
});
```

## Project-Specific Integration

### L2P Integration

L2P users have additional fields (character progression):

```typescript
const user = await authClient.getCurrentUser();

// L2P-specific fields
console.log(user.selectedCharacter); // 'student', 'teacher', etc.
console.log(user.characterLevel);     // 1, 2, 3, etc.
```

Update character progression:

```typescript
await authClient.updateProfile({
  selectedCharacter: 'teacher',
  characterLevel: 5,
});
```

### VideoVault Integration

VideoVault can use the basic auth flow:

1. Check if user is authenticated
2. If not, redirect to central login
3. On return, verify token and proceed

```typescript
// In VideoVault App.tsx
import { useEffect, useState } from 'react';
import { authClient } from './lib/auth-client';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    async function init() {
      // Handle auth callback
      const params = new URLSearchParams(window.location.search);
      const accessToken = params.get('accessToken');
      const refreshToken = params.get('refreshToken');

      if (accessToken && refreshToken) {
        authClient.setTokens({ accessToken, refreshToken });
        window.history.replaceState({}, '', window.location.pathname);
      }

      // Get current user
      const currentUser = await authClient.getCurrentUser();

      if (!currentUser) {
        authClient.redirectToLogin();
        return;
      }

      setUser(currentUser);
    }

    init();
  }, []);

  if (!user) {
    return <div>Loading...</div>;
  }

  return <VideoVaultApp user={user} />;
}
```

### Payment Integration

Payment uses NextAuth, so integration is slightly different:

#### Option 1: Replace NextAuth with Unified Auth

1. Remove NextAuth configuration
2. Use auth client for session management
3. Update API routes to use auth middleware

#### Option 2: Hybrid Approach (Keep NextAuth for now)

Keep NextAuth but sync users with unified auth service:

```typescript
// In pages/api/auth/[...nextauth].ts
import { authClient } from '@/lib/auth-client';

callbacks: {
  async signIn({ user }) {
    // Sync user with unified auth service
    // This ensures user exists in central database
    return true;
  },
  async session({ session, token }) {
    // Optionally fetch additional data from unified auth
    return session;
  },
}
```

## User Migration

Before integrating, migrate existing users:

```bash
cd auth

# Dry run to see what would be migrated
tsx scripts/migrate-users.ts --dry-run

# Migrate all users
tsx scripts/migrate-users.ts

# Migrate specific project
tsx scripts/migrate-users.ts --project=l2p
tsx scripts/migrate-users.ts --project=videovault
tsx scripts/migrate-users.ts --project=payment
```

Migration strategy:
1. **L2P users**: Migrated as primary users (most complete data)
2. **VideoVault users**: Merged by email with existing users
3. **Payment users**: Merged by email with existing users

## API Endpoints

### Auth Endpoints

```
POST   /api/auth/register          - Register new user
POST   /api/auth/login             - Login with credentials
POST   /api/auth/logout            - Logout (blacklist token)
POST   /api/auth/refresh           - Refresh access token
GET    /api/auth/verify            - Verify token validity
POST   /api/auth/verify-email      - Verify email with token
POST   /api/auth/forgot-password   - Request password reset
POST   /api/auth/reset-password    - Reset password with token
POST   /api/auth/change-password   - Change password (authenticated)
```

### OAuth Endpoints

```
GET    /api/oauth/google           - Initiate Google OAuth
GET    /api/oauth/google/callback  - Google OAuth callback
GET    /api/oauth/providers        - Get linked OAuth providers
DELETE /api/oauth/providers/:provider - Unlink OAuth provider
```

### User Endpoints

```
GET    /api/user/me                - Get current user profile
PATCH  /api/user/profile           - Update user profile
```

## Testing

### Test Auth Flow

1. Start auth service: `cd auth && npm run dev`
2. Start your project: `cd l2p && npm run dev:frontend`
3. Navigate to your project URL
4. Click "Login" - should redirect to `http://localhost:5500/login`
5. Login with test credentials
6. Should redirect back with tokens

### Test Token Verification

```typescript
const valid = await authClient.verifyToken();
console.log('Token valid:', valid);
```

### Test Token Refresh

```typescript
const refreshed = await authClient.refreshAccessToken();
console.log('Token refreshed:', refreshed);
```

## Troubleshooting

### CORS Issues

Make sure your project URL is in the auth service's allowed origins:

```env
# In auth/.env
ALLOWED_ORIGINS=http://localhost:3002,http://localhost:5100,http://localhost:3004
```

### Token Not Saving

Check localStorage in browser DevTools:
- `accessToken` should be present
- `refreshToken` should be present

### Redirect Loop

Make sure you're not calling `redirectToLogin()` on every page load. Only redirect if user is null AND route requires auth.

### 401 Unauthorized

1. Check token is being sent in Authorization header
2. Verify token hasn't expired (15 min for access token)
3. Try refreshing the token

## Environment Variables Reference

### Auth Service

```env
# Server
PORT=5500
NODE_ENV=development

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/unified_auth_db

# JWT
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5500/api/oauth/google/callback

# Allowed Origins
ALLOWED_ORIGINS=http://localhost:3002,http://localhost:5100,http://localhost:3004

# CORS
CORS_ORIGIN=*
CORS_CREDENTIALS=true
```

### Project Integration

```env
# Frontend (Vite)
VITE_AUTH_SERVICE_URL=http://localhost:5500

# Backend (Express)
AUTH_SERVICE_URL=http://localhost:5500
```

## Security Best Practices

1. **Use HTTPS in production**: Set `secure: true` for cookies
2. **Keep secrets secret**: Never commit JWT secrets to git
3. **Rotate secrets regularly**: Change JWT secrets periodically
4. **Use httpOnly cookies**: Prevents XSS attacks
5. **Implement CSRF protection**: Use CSRF tokens for state-changing operations
6. **Rate limit auth endpoints**: Prevent brute force attacks
7. **Validate tokens server-side**: Always verify tokens on the backend

## Next Steps

1. ✅ Copy auth client to your project
2. ✅ Configure environment variables
3. ✅ Migrate existing users
4. ✅ Update login/register flows
5. ✅ Add auth middleware to protected routes
6. ✅ Test authentication flow
7. ✅ Deploy auth service
8. ✅ Update DNS/reverse proxy for production

## Support

For issues or questions:
- Check the auth service logs: `docker-compose logs -f`
- Review migration logs: Check `user_migration_log` table
- Test endpoints with curl or Postman
- Check browser console for frontend errors
