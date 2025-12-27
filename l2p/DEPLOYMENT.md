# Learn2Play (L2P) - Deployment Guide

Learn2Play is a real-time multiplayer quiz platform with React frontend and Node.js/TypeScript backend.

## 🚀 Quick Deployment (5 minutes)

### Prerequisites
- **Node.js 20+** (with npm)
- **Docker & Docker Compose**
- **Git**

### 1. Clone the Repository
```bash
git clone <repository-url>
cd l2p
```

### 2. Run the Setup Script
```bash
chmod +x setup.sh
./setup.sh
```

This will:
- Install all dependencies
- Set up environment files
- Initialize the database
- Start all services

### 3. Access the Application
- **Frontend**: http://localhost:5174
- **Backend API**: http://localhost:3001
- **Database**: localhost:5434 (PostgreSQL)

---

## 📋 Detailed Setup Instructions

### Step 1: Environment Configuration

Copy the environment template:
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```bash
# Database
DATABASE_URL=postgresql://l2p_user:your_password@localhost:5434/learn2play
DB_HOST=localhost
DB_PORT=5434
DB_NAME=learn2play
DB_USER=l2p_user
DB_PASSWORD=your_password

# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-chars

# Email (for password reset and verification)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com

# Google Gemini AI (for question generation)
GOOGLE_AI_API_KEY=your-gemini-api-key

# Application
NODE_ENV=production
PORT=3001
FRONTEND_PORT=5174
```

### Step 2: Install Dependencies

Install all project dependencies:
```bash
# Root dependencies
npm install

# Frontend dependencies
cd frontend && npm install && cd ..

# Backend dependencies
cd backend && npm install && cd ..
```

### Step 3: Database Setup

Start PostgreSQL with Docker:
```bash
docker-compose up -d postgres
```

Wait for database to be ready, then run migrations:
```bash
npm run db:migrate
```

### Step 4: Build the Application

```bash
# Build frontend
npm run build:frontend

# Build backend (optional - uses tsx for development)
npm run build:backend
```

### Step 5: Start the Application

For **development**:
```bash
npm run dev
```

For **production**:
```bash
docker-compose --profile production up -d
```

---

## 🐳 Docker Deployment

### Deploy vs Rebuild
- Deploy (production): Builds production images, starts the full stack, runs DB migrations, and performs health checks.
  - Command: `npm run deploy`
- Rebuild (any profile): Flexible rebuild helper for specific services or full stack with optional DB reset.
  - Command: `npm run rebuild`
  - Examples: `bash rebuild.sh rebuild-backend -p dev`, `bash rebuild.sh rebuild-all --reset-db -y -p dev`

### Development Environment
```bash
# Start all services
docker-compose --profile development up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Production Environment
```bash
# Build and start production services
docker-compose --profile production up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f l2p-frontend l2p-backend
```

---

## 🔧 Configuration Options

### Database Configuration
- **Development**: Uses Docker PostgreSQL container
- **Production**: Configure `DATABASE_URL` for external database
- **Test**: Separate test database configured automatically

### Email Configuration (Optional)
Required for password reset and email verification:
- **Gmail**: Use App Passwords (not your regular password)
- **Other SMTP**: Configure SMTP settings accordingly

### AI Integration (Optional)
- **Google Gemini**: For AI-powered question generation
- **File Upload**: Supports PDF, DOCX, TXT, MD processing

---

## 📁 Project Structure

```
l2p/
├── frontend/                 # React + TypeScript frontend
│   ├── src/
│   ├── public/
│   ├── e2e/                 # Playwright E2E tests
│   └── package.json
├── backend/                  # Node.js + TypeScript backend  
│   ├── src/
│   ├── migrations/          # Database migrations
│   └── package.json
├── shared/                   # Shared utilities
├── scripts/                  # Utility scripts
├── docker-compose.yml        # Docker configuration
├── .env.example             # Environment template
└── package.json             # Root package.json
```

---

## 🧪 Testing

### Run All Tests
```bash
npm run test:all
```

### Specific Test Types
```bash
# Unit tests
npm run test:unit

# Integration tests  
npm run test:integration

# End-to-end tests
npm run test:e2e

# Performance tests
npm run test:performance
```

### Interactive Test Runner
```bash
./test-runner.sh
```

---

## 🚀 Production Deployment

### Option 1: Docker Compose (Recommended)
```bash
# Production deployment
docker-compose --profile production up -d

# With SSL (using Traefik)
docker-compose --profile production-ssl up -d
```

### Option 2: Traditional Deployment
```bash
# Build applications
npm run build

# Start with PM2 (process manager)
npm install -g pm2
pm2 start ecosystem.config.js
```

### Option 3: Cloud Deployment

#### Docker Swarm (Advanced)
```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.yml l2p
```

#### Kubernetes (Advanced)
```bash
# Apply configurations
kubectl apply -f k8s/
```

---

## 🔧 Troubleshooting

### Common Issues

1. **Port Conflicts**
   ```bash
   # Check what's using ports
   lsof -i :3001 -i :5174 -i :5434
   
   # Kill processes if needed
   kill -9 <PID>
   ```

2. **Database Connection Issues**
   ```bash
   # Check database status
   docker-compose logs postgres
   
   # Reset database
   docker-compose down -v
   docker-compose up -d postgres
   npm run db:migrate
   ```

3. **Permission Issues**
   ```bash
   # Fix script permissions
   chmod +x setup.sh test-runner.sh scripts/*.sh
   ```

4. **Node.js Version Issues**
   ```bash
   # Check Node.js version
   node --version  # Should be 20+
   
   # Install/update Node.js
   nvm install 20
   nvm use 20
   ```

### Debug Commands
```bash
# Check service status
docker-compose ps

# View detailed logs
docker-compose logs -f --tail=100

# Access database
npm run db:cli

# Test API endpoints
curl http://localhost:3001/api/health

# Check frontend build
npm run build:frontend --verbose
```

---

## 🔒 Security Considerations

### Production Checklist
- [ ] Change default JWT secrets
- [ ] Use strong database passwords
- [ ] Configure HTTPS/SSL certificates
- [ ] Set up firewall rules
- [ ] Enable rate limiting
- [ ] Configure CORS origins
- [ ] Set up monitoring and logging
- [ ] Regular security updates

### Environment Variables Security
- Never commit `.env` files to repository
- Use Docker secrets or environment injection for production
- Rotate JWT secrets regularly
- Use strong, unique passwords for all services

---

## 📊 Monitoring & Maintenance

### Health Checks
```bash
# Application health
curl http://localhost:3001/api/health

# Database health  
npm run db:health

# System resources
docker stats
```

### Logs
```bash
# Application logs
docker-compose logs -f l2p-frontend l2p-backend

# Database logs
docker-compose logs -f postgres

# All logs
docker-compose logs -f
```

### Backups
```bash
# Database backup
docker exec l2p_postgres pg_dump -U l2p_user learn2play > backup.sql

# Restore database
docker exec -i l2p_postgres psql -U l2p_user learn2play < backup.sql
```

---

## 🤝 Support & Contributing

### Getting Help
- Check the [troubleshooting section](#-troubleshooting)
- Review application logs
- Check Docker container status
- Verify environment configuration

### Development
- Follow TypeScript and React best practices
- Run tests before submitting changes
- Use the provided linting and formatting tools
- Update documentation when needed

---

## 📝 License & Credits

Learn2Play (L2P) - Real-time multiplayer quiz platform
Built with React, Node.js, TypeScript, PostgreSQL, and Socket.IO

For more information, see the main [README.md](README.md) file.
