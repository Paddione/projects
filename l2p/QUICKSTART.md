# 🚀 Learn2Play - Quick Start Guide

Get Learn2Play running in 5 minutes!

## ⚡ One-Command Setup

```bash
git clone <repository-url>
cd l2p
chmod +x setup.sh
./setup.sh
```

That's it! The script will:
- ✅ Check prerequisites (Node.js, Docker)
- ✅ Install all dependencies  
- ✅ Configure environment
- ✅ Setup database
- ✅ Build applications
- ✅ Start all services

## 🎯 Access Your Application

After setup completes:

- **Frontend**: http://localhost:5174
- **Backend API**: http://localhost:3001
- **Database**: localhost:5434

## 🎮 Getting Started

1. **Open** http://localhost:5174 in your browser
2. **Register** a new account
3. **Create** or **join** a quiz lobby  
4. **Play** with friends in real-time!

## 🛠️ Common Commands

```bash
# Start (development profile)
docker-compose up -d

# Stop services  
docker-compose down

# View logs
docker-compose logs -f

# Run tests
npm run test:all

# Production deployment
npm run deploy
```

## 🔧 Manual Setup

If the automatic setup doesn't work:

1. **Prerequisites**: Node.js 20+, Docker, Docker Compose
2. **Environment**: Copy `.env.example` to `.env`
3. **Install**: `npm install && cd frontend && npm install && cd .. && cd backend && npm install && cd ..`
4. **Database**: `docker-compose up -d postgres && npm run db:migrate`
5. **Build**: `npm run build:all`
6. **Start**: `docker-compose up -d`

## 📚 Need Help?

- 📖 **Full Documentation**: [DEPLOYMENT.md](DEPLOYMENT.md)
- 🔧 **Troubleshooting**: Check Docker logs with `docker-compose logs -f`
- 🧪 **Testing**: Run `./test-runner.sh` for interactive test menu
- 🔒 **Security**: See [DEPLOYMENT.md](DEPLOYMENT.md#-security-considerations) for production setup

---

**Enjoy playing Learn2Play! 🎉**
