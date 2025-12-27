# Learn2Play (L2P) Deployment Guide

**Version:** 1.0.0
**Last Updated:** 2025-12-05
**Repository:** https://github.com/Paddione/l2p.git

---

## ✅ Git Repository Status

All changes have been committed and pushed to the main branch:
- **Latest Commit:** `fb53265` - Update Claude Code settings for improved development workflow
- **Previous Commit:** `aab57d2` - Enhance perks system with real-time updates and improved UI/UX
- **Branch:** `main`
- **Remote Status:** ✅ Up to date with origin/main
- **Working Tree:** ✅ Clean (no uncommitted changes)

---

## 📦 What's Included in Latest Commits

### Major Changes (aab57d2)
- **Backend:** Enhanced perks system with real-time notifications, improved API routes
- **Frontend:** Complete redesign of PerksManager component, enhanced GameInterface
- **API Service:** Refactored error handling, retry logic, better TypeScript types
- **Testing:** Updated test suites, improved coverage
- **Styling:** Modern card-based UI, responsive design, accessibility improvements
- **Total Changes:** 22 files changed, 1,179 insertions(+), 235 deletions(-)

### Configuration Updates (fb53265)
- Claude Code development settings
- Improved workspace configuration

---

## 🚀 Deployment Instructions for Remote Client

### Step 1: Pull Latest Code
```bash
# Clone repository (if first time)
git clone https://github.com/Paddione/l2p.git
cd l2p

# Or pull latest changes (if repository exists)
git pull origin main
```

### Step 2: Verify Code Version
```bash
# Check you have the latest commits
git log --oneline -3

# You should see:
# fb53265 Update Claude Code settings...
# aab57d2 Enhance perks system...
```

### Step 3: Set Up Environment Variables

Create or update `.env` file with production settings:

```bash
# CRITICAL: Update these for production
NODE_ENV=production
ENVIRONMENT=production

# Database Configuration - MUST BE CONFIGURED
DATABASE_URL=postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE_NAME
DB_HOST=your-database-host
DB_PORT=5432
DB_NAME=learn2play
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_SSL=true

# Domain Configuration
DOMAIN=your-domain.com
PORT=3001
FRONTEND_URL=https://your-domain.com

# CORS Configuration
CORS_ORIGIN=https://your-domain.com
CORS_ORIGINS=https://your-domain.com,https://www.your-domain.com
SOCKET_CORS_ORIGIN=https://your-domain.com

# JWT Secrets - GENERATE NEW SECRETS FOR PRODUCTION
JWT_SECRET=generate-a-strong-random-secret-here
JWT_REFRESH_SECRET=generate-another-strong-random-secret-here
JWT_EXPIRES_IN=15m

# Email Configuration (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password
EMAIL_SENDER_ADDRESS=noreply@your-domain.com
EMAIL_SENDER_NAME=Learn2Play

# Rate Limiting (Production Settings)
DISABLE_RATE_LIMITING=false
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
```

### Step 4: Install Dependencies
```bash
# Install all dependencies
npm run install:all

# This will install:
# - Root project dependencies
# - Frontend dependencies
# - Backend dependencies
```

### Step 5: Run Database Migrations
```bash
# Test database connection first
npm --prefix backend run db:health

# Run migrations
npm --prefix backend run db:migrate

# Verify migration status
npm --prefix backend run db:status
```

### Step 6: Build for Production
```bash
# Build frontend and backend
npm run build:all

# Or build individually:
# cd frontend && npm run build
# cd backend && npm run build
```

### Step 7: Deploy with Docker

#### Option A: Using Docker Compose (Recommended)
```bash
# Production deployment with all services
docker-compose --profile production up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f
```

#### Option B: Using Rebuild Script
```bash
# Complete rebuild and deployment
./rebuild.sh

# Or specific components:
./rebuild.sh rebuild-backend
./rebuild.sh rebuild-frontend
./rebuild.sh rebuild-all --reset-db
```

### Step 8: Verify Deployment
```bash
# Check all services are healthy
docker-compose ps

# Test health endpoints
curl http://localhost:3001/api/health
curl http://localhost:3001/health

# Check logs for errors
docker-compose logs backend | tail -100
docker-compose logs frontend | tail -100
```

---

## ⚠️ CRITICAL PRE-DEPLOYMENT CHECKLIST

Before deploying, you **MUST** address these issues:

### 🔴 Database Connectivity (CRITICAL)
- [ ] **Configure DATABASE_URL** with correct production database credentials
- [ ] **Verify database is accessible** from deployment server
- [ ] **Check firewall rules** allow connections on port 5432
- [ ] **Test connection** before starting services
- [ ] **Run migrations** successfully

**Current Issue:** Development .env points to localhost database which won't be accessible in production.

### 🔴 Security Vulnerabilities (HIGH PRIORITY)
Run security updates before deployment:
```bash
# Check vulnerabilities
npm audit

# Fix non-breaking changes
npm audit fix

# Review and apply breaking changes (carefully)
npm audit fix --force
```

**Known Vulnerabilities:**
- 4 CRITICAL (jsonpath-plus RCE, axios CSRF/DoS/SSRF)
- 7 HIGH (glob command injection, jws signature issues, playwright SSL)
- 5 MODERATE (esbuild, js-yaml, mammoth, nodemailer)

### 🔴 TypeScript Type Errors (HIGH PRIORITY)
Fix before production deployment:
```bash
# Install missing testing library type definitions
cd frontend
npm install --save-dev @testing-library/jest-dom

# Verify types compile
npx tsc --noEmit
```

**Known Issues:**
- Missing `@testing-library/jest-dom` type definitions (500+ errors)
- Missing `isAdmin` property in User type
- Incomplete `AuthResponse` type definition

### 🟡 Test Failures (MEDIUM PRIORITY)
Fix 2 failing tests in PerksManager:
```bash
# Run tests to verify
npm run test:all

# Failed tests:
# - PerksManager › handles API errors gracefully
# - PerksManager › handles network errors gracefully
```

**Issue:** Tests expect "Error: " prefix in error messages, component doesn't include it.

### 🟡 Environment Variables (CRITICAL)
Update `.env` file with production values:
- [ ] Generate strong JWT secrets (not development defaults)
- [ ] Configure production database connection
- [ ] Set up production SMTP credentials
- [ ] Update CORS origins for production domain
- [ ] Set appropriate rate limits

---

## 📊 Current Application Status

### Code Quality
- ✅ Docker Compose configuration valid
- ✅ 14 database migrations ready
- ✅ Comprehensive test suite (884 passing tests)
- ✅ Production-ready Docker setup
- ❌ TypeScript type errors need fixing
- ❌ 2 test failures need addressing
- ❌ 19 security vulnerabilities need patching

### Infrastructure
- ✅ Node.js v22.21.0 (latest LTS)
- ✅ npm 10.9.4
- ✅ Docker 29.0.0
- ✅ PostgreSQL container ready
- ❌ Database connection needs configuration

### Features Ready for Deployment
- ✅ Real-time multiplayer quiz system
- ✅ JWT authentication with email verification
- ✅ Character progression and experience tracking
- ✅ Enhanced perks system with real-time notifications
- ✅ File upload and AI question generation
- ✅ Admin panel and user management
- ✅ Responsive UI with accessibility features
- ✅ Comprehensive error handling

---

## 🔧 Troubleshooting Common Deployment Issues

### Issue: Database Connection Timeout
```bash
# Check database is running
docker ps | grep postgres

# Test connection manually
PGPASSWORD=your-password psql -h your-host -U your-user -d learn2play

# Check firewall/security groups allow port 5432
```

### Issue: Services Won't Start
```bash
# Check environment variables are set
env | grep -E 'DATABASE_URL|JWT_SECRET|SMTP'

# View detailed logs
docker-compose logs backend -f

# Check service health
docker-compose ps
```

### Issue: Frontend Can't Connect to Backend
```bash
# Verify CORS settings in .env
# Ensure FRONTEND_URL matches actual frontend URL
# Check CORS_ORIGINS includes all valid origins
```

### Issue: Email Verification Not Working
```bash
# Test SMTP connection
npm --prefix backend run smtp:fix

# Verify SMTP credentials are correct
# Check Gmail App Password if using Gmail
```

---

## 📈 Post-Deployment Verification

After deployment, verify these endpoints:

### Health Checks
```bash
# Backend health
curl https://your-domain.com/api/health

# Full health check
curl https://your-domain.com/health
```

### Authentication Flow
1. Visit frontend at https://your-domain.com
2. Register a new user account
3. Check email for verification
4. Log in successfully
5. Test protected routes

### Database Verification
```bash
# Check migrations are applied
npm --prefix backend run db:status

# Verify tables exist
npm --prefix backend run db:validate
```

### WebSocket Connectivity
1. Create or join a lobby
2. Verify real-time updates work
3. Test multiplayer game functionality
4. Check character progression updates

---

## 🔐 Security Recommendations

### Before Going Live
1. **Change all default secrets** in .env
2. **Enable HTTPS** with valid SSL certificates
3. **Configure firewall rules** to restrict access
4. **Set up database backups** with automated schedule
5. **Enable monitoring** and error tracking
6. **Review CORS settings** for production domains
7. **Update all vulnerable dependencies**
8. **Enable rate limiting** with appropriate limits
9. **Set up log rotation** to prevent disk issues
10. **Configure security headers** (Helmet.js already included)

### Environment Security
```bash
# Never commit .env to git
echo ".env" >> .gitignore

# Use strong passwords (20+ characters)
# Generate JWT secrets with: openssl rand -base64 32
# Use different secrets for different environments
```

---

## 📞 Support & Monitoring

### Logs Location
- **Backend Logs:** `docker-compose logs backend`
- **Frontend Logs:** `docker-compose logs frontend`
- **Database Logs:** `docker-compose logs postgres`
- **Nginx Logs:** `docker-compose logs nginx-proxy-manager`

### Monitoring Endpoints
- **Health:** `/api/health`
- **Metrics:** `/metrics` (Prometheus format)
- **Status:** `/health` (detailed system status)

### Performance Monitoring
```bash
# Check resource usage
docker stats

# Monitor database performance
npm --prefix backend run db:top-slow

# View system status
docker-compose ps
```

---

## 🎯 Quick Deployment Commands

```bash
# Complete deployment from scratch
git clone https://github.com/Paddione/l2p.git
cd l2p
cp .env.example .env  # Edit with production values
npm run install:all
npm --prefix backend run db:migrate
npm run build:all
docker-compose --profile production up -d

# Update existing deployment
git pull origin main
npm run install:all
npm --prefix backend run db:migrate
npm run build:all
docker-compose --profile production up -d --build

# Rollback to previous version
git log --oneline -10  # Find previous commit
git checkout e42a964    # Replace with desired commit
docker-compose --profile production up -d --build
```

---

## 📝 Deployment Checklist Summary

- [ ] Pull latest code from git (commit fb53265)
- [ ] Update .env with production settings
- [ ] Configure production database connection
- [ ] Generate strong JWT secrets
- [ ] Set up SMTP credentials
- [ ] Install dependencies
- [ ] Fix security vulnerabilities (npm audit fix)
- [ ] Fix TypeScript type errors
- [ ] Run and verify database migrations
- [ ] Build production bundles
- [ ] Deploy with Docker Compose
- [ ] Verify all services are healthy
- [ ] Test authentication flow
- [ ] Test multiplayer functionality
- [ ] Set up monitoring and backups
- [ ] Configure SSL/HTTPS
- [ ] Review and enable rate limiting

---

## 🚦 Deployment Status

**Overall:** 🟡 READY FOR DEPLOYMENT WITH FIXES

The application code is ready and committed to git. However, you must:
1. Configure production database connection
2. Update environment variables for production
3. Fix security vulnerabilities before going live
4. Optionally fix TypeScript errors and test failures

**Estimated Setup Time:** 30-60 minutes (depending on infrastructure setup)

---

**Good luck with your deployment! 🚀**

For issues or questions, refer to the main README.md or project documentation.
