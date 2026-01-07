# Dashboard Environment Management

## Overview

The dashboard now supports dynamic environment detection and filtering, with clear visual indicators for development vs production modes.

## New Features

### 1. Environment Badge
- **Location**: Dashboard header (top-left, below title)
- **Displays**: Current environment (DEVELOPMENT or PRODUCTION)
- **Colors**:
  - 🟠 **Orange** for Development
  - 🟢 **Green** for Production

### 2. Hot Reload Indicator
- **Location**: Dashboard header (next to environment badge)
- **Displays**: 🔥 Hot Reload Active (only in development mode)
- **Animation**: Pulsing glow effect to indicate active hot reload

### 3. Environment Filtering
- **Location**: Containers section header
- **Filters**: All | Production | Development | Infrastructure
- **Functionality**: Filter Docker containers by their environment type

## Environment Configuration

### Production Mode
```bash
# Set in .env-prod or environment
NODE_ENV=production
```

**Characteristics**:
- Green "PRODUCTION" badge
- No hot reload indicator
- Optimized for stability
- All services run in Docker containers

### Development Mode
```bash
# Set in .env-dev or environment
NODE_ENV=development
```

**Characteristics**:
- Orange "DEVELOPMENT" badge
- 🔥 Hot reload indicator visible
- Optimized for rapid iteration
- Mix of Docker (infrastructure) and local npm services

## Docker Compose Files

### Production: `rag/docker-compose.yml`
Full production stack including:
- vLLM (AI inference)
- Qdrant (vector database)
- Infinity (embeddings)
- PostgreSQL (database)
- Open WebUI (chat interface)
- Ingest Engine (document processing)
- Dashboard (management UI)

**Usage**:
```bash
cd /home/patrick/projects/vllm/rag
docker-compose up -d
```

### Development: `docker-compose.dev.yml`
Infrastructure-only stack for development:
- Qdrant (vector database)
- Infinity (embeddings)
- PostgreSQL (database)

**Usage**:
```bash
cd /home/patrick/projects/vllm
docker-compose -f docker-compose.dev.yml up -d
```

Then run application services locally:
```bash
# Dashboard with hot reload
cd dashboard
npm run dev

# vLLM (if needed locally)
docker run --runtime nvidia -e HF_TOKEN=$HF_TOKEN -p 4100:8888 \
  vllm/vllm-openai:latest --model Qwen/Qwen2.5-Coder-1.5B
```

## API Endpoints

### New Endpoint: `/api/environment-info`
Returns current environment configuration:

**Response**:
```json
{
  "environment": "development",
  "hotReload": true
}
```

**Used by**: Dashboard header to display environment badges

## Service Filtering

### Container Filters
**By Project**:
- All
- L2P
- VideoVault
- Payment
- Auth
- vLLM
- Infrastructure

**By Environment**:
- All
- Production
- Development
- Infrastructure

**Usage**: Click filter buttons in the Containers section to show only relevant containers.

## Testing Production Deployment

### Full Stack Test
```bash
# 1. Navigate to RAG directory
cd /home/patrick/projects/vllm/rag

# 2. Load production environment
export $(cat ../.env-prod | xargs)

# 3. Start all services
docker-compose up -d

# 4. Verify services
docker-compose ps

# 5. Check dashboard
# Visit: https://dashboard.korczewski.de
# Should show: Green "PRODUCTION" badge, no hot reload indicator

# 6. Stop services
docker-compose down
```

### Development Stack Test
```bash
# 1. Navigate to vLLM directory
cd /home/patrick/projects/vllm

# 2. Load development environment
export $(cat .env-dev | xargs)

# 3. Start infrastructure only
docker-compose -f docker-compose.dev.yml up -d

# 4. Start dashboard with hot reload
cd dashboard
npm run dev

# 5. Verify dashboard
# Visit: http://localhost:4242
# Should show: Orange "DEVELOPMENT" badge, 🔥 Hot Reload Active

# 6. Stop services
docker-compose -f docker-compose.dev.yml down
```

## Environment Detection Logic

The dashboard automatically detects the environment based on:
1. `NODE_ENV` environment variable
2. Presence of nodemon (development)
3. Docker container labels

**Server-side** (`server.js`):
```javascript
const NODE_ENV = process.env.NODE_ENV || 'production';
const IS_DEVELOPMENT = NODE_ENV === 'development';
```

**Client-side** (`app.js`):
```javascript
// Fetches from /api/environment-info
const data = await fetch('/api/environment-info');
// Updates badges based on response
```

## Benefits

### For Development
- ✅ Clear visual indication of dev mode
- ✅ Hot reload status always visible
- ✅ Lighter resource usage (infrastructure only in Docker)
- ✅ Faster iteration cycles
- ✅ Easy filtering of dev containers

### For Production
- ✅ Clear visual indication of prod mode
- ✅ Full containerized stack
- ✅ Stable, reproducible deployments
- ✅ Easy monitoring of production containers
- ✅ Environment-based filtering

## Troubleshooting

### Badge Not Updating
1. Check browser console for errors
2. Verify `/api/environment-info` endpoint is accessible
3. Clear browser cache and reload

### Wrong Environment Displayed
1. Verify `NODE_ENV` environment variable
2. Check `.env-dev` or `.env-prod` is loaded
3. Restart dashboard service

### Hot Reload Not Working
1. Ensure `npm run dev` is used (not `npm start`)
2. Verify nodemon is installed
3. Check `nodemon.json` configuration

## Files Modified

### Frontend
- `dashboard/public/index.html` - Added environment badges
- `dashboard/public/style.css` - Added badge styling
- `dashboard/public/app.js` - Added environment fetching and filtering

### Backend
- `dashboard/server.js` - Added `/api/environment-info` endpoint

### Configuration
- `docker-compose.dev.yml` - New development infrastructure file
- `ENVIRONMENT_SETUP.md` - This documentation

## Next Steps

1. ✅ Test production deployment
2. ✅ Test development workflow
3. ✅ Verify environment badges display correctly
4. ✅ Test container filtering by environment
5. Document any issues or improvements needed
