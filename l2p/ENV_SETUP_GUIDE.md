# Environment Variables Setup Guide

## Values You Need to Fill In

### 1. Google AI / Gemini API Key (Optional but recommended for AI features)

**Current placeholders:**
```bash
GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
GOOGLE_CLOUD_PROJECT_ID=YOUR_GCP_PROJECT_ID_HERE  # Optional
GOOGLE_SERVICE_ACCOUNT_EMAIL=YOUR_SERVICE_ACCOUNT_EMAIL_HERE  # Optional
```

**How to get your Gemini API key:**
1. Go to https://aistudio.google.com/app/apikey
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key and replace `YOUR_GEMINI_API_KEY_HERE`

**Optional Google Cloud settings** (only needed for advanced features):
- `GOOGLE_CLOUD_PROJECT_ID`: Your GCP project ID if using Google Cloud Platform
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`: Service account email if using GCP authentication

### 2. Verify Other Settings

The following should already be configured correctly:

✅ **Database credentials** - Match your `shared-infrastructure/.env`
✅ **JWT secrets** - Already generated
✅ **SMTP settings** - Already configured with Gmail
✅ **Auth Service URL** - Set to `https://auth.korczewski.de`
✅ **Application URLs** - Set to `https://l2p.korczewski.de`

## Quick Setup Checklist

- [ ] Copy `.env-prod.example` to `.env-prod` (if starting fresh)
- [ ] Fill in `GEMINI_API_KEY` (get from https://aistudio.google.com/app/apikey)
- [ ] Optionally fill in `GOOGLE_CLOUD_PROJECT_ID` and `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- [ ] Verify SMTP credentials are correct
- [ ] Verify database passwords match `shared-infrastructure/.env`
- [ ] Never commit `.env-prod` to git!

## Testing Your Configuration

After filling in the values, restart your services:

```bash
cd /home/patrick/projects/l2p
docker-compose --profile production down
docker-compose --profile production up -d
```

Check the logs:
```bash
docker logs l2p-api --tail 50
```

## Security Notes

🔒 **Never commit these files:**
- `.env-prod`
- `.env-dev`
- Any file containing real API keys, passwords, or secrets

✅ **Safe to commit:**
- `.env-prod.example`
- `.env.example`
- Configuration templates with placeholder values
