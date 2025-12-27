# Patrick's Projects Monorepo

A collection of independent full-stack applications including a multiplayer quiz platform, video management system, payment platform, and AI-powered development tools.

## 📋 Projects Overview

This monorepo contains four independent projects, each with its own technology stack, development workflow, and deployment process:

| Project | Description | Tech Stack | Port(s) |
|---------|-------------|------------|---------|
| [**Learn2Play (l2p)**](./l2p/README.md) | Multiplayer quiz platform with real-time gameplay | React, Express, Socket.io, PostgreSQL | 5173, 5001 |
| [**VideoVault**](./VideoVault/README.md) | Client-first video management with advanced filtering | React, Vite, File System Access API | 5100/5000 |
| [**Payment**](./payment/README.md) | Payment processing platform with Stripe | Next.js 16, Prisma, NextAuth | 3004 |
| [**VLLM**](./vllm/README.md) | MCP server for AI inference and code analysis | TypeScript, vLLM, PostgreSQL | 4100 |

## 🚀 Quick Start

### Prerequisites

- **Node.js 20+** and npm
- **Docker & Docker Compose**
- **Python 3.10+** (for VLLM AI features)
- **NVIDIA GPU** (optional, for VLLM and AI image generation)

### Initial Setup

Clone and set up all projects at once:

```bash
# Run the automated setup script
./setup.sh
```

This will:
- ✅ Check for required dependencies (Node.js, npm, Python, Docker)
- ✅ Install npm dependencies for all projects
- ✅ Create `.env` files from `.env.example` templates
- ✅ Set up Python virtual environments (for VLLM)
- ✅ Optionally start Docker services

### Individual Project Setup

Each project can also be set up independently:

```bash
# Learn2Play
cd l2p && npm install

# VideoVault
cd VideoVault && npm install

# Payment
cd payment && npm install

# VLLM
cd vllm && npm install && npm run build
```

## 📚 Project Details

### Learn2Play (l2p)

**Real-time multiplayer quiz platform**

A full-stack application enabling live quiz competitions with Socket.io-powered real-time communication, comprehensive user management, and extensive testing infrastructure.

**Key Features:**
- Real-time multiplayer gameplay
- JWT authentication
- Player progression system
- Admin panel
- Comprehensive test suite (Unit, Integration, E2E)

**Quick Start:**
```bash
cd l2p
npm run deploy:dev     # Start Docker stack
npm run db:migrate     # Run migrations
npm run dev:frontend   # Start frontend (separate terminal)
```

👉 [View full L2P documentation](./l2p/README.md)

---

### VideoVault

**Advanced video management application**

A privacy-first video organizer using the File System Access API for local file operations, with optional PostgreSQL backend for shared libraries.

**Key Features:**
- Directory scanning with drag & drop import
- Advanced filtering (date, size, duration, categories)
- Bulk operations (rename, move, delete)
- Modern video player with shortcuts
- Virtualized rendering for large libraries

**Quick Start:**
```bash
cd VideoVault
npm run docker:dev     # Docker development with hot reload
# OR
npm run dev            # Local development (port 5100)
```

**Requirements:** Chromium-based browser (Chrome, Edge, Opera) for File System Access API

👉 [View full VideoVault documentation](./VideoVault/README.md)

---

### Payment

**Payment processing platform**

A Next.js application with Stripe integration, featuring secure authentication via NextAuth and Prisma for database operations.

**Key Features:**
- Stripe payment integration
- NextAuth v5 authentication
- Prisma ORM with PostgreSQL
- Server-side rendering
- E2E testing with Playwright

**Quick Start:**
```bash
cd payment
cp .env.example .env        # Configure environment
npx prisma migrate dev      # Run migrations
npm run dev                 # Start dev server (port 3004)
```

👉 [View full Payment documentation](./payment/README.md)

---

### VLLM

**AI-powered development tools via MCP**

A Model Context Protocol (MCP) server that provides AI inference, code review, repository analysis, and database management tools for Claude Desktop.

**Key Features:**
- vLLM integration for LLM inference
- AI-powered code review and analysis
- Repository quality scoring
- PostgreSQL database management
- Git history analysis
- Optional RAG stack and AI image generation

**Quick Start:**
```bash
cd vllm
bash deploy.sh             # Deploy vLLM container
npm install && npm run build
# Configure Claude Desktop with MCP server path
```

👉 [View full VLLM documentation](./vllm/README.md)

---

## 🛠 Common Commands

### Development

```bash
# Learn2Play
cd l2p && npm run dev:backend && npm run dev:frontend

# VideoVault
cd VideoVault && npm run dev

# Payment
cd payment && npm run dev

# VLLM
cd vllm && bash deploy.sh
```

### Testing

```bash
# Run tests for specific projects
cd l2p && npm run test:all
cd VideoVault && npm test
cd payment && npm test
```

### Docker

```bash
# Start Docker stacks
cd l2p && npm run deploy:dev
cd VideoVault && npm run docker:dev
cd payment && docker-compose up
```

### Building

```bash
# Production builds
cd l2p && npm run build:all
cd VideoVault && npm run build
cd payment && npm run build
cd vllm && npm run build
```

## 📁 Repository Structure

```
.
├── l2p/                    # Learn2Play multiplayer quiz platform
│   ├── frontend/          # React frontend
│   ├── backend/           # Express backend
│   ├── shared/            # Shared utilities
│   └── README.md
│
├── VideoVault/            # Video management application
│   ├── client/            # React client
│   ├── server/            # Express server
│   └── README.md
│
├── payment/               # Payment processing platform
│   ├── app/               # Next.js app directory
│   ├── prisma/            # Database schema
│   └── README.md
│
├── vllm/                  # AI development tools
│   ├── src/               # MCP server source
│   ├── rag/               # RAG implementation
│   ├── dashboard/         # Optional dashboard
│   └── README.md
│
├── setup.sh               # Automated setup script
├── CLAUDE.md              # AI development guidelines
└── README.md              # This file
```

## 🔧 Technology Stack Overview

### Frontend Technologies
- **React 18** (l2p, VideoVault)
- **Next.js 16** (payment)
- **TypeScript** (all projects)
- **Vite** (l2p, VideoVault)
- **Tailwind CSS** (all projects)

### Backend Technologies
- **Express** (l2p, VideoVault)
- **Next.js API Routes** (payment)
- **Socket.io** (l2p)
- **PostgreSQL** (all projects)
- **Drizzle ORM** (l2p, VideoVault)
- **Prisma** (payment)

### AI/ML Technologies
- **vLLM** for inference
- **Model Context Protocol (MCP)**
- **LlamaIndex** for RAG
- **Qdrant** vector database
- **Stable Diffusion Forge** (optional)

### Testing
- **Vitest** (VideoVault, payment)
- **Jest** (l2p)
- **Playwright** (all projects)
- **React Testing Library**

### DevOps
- **Docker & Docker Compose**
- **Nginx** (reverse proxy)
- **GitHub Actions** (if configured)

## 📊 Database Overview

Each project uses PostgreSQL but with different ORMs and schemas:

| Project | ORM | Default Port | Database Name |
|---------|-----|--------------|---------------|
| l2p | Drizzle | 5432 (dev), 5433 (test) | learn2play |
| VideoVault | Drizzle (optional) | 5432 | videovault |
| payment | Prisma | 5432 | payment |
| vllm | pg (direct) | 5432 | webui |

## 🔐 Environment Variables

Each project requires its own `.env` file. Always use the provided `.env.example` as a template:

```bash
# For each project
cd <project-directory>
cp .env.example .env
# Edit .env with your configuration
```

**Common variables across projects:**
- `DATABASE_URL`: PostgreSQL connection string
- `NODE_ENV`: Environment (development, production, test)
- `PORT`: Application port
- Project-specific secrets and API keys

**Important:** Use alphanumeric-only values for PostgreSQL credentials (no special characters).

## 🧪 Testing Infrastructure

### Learn2Play
- Unit tests with Jest (ES modules)
- Integration tests with test database
- E2E tests with Playwright
- Coverage tracking and reporting

### VideoVault
- Unit tests with Vitest
- Server E2E tests
- Playwright E2E tests (Docker)
- Optional MSW for mocking

### Payment
- Unit tests with Vitest
- E2E tests with Playwright
- React component testing

### VLLM
- Jest unit tests
- Tool integration testing

## 🐳 Docker Support

All projects include Docker support with compose files:

**Development:**
- Hot reload enabled
- Volume mounts for code
- Separate networks per project

**Production:**
- Optimized builds
- Multi-stage Dockerfiles
- Health checks
- Resource limits

## 📖 Documentation

- **CLAUDE.md**: Comprehensive development guide for AI assistants
- **Project READMEs**: Detailed documentation for each project
- **In-code documentation**: JSDoc comments and TypeScript types

## 🔄 Git Workflow

- Independent versioning per project
- Conventional commits recommended
- Large files excluded (models, node_modules, databases)
- No sensitive data in repository

## 🤝 Contributing

Each project can be developed independently:

1. Fork the repository
2. Create a feature branch
3. Make changes to your target project(s)
4. Run project-specific tests
5. Run type checking
6. Submit a pull request

### Pre-commit Checklist

```bash
# For the project you modified
cd <project>
npm run typecheck     # TypeScript validation
npm test              # Run tests
npm run lint          # Linting (if available)
```

## 🚨 Troubleshooting

### Port Conflicts

If you encounter port conflicts when running multiple projects:

```bash
# Check what's using a port
sudo lsof -i :5001

# Or modify the port in project's .env file
PORT=5002
```

### Database Connection Issues

```bash
# Check Docker containers
docker ps

# View container logs
docker logs <container-name>

# Restart PostgreSQL container
cd <project> && docker-compose restart postgres
```

### Module Resolution Errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Docker Issues

```bash
# Clean up Docker resources
docker system prune -f
docker volume prune -f

# Rebuild containers
cd <project>
docker-compose down -v
docker-compose up --build
```

## 📝 License

MIT License - Each project may have its own license file.

## 🔗 Useful Links

- [Learn2Play Documentation](./l2p/README.md)
- [VideoVault Documentation](./VideoVault/README.md)
- [Payment Documentation](./payment/README.md)
- [VLLM Documentation](./vllm/README.md)
- [CLAUDE.md - AI Development Guide](./CLAUDE.md)

## 💡 Quick Tips

1. **Use the setup script**: `./setup.sh` automates initial configuration
2. **Check project READMEs**: Each has specific requirements and commands
3. **Environment files**: Always copy from `.env.example`
4. **Docker first**: Use Docker for databases to avoid local setup
5. **Test environments**: l2p uses separate test database on port 5433
6. **Browser compatibility**: VideoVault requires Chromium for full features
7. **GPU optional**: VLLM works without GPU but performs better with one

## 📞 Support

For project-specific issues, refer to individual project README files. For general monorepo questions, check CLAUDE.md for detailed architectural guidance.

---

**Built with ❤️ by Patrick**
