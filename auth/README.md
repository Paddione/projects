# Auth Service

Unified authentication service for the monorepo. Provides JWT-based auth, session handling, Google OAuth, password reset, and email verification.

## Quick Start

```bash
npm install
cp .env.example .env-dev
cp .env.example .env-prod

# Local development only (Docker Compose)
docker-compose --env-file .env-dev up -d
```

## Environment Configuration

File structure:
- `.env.example` (template)
- `.env-dev` (development, gitignored)
- `.env-prod` (production, gitignored)

Required variables:
- `DATABASE_URL` - points to `shared-postgres:5432/auth_db`
- `AUTH_DB_USER`, `AUTH_DB_PASSWORD` - match `shared-infrastructure/.env`
- `JWT_SECRET`, `JWT_REFRESH_SECRET` - 32-char hex, unique per env
- `SESSION_SECRET` - 32-char hex, unique per env
- SMTP settings (dev placeholders OK, prod real creds)
- Google OAuth client ID and secret

OAuth redirect URIs:
- Dev: `http://localhost:5500/api/oauth/google/callback`
- Prod: `https://auth.korczewski.de/api/oauth/google/callback`

## Local Development (Docker Compose)

Docker Compose is used **only for local development**, not production.

```bash
docker-compose up -d       # Start local dev
docker-compose down        # Stop local dev
```

## Production Deployment (k3s)

Production runs on **k3s** (lightweight Kubernetes). Do not use Docker Compose for production.

```bash
# Deploy auth service to the k3s cluster
../../k8s/scripts/deploy/deploy-auth.sh

# Or deploy the full stack
../../k8s/scripts/deploy/deploy-all.sh

# Verify
kubectl get pods -l app=auth -n korczewski-services
```

K8s manifests: `k8s/services/auth/`. Full deployment guide: `k8s/README.md`.

Production URL: https://auth.korczewski.de

Production uses the centralized Postgres instance from `shared-infrastructure`. Use different secrets for dev and prod.

## Keyboard Shortcuts

### Universal

| Shortcut | Action |
|----------|--------|
| `Tab` | Move focus to next element |
| `Shift+Tab` | Move focus to previous element |
| `Enter` | Submit form or activate button/link |
| `Space` | Activate button (not form submit) |
| `Esc` | Cancel action, close modal, clear focus |

### Form Tab Order by View

| View | Tab Order |
|------|-----------|
| Login | Username, Password, Forgot Password, Submit, Google OAuth, Sign Up |
| Register | Name, Username, Email, Password, Submit, Google OAuth, Sign In |
| Forgot Password | Email, Submit, Back to Sign In |
| Reset Password | Token, New Password, Confirm Password, Submit, Back to Sign In |

### Fast Login Flow

1. Focus username (auto-focused on page load)
2. Type username, press Enter (moves to password)
3. Type password, press Enter (submits form)

### Password Requirements

8+ characters with uppercase, lowercase, number, and special character (`@$!%*?&`). Visual strength bar shows weak (red), medium (yellow), or strong (green).

## Security Notes

Based on a security audit of the JWT implementation, password handling, and session management.

### Overall Posture: Good

Strengths:
- Strong password hashing (bcrypt with configurable rounds)
- Account lockout after 5 failed attempts (15-minute duration)
- JWT token blacklisting on logout
- HttpOnly cookies for token storage
- Zod schema validation on all endpoints
- Short-lived access tokens (15 min) with longer refresh tokens (7 days)
- Password reset tokens with 256-bit entropy and 1-hour expiry

### Key Findings

**High severity:**
- Development reset token exposure in API response (`NODE_ENV=development` guard) -- remove before production
- Timing attack vulnerability in login flow (user-not-found returns faster than bcrypt comparison)

**Medium severity:**
- No rate limiting on auth endpoints (login, register, forgot-password, refresh)
- JWT secret validation does not enforce minimum length in production
- Cookie `sameSite` set to `lax` instead of `strict`; no `path` restriction

**Low severity:**
- Token blacklist cleanup method exists but is never called automatically
- Error message reveals OAuth account type ("This account uses OAuth")

### Priority Actions

1. Remove reset token from API response (or gate behind admin debug endpoint)
2. Add constant-time login by always running bcrypt comparison
3. Add rate limiting middleware (express-rate-limit) to all auth routes
4. Strengthen JWT secret validation with minimum length check in production
5. Update cookie settings: `sameSite: 'strict'`, `path: '/api'`
6. Schedule automated token blacklist cleanup
7. Add security headers via helmet middleware
8. Implement security event audit logging

### Compliance

OWASP Top 10 coverage is solid for access control, cryptography, injection prevention, and auth failures. Gaps remain in rate limiting (A04), CSP headers (A08), and audit logging (A09).
