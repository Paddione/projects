# Patrick's Projects Repository

**Unified repository containing multiple full-stack projects**

[![Repository Size](https://img.shields.io/badge/repo%20size-7.9%20MB-green)]()
[![Projects](https://img.shields.io/badge/projects-4-blue)]()
[![License](https://img.shields.io/badge/license-Private-red)]()

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/patrick-projects.git
cd patrick-projects

# Run automated setup
chmod +x setup.sh
./setup.sh

# Or see SETUP_GUIDE.md for manual setup
```

## 📁 Projects

### 1. L2P (Learn to Play)
A comprehensive learning platform with authentication, question sets, and interactive features.

**Tech Stack:**
- Frontend: React, TypeScript
- Backend: Node.js, Express
- Database: PostgreSQL
- Deployment: Docker, Nginx
- AI: Gemini 2.0 Flash

**Features:**
- User authentication & authorization
- Question set management
- Interactive learning modules
- Real-time updates via WebSocket
- Perk system with badges

### 2. VideoVault
Video management and storage system with advanced filtering and organization.

**Tech Stack:**
- Frontend: React, TypeScript
- Backend: Node.js
- Features: Video tagging, playlists, advanced search

### 3. Payment
Payment processing system with Stripe integration.

**Tech Stack:**
- Frontend: Next.js, TypeScript
- Backend: Next.js API Routes
- Database: PostgreSQL (Prisma)
- Payment: Stripe

**Features:**
- Stripe checkout integration
- Wallet system
- Order management
- Admin dashboard

### 4. VLLM
AI/ML project with image generation capabilities using Stable Diffusion Forge.

**Tech Stack:**
- Backend: Node.js, Python
- AI: Stable Diffusion, PyTorch
- Tools: Pinokio, RAG

**Features:**
- AI Image Generation (Stable Diffusion XL)
- Pinokio integration
- RAG (Retrieval-Augmented Generation)
- Command center dashboard
- Multiple model support

## 📚 Documentation

- **[SETUP_GUIDE.md](SETUP_GUIDE.md)** - Comprehensive setup instructions
- **[SIZE_REDUCTION_SUMMARY.md](SIZE_REDUCTION_SUMMARY.md)** - Repository optimization details
- **[PUBLISHING_GUIDE.md](PUBLISHING_GUIDE.md)** - How to publish to Git platforms

## 🛠️ Setup

### Automated Setup (Recommended)

```bash
./setup.sh
```

This script will:
- Check prerequisites (Node.js, Python, Docker)
- Install dependencies for all projects
- Create Python virtual environments
- Set up environment files
- Optionally start Docker services

### Manual Setup

See [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed manual setup instructions.

### Requirements

- **Node.js:** v18 or higher
- **Python:** 3.10 or higher
- **Docker:** Latest version (optional but recommended)
- **PostgreSQL:** 14 or higher
- **RAM:** 16 GB minimum (32 GB for AI features)
- **Storage:** 10 GB minimum (60 GB+ with AI models)
- **GPU:** NVIDIA GPU with 8GB+ VRAM (for AI image generation)

## 🔧 Development

### Start Individual Projects

```bash
# L2P
cd l2p && npm run dev

# Payment
cd payment && npm run dev

# VideoVault
cd VideoVault && npm run dev

# VLLM
cd vllm && npm run dev
```

### Run Tests

```bash
# Run tests for all projects
npm test

# Or run tests for individual projects
cd l2p && npm test
```

## 📦 What's Included

This repository includes **only source code and configuration** (7.9 MB):
- ✅ All source code (.ts, .tsx, .js, .py)
- ✅ Configuration files (package.json, tsconfig.json, etc.)
- ✅ Documentation and guides
- ✅ Docker configurations
- ✅ Test files

## 🚫 What's Excluded

The following are **excluded** from version control (see `.gitignore`):
- ❌ AI models (~40 GB) - Download separately
- ❌ Virtual environments (~8 GB) - Created during setup
- ❌ Node modules - Installed via npm
- ❌ Database data - Created during setup
- ❌ Build artifacts - Generated during build
- ❌ Environment files (.env) - Created from .env.example

**Total excluded:** ~52 GB of downloadable/generated content

See [SIZE_REDUCTION_SUMMARY.md](SIZE_REDUCTION_SUMMARY.md) for details.

## 🔐 Environment Variables

Each project requires environment variables. Copy `.env.example` to `.env` and configure:

```bash
# L2P
cp l2p/.env.example l2p/.env

# Payment
cp payment/.env.example payment/.env

# Configure with your credentials
```

## 🐳 Docker Deployment

```bash
# Development
docker-compose up -d

# Production
docker-compose -f docker-compose.prod.yml up -d
```

## 📊 Repository Stats

- **Repository Size:** 7.9 MB (99.3% reduction from original)
- **Files Tracked:** 1,216
- **Lines of Code:** ~100,000+
- **Projects:** 4
- **Languages:** TypeScript, JavaScript, Python, CSS, HTML

## 🤝 Contributing

This is a private repository. For collaborators:

1. Clone the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📝 License

Private Repository - All Rights Reserved

## 🆘 Support

For setup issues or questions:
1. Check [SETUP_GUIDE.md](SETUP_GUIDE.md)
2. Review project-specific README files
3. Check the documentation in each project directory

---

**Last Updated:** 2025-12-27  
**Repository:** patrick-projects  
**Maintainer:** Patrick Korczewski

