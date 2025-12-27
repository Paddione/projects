# Nginx Proxy Manager Setup for auth.korczewski.de

## Overview

This guide explains how to configure Nginx Proxy Manager to proxy requests to your unified auth service running at `auth.korczewski.de`.

## Architecture

```
Internet
    ↓
auth.korczewski.de (DNS)
    ↓
Nginx Proxy Manager (Reverse Proxy Server)
    ↓
Auth Service (This Machine - Port 5500)
```

## Prerequisites

1. ✅ Domain: `auth.korczewski.de` pointing to your Nginx Proxy Manager server
2. ✅ Auth service running on `http://localhost:5500` (or your server IP)
3. ✅ Nginx Proxy Manager installed and accessible

## Nginx Proxy Manager Configuration

### Step 1: Add Proxy Host

1. Login to your Nginx Proxy Manager admin panel
2. Navigate to **"Hosts"** → **"Proxy Hosts"**
3. Click **"Add Proxy Host"**

### Step 2: Details Tab Configuration

Fill in the following:

**Domain Names:**
```
auth.korczewski.de
```

**Scheme:**
```
http
```

**Forward Hostname / IP:**
```
<YOUR_AUTH_SERVER_IP>
```
- If auth service is on the same machine as NPM: `localhost` or `127.0.0.1`
- If auth service is on a different machine: Use the machine's IP address (e.g., `192.168.1.100`)
- If auth service is accessible via hostname: Use the hostname

**Forward Port:**
```
5500
```

**Options:**
- ✅ **Cache Assets**: Enabled
- ✅ **Block Common Exploits**: Enabled
- ✅ **Websockets Support**: Enabled (for future Socket.io if needed)

### Step 3: SSL Tab Configuration

**SSL Certificate:**
- Select: **"Request a new SSL Certificate"**
- Or use existing wildcard certificate for `*.korczewski.de` if you have one

**Options:**
- ✅ **Force SSL**: Enabled
- ✅ **HTTP/2 Support**: Enabled
- ✅ **HSTS Enabled**: Enabled
- ✅ **HSTS Subdomains**: Disabled (unless you want it for all subdomains)

**Email Address for Let's Encrypt:**
```
your-email@example.com
```

**Terms of Service:**
- ✅ I Agree to the Let's Encrypt Terms of Service

### Step 4: Advanced Tab (Optional but Recommended)

Add the following custom Nginx configuration to handle large requests and set proper headers:

```nginx
# Increase body size limit for file uploads
client_max_body_size 10M;

# Proxy headers
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Port $server_port;

# CORS headers (if needed for cross-origin requests)
add_header Access-Control-Allow-Origin $http_origin always;
add_header Access-Control-Allow-Credentials true always;
add_header Access-Control-Allow-Methods "GET, POST, PUT, PATCH, DELETE, OPTIONS" always;
add_header Access-Control-Allow-Headers "Authorization, Content-Type, Accept, Origin, X-Requested-With" always;

# Handle OPTIONS preflight requests
if ($request_method = OPTIONS) {
    return 204;
}

# Security headers
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;

# Rate limiting (optional but recommended)
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=10r/s;
limit_req zone=auth_limit burst=20 nodelay;
```

### Step 5: Save and Test

1. Click **"Save"**
2. Wait for SSL certificate to be issued (usually takes 1-2 minutes)
3. Test the proxy:
   ```bash
   curl https://auth.korczewski.de/health
   ```

## Quick Setup Summary

### For Same-Machine Setup

If auth service and NPM are on the same server:

| Field | Value |
|-------|-------|
| Domain Names | `auth.korczewski.de` |
| Scheme | `http` |
| Forward Hostname/IP | `localhost` |
| Forward Port | `5500` |
| Cache Assets | ✅ |
| Block Common Exploits | ✅ |
| Websockets Support | ✅ |
| Force SSL | ✅ |
| HTTP/2 Support | ✅ |

### For Different-Machine Setup

If auth service is on a different server (e.g., 192.168.1.100):

| Field | Value |
|-------|-------|
| Domain Names | `auth.korczewski.de` |
| Scheme | `http` |
| Forward Hostname/IP | `192.168.1.100` |
| Forward Port | `5500` |
| Cache Assets | ✅ |
| Block Common Exploits | ✅ |
| Websockets Support | ✅ |
| Force SSL | ✅ |
| HTTP/2 Support | ✅ |

## Update Auth Service Configuration

After setting up the proxy, update your auth service configuration:

### 1. Update .env File

```bash
cd /home/patrick/projects/auth
```

Edit `.env`:

```env
# Change from localhost to production domain
PORT=5500
NODE_ENV=production

# Update allowed origins to include production domains
ALLOWED_ORIGINS=https://l2p.korczewski.de,https://videovault.korczewski.de,https://payment.korczewski.de

# CORS origin
CORS_ORIGIN=https://auth.korczewski.de,https://l2p.korczewski.de,https://videovault.korczewski.de,https://payment.korczewski.de
CORS_CREDENTIALS=true

# Google OAuth redirect URI (IMPORTANT!)
GOOGLE_REDIRECT_URI=https://auth.korczewski.de/api/oauth/google/callback
```

### 2. Update Google OAuth Console

**IMPORTANT:** You must update your Google OAuth credentials:

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Select your OAuth 2.0 Client ID
3. Add authorized redirect URI:
   ```
   https://auth.korczewski.de/api/oauth/google/callback
   ```
4. Save changes

### 3. Restart Auth Service

```bash
# If running with npm
npm run build
npm start

# Or if running with docker-compose
docker-compose down
docker-compose up -d --build
```

## Testing the Setup

### 1. Test Health Endpoint

```bash
curl https://auth.korczewski.de/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "unified-auth-service",
  "timestamp": "2025-12-27T...",
  "uptime": ...
}
```

### 2. Test API Info

```bash
curl https://auth.korczewski.de/api
```

### 3. Test OAuth Redirect

```bash
curl -I https://auth.korczewski.de/api/oauth/google
```

Should return `302 Found` with Location header pointing to Google.

### 4. Test Frontend

Open in browser:
```
https://auth.korczewski.de/login
```

Should show the login page.

## Troubleshooting

### Issue: 502 Bad Gateway

**Cause:** Auth service is not running or NPM can't reach it

**Solutions:**
- Check auth service is running: `curl http://localhost:5500/health`
- Check firewall rules between NPM and auth server
- Verify Forward Hostname/IP is correct
- Check auth service logs

### Issue: 504 Gateway Timeout

**Cause:** Auth service is taking too long to respond

**Solutions:**
- Check auth service logs for errors
- Increase timeout in NPM Advanced config:
  ```nginx
  proxy_connect_timeout 60s;
  proxy_send_timeout 60s;
  proxy_read_timeout 60s;
  ```

### Issue: SSL Certificate Error

**Cause:** Let's Encrypt rate limit or DNS not propagated

**Solutions:**
- Wait 5 minutes and try again
- Check DNS: `nslookup auth.korczewski.de`
- Use DNS challenge instead of HTTP challenge
- Use existing wildcard certificate

### Issue: CORS Errors

**Cause:** Browser blocking cross-origin requests

**Solutions:**
- Add CORS headers in Advanced config (see Step 4 above)
- Ensure `CORS_ORIGIN` in `.env` includes your frontend domains
- Check browser console for specific CORS errors

### Issue: OAuth Redirect Not Working

**Cause:** Redirect URI mismatch

**Solutions:**
- Verify Google OAuth Console has `https://auth.korczewski.de/api/oauth/google/callback`
- Check `.env` has correct `GOOGLE_REDIRECT_URI`
- Test redirect: `curl -I https://auth.korczewski.de/api/oauth/google`

## Docker Compose Production Setup (Optional)

If you want to run the auth service in Docker, here's a production-ready compose file:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: unified_auth_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - auth_db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  auth-service:
    build: .
    restart: unless-stopped
    ports:
      - "5500:5500"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:${DB_PASSWORD}@postgres:5432/unified_auth_db
    env_file:
      - .env
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  auth_db_data:
```

## Network Architecture

### Recommended Setup

```
┌─────────────────────────────────────────────────────────┐
│                    Internet                              │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │  Nginx Proxy Manager          │
        │  (Reverse Proxy Server)       │
        │  - SSL Termination            │
        │  - Domain Routing             │
        │  - Rate Limiting              │
        └───────────────┬───────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ auth.ko...de │ │ l2p.ko...de  │ │ videov...de  │
│ :5500        │ │ :3002        │ │ :5100        │
└──────────────┘ └──────────────┘ └──────────────┘
```

## Security Checklist

Before going to production:

- ✅ Change all secrets in `.env` (JWT_SECRET, JWT_REFRESH_SECRET, SESSION_SECRET)
- ✅ Use strong database password
- ✅ Enable Force SSL in NPM
- ✅ Enable HSTS
- ✅ Update Google OAuth redirect URI
- ✅ Set `NODE_ENV=production`
- ✅ Configure proper CORS origins (no wildcards)
- ✅ Enable rate limiting
- ✅ Set up database backups
- ✅ Configure firewall rules
- ✅ Use environment-specific secrets

## Next Steps

After NPM setup:

1. ✅ Test all endpoints work via `https://auth.korczewski.de`
2. ✅ Update project frontends to use production auth URL
3. ✅ Test OAuth flow end-to-end
4. ✅ Migrate users from old databases
5. ✅ Deploy to production

## Support

If you encounter issues:

1. Check NPM access logs: NPM UI → Hosts → Your Proxy Host → View Access Log
2. Check NPM error logs: NPM UI → Hosts → Your Proxy Host → View Error Log
3. Check auth service logs: `docker-compose logs -f auth-service`
4. Test direct access: `curl http://localhost:5500/health`
5. Test proxy access: `curl https://auth.korczewski.de/health`
