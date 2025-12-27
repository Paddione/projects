# Quick Start Guide - Unified Auth Service

## Phase 1: Foundation ✅ COMPLETED

The authentication service foundation is now complete! Here's what's been built:

### What's Ready

✅ **Complete auth service architecture**
- Express.js server with TypeScript
- Drizzle ORM with PostgreSQL
- JWT token management
- Bcrypt password hashing
- Rate limiting and security headers

✅ **Database schema defined**
- Consolidated `auth.users` table (from all 3 projects)
- OAuth accounts table
- Sessions table
- Token blacklist
- Migration log

✅ **Core services implemented**
- AuthService: register, login, password reset, email verification
- TokenService: JWT generation, validation, blacklisting
- Security: account lockout, rate limiting, password strength validation

✅ **API endpoints ready**
- `/api/auth/register` - User registration
- `/api/auth/login` - Login with credentials
- `/api/auth/logout` - Token blacklisting
- `/api/auth/refresh` - Refresh access tokens
- `/api/auth/verify` - Validate tokens
- `/api/user/me` - Get user profile
- `/api/user/profile` - Update profile

## Next Steps: Get It Running

### Step 1: Create the Database

```bash
# Create the unified auth database
createdb unified_auth_db

# Or using psql
psql -U postgres -c "CREATE DATABASE unified_auth_db;"
```

### Step 2: Configure Environment

```bash
cd /home/patrick/projects/auth

# Create .env from example
cp .env.example .env

# Edit .env with your settings
nano .env
```

**Minimum required configuration:**
```env
PORT=5500
NODE_ENV=development
DATABASE_URL=postgresql://postgres:password@localhost:5432/unified_auth_db
JWT_SECRET=change-this-to-a-secure-random-string
JWT_REFRESH_SECRET=change-this-to-another-secure-random-string
```

### Step 3: Run Migrations

```bash
# Run the database migrations
npm run db:migrate
```

Expected output:
```
🚀 Starting database migrations...

Running migration 001_create_auth_schema.sql...
✅ Migration 001 completed successfully

🎉 All migrations completed successfully!
```

### Step 4: Start the Service

```bash
# Development mode with hot reload
npm run dev
```

Expected output:
```
================================================================================
🚀 Unified Authentication Service
================================================================================
✅ Server running on port 5500
✅ Environment: development
✅ API URL: http://localhost:5500
================================================================================
```

### Step 5: Test the Service

```bash
# Test health check
curl http://localhost:5500/health

# Expected response:
# {"status":"healthy","service":"unified-auth-service","timestamp":"..."}
```

## Testing Authentication

### 1. Register a User

```bash
curl -X POST http://localhost:5500/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "TestPass123!",
    "name": "Test User"
  }'
```

### 2. Login

```bash
curl -X POST http://localhost:5500/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "usernameOrEmail": "testuser",
    "password": "TestPass123!"
  }'
```

Save the `accessToken` from the response!

### 3. Verify Token

```bash
curl http://localhost:5500/api/auth/verify \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE"
```

### 4. Get User Profile

```bash
curl http://localhost:5500/api/user/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE"
```

## What's Next: The Roadmap

### ✅ Phase 1: Foundation (DONE!)
- Auth service infrastructure
- Database schemas
- Core authentication logic

### 📋 Phase 2: Central Login UI (Next)
- React frontend for login/register
- Google OAuth buttons
- Redirect mechanism
- Build served from Express

### 📋 Phase 3: Database Migration
- Write user migration script
- Consolidate users from l2p, VideoVault, payment
- Handle duplicate emails
- Update foreign keys

### 📋 Phase 4: L2P Integration
- Update l2p to use auth service
- Modify AuthService to call API
- Update frontend redirects

### 📋 Phase 5: VideoVault Integration
- Update session configuration
- Replace env-based auth

### 📋 Phase 6: Payment Integration
- Update NextAuth to delegate
- Google OAuth integration

### 📋 Phase 7: OAuth Implementation
- Complete Google OAuth flow
- Account linking
- Token refresh

### 📋 Phase 8: Testing & Security
- Unit tests
- Integration tests
- Security audit

### 📋 Phase 9: Production Deployment
- Production database setup
- Deploy auth service
- Update all projects

## Troubleshooting

### "Cannot connect to database"
**Fix**: Update DATABASE_URL in `.env` with correct credentials

### "JWT secrets must be configured"
**Fix**: Set JWT_SECRET and JWT_REFRESH_SECRET in `.env`

### "Port 5500 already in use"
**Fix**: Change PORT in `.env` or stop the other service

### "Module not found"
**Fix**: Run `npm install` again

## Development Commands

```bash
# Start dev server (hot reload)
npm run dev

# Build TypeScript
npm run build

# Start production server
npm start

# Run migrations
npm run db:migrate

# Type check
npm run typecheck

# View database in Drizzle Studio
npm run db:studio
```

## Database Management

### View Tables

```bash
psql unified_auth_db -c "\dt auth.*"
```

### View Users

```bash
psql unified_auth_db -c "SELECT id, username, email, role, created_at FROM auth.users;"
```

### Clean Up (Development Only)

```bash
# Drop and recreate database
dropdb unified_auth_db
createdb unified_auth_db
npm run db:migrate
```

## Architecture Notes

### Token Flow
1. User logs in → receives access token (15min) + refresh token (7 days)
2. Client stores both tokens
3. Access token used for API requests
4. When access token expires → use refresh token to get new tokens
5. Logout → access token added to blacklist

### Security Features
- ✅ Bcrypt password hashing (12 rounds)
- ✅ Rate limiting (5 login attempts per 15min)
- ✅ Account lockout after failed attempts
- ✅ Password strength validation
- ✅ CSRF protection via SameSite cookies
- ✅ Token blacklisting for logout
- ✅ HTTP-only cookies option

### Database Schema
- **auth.users** - Central user table with fields from all 3 projects
- **auth.oauth_accounts** - Google OAuth data
- **auth.sessions** - Session-based auth support
- **auth.token_blacklist** - Revoked JWT tokens
- **auth.user_migration_log** - Audit trail for migration

## Get Help

### Check Logs
The service logs all operations. Look for:
- ✅ Green checkmarks = success
- ❌ Red X = errors
- 🔍 Detailed error messages

### Common Issues

**Password too weak**: Ensure 8+ chars, uppercase, lowercase, number, special char

**Email already registered**: User exists, try login or password reset

**Invalid credentials**: Wrong username/password, check spelling

**Token expired**: Get new token with refresh endpoint

## Success Criteria

When everything is working, you should be able to:

1. ✅ Start the service without errors
2. ✅ Access health check at http://localhost:5500/health
3. ✅ Register a new user
4. ✅ Login with credentials
5. ✅ Verify tokens work
6. ✅ Get user profile
7. ✅ Refresh tokens
8. ✅ Logout (blacklist token)

---

**Next**: Once this is running, we'll build the central login UI (Phase 2) and then start integrating with your projects!
