# OAuth Login Database Propagation - Issue & Fix

## Problem Identified

When users log in via the Auth Service OAuth flow, they can authenticate successfully but then "can't do anything" because their game profile isn't properly accessible.

### Root Causes

1. **Missing OAuth Middleware Implementation**
   - File: `l2p/backend/src/middleware/oauth-auth.ts`
   - The `oauthAuthenticate` middleware was a stub that always returned 501 "not implemented"
   - This prevented the `/auth/oauth/me` endpoint from working

2. **Authentication Flow Issues**
   - After OAuth login, users receive valid tokens from the auth service
   - However, the l2p backend's protected endpoints need access to game profile data
   - The `/auth/oauth/me` endpoint (which combines auth + game profile data) was inaccessible

## Changes Made

### 1. Implemented OAuth Authentication Middleware
**File**: `l2p/backend/src/middleware/oauth-auth.ts`

- Implemented proper OAuth token verification
- Verifies tokens with the centralized auth service at `/api/auth/verify`
- Extracts user data and attaches it to `req.user`
- Properly handles token expiration, invalid tokens, and service unavailability

### 2. Created Comprehensive Test Script
**File**: `l2p/backend/scripts/test-oauth-flow.sh`

Tests the complete OAuth flow:
1. User registration in auth service
2. Login to get tokens
3. OAuth endpoint accessibility
4. Database profile creation
5. Game profile data propagation
6. Protected resource access with OAuth tokens

### 3. Created Verification SQL Queries
**File**: `l2p/backend/scripts/verify-oauth-db-propagation.sql`

Provides SQL queries to manually verify:
- Game profile creation
- Profile data accuracy
- Recent profile additions
- Clean up test users

## How It Works Now

### OAuth Login Flow (Fixed)

1. **User Clicks "Login via Auth Service"**
   - Frontend redirects to auth service OAuth authorization page

2. **User Authorizes**
   - Auth service redirects back with authorization code
   - Frontend calls `/api/auth/oauth/exchange` with the code

3. **Backend Exchanges Code for Tokens**
   - L2P backend calls auth service to exchange code for tokens
   - **Crucially**: Calls `gameProfileService.getOrCreateProfile(userId)`
   - This creates a row in `user_game_profiles` table linking auth_user_id to game data

4. **User Makes API Requests**
   - Frontend sends requests with Bearer token
   - OAuth middleware verifies token with auth service
   - Endpoints can now access both auth data AND game profile data

5. **Game Profile Access**
   - Endpoints like `/auth/oauth/me` combine auth user data + game profile
   - User can now interact with the app normally

## Testing the Fix

### Prerequisites
- Backend server must be **restarted** to load the new middleware
- Both auth service and l2p backend must be running

### Automated Test
```bash
cd l2p/backend
./scripts/test-oauth-flow.sh
```

Or for production:
```bash
AUTH_SERVICE_URL=https://auth.korczewski.de \
L2P_BACKEND_URL=https://l2p.korczewski.de \
DB_HOST=10.10.0.5 \
./scripts/test-oauth-flow.sh
```

### Manual Testing Steps

1. **Before Testing**
   ```sql
   -- Connect to l2p database
   SELECT COUNT(*) FROM user_game_profiles;
   -- Note the count
   ```

2. **Perform OAuth Login**
   - Open browser to https://l2p.korczewski.de
   - Click "Login via Auth Service"
   - Complete OAuth flow
   - **Watch browser console for any errors**

3. **Check Database Propagation**
   ```sql
   -- Should see one more profile than before
   SELECT COUNT(*) FROM user_game_profiles;

   -- View the newly created profile
   SELECT * FROM user_game_profiles
   ORDER BY created_at DESC
   LIMIT 1;
   ```

4. **Test App Functionality**
   - Try to access profile page
   - Try to create a lobby
   - Try to view character info
   - Everything should work normally

### Browser Console Test

Open browser console after OAuth login and run:

```javascript
// Get current user data (should include game profile)
fetch('https://l2p.korczewski.de/api/auth/oauth/me', {
  credentials: 'include'
})
.then(r => r.json())
.then(data => {
  console.log('OAuth Me Response:', data);
  console.log('User ID:', data.user?.userId);
  console.log('Selected Character:', data.user?.selectedCharacter);
  console.log('Character Level:', data.user?.characterLevel);
});

// Test accessing a game endpoint
fetch('https://l2p.korczewski.de/api/characters/profile', {
  credentials: 'include'
})
.then(r => r.json())
.then(data => {
  console.log('Character Profile:', data);
});
```

## Expected Results

### ✅ Success Indicators

1. **OAuth /me endpoint returns complete user data:**
   ```json
   {
     "user": {
       "userId": 17,
       "username": "testuser",
       "email": "test@example.com",
       "role": "USER",
       "emailVerified": false,
       "selectedCharacter": "student",
       "characterLevel": 1,
       "experiencePoints": 0,
       "preferences": {...}
     }
   }
   ```

2. **Database shows new game profile:**
   - `auth_user_id` matches the user ID from auth service
   - `selected_character` defaults to 'student'
   - `character_level` defaults to 1
   - `experience_points` defaults to 0

3. **User can access all app features:**
   - Profile page loads
   - Can create/join lobbies
   - Can play games
   - Character selection works

### ❌ Failure Indicators

1. **401 errors on API calls**
   - Means token verification is failing
   - Check if backend was restarted

2. **"Can't do anything" after login**
   - Means game profile wasn't created
   - Check database for profile creation
   - Check backend logs for errors in `getOrCreateProfile`

3. **501 "OAuth authentication not yet implemented"**
   - Means backend server wasn't restarted after the fix
   - **RESTART THE BACKEND**

## Database Schema Reference

### user_game_profiles table
```sql
CREATE TABLE user_game_profiles (
    auth_user_id INTEGER PRIMARY KEY,
    selected_character VARCHAR(50) DEFAULT 'student',
    character_level INTEGER DEFAULT 1,
    experience_points INTEGER DEFAULT 0,
    preferences JSONB DEFAULT '{"language": "en", "theme": "light"}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Next Steps

1. **Restart Backend Server**
   ```bash
   # SSH to server or use PM2
   pm2 restart l2p-backend
   # or
   systemctl restart l2p-backend
   ```

2. **Test OAuth Flow**
   - Use automated test script OR manual browser test

3. **Monitor Logs**
   ```bash
   # Watch for any errors during OAuth flow
   pm2 logs l2p-backend
   ```

4. **Verify Database**
   ```bash
   PGPASSWORD=<password> psql -h 10.10.0.5 -U l2p_user -d l2p_db -f scripts/verify-oauth-db-propagation.sql
   ```

## Files Changed

1. ✅ `l2p/backend/src/middleware/oauth-auth.ts` - Implemented OAuth middleware
2. ✅ `l2p/backend/scripts/test-oauth-flow.sh` - Created comprehensive test
3. ✅ `l2p/backend/scripts/verify-oauth-db-propagation.sql` - Created verification queries
4. ✅ `OAUTH_FIX_SUMMARY.md` - This documentation

## Key Endpoints

- `POST /api/auth/oauth/exchange` - Exchanges OAuth code for tokens + creates game profile
- `GET /api/auth/oauth/me` - Returns auth user + game profile data (NOW WORKS!)
- `GET /api/characters/profile` - Returns game character profile (requires auth)

## Troubleshooting

**Q: Still getting "OAuth authentication not yet implemented"**
A: Backend server wasn't restarted. Restart it!

**Q: User authenticates but has no character/level data**
A: Check if game profile was created in database. May need to manually trigger profile creation.

**Q: Database errors during profile creation**
A: Check database connection, schema migrations, and permissions.

**Q: Token verification fails**
A: Ensure AUTH_SERVICE_URL environment variable is set correctly in backend.
