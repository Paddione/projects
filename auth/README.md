# Unified Authentication Service

Centralized authentication service for l2p, VideoVault, and payment projects with Google OAuth support.

## Features

- ✅ Email/password authentication with bcrypt hashing
- ✅ JWT access tokens (15min) + refresh tokens (7 days)
- ✅ Session-based authentication support
- ✅ Google OAuth 2.0 integration (ready for implementation)
- ✅ Email verification
- ✅ Password reset functionality
- ✅ Account security (rate limiting, account lockout)
- ✅ Role-based access control (USER/ADMIN)
- ✅ Token blacklisting for logout
- ✅ CORS configuration for multiple origins
- ✅ Consolidated user database schema

## Tech Stack

- **Framework**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcrypt
- **Validation**: Zod
- **Security**: Helmet, CORS, Rate Limiting

## Database Schema

The service uses a single PostgreSQL database (`unified_auth_db`) with the following schemas:

- **`auth`** - Authentication and user management (centralized)
  - `users` - Consolidated user table
  - `oauth_accounts` - Google OAuth accounts
  - `sessions` - Session storage
  - `token_blacklist` - Blacklisted JWT tokens
  - `verification_tokens` - Email verification
  - `user_migration_log` - Migration audit trail

- **`l2p`** - Learn2Play project data
- **`videovault`** - VideoVault project data
- **`payment`** - Payment project data

## Setup

### Prerequisites

- Node.js >= 18.0.0
- PostgreSQL >= 14
- npm or yarn

### Installation

1. Clone and navigate to the auth directory:
```bash
cd /home/patrick/projects/auth
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```bash
cp .env.example .env
```

4. Configure environment variables in `.env`:
```env
# Server
PORT=5500
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/unified_auth_db

# JWT Secrets (CHANGE IN PRODUCTION!)
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5500/oauth/google/callback

# Allowed Origins
ALLOWED_ORIGINS=http://localhost:3002,http://localhost:5100,http://localhost:3004
```

5. Create database:
```bash
psql -U postgres -c "CREATE DATABASE unified_auth_db;"
```

6. Run migrations:
```bash
npm run db:migrate
```

### Development

Start the development server with hot reload:
```bash
npm run dev
```

The service will be available at `http://localhost:5500`

### Production

Build and start:
```bash
npm run build
npm start
```

## API Endpoints

### Authentication

#### Register
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "name": "John Doe" // optional
}
```

Response:
```json
{
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "role": "USER",
    ...
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6..."
  }
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "usernameOrEmail": "johndoe",
  "password": "SecurePass123!"
}
```

#### Logout
```http
POST /api/auth/logout
Authorization: Bearer <access_token>
```

#### Refresh Token
```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6..."
}
```

#### Verify Token
```http
GET /api/auth/verify
Authorization: Bearer <access_token>
```

#### Forgot Password
```http
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "john@example.com"
}
```

#### Reset Password
```http
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "reset-token-from-email",
  "newPassword": "NewSecurePass123!"
}
```

#### Change Password
```http
POST /api/auth/change-password
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "currentPassword": "OldPass123!",
  "newPassword": "NewPass123!"
}
```

### User Management

#### Get Current User
```http
GET /api/user/me
Authorization: Bearer <access_token>
```

#### Update Profile
```http
PATCH /api/user/profile
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "John Updated",
  "avatar_url": "https://example.com/avatar.jpg",
  "timezone": "America/New_York"
}
```

## Password Requirements

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character (@$!%*?&)

## Security Features

### Rate Limiting
- General API: 100 requests per 15 minutes
- Login/Register: 5 attempts per 15 minutes
- Failed login attempts tracked
- Account lockout after 5 failed attempts (15 min lockout)

### Token Management
- Access tokens expire after 15 minutes
- Refresh tokens expire after 7 days
- Tokens can be blacklisted (logout)
- Expired tokens auto-cleaned from blacklist

### CORS
- Configurable allowed origins
- Credentials support (cookies)
- Whitelisted methods and headers

## Integration with Projects

### l2p, VideoVault, Payment

All projects will authenticate by calling this service:

1. **Redirect unauthenticated users** to `http://localhost:5500/login?redirect_uri=<project_url>`
2. **Verify tokens** by calling `GET /api/auth/verify`
3. **Refresh tokens** by calling `POST /api/auth/refresh`

Example client code:
```typescript
// Check authentication
const isAuthenticated = async () => {
  const response = await fetch('http://localhost:5500/api/auth/verify', {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  return response.ok;
};

// Refresh token
const refreshToken = async () => {
  const response = await fetch('http://localhost:5500/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });
  const data = await response.json();
  return data.tokens;
};
```

## Development Scripts

```bash
# Development with hot reload
npm run dev

# Build TypeScript
npm run build

# Start production server
npm start

# Run migrations
npm run db:migrate

# Generate Drizzle migrations
npm run db:generate

# Push schema to DB (dev only)
npm run db:push

# Open Drizzle Studio
npm run db:studio

# Type checking
npm run typecheck

# Linting
npm run lint
```

## Database Migrations

### Creating a New Migration

1. Update the schema in `src/db/schema.ts`
2. Generate migration:
```bash
npm run db:generate
```
3. Review the generated SQL in `migrations/drizzle/`
4. Apply migration:
```bash
npm run db:migrate
```

### Manual Migration

Create a new SQL file in `migrations/` and run:
```bash
tsx migrations/run-migrations.ts
```

## Testing

The service can be tested with curl, Postman, or any HTTP client:

```bash
# Health check
curl http://localhost:5500/health

# Register
curl -X POST http://localhost:5500/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"TestPass123!"}'

# Login
curl -X POST http://localhost:5500/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"usernameOrEmail":"testuser","password":"TestPass123!"}'

# Verify token
curl http://localhost:5500/api/auth/verify \
  -H "Authorization: Bearer <your-token>"
```

## Next Steps

### Phase 2: Central Login UI
- Create React frontend for login/register pages
- Add Google OAuth button and flow
- Implement redirect mechanism

### Phase 3: Database Migration
- Write user migration script to consolidate existing users
- Handle email duplicates
- Migrate data from l2p, VideoVault, payment

### Phase 4-6: Project Integration
- Update l2p to use auth service
- Update VideoVault to use auth service
- Update payment to use auth service

### Phase 7: OAuth Implementation
- Complete Google OAuth flow
- Implement account linking
- Test across all projects

## Troubleshooting

### Database Connection Issues
- Verify DATABASE_URL is correct
- Ensure PostgreSQL is running
- Check user permissions

### JWT Errors
- Ensure JWT_SECRET and JWT_REFRESH_SECRET are set
- Check token expiry times
- Verify token format

### CORS Errors
- Add your origin to ALLOWED_ORIGINS
- Check credentials setting
- Verify request headers

## License

MIT
