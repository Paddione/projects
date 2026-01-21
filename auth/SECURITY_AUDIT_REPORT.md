# Security Audit Report - Auth Service
**Date**: 2026-01-10
**Auditor**: Claude Code (security-guidance plugin)
**Scope**: Auth service JWT implementation, password handling, session management

---

## Executive Summary

Overall security posture: **GOOD** with some areas for improvement.

The auth service demonstrates solid security fundamentals:
- ✅ Strong password hashing (bcrypt with configurable rounds)
- ✅ Account lockout after failed attempts
- ✅ JWT token blacklisting on logout
- ✅ HttpOnly cookies for token storage
- ✅ Password strength validation
- ⚠️ Some areas need hardening (see findings below)

---

## Critical Findings

### 🔴 HIGH SEVERITY

#### 1. Development Reset Token Exposure (auth/src/routes/auth.ts:264)
**Location**: `POST /api/auth/forgot-password` endpoint

**Issue**:
```typescript
res.status(200).json({
  message: 'If the email exists, a password reset link has been sent',
  // TODO: Remove token from response in production (only for development)
  ...(process.env.NODE_ENV === 'development' && { resetToken }),
});
```

**Risk**: Reset tokens are exposed in API responses during development. If this code is deployed with `NODE_ENV=development`, attackers can obtain password reset tokens directly from the API response.

**Recommendation**:
- Remove this entirely or use a separate debug endpoint
- Add runtime check to ensure this never runs in production
- Consider using feature flags instead of NODE_ENV

**Fix**:
```typescript
res.status(200).json({
  message: 'If the email exists, a password reset link has been sent'
});
// Use separate debug endpoint if needed: GET /debug/last-reset-token (with admin auth)
```

---

#### 2. Timing Attack Vulnerability in Login (auth/src/services/AuthService.ts:218-256)
**Location**: `login()` method

**Issue**: The login flow reveals whether a user exists through response timing differences:
1. User not found → immediate error (line 231-233)
2. Account locked → check lock timing (line 236-239)
3. Valid user → bcrypt comparison (line 251) takes ~100-200ms

**Risk**: Attackers can enumerate valid usernames/emails by measuring response times.

**Recommendation**: Always perform bcrypt comparison, even for non-existent users:

```typescript
async login(credentials: LoginCredentials): Promise<AuthResult> {
  // Always hash the password to maintain constant timing
  const dummyHash = '$2b$12$dummyhashfortimingequalityxxxxxxxxxxxxxxxxxxxxxxx';

  const [user] = await db.select()...

  // Always compare, even if user doesn't exist
  const passwordHash = user?.password_hash || dummyHash;
  const isValidPassword = await this.verifyPassword(credentials.password, passwordHash);

  // THEN check if user exists
  if (!user) {
    throw new Error('Invalid credentials');
  }

  // Rest of login logic...
}
```

---

### 🟡 MEDIUM SEVERITY

#### 3. Insufficient JWT Secret Validation (auth/src/services/TokenService.ts:16-28)
**Location**: `TokenService` constructor

**Issue**:
```typescript
this.JWT_SECRET = process.env.JWT_SECRET || (isTest ? 'test-jwt-secret' : '');
```

**Risk**:
- In test environments, uses weak predictable secrets
- Production check only validates non-empty, not secret strength
- No minimum length requirement

**Recommendation**:
```typescript
constructor() {
  const isTest = process.env.NODE_ENV === 'test';

  this.JWT_SECRET = process.env.JWT_SECRET || (isTest ? 'test-jwt-secret' : '');
  this.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || (isTest ? 'test-refresh-secret' : '');

  // Validate secrets exist
  if (!this.JWT_SECRET || !this.JWT_REFRESH_SECRET) {
    throw new Error('JWT secrets must be configured');
  }

  // Validate secret strength in production
  if (process.env.NODE_ENV === 'production') {
    if (this.JWT_SECRET.length < 32 || this.JWT_REFRESH_SECRET.length < 32) {
      throw new Error('Production JWT secrets must be at least 32 characters');
    }

    if (this.JWT_SECRET === 'test-jwt-secret' || this.JWT_REFRESH_SECRET === 'test-refresh-secret') {
      throw new Error('Production JWT secrets must not use test values');
    }
  }

  // Add entropy check for production
  if (process.env.NODE_ENV === 'production' && !this.hasMinimumEntropy(this.JWT_SECRET)) {
    throw new Error('JWT_SECRET has insufficient entropy');
  }
}

private hasMinimumEntropy(secret: string): boolean {
  // Check for sufficient character diversity
  const uniqueChars = new Set(secret).size;
  return uniqueChars >= 16; // At least 16 unique characters in a 32+ char string
}
```

---

#### 4. No Rate Limiting on Auth Endpoints (auth/src/routes/auth.ts)
**Location**: All auth routes

**Issue**: No rate limiting middleware applied to:
- `/api/auth/login` - brute force target
- `/api/auth/register` - account creation spam
- `/api/auth/forgot-password` - email bombing
- `/api/auth/refresh` - token exhaustion

**Risk**:
- Brute force attacks on login
- Account enumeration
- Email spam via password reset
- DoS via excessive token generation

**Recommendation**:
```typescript
import rateLimit from 'express-rate-limit';

// Strict rate limit for login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Moderate rate limit for other auth operations
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many requests, please try again later',
});

router.post('/login', loginLimiter, async (req, res) => { ... });
router.post('/register', authLimiter, async (req, res) => { ... });
router.post('/forgot-password', authLimiter, async (req, res) => { ... });
router.post('/refresh', authLimiter, async (req, res) => { ... });
```

---

#### 5. Cookie Security Configuration (auth/src/routes/auth.ts:58-72)
**Location**: Cookie setting in register/login endpoints

**Issue**:
```typescript
res.cookie('accessToken', result.tokens.accessToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 15 * 60 * 1000,
  domain: process.env.COOKIE_DOMAIN || undefined,
});
```

**Risks**:
- `sameSite: 'lax'` allows GET requests from other sites to send cookies
- `secure` only enabled in production (development cookies sent over HTTP)
- No `path` restriction

**Recommendation**:
```typescript
res.cookie('accessToken', result.tokens.accessToken, {
  httpOnly: true,
  secure: true, // Always use secure, rely on ingress TLS in dev
  sameSite: 'strict', // Prevent CSRF more strictly
  maxAge: 15 * 60 * 1000,
  domain: process.env.COOKIE_DOMAIN || undefined,
  path: '/api', // Restrict to API routes only
});
```

**Note**: In development, use HTTPS locally or configure k3d ingress TLS.

---

#### 6. SQL Injection Risk via Raw SQL (auth/src/services/AuthService.ts:149,160,225)
**Location**: Case-insensitive queries using `sql` template

**Issue**:
```typescript
.where(sql`LOWER(${users.email}) = LOWER(${data.email})`)
```

**Assessment**:
- ✅ Using Drizzle's `sql` template tag (parameterized)
- ✅ Properly escaping user input
- ⚠️ But mixing ORM methods with raw SQL is risky for maintainability

**Recommendation**: Use Drizzle's built-in case-insensitive operators:
```typescript
import { ilike } from 'drizzle-orm';

// Instead of:
.where(sql`LOWER(${users.email}) = LOWER(${data.email})`)

// Use:
.where(ilike(users.email, data.email))
```

---

### 🟢 LOW SEVERITY

#### 7. Password Reset Token Length (auth/src/services/AuthService.ts:348)
**Location**: Token generation in `requestPasswordReset()`

**Issue**:
```typescript
const resetToken = crypto.randomBytes(32).toString('hex');
```

**Assessment**: 32 bytes = 64 hex characters = 256 bits of entropy. This is excellent.

**Recommendation**: Document why 32 bytes chosen, add constant:
```typescript
private readonly RESET_TOKEN_BYTES = 32; // 256 bits of entropy

const resetToken = crypto.randomBytes(this.RESET_TOKEN_BYTES).toString('hex');
```

---

#### 8. Error Message Information Disclosure (auth/src/services/AuthService.ts:248)
**Location**: Login error messages

**Issue**:
```typescript
if (!user.password_hash) {
  throw new Error('This account uses OAuth. Please sign in with Google.');
}
```

**Risk**: Reveals account authentication method to attackers.

**Recommendation**: Generic error message:
```typescript
if (!user.password_hash) {
  throw new Error('Invalid credentials');
}
```

Users who legitimately use OAuth will recognize they need OAuth. Attackers gain no intel.

---

#### 9. Token Blacklist Cleanup (auth/src/services/TokenService.ts:149-153)
**Location**: `cleanupExpiredTokens()` method

**Issue**: Method exists but is never called automatically.

**Risk**: Blacklist table grows indefinitely, potential performance degradation.

**Recommendation**: Add scheduled cleanup:
```typescript
// In server.ts or similar
import cron from 'node-cron';

// Run cleanup daily at 3 AM
cron.schedule('0 3 * * *', async () => {
  try {
    await tokenService.cleanupExpiredTokens();
    console.log('Token blacklist cleanup completed');
  } catch (error) {
    console.error('Token blacklist cleanup failed:', error);
  }
});
```

---

## Security Best Practices Implemented ✅

### Password Security
- ✅ Bcrypt with configurable salt rounds (default: 12)
- ✅ Strong password validation (length, uppercase, lowercase, numbers, special chars)
- ✅ Password reset with expiry (1 hour)
- ✅ Email verification with expiry (24 hours)

### Account Protection
- ✅ Account lockout after 5 failed attempts (configurable)
- ✅ 15-minute lockout duration (configurable)
- ✅ Failed attempt tracking
- ✅ Last login timestamps

### Token Security
- ✅ JWT with proper issuer/audience claims
- ✅ Short-lived access tokens (15 minutes)
- ✅ Longer-lived refresh tokens (7 days)
- ✅ Token blacklisting on logout
- ✅ HttpOnly cookies

### Input Validation
- ✅ Zod schema validation on all endpoints
- ✅ Email format validation
- ✅ Username regex validation (`^[a-zA-Z0-9_]+$`)
- ✅ Case-insensitive email/username checks

### Data Protection
- ✅ Password hash excluded from API responses
- ✅ Proper error handling with generic messages
- ✅ Email verification before full account access

---

## Environment Variable Security Audit

### Required Secrets (.env files)
```bash
# JWT Secrets (MUST be 32+ hex characters)
JWT_SECRET=              # ⚠️ AUDIT: Verify production strength
JWT_REFRESH_SECRET=      # ⚠️ AUDIT: Verify production strength

# Session Secret
SESSION_SECRET=          # ⚠️ AUDIT: Verify production strength

# Database (MUST be alphanumeric only)
DATABASE_URL=postgresql://auth_user:<password>@shared-postgres:5432/auth_db

# SMTP (for email verification/password reset)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=              # ⚠️ AUDIT: Ensure not hardcoded

# Google OAuth (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=   # ⚠️ AUDIT: Ensure not committed

# Application
FRONTEND_URL=
COOKIE_DOMAIN=          # Production: .korczewski.de
COOKIE_SECURE=          # Production: true
```

### Recommendations:
1. **Secret Generation**: All secrets should be generated with:
   ```bash
   openssl rand -hex 32
   ```

2. **Secret Rotation**: Implement key rotation strategy:
   - JWT secrets: Rotate every 90 days
   - Session secrets: Rotate on suspected compromise
   - OAuth secrets: Rotate according to provider recommendations

3. **Secret Storage**:
   - ❌ Never commit .env-dev or .env-prod
   - ✅ Use .env.example as template
   - ✅ Use docker secrets or vault in production
   - ✅ Restrict file permissions: `chmod 600 .env-prod`

---

## Additional Recommendations

### 1. Implement Security Headers
Add helmet middleware in server.ts:
```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));
```

### 2. Add Request Logging
Implement audit logging for security events:
```typescript
// Log security-relevant events
logger.security({
  event: 'LOGIN_FAILED',
  userId: user?.id,
  ip: req.ip,
  userAgent: req.headers['user-agent'],
  timestamp: new Date(),
});
```

### 3. Implement 2FA (Future Enhancement)
Consider adding TOTP-based 2FA:
- Use libraries like `otplib` or `speakeasy`
- Store 2FA secret encrypted in database
- Add backup codes for account recovery

### 4. Add CAPTCHA to Prevent Automation
Integrate reCAPTCHA or hCaptcha on:
- Login (after 2 failed attempts)
- Registration
- Password reset

### 5. Session Management Enhancement
Add session tracking table:
```sql
CREATE TABLE user_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  refresh_token_hash VARCHAR(255),
  ip_address INET,
  user_agent TEXT,
  last_activity TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

This allows:
- Viewing active sessions
- Revoking specific sessions
- Detecting suspicious activity

---

## Compliance Considerations

### GDPR
- ✅ User can be deleted (implement hard delete)
- ⚠️ Add data export functionality
- ⚠️ Add consent tracking for email communications

### OWASP Top 10 (2021)
- ✅ A01: Broken Access Control - Proper JWT validation
- ✅ A02: Cryptographic Failures - Strong bcrypt, secure tokens
- ✅ A03: Injection - Parameterized queries via Drizzle
- ⚠️ A04: Insecure Design - Add rate limiting
- ✅ A05: Security Misconfiguration - Good cookie settings
- ⚠️ A06: Vulnerable Components - Regular dependency audits needed
- ✅ A07: Identification/Auth Failures - Strong password policy, lockout
- ⚠️ A08: Software/Data Integrity - Add CSP headers
- ⚠️ A09: Security Logging Failures - Add audit logging
- ⚠️ A10: SSRF - N/A for this service

---

## Action Items (Priority Order)

### Immediate (Fix before production deployment)
1. [ ] Remove reset token from API response (Finding #1)
2. [ ] Fix timing attack in login flow (Finding #2)
3. [ ] Add rate limiting to all auth endpoints (Finding #4)
4. [ ] Strengthen JWT secret validation (Finding #3)
5. [ ] Update cookie settings to sameSite: 'strict' (Finding #5)

### Short-term (Within 1 week)
6. [ ] Add automated token blacklist cleanup (Finding #9)
7. [ ] Implement security headers (helmet)
8. [ ] Add security event logging
9. [ ] Set up dependency vulnerability scanning (npm audit, Snyk)
10. [ ] Document secret rotation procedures

### Medium-term (Within 1 month)
11. [ ] Add CAPTCHA to prevent automation
12. [ ] Implement session management table
13. [ ] Add user session viewing/revocation
14. [ ] Replace raw SQL with Drizzle operators (Finding #6)
15. [ ] Create security testing suite

### Long-term (Future enhancements)
16. [ ] Implement 2FA (TOTP)
17. [ ] Add device fingerprinting
18. [ ] Implement anomaly detection
19. [ ] Add GDPR data export
20. [ ] Security penetration testing

---

## Testing Recommendations

### Security Test Suite
Create `auth/src/__tests__/security/` with:

1. **auth-security.test.ts**:
   - Test account lockout after failed attempts
   - Test token blacklisting
   - Test password strength validation
   - Test timing attack resistance

2. **jwt-security.test.ts**:
   - Test token expiration
   - Test invalid token rejection
   - Test token tampering detection
   - Test blacklist enforcement

3. **rate-limit.test.ts**:
   - Test rate limiting on login
   - Test rate limiting on password reset
   - Test rate limit bypass attempts

### Manual Security Testing
- [ ] Attempt SQL injection on login/register
- [ ] Test CSRF protection
- [ ] Test XSS via username/name fields
- [ ] Verify secure headers in responses
- [ ] Test session fixation vulnerabilities
- [ ] Attempt privilege escalation (user → admin)

---

## Conclusion

The auth service demonstrates a **solid security foundation** with proper password hashing, account lockout, and JWT token management. The main areas requiring immediate attention are:

1. Timing attack vulnerability in login
2. Missing rate limiting
3. Development reset token exposure
4. Cookie security hardening

Implementing the immediate action items will bring the service to **production-ready security standards**. The short-term and medium-term improvements will provide defense-in-depth and align with industry best practices.

**Audit Status**: ⚠️ **Conditionally Approved** (fix immediate items before production)

---

🤖 Generated with [Claude Code](https://claude.com/claude-code) - security-guidance plugin
