# Deployment Checklist for auth.korczewski.de

Use this checklist to deploy the unified auth service to production.

## ☐ Step 1: Google OAuth Configuration (5 minutes)

**IMPORTANT: Do this first!**

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Select your OAuth 2.0 Client ID: `755774244698-nsvf3tjbpbt4i7phbba9o97ftodhd4eo.apps.googleusercontent.com`
3. Under **"Authorized redirect URIs"**, add:
   ```
   https://auth.korczewski.de/api/oauth/google/callback
   ```
4. Click **Save**

✅ Verification: You should see both URIs listed:
- `http://localhost:5500/api/oauth/google/callback` (for dev)
- `https://auth.korczewski.de/api/oauth/google/callback` (for prod)

---

## ☐ Step 2: Nginx Proxy Manager Setup (10 minutes)

### Quick Settings

Open your Nginx Proxy Manager and add a new Proxy Host:

**Details Tab:**
```
Domain Names:        auth.korczewski.de
Scheme:             http
Forward Host/IP:    <YOUR_SERVER_IP>    (localhost if same machine)
Forward Port:       5500
Cache Assets:       ✅
Block Exploits:     ✅
Websockets:         ✅
```

**SSL Tab:**
```
SSL Certificate:    Request new certificate
Force SSL:          ✅
HTTP/2:             ✅
HSTS:               ✅
Email:              <your-email>
Agree to ToS:       ✅
```

**Advanced Tab:** (Copy-paste from `NPM_QUICK_SETUP.txt`)

See file: `/home/patrick/projects/auth/NPM_QUICK_SETUP.txt`

✅ Verification:
```bash
curl https://auth.korczewski.de/health
```
Should return: `{"status":"healthy",...}`

---

## ☐ Step 3: Build and Deploy Auth Service (5 minutes)

```bash
cd /home/patrick/projects/auth

# Build backend
npm run build

# Build frontend
cd frontend && npm run build && cd ..

# Start service (choose one method):

# Method 1: Direct node
node dist/server.js

# Method 2: PM2 (recommended for production)
npm install -g pm2
pm2 start dist/server.js --name auth-service
pm2 save
pm2 startup

# Method 3: Docker (if you prefer)
docker-compose up -d --build
```

✅ Verification:
```bash
# Local health check
curl http://localhost:5500/health

# Production health check
curl https://auth.korczewski.de/health
```

---

## ☐ Step 4: Test OAuth Flow (5 minutes)

1. Open browser: `https://auth.korczewski.de/login`
2. Click **"Login with Google"** button (when frontend is updated)
3. Should redirect to Google
4. Authorize the app
5. Should redirect back with tokens

**Manual test:**
```bash
curl -I https://auth.korczewski.de/api/oauth/google
```

Should return `302 Found` with Location header pointing to Google.

✅ Verification: OAuth redirect works and contains your domain

---

## ☐ Step 5: Security Hardening (10 minutes)

### Update Secrets in .env

**CRITICAL:** Change these default secrets!

```bash
cd /home/patrick/projects/auth
nano .env
```

Generate secure secrets:
```bash
# Generate random secrets
openssl rand -base64 32  # Use for JWT_SECRET
openssl rand -base64 32  # Use for JWT_REFRESH_SECRET
openssl rand -base64 32  # Use for SESSION_SECRET
```

Update:
```env
JWT_SECRET=<your-generated-secret-1>
JWT_REFRESH_SECRET=<your-generated-secret-2>
SESSION_SECRET=<your-generated-secret-3>
NODE_ENV=production
```

### Update Database Password

```env
DATABASE_URL=postgresql://postgres:<STRONG_PASSWORD>@localhost:5432/unified_auth_db
```

✅ Verification: Restart service and test login still works

---

## ☐ Step 6: Database Migration (Optional - 10 minutes)

If you have existing users in l2p, VideoVault, or payment:

```bash
cd /home/patrick/projects/auth

# Dry run first to see what would be migrated
tsx scripts/migrate-users.ts --dry-run

# Migrate all users
tsx scripts/migrate-users.ts

# Or migrate specific project
tsx scripts/migrate-users.ts --project=l2p
```

✅ Verification: Check user count in database

---

## ☐ Step 7: Update Project Integrations (Per Project)

For each project (l2p, VideoVault, payment):

1. Copy auth client library:
   ```bash
   cp /home/patrick/projects/auth/client/auth-client.ts <project>/src/lib/
   ```

2. Update `.env`:
   ```env
   VITE_AUTH_SERVICE_URL=https://auth.korczewski.de
   ```

3. Follow `INTEGRATION_GUIDE.md` for project-specific steps

✅ Verification: Test login flow from each project

---

## ☐ Step 8: Final Testing (15 minutes)

### Test Checklist

- ☐ Health endpoint: `curl https://auth.korczewski.de/health`
- ☐ API info: `curl https://auth.korczewski.de/api`
- ☐ Login page loads: `https://auth.korczewski.de/login`
- ☐ Register page loads: `https://auth.korczewski.de/register`
- ☐ OAuth redirect works: `https://auth.korczewski.de/api/oauth/google`
- ☐ Can register new user
- ☐ Can login with email/password
- ☐ Can login with Google OAuth
- ☐ JWT tokens are issued
- ☐ Token refresh works
- ☐ Logout works
- ☐ Password reset works (if email configured)
- ☐ CORS works from project domains
- ☐ SSL certificate is valid
- ☐ HTTPS redirect works (http → https)

### Test Registration

```bash
curl -X POST https://auth.korczewski.de/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"prodtest","email":"prod@test.com","password":"TestPass123@","name":"Prod Test"}'
```

### Test Login

```bash
curl -X POST https://auth.korczewski.de/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"usernameOrEmail":"prod@test.com","password":"TestPass123@"}'
```

### Test Token Verification

```bash
TOKEN="<access-token-from-login>"
curl https://auth.korczewski.de/api/auth/verify \
  -H "Authorization: Bearer $TOKEN"
```

✅ All tests pass

---

## ☐ Step 9: Monitoring & Backup Setup (Optional)

### Set up PM2 monitoring

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### Database backups

```bash
# Create backup script
cat > /home/patrick/scripts/backup-auth-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/patrick/backups/auth"
mkdir -p $BACKUP_DIR
pg_dump -U postgres unified_auth_db > $BACKUP_DIR/auth_$(date +%Y%m%d_%H%M%S).sql
# Keep only last 7 days
find $BACKUP_DIR -name "auth_*.sql" -mtime +7 -delete
EOF

chmod +x /home/patrick/scripts/backup-auth-db.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /home/patrick/scripts/backup-auth-db.sh
```

✅ Backups are configured

---

## ☐ Step 10: Documentation & Handoff

### Update project domains

Update `ALLOWED_ORIGINS` in `.env` as projects get their own domains:

```env
ALLOWED_ORIGINS=https://l2p.korczewski.de,https://videovault.korczewski.de,https://payment.korczewski.de
```

### Document production URLs

| Service | URL |
|---------|-----|
| Auth Service | https://auth.korczewski.de |
| Login Page | https://auth.korczewski.de/login |
| Register Page | https://auth.korczewski.de/register |
| API Docs | https://auth.korczewski.de/api |
| Health Check | https://auth.korczewski.de/health |

✅ Documentation is complete

---

## Quick Reference Files

- 📄 `NPM_QUICK_SETUP.txt` - Copy-paste values for Nginx Proxy Manager
- 📄 `NGINX_PROXY_SETUP.md` - Detailed NPM setup guide
- 📄 `INTEGRATION_GUIDE.md` - How to integrate with projects
- 📄 `README.md` - General project documentation
- 📄 `QUICKSTART.md` - Quick start guide

---

## Troubleshooting

If something goes wrong, check:

1. **Service logs:**
   ```bash
   pm2 logs auth-service
   # or
   docker-compose logs -f
   ```

2. **NPM logs:**
   - Nginx Proxy Manager UI → Hosts → auth.korczewski.de → View Logs

3. **Database connection:**
   ```bash
   psql -U postgres -d unified_auth_db -c "SELECT COUNT(*) FROM auth.users;"
   ```

4. **Network connectivity:**
   ```bash
   curl http://localhost:5500/health  # Local test
   curl https://auth.korczewski.de/health  # External test
   ```

---

## Success Criteria

✅ All checklist items completed
✅ OAuth flow works end-to-end
✅ All tests pass
✅ Service is accessible via https://auth.korczewski.de
✅ Projects can authenticate users
✅ No security warnings in browser
✅ Monitoring and backups configured

---

## Estimated Total Time: 60-90 minutes

**Questions or issues?** Check troubleshooting sections in:
- `NGINX_PROXY_SETUP.md`
- `INTEGRATION_GUIDE.md`

Good luck with your deployment! 🚀
