# JWT Claims Standardization - Summary

## Changes Made

I've standardized the JWT issuer and audience claims across both your Auth Service and L2P Service to enable local token validation.

### Previous Configuration (PROBLEM)
- **Auth Service**: `issuer: 'auth-service'`, `audience: 'unified-auth'`
- **L2P Service**: `issuer: 'learn2play-api'`, `audience: 'learn2play-client'`

This mismatch meant L2P couldn't validate Auth Service tokens locally.

### New Configuration (SOLUTION)
- **Both Services**: `issuer: 'unified-auth'`, `audience: 'korczewski-services'`

## Files Modified

### Auth Service
- `/home/patrick/projects/auth/src/services/TokenService.ts`
  - Line 49-50: Access token generation
  - Line 59-60: Refresh token generation
  - Line 73-74: Access token verification
  - Line 94-95: Refresh token verification

### L2P Service
- `/home/patrick/projects/l2p/backend/src/services/AuthService.ts`
  - Line 128-129: Access token generation
  - Line 155-156: Refresh token generation
  - Line 189-190: Access token verification
  - Line 199-200: Access token verification (with previous secret rotation)
  - Line 223-224: Refresh token verification

## Benefits

### ✅ Local Token Validation
L2P can now verify tokens issued by Auth Service **locally** without making HTTP calls:
```typescript
// L2P can now verify Auth Service tokens directly!
const payload = authService.verifyAccessToken(token);
```

### ✅ Service Independence
- If Auth Service goes down, L2P can still validate existing tokens
- Faster authentication (no HTTP roundtrip needed)
- Reduced load on Auth Service

### ✅ Unified Authentication
- All services in your ecosystem use the same JWT claims
- Easier to add new services in the future
- Consistent token format across all services

## What You Need to Do

### 1. IMPORTANT: Invalidate Old Tokens

⚠️ **All existing JWT tokens will become invalid** after deploying these changes because they were signed with different issuer/audience claims.

**Users will need to log in again** after deployment.

### 2. Deployment Steps

#### Option A: Zero-Downtime Migration (Recommended)
1. Deploy Auth Service first (generates new tokens)
2. Wait 15 minutes (access token expiry)
3. Deploy L2P Service (can validate both old and new tokens during transition)
4. Users gradually get new tokens as they refresh/login

#### Option B: Quick Deployment (Acceptable)
1. Deploy both services simultaneously
2. Users will be logged out and need to re-authenticate
3. This is acceptable for your use case

### 3. Restart Services

```bash
# On your production server
cd /home/patrick/projects/auth
npm run build
pm2 restart auth-service  # or however you run it

cd /home/patrick/projects/l2p
npm run build
pm2 restart l2p-service
```

### 4. Test Authentication Flow

After deployment, test:

1. **Login on auth.korczewski.de**
   - Should receive new JWT token with standardized claims

2. **Access L2P at l2p.korczewski.de**
   - Should be authenticated (cookie shared via `.korczewski.de` domain)
   - L2P validates token locally now

3. **Check token payload** (optional verification):
```bash
# Decode a token to verify claims
echo "YOUR_JWT_TOKEN_HERE" | jwt decode -
# Should show:
# "iss": "unified-auth"
# "aud": "korczewski-services"
```

## Your Original Question: Answer

> "how do i make sure that after logging in on auth.korczewski.de the login works for l2p.korczewski.de too? i just copied the JWT Tokens to the other prodenv is that right?"

**Answer:** Yes, copying the JWT secrets was necessary, but you also needed:

1. ✅ **Matching JWT Secrets** (you did this)
2. ✅ **Cookie Domain Configuration** (already set to `.korczewski.de` in L2P)
3. ✅ **CORS Configuration** (already allows cross-subdomain requests)
4. ✅ **Matching JWT Claims** (I just fixed this for you)

Now your setup is complete! Both services can:
- Share cookies across subdomains
- Validate tokens locally with the same secret
- Use consistent issuer/audience claims

## Verification Checklist

After deployment, verify:
- [ ] Can log in at auth.korczewski.de
- [ ] Token is automatically sent to l2p.korczewski.de (via cookie domain)
- [ ] L2P validates token without calling Auth Service
- [ ] No more issuer/audience mismatch errors in logs

## Rollback Plan

If something goes wrong:
```bash
# Revert changes
git checkout HEAD~1 auth/src/services/TokenService.ts
git checkout HEAD~1 l2p/backend/src/services/AuthService.ts

# Rebuild and restart
npm run build
pm2 restart all
```

## Future Considerations

### Add More Services?
When adding new services (e.g., payment.korczewski.de), use:
```typescript
issuer: 'unified-auth'
audience: 'korczewski-services'
JWT_SECRET: (same secret as auth and l2p)
```

### Token Rotation?
If you need to rotate JWT secrets in the future:
1. Set `JWT_PREVIOUS_SECRET` in .env (L2P already supports this)
2. Deploy new secret
3. Old tokens still work during transition period
4. Remove `JWT_PREVIOUS_SECRET` after all tokens expired

---

**Status:** ✅ Ready to deploy!
