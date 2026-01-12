const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Docker = require('dockerode');
const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const os = require('os');
const { Pool } = require('pg');

/**
 * ============================================================================
 * DEPLOYMENT PHILOSOPHY: SINGLE ENVIRONMENT PER SERVICE
 * ============================================================================
 * 
 * This dashboard manages all services in the infrastructure following a strict
 * "single environment per service" model:
 * 
 * RULES:
 * 1. Each service has EXACTLY ONE production environment
 * 2. Each service has EXACTLY ONE development environment (if applicable)
 * 3. No duplicate or overlapping environments are allowed
 * 4. All deployments follow the patterns defined in /projects/DEPLOYMENT.md
 * 
 * ENVIRONMENT TYPES:
 * - production: Live services accessible via *.korczewski.de
 * - development: Dev services for testing (Docker profiles or npm)
 * - infrastructure: Shared services (Traefik, PostgreSQL)
 * 
 * SERVICE CATEGORIES:
 * - Infrastructure: traefik, shared-postgres (production only)
 * - Core Services: auth, vllm-rag
 * - Applications: l2p, payment, videovault
 * - AI/ML: vllm, open-webui, qdrant, infinity
 * 
 * DEPLOYMENT PATHS:
 * - Docker Compose: Services use profiles (production/development)
 * - npm: Development services run locally with hot reload
 * - Hybrid: Some services use Docker for prod, npm for dev
 * 
 * See /projects/DEPLOYMENT.md for complete deployment guide
 * ============================================================================
 */

// Environment Configuration
const NODE_ENV = process.env.NODE_ENV || 'production';
const IS_DEVELOPMENT = NODE_ENV === 'development';
const IS_PRODUCTION = NODE_ENV === 'production';

const REGISTRY_PATH = path.join(__dirname, '..', '..', 'browser_control_registry.json');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: ["http://localhost:4242", "http://dashboard.korczewski.de", "https://dashboard.korczewski.de", "https://auth.korczewski.de", "https://*.korczewski.de"],
        credentials: true
    }
});
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password123';
const DB_URL = process.env.DATABASE_URL || 'postgresql://webui:webui@localhost:5438/webui';
const PROJECT_ROOT = process.env.PROJECT_ROOT || path.resolve(__dirname, '..');
const FORGE_PATH = process.env.FORGE_PATH || path.join(PROJECT_ROOT, 'ai-image-gen', 'forge');
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || null;
const dbPool = new Pool({
    connectionString: DB_URL,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    max: 5
});
const ALLOWED_ROLES = new Set(['admin', 'user', 'pending']);

console.log(`🚀 Dashboard starting in ${NODE_ENV.toUpperCase()} mode`);
console.log(`📊 Database: ${DB_URL.replace(/:[^:@]+@/, ':***@')}`);
if (IS_DEVELOPMENT) {
    console.log('🔥 Hot reload enabled via nodemon');
}

// Docker Compose Environment Configuration
const DOCKER_ENVIRONMENTS = {
    'l2p-production': {
        name: 'L2P Production',
        path: path.resolve(PROJECT_ROOT, '..', 'l2p'),
        composeFiles: ['docker-compose.yml'],
        profile: 'production',
        project: 'l2p',
        env: 'production',
        description: 'Learn2Play production stack (frontend, backend, redis)'
    },
    'l2p-development': {
        name: 'L2P Development',
        path: path.resolve(PROJECT_ROOT, '..', 'l2p'),
        composeFiles: ['docker-compose.yml'],
        profile: 'development',
        project: 'l2p',
        env: 'development',
        description: 'Learn2Play dev environment with hot reload'
    },
    'shared-infrastructure': {
        name: 'Shared Infrastructure',
        path: path.resolve(PROJECT_ROOT, '..', 'shared-infrastructure'),
        composeFiles: ['docker-compose.yml'],
        project: 'shared',
        env: 'infrastructure',
        description: 'Centralized PostgreSQL database'
    },
    'auth-service': {
        name: 'Auth Service',
        path: path.resolve(PROJECT_ROOT, '..', 'auth'),
        composeFiles: ['docker-compose.yml'],
        project: 'auth',
        env: 'production',
        description: 'Central authentication service'
    },
    'payment-production': {
        name: 'Payment Service',
        path: path.resolve(PROJECT_ROOT, '..', 'payment'),
        composeFiles: ['compose.yaml'],
        project: 'payment',
        env: 'production',
        description: 'Subscription and payment processing (Stripe)'
    },
    'videovault-production': {
        name: 'VideoVault Production',
        path: path.resolve(PROJECT_ROOT, '..', 'VideoVault'),
        composeFiles: ['docker-compose.yml'],
        service: 'videovault',
        project: 'videovault',
        env: 'production',
        description: 'Media management and transcription (production)'
    },
    'videovault-development': {
        name: 'VideoVault Development',
        path: path.resolve(PROJECT_ROOT, '..', 'VideoVault'),
        composeFiles: ['docker-compose.yml'],
        service: 'videovault-dev',
        project: 'videovault',
        env: 'development',
        description: 'Media management and transcription (dev)'
    },
    'traefik': {
        name: 'Traefik Reverse Proxy',
        path: path.resolve(PROJECT_ROOT, '..', 'reverse-proxy'),
        composeFiles: ['docker-compose.yml'],
        project: 'shared',
        env: 'infrastructure',
        description: 'Reverse proxy and SSL termination'
    },
    'vllm-rag': {
        name: 'vLLM RAG Stack',
        path: path.resolve(PROJECT_ROOT, 'rag'),
        composeFiles: ['docker-compose.yml'],
        project: 'vllm',
        env: 'production',
        description: 'AI inference and RAG pipeline (vLLM, Qdrant, Infinity, Open WebUI)'
    }
};

// npm Project Configuration (for local development servers)
const NPM_PROJECTS = {
    'l2p-dev': {
        name: 'L2P Dev (npm)',
        path: path.resolve(PROJECT_ROOT, '..', 'l2p'),
        script: 'dev',
        port: 3000,
        project: 'l2p',
        env: 'development',
        description: 'L2P development server (frontend + backend)'
    },
    'videovault-dev': {
        name: 'VideoVault Dev (npm)',
        path: path.resolve(PROJECT_ROOT, '..', 'VideoVault'),
        script: 'dev',
        port: 5100,
        project: 'videovault',
        env: 'development',
        description: 'VideoVault development server'
    },
    'payment-dev': {
        name: 'Payment Service Dev (npm)',
        path: path.resolve(PROJECT_ROOT, '..', 'payment'),
        script: 'dev',
        port: 3004,
        project: 'payment',
        env: 'development',
        description: 'Payment service development server'
    },
    'auth-dev': {
        name: 'Auth Service Dev (npm)',
        path: path.resolve(PROJECT_ROOT, '..', 'auth'),
        script: 'start',
        port: 5500,
        project: 'auth',
        env: 'development',
        description: 'Auth service (local process)'
    }
};

app.use(express.json());
app.use(cookieParser());
const sessionMiddleware = session({
    secret: 'vram-mastermind-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true if using HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
});

app.use(sessionMiddleware);
io.engine.use(sessionMiddleware);

app.use(cors({
    origin: ["http://localhost:4242", "http://dashboard.korczewski.de", "https://dashboard.korczewski.de", "https://auth.korczewski.de", "https://*.korczewski.de"],
    credentials: true
}));

// OAuth authentication helper
async function verifyOAuthToken(token) {
    if (!AUTH_SERVICE_URL) {
        return null;
    }

    try {
        const response = await fetch(`${AUTH_SERVICE_URL}/api/auth/verify`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        return data?.user || null;
    } catch (error) {
        console.error('OAuth verification error:', error);
        return null;
    }
}

// Extract token from request
function extractToken(req) {
    // Check Authorization header
    const authHeader = req.headers?.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }

    // Check cookies
    const cookieToken = req.cookies?.['accessToken'];
    if (cookieToken) {
        return cookieToken;
    }

    return null;
}

// Authentication middleware
const requireAuth = async (req, res, next) => {
    // Try OAuth authentication first
    const token = extractToken(req);
    if (token && AUTH_SERVICE_URL) {
        const user = await verifyOAuthToken(token);
        if (user) {
            req.user = user;
            req.session.user = user;
            req.session.authenticated = true;
            return next();
        }
    }

    // Fallback to session-based authentication
    if (req.session && req.session.authenticated) {
        return next();
    }

    // Allow access to login endpoints
    if (req.path === '/login.html' || req.path === '/api/login' || req.path === '/api/auth/callback') {
        return next();
    }

    // Reject API requests
    if (req.path.startsWith('/api/')) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Redirect to auth service if available, otherwise to login page
    if (AUTH_SERVICE_URL) {
        const redirectUrl = encodeURIComponent(`https://dashboard.korczewski.de${req.path}`);
        return res.redirect(`${AUTH_SERVICE_URL}/login?redirect=${redirectUrl}`);
    }

    return res.redirect('/login.html');
};

const serveDashboard = (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
};

app.get('/', requireAuth, serveDashboard);
app.get('/index.html', requireAuth, serveDashboard);

// Serve static assets (login page, styles, scripts)
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        req.session.authenticated = true;
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: 'Invalid password' });
    }
});

app.get('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.use(requireAuth);

let forgeProcess = null;

// Available models for vLLM
const AVAILABLE_MODELS = {
    vllm: [
        { id: 'Qwen/Qwen2.5-Coder-0.5B', name: 'Qwen 2.5 Coder 0.5B', vram: '1-2 GB', contextSize: 'Very Large' },
        { id: 'Qwen/Qwen2.5-Coder-1.5B', name: 'Qwen 2.5 Coder 1.5B', vram: '2-4 GB', contextSize: 'Large' },
        { id: 'Qwen/Qwen2.5-Coder-3B', name: 'Qwen 2.5 Coder 3B', vram: '4-6 GB', contextSize: 'Medium' },
        { id: 'Qwen/Qwen2.5-Coder-7B-Instruct-AWQ', name: 'Qwen 2.5 Coder 7B AWQ', vram: '8-12 GB', contextSize: 'Standard' }
    ]
};

// Selected models for services (persists in memory)
const selectedModels = {
    vllm: 'Qwen/Qwen2.5-Coder-1.5B'
};

const SERVICES = [
    {
        id: 'open-webui',
        name: 'Open WebUI (Portal)',
        containerName: 'open-webui-rag',
        url: 'https://chat.korczewski.de',
        model: 'Multi-Model Chat',
        description: 'Primary interface for RAG, chat, and interaction with all local models.',
        vramEstimate: 'Low (CPU)',
        type: 'docker',
        group: 'portal'
    },
    {
        id: 'vllm',
        name: 'vLLM (LLM)',
        containerName: 'vllm-rag',
        url: 'https://api.korczewski.de',
        model: 'Qwen/Qwen2.5-Coder-1.5B',
        description: 'High-throughput LLM serving engine compatible with OpenAI API.',
        vramEstimate: '2-4 GB',
        type: 'docker',
        group: 'core'
    },
    {
        id: 'forge',
        name: 'Forge (Image Gen)',
        url: 'https://forge.korczewski.de',
        model: 'FLUX.1 / SDXL',
        description: 'Advanced image generation interface with Stable Diffusion Forge.',
        vramEstimate: '12 GB+',
        type: 'process',
        path: FORGE_PATH,
        startCmd: './webui.sh',
        logPath: '/tmp/forge.log',
        group: 'creative'
    },
    {
        id: 'infinity',
        name: 'Infinity (Embeddings)',
        containerName: 'infinity-embeddings',
        url: 'https://embeddings.korczewski.de',
        model: 'BAAI/bge-m3',
        description: 'Fast embedding inference server for vector search.',
        vramEstimate: '2-4 GB',
        type: 'docker',
        group: 'core'
    },
    {
        id: 'qdrant',
        name: 'Qdrant (Vector DB)',
        containerName: 'qdrant-rag',
        url: 'https://qdrant.korczewski.de/dashboard',
        model: 'Vector Search',
        description: 'Vector database for storing and searching document embeddings.',
        vramEstimate: '1-2 GB',
        type: 'docker',
        group: 'data'
    },
    {
        id: 'postgres',
        name: 'PostgreSQL (WebUI DB)',
        containerName: 'postgres-rag',
        model: 'SQL Database',
        description: 'Relational database for Open WebUI user data and settings.',
        vramEstimate: '< 500 MB',
        type: 'docker',
        group: 'data'
    },
    {
        id: 'ingest',
        name: 'Ingest Engine',
        containerName: 'rag-ingest-engine',
        model: 'Document Processing',
        description: 'Automated document ingestion and vectorization service.',
        vramEstimate: 'Low (CPU/Shared)',
        type: 'docker',
        group: 'pipeline'
    },
    {
        id: 'auth',
        name: 'Auth Service',
        url: 'https://auth.korczewski.de',
        port: 5500,
        description: 'Central identity and access management service.',
        type: 'process',
        path: path.resolve(PROJECT_ROOT, '..', 'auth'),
        startCmd: 'npm start',
        logPath: path.resolve(PROJECT_ROOT, '..', 'auth', 'auth_prod.log'),
        group: 'core'
    },
    {
        id: 'l2p',
        name: 'Learn2Play',
        url: 'https://l2p.korczewski.de',
        port: 3001,
        description: 'AI-powered learning platform for gaming.',
        type: 'process',
        path: path.resolve(PROJECT_ROOT, '..', 'l2p'),
        startCmd: 'npm run dev',
        logPath: path.resolve(PROJECT_ROOT, '..', 'l2p', 'logs', 'dev.log'),
        group: 'business'
    },
    {
        id: 'payment',
        name: 'Payment Service',
        url: 'https://payment.korczewski.de',
        port: 3004,
        description: 'Subscription and payment processing service.',
        type: 'process',
        path: path.resolve(PROJECT_ROOT, '..', 'payment'),
        startCmd: 'npm run dev',
        logPath: path.resolve(PROJECT_ROOT, '..', 'payment', 'dev.log'),
        group: 'business'
    },
    {
        id: 'videovault',
        name: 'VideoVault',
        url: 'https://videovault.korczewski.de',
        port: 5100,
        description: 'AI-powered media management and transcription vault.',
        type: 'process',
        path: path.resolve(PROJECT_ROOT, '..', 'VideoVault'),
        startCmd: 'npm run dev',
        logPath: path.resolve(PROJECT_ROOT, '..', 'VideoVault', 'dev.log'),
        group: 'creative'
    },
    {
        id: 'shared-postgres',
        name: 'Shared PostgreSQL',
        containerName: 'shared-postgres',
        url: 'postgresql://localhost:5432',
        model: 'PostgreSQL 15',
        description: 'Centralized database for auth, l2p, payment, and videovault services.',
        vramEstimate: '< 2 GB',
        type: 'docker',
        group: 'infrastructure'
    },
    {
        id: 'traefik',
        name: 'Traefik Proxy',
        containerName: 'traefik',
        url: 'https://traefik.korczewski.de',
        model: 'Traefik v3',
        description: 'Reverse proxy and load balancer with automatic SSL/TLS certificates.',
        vramEstimate: '< 500 MB',
        type: 'docker',
        group: 'infrastructure'
    },
    {
        id: 'l2p-frontend-prod',
        name: 'L2P Frontend (Prod)',
        containerName: 'l2p-frontend-1',
        url: 'https://l2p.korczewski.de',
        model: 'Nginx + React',
        description: 'Production frontend for Learn2Play platform.',
        vramEstimate: '< 100 MB',
        type: 'docker',
        group: 'production'
    },
    {
        id: 'l2p-backend-prod',
        name: 'L2P Backend (Prod)',
        containerName: 'l2p-backend-1',
        url: 'https://l2p.korczewski.de/api',
        model: 'Node.js + Express',
        description: 'Production backend for Learn2Play platform.',
        vramEstimate: '< 500 MB',
        type: 'docker',
        group: 'production'
    },
    {
        id: 'l2p-postgres-prod',
        name: 'L2P PostgreSQL (Prod)',
        containerName: 'l2p-postgres-1',
        model: 'PostgreSQL 15',
        description: 'Production database for Learn2Play platform.',
        vramEstimate: '< 1 GB',
        type: 'docker',
        group: 'production'
    },
    {
        id: 'l2p-redis-prod',
        name: 'L2P Redis (Prod)',
        containerName: 'l2p-redis-1',
        model: 'Redis 7',
        description: 'Production session storage for Learn2Play platform.',
        vramEstimate: '< 200 MB',
        type: 'docker',
        group: 'production'
    },
    {
        id: 'vllm-dashboard',
        name: 'vLLM Dashboard',
        containerName: 'vllm-dashboard',
        url: 'https://dashboard.korczewski.de',
        model: 'Dashboard UI',
        description: 'Central control panel for all services.',
        vramEstimate: '< 200 MB',
        type: 'docker',
        group: 'infrastructure'
    }
];

// In-memory store for last errors
const lastErrors = {};
const browserTaskResults = {};
let activeBrowserTasks = new Set();

function getBrowserRegistry() {
    try {
        if (fs.existsSync(REGISTRY_PATH)) {
            return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
        }
    } catch (e) {
        console.error('Error reading browser registry:', e);
    }
    return { groups: {} };
}

// Helper to get VRAM info
async function getVramInfo() {
    return new Promise((resolve) => {
        exec('nvidia-smi --query-gpu=memory.total,memory.used --format=csv,noheader,nounits', (err, stdout) => {
            if (err) return resolve({ total: 0, used: 0 });
            const [total, used] = stdout.split(',').map(n => parseInt(n.trim()));
            resolve({ total, used });
        });
    });
}

// Helper to check if a process is running
async function isProcessRunning(service) {
    return new Promise((resolve) => {
        if (service.id === 'forge') {
            exec('ps aux | grep -v grep | grep "launch.py"', (err, stdout) => {
                resolve(!!stdout.trim());
            });
            return;
        }

        // For other services, we check for processes running in their specific path
        // This is a bit heuristic - we look for the startCmd or node processes in that path
        const searchPattern = service.path.split('/').pop();
        exec(`ps aux | grep -v grep | grep "${searchPattern}" | grep "node"`, (err, stdout) => {
            resolve(!!stdout.trim());
        });
    });
}

async function getServiceStatus() {
    const statuses = {};
    for (const service of SERVICES) {
        if (service.type === 'docker') {
            try {
                const container = docker.getContainer(service.containerName);
                const data = await container.inspect();
                statuses[service.id] = data.State.Running;
            } catch (e) {
                statuses[service.id] = false;
            }
        } else if (service.type === 'process') {
            statuses[service.id] = await isProcessRunning(service);
        }
    }
    return statuses;
}

let lastCpuSnapshot = os.cpus();

function getCpuUsage() {
    const current = os.cpus();
    let idleDiff = 0;
    let totalDiff = 0;

    current.forEach((cpu, index) => {
        const prev = lastCpuSnapshot[index];
        const prevTimes = prev.times;
        const currTimes = cpu.times;
        const prevTotal = Object.values(prevTimes).reduce((sum, time) => sum + time, 0);
        const currTotal = Object.values(currTimes).reduce((sum, time) => sum + time, 0);
        totalDiff += currTotal - prevTotal;
        idleDiff += currTimes.idle - prevTimes.idle;
    });

    lastCpuSnapshot = current;
    if (totalDiff === 0) return 0;
    const usage = 100 - (idleDiff / totalDiff) * 100;
    return Math.max(0, Math.min(100, Math.round(usage)));
}

function getDiskUsage() {
    return new Promise((resolve) => {
        exec('df -k /', (err, stdout) => {
            if (err) return resolve({ totalGB: 0, usedGB: 0, percent: 0 });
            const lines = stdout.trim().split('\n');
            if (lines.length < 2) return resolve({ totalGB: 0, usedGB: 0, percent: 0 });
            const parts = lines[1].split(/\s+/);
            const totalKB = parseInt(parts[1], 10) || 0;
            const usedKB = parseInt(parts[2], 10) || 0;
            const percent = parseInt((parts[4] || '').replace('%', ''), 10) || 0;
            const totalGB = Math.round((totalKB / (1024 * 1024)) * 10) / 10;
            const usedGB = Math.round((usedKB / (1024 * 1024)) * 10) / 10;
            resolve({ totalGB, usedGB, percent });
        });
    });
}

let lastDiskCheck = 0;
let cachedDisk = { totalGB: 0, usedGB: 0, percent: 0 };

async function getSystemStats() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const totalGB = Math.round((totalMem / (1024 * 1024 * 1024)) * 10) / 10;
    const usedGB = Math.round((usedMem / (1024 * 1024 * 1024)) * 10) / 10;
    const percent = totalMem ? Math.round((usedMem / totalMem) * 100) : 0;
    const now = Date.now();
    if (now - lastDiskCheck > 10000) {
        cachedDisk = await getDiskUsage();
        lastDiskCheck = now;
    }

    return {
        cpu: getCpuUsage(),
        memory: { totalGB, usedGB, percent },
        disk: cachedDisk
    };
}

let userSchemaCache = { timestamp: 0, columns: [] };

async function getUserSchema() {
    const now = Date.now();
    if (now - userSchemaCache.timestamp < 10000 && userSchemaCache.columns.length) {
        return userSchemaCache.columns;
    }
    const result = await dbPool.query(`
        SELECT column_name, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'user'
    `);
    userSchemaCache = {
        timestamp: now,
        columns: result.rows.map(row => ({
            name: row.column_name,
            isNullable: row.is_nullable === 'YES',
            hasDefault: row.column_default !== null
        }))
    };
    return userSchemaCache.columns;
}

function getUserSchemaMap(schema) {
    const map = new Map();
    schema.forEach(column => map.set(column.name, column));
    return map;
}

// Helper to discover all running Docker containers
async function discoverDockerContainers() {
    try {
        const containers = await docker.listContainers({ all: false });
        return containers.map(container => {
            const labels = container.Labels || {};
            const names = (container.Names || []).map(n => n.replace(/^\//, ''));
            const ports = (container.Ports || []).map(p =>
                p.PublicPort ? `${p.PublicPort}:${p.PrivatePort}` : `${p.PrivatePort}`
            ).join(', ');

            // Try to infer project from compose labels
            const composeProject = labels['com.docker.compose.project'] || 'unknown';
            const composeService = labels['com.docker.compose.service'] || names[0];

            // Try to infer environment
            let env = 'production';
            if (names[0].includes('-dev') || names[0].includes('development')) {
                env = 'development';
            } else if (names[0].includes('test')) {
                env = 'test';
            } else if (['traefik', 'shared-postgres'].includes(names[0])) {
                env = 'infrastructure';
            }

            // Map to project categories
            let project = 'unknown';
            if (composeProject.includes('l2p') || names[0].includes('l2p')) {
                project = 'l2p';
            } else if (composeProject.includes('videovault') || names[0].includes('videovault')) {
                project = 'videovault';
            } else if (composeProject.includes('auth') || names[0].includes('auth')) {
                project = 'auth';
            } else if (composeProject.includes('payment') || names[0].includes('payment')) {
                project = 'payment';
            } else if (names[0].includes('vllm') || names[0].includes('qdrant') || names[0].includes('infinity') || names[0].includes('webui')) {
                project = 'vllm';
            } else if (names[0].includes('postgres') || names[0].includes('traefik')) {
                project = 'shared';
            }

            return {
                id: container.Id.substring(0, 12),
                name: names[0],
                image: container.Image,
                state: container.State,
                status: container.Status,
                ports: ports,
                created: container.Created,
                composeProject: composeProject,
                composeService: composeService,
                project: project,
                env: env,
                labels: labels
            };
        });
    } catch (error) {
        console.error('Error discovering Docker containers:', error);
        return [];
    }
}

// Helper to detect running npm servers
async function detectNpmServers() {
    const results = [];

    for (const [id, config] of Object.entries(NPM_PROJECTS)) {
        const isRunning = await new Promise((resolve) => {
            // Check for node processes in the project directory
            const searchPattern = config.path.split('/').pop();
            exec(`ps aux | grep -v grep | grep "node" | grep "${searchPattern}"`, (err, stdout) => {
                resolve(!!stdout.trim());
            });
        });

        // Also check if port is in use
        const portInUse = config.port ? await new Promise((resolve) => {
            exec(`lsof -i :${config.port} -sTCP:LISTEN -t`, (err, stdout) => {
                resolve(!!stdout.trim());
            });
        }) : false;

        results.push({
            id: id,
            ...config,
            running: isRunning || portInUse,
            portInUse: portInUse
        });
    }

    return results;
}

// Helper to get docker-compose environment status
async function getEnvironmentStatus(envId, envConfig) {
    const composeCmd = envConfig.composeFiles.map(f => `-f ${f}`).join(' ');
    const profileArg = envConfig.profile ? `--profile ${envConfig.profile}` : '';

    return new Promise((resolve) => {
        exec(
            `docker compose ${composeCmd} ${profileArg} ps --format json`,
            { cwd: envConfig.path, timeout: 5000 },
            (err, stdout, stderr) => {
                if (err) {
                    resolve({ running: false, total: 0, runningCount: 0, services: [] });
                    return;
                }
                try {
                    const lines = stdout.trim().split('\n').filter(l => l.trim());
                    const services = lines.map(line => {
                        try { return JSON.parse(line); } catch { return null; }
                    }).filter(Boolean);

                    const runningCount = services.filter(s => s.State === 'running').length;
                    resolve({
                        running: runningCount > 0,
                        total: services.length,
                        runningCount: runningCount,
                        services: services.map(s => ({
                            name: s.Service,
                            state: s.State,
                            status: s.Status
                        }))
                    });
                } catch {
                    resolve({ running: false, total: 0, runningCount: 0, services: [] });
                }
            }
        );
    });
}

function getServiceLogs(service, lines) {
    return new Promise((resolve) => {
        if (!service) return resolve('Service not found.');
        const tail = Number.isInteger(lines) ? lines : 120;
        if (service.type === 'docker') {
            exec(`docker logs --tail ${tail} ${service.containerName}`, (err, stdout, stderr) => {
                if (err) return resolve(stderr || err.message || 'Unable to fetch logs.');
                resolve(stdout || stderr || 'No logs available.');
            });
            return;
        }
        if (service.type === 'process') {
            const logPath = service.logPath || '/tmp/forge.log';
            exec(`tail -n ${tail} ${logPath}`, (err, stdout, stderr) => {
                if (err) return resolve(stderr || err.message || 'No logs available.');
                resolve(stdout || stderr || 'No logs available.');
            });
            return;
        }
        resolve('Logs are not available for this service type.');
    });
}

async function controlService(serviceId, action) {
    const service = SERVICES.find(s => s.id === serviceId);
    if (!service) return { success: false, error: 'Service not found' };

    try {
        if (action === 'stop' || action === 'restart') {
            if (service.type === 'docker') {
                const container = docker.getContainer(service.containerName);
                await container.stop().catch(e => {
                    if (e.statusCode !== 304) throw e; // 304 means already stopped
                });

                // For vLLM with model selection, remove the container to allow recreation with new model
                if (serviceId === 'vllm' && selectedModels[serviceId]) {
                    await container.remove().catch(e => {
                        console.log('Container removal not needed or failed:', e.message);
                    });
                }
            } else {
                await new Promise((resolve) => {
                    if (service.id === 'forge') {
                        exec('pkill -9 -f "launch.py"', (err) => resolve());
                    } else {
                        // Kill node processes running in the service path
                        const searchPattern = service.path.split('/').pop();
                        exec(`pkill -9 -f "${searchPattern}"`, (err) => resolve());
                    }
                });
            }
        }

        if (action === 'start' || action === 'restart') {
            if (service.type === 'docker') {
                // Special handling for vLLM with model selection
                if (serviceId === 'vllm' && selectedModels[serviceId]) {
                    await startVllmWithModel(selectedModels[serviceId]);
                } else {
                    const container = docker.getContainer(service.containerName);
                    await container.start();
                }
            } else {
                // Start generic process
                const logFile = service.logPath || `/tmp/${service.id}.log`;
                const logDir = path.dirname(logFile);
                if (!fs.existsSync(logDir)) {
                    fs.mkdirSync(logDir, { recursive: true });
                }

                const out = fs.openSync(logFile, 'a');
                const err = fs.openSync(logFile, 'a');

                let cmd, args;
                if (service.id === 'forge') {
                    cmd = './webui.sh';
                    args = ['--listen', '--port', '7863', '--cuda-malloc', '--always-gpu', '--share', '--enable-insecure-extension-access'];
                } else {
                    const parts = service.startCmd.split(' ');
                    cmd = parts[0];
                    args = parts.slice(1);
                }

                // Determine port to pass to the process
                let envPort = service.port;
                if (!envPort && service.url) {
                    const portMatch = service.url.match(/:(\d+)/);
                    if (portMatch) {
                        envPort = parseInt(portMatch[1], 10);
                    }
                }

                const child = spawn(cmd, args, {
                    cwd: service.path,
                    detached: true,
                    stdio: ['ignore', out, err],
                    env: { ...process.env, PORT: envPort ? envPort.toString() : undefined }
                });
                child.unref();
            }
        }

        lastErrors[serviceId] = null;
        return { success: true };
    } catch (e) {
        const errorMsg = e.message || String(e);
        console.error(`Error ${action}ing ${serviceId}:`, errorMsg);
        lastErrors[serviceId] = errorMsg;
        return { success: false, error: errorMsg };
    }
}

// Helper function to start vLLM with a specific model
async function startVllmWithModel(modelId) {
    return new Promise((resolve, reject) => {
        // Run the deploy.sh script with the selected model
        const deployPath = path.join(__dirname, '..', 'scripts', 'deploy.sh');
        const env = { ...process.env, MODEL: modelId };

        exec(`bash ${deployPath}`, { env, cwd: path.join(__dirname, '..') }, (err, stdout, stderr) => {
            if (err) {
                console.error('vLLM deployment error:', stderr);
                return reject(new Error(stderr || err.message));
            }
            console.log('vLLM deployment output:', stdout);
            resolve();
        });
    });
}

// Socket communication
io.on('connection', async (socket) => {
    const session = socket.request.session;

    // Try OAuth authentication from handshake
    let authenticated = false;
    const token = socket.handshake.auth?.token || socket.handshake.headers?.cookie?.match(/accessToken=([^;]+)/)?.[1];

    if (token && AUTH_SERVICE_URL) {
        const user = await verifyOAuthToken(token);
        if (user) {
            authenticated = true;
            socket.user = user;
            console.log('OAuth authenticated client connected:', user.username);
        }
    }

    // Fallback to session-based authentication
    if (!authenticated && session && session.authenticated) {
        authenticated = true;
        console.log('Session authenticated client connected');
    }

    if (!authenticated) {
        console.log('Unauthorized socket connection attempt');
        socket.disconnect();
        return;
    }

    const sendUpdate = async () => {
        const vram = await getVramInfo();
        const statuses = await getServiceStatus();
        const system = await getSystemStats();
        const running = Object.values(statuses).filter(Boolean).length;

        // Get Docker environment status summary
        const envStatus = {};
        for (const [id, env] of Object.entries(DOCKER_ENVIRONMENTS)) {
            const status = await getEnvironmentStatus(id, env);
            envStatus[id] = status;
        }

        // Get all running Docker containers
        const containers = await discoverDockerContainers();

        // Get npm server status
        const npmServers = await detectNpmServers();

        socket.emit('status_update', {
            vram,
            statuses,
            errors: lastErrors,
            system,
            environments: envStatus,
            containers: containers,
            npmServers: npmServers,
            summary: { running, total: SERVICES.length },
            config: {
                nodeEnv: NODE_ENV,
                isDevelopment: IS_DEVELOPMENT,
                isProduction: IS_PRODUCTION
            }
        });
    };

    const interval = setInterval(sendUpdate, 2000);
    sendUpdate();

    socket.on('control_service', async (data) => {
        const { serviceId, action } = data;
        await controlService(serviceId, action);
        sendUpdate();
    });

    socket.on('clear_error', (serviceId) => {
        lastErrors[serviceId] = null;
        sendUpdate();
    });

    socket.on('disconnect', () => {
        clearInterval(interval);
    });
});

app.get('/api/services', (req, res) => {
    res.json(SERVICES);
});

// API: Get current environment info (for dashboard header badges)
app.get('/api/environment-info', (req, res) => {
    res.json({
        environment: NODE_ENV,
        hotReload: IS_DEVELOPMENT
    });
});

// New API: Get all running Docker containers
app.get('/api/containers', async (req, res) => {
    try {
        const containers = await discoverDockerContainers();
        res.json({ containers });
    } catch (error) {
        console.error('Error fetching containers:', error);
        res.status(500).json({ error: 'Failed to fetch containers' });
    }
});

// New API: Get all docker-compose environments with their status
app.get('/api/environments', async (req, res) => {
    try {
        const environments = {};
        for (const [id, config] of Object.entries(DOCKER_ENVIRONMENTS)) {
            const status = await getEnvironmentStatus(id, config);
            environments[id] = {
                ...config,
                ...status
            };
        }
        res.json({ environments });
    } catch (error) {
        console.error('Error fetching environments:', error);
        res.status(500).json({ error: 'Failed to fetch environments' });
    }
});

// New API: Control docker-compose environment (start/stop/restart)
app.post('/api/environments/:id/:action', async (req, res) => {
    const { id, action } = req.params;
    const envConfig = DOCKER_ENVIRONMENTS[id];

    if (!envConfig) {
        return res.status(404).json({ success: false, message: 'Environment not found' });
    }

    if (!['start', 'stop', 'restart'].includes(action)) {
        return res.status(400).json({ success: false, message: 'Invalid action' });
    }

    try {
        const composeCmd = envConfig.composeFiles.map(f => `-f ${f}`).join(' ');
        const profileArg = envConfig.profile ? `--profile ${envConfig.profile}` : '';
        const serviceArg = envConfig.service ? envConfig.service : '';

        let cmd;
        if (action === 'start') {
            cmd = `docker compose ${composeCmd} ${profileArg} up -d ${serviceArg}`;
        } else if (action === 'stop') {
            cmd = `docker compose ${composeCmd} ${profileArg} down ${serviceArg}`;
        } else if (action === 'restart') {
            cmd = `docker compose ${composeCmd} ${profileArg} restart ${serviceArg}`;
        }

        const result = await new Promise((resolve, reject) => {
            exec(cmd, { cwd: envConfig.path, timeout: 60000 }, (err, stdout, stderr) => {
                if (err) {
                    reject(new Error(stderr || err.message));
                } else {
                    resolve({ stdout, stderr });
                }
            });
        });

        res.json({ success: true, output: result.stdout, id, action });
    } catch (error) {
        console.error(`Error ${action}ing environment ${id}:`, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// New API: Get all npm servers with their running status
app.get('/api/npm-servers', async (req, res) => {
    try {
        const servers = await detectNpmServers();
        res.json({ servers });
    } catch (error) {
        console.error('Error detecting npm servers:', error);
        res.status(500).json({ error: 'Failed to detect npm servers' });
    }
});

// New API: Control npm server (start/stop)
app.post('/api/npm-servers/:id/:action', async (req, res) => {
    const { id, action } = req.params;
    const npmConfig = NPM_PROJECTS[id];

    if (!npmConfig) {
        return res.status(404).json({ success: false, message: 'npm project not found' });
    }

    if (!['start', 'stop'].includes(action)) {
        return res.status(400).json({ success: false, message: 'Invalid action. Use start or stop' });
    }

    try {
        if (action === 'stop') {
            // Kill npm processes in the project directory
            const searchPattern = npmConfig.path.split('/').pop();
            await new Promise((resolve) => {
                exec(`pkill -9 -f "${searchPattern}"`, (err) => resolve());
            });
            res.json({ success: true, message: `Stopped ${npmConfig.name}` });
        } else if (action === 'start') {
            // Start npm server
            const logFile = path.join(npmConfig.path, `${id}.log`);
            const out = fs.openSync(logFile, 'a');
            const err = fs.openSync(logFile, 'a');

            const child = spawn('npm', ['run', npmConfig.script], {
                cwd: npmConfig.path,
                detached: true,
                stdio: ['ignore', out, err],
                env: { ...process.env, PORT: npmConfig.port ? npmConfig.port.toString() : undefined }
            });
            child.unref();

            res.json({ success: true, message: `Started ${npmConfig.name}`, pid: child.pid });
        }
    } catch (error) {
        console.error(`Error ${action}ing npm server ${id}:`, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get available models for a service
app.get('/api/models/:serviceId', (req, res) => {
    const { serviceId } = req.params;
    const models = AVAILABLE_MODELS[serviceId] || [];
    res.json({ models });
});

// Get currently selected model for a service
app.get('/api/models/:serviceId/selected', (req, res) => {
    const { serviceId } = req.params;
    const selected = selectedModels[serviceId] || null;
    res.json({ selected });
});

// Set selected model for a service
app.post('/api/models/:serviceId/select', (req, res) => {
    const { serviceId } = req.params;
    const { modelId } = req.body;

    if (!AVAILABLE_MODELS[serviceId]) {
        return res.status(400).json({ success: false, message: 'Service does not support model selection' });
    }

    const modelExists = AVAILABLE_MODELS[serviceId].some(m => m.id === modelId);
    if (!modelExists) {
        return res.status(400).json({ success: false, message: 'Invalid model ID' });
    }

    selectedModels[serviceId] = modelId;

    // Update the service definition to reflect the new model
    const service = SERVICES.find(s => s.id === serviceId);
    if (service) {
        service.model = modelId;
        const modelInfo = AVAILABLE_MODELS[serviceId].find(m => m.id === modelId);
        if (modelInfo) {
            service.vramEstimate = modelInfo.vram;
        }
    }

    res.json({ success: true, selected: modelId });
});

app.get('/api/services/:id/logs', async (req, res) => {
    const service = SERVICES.find(s => s.id === req.params.id);
    const logs = await getServiceLogs(service, parseInt(req.query.tail || '120', 10));
    res.json({ logs });
});

app.get('/api/users', async (req, res) => {
    try {
        const result = await dbPool.query(`
            SELECT id, email, name, role, last_active_at, created_at
            FROM "user"
            ORDER BY created_at DESC
        `);
        res.json({ users: result.rows });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('relation "user" does not exist')) {
            return res.json({ users: [], warning: 'User table is not available yet.' });
        }
        res.status(500).json({ users: [], error: 'Unable to load users.' });
    }
});

app.post('/api/users', async (req, res) => {
    const { email, name, role } = req.body;
    if (!email) {
        return res.status(400).json({ success: false, message: 'Email is required.' });
    }
    const normalizedRole = ALLOWED_ROLES.has(role) ? role : 'user';

    try {
        const schema = await getUserSchema();
        if (!schema.length) {
            return res.status(500).json({ success: false, message: 'User schema not available.' });
        }
        const schemaMap = getUserSchemaMap(schema);
        if (!schemaMap.has('email')) {
            return res.status(500).json({ success: false, message: 'Email column missing.' });
        }

        const insertColumns = [];
        const values = [];
        const addColumn = (columnName, value) => {
            if (!schemaMap.has(columnName)) return;
            insertColumns.push(columnName);
            values.push(value);
        };

        const nameColumn = schemaMap.get('name');
        if (nameColumn && !nameColumn.isNullable && !nameColumn.hasDefault && !name) {
            return res.status(400).json({ success: false, message: 'Name is required.' });
        }

        addColumn('email', email);
        if (name) {
            addColumn('name', name);
        }
        addColumn('role', normalizedRole);
        addColumn('created_at', new Date());
        addColumn('updated_at', new Date());
        addColumn('is_active', true);
        addColumn('disabled', false);

        const requiredMissing = schema
            .filter(column => !column.isNullable && !column.hasDefault)
            .map(column => column.name)
            .filter(columnName => !insertColumns.includes(columnName));

        if (requiredMissing.length) {
            return res.status(400).json({
                success: false,
                message: `Missing required fields: ${requiredMissing.join(', ')}.`
            });
        }

        const columnsSql = insertColumns.map(column => `"${column}"`).join(', ');
        const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
        const result = await dbPool.query(
            `INSERT INTO "user" (${columnsSql}) VALUES (${placeholders}) RETURNING id, email, name, role, last_active_at, created_at`,
            values
        );

        res.json({ success: true, user: result.rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Unable to create user.' });
    }
});

app.patch('/api/users/:id/role', async (req, res) => {
    const { role } = req.body;
    const userId = parseInt(req.params.id, 10);
    if (!ALLOWED_ROLES.has(role)) {
        return res.status(400).json({ success: false, message: 'Invalid role.' });
    }
    if (Number.isNaN(userId)) {
        return res.status(400).json({ success: false, message: 'Invalid user id.' });
    }

    try {
        const result = await dbPool.query(
            'UPDATE "user" SET role = $1 WHERE id = $2 RETURNING id, email, name, role, last_active_at, created_at',
            [role, userId]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
        res.json({ success: true, user: result.rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Unable to update user.' });
    }
});

app.post('/api/users/:id/reset-password', async (req, res) => {
    const userId = parseInt(req.params.id, 10);
    if (Number.isNaN(userId)) {
        return res.status(400).json({ success: false, message: 'Invalid user id.' });
    }

    try {
        const schema = await getUserSchema();
        const schemaMap = getUserSchemaMap(schema);
        const candidates = ['password', 'hashed_password', 'password_hash', 'password_digest'];
        const updates = [];
        const values = [];
        let index = 1;

        candidates.forEach(columnName => {
            const column = schemaMap.get(columnName);
            if (!column) return;
            if (column.isNullable) {
                updates.push(`"${columnName}" = NULL`);
                return;
            }
            if (column.hasDefault) {
                updates.push(`"${columnName}" = DEFAULT`);
                return;
            }
        });

        const lastActive = schemaMap.get('last_active_at');
        if (lastActive && lastActive.isNullable) {
            updates.push('"last_active_at" = NULL');
        }
        if (schemaMap.has('updated_at')) {
            updates.push(`"updated_at" = $${index}`);
            values.push(new Date());
            index += 1;
        }

        if (!updates.length) {
            return res.status(400).json({ success: false, message: 'Password reset not supported for this schema.' });
        }

        values.push(userId);
        const result = await dbPool.query(
            `UPDATE "user" SET ${updates.join(', ')} WHERE id = $${index} RETURNING id`,
            values
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
        res.json({ success: true, message: 'Password reset applied. User must re-authenticate.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Unable to reset password.' });
    }
});

app.delete('/api/users/:id', async (req, res) => {
    const userId = parseInt(req.params.id, 10);
    if (Number.isNaN(userId)) {
        return res.status(400).json({ success: false, message: 'Invalid user id.' });
    }

    try {
        const result = await dbPool.query('DELETE FROM "user" WHERE id = $1', [userId]);
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Unable to delete user.' });
    }
});

// Browser Control API
app.get('/api/browser/groups', (req, res) => {
    const registry = getBrowserRegistry();
    res.json(registry.groups);
});

app.get('/api/browser/results', (req, res) => {
    res.json(browserTaskResults);
});

app.post('/api/browser/run/:groupId', async (req, res) => {
    const { groupId } = req.params;
    const registry = getBrowserRegistry();
    const group = registry.groups[groupId];

    if (!group) {
        return res.status(404).json({ success: false, error: 'Group not found' });
    }

    if (activeBrowserTasks.has(groupId)) {
        return res.status(409).json({ success: false, error: 'Task group already running' });
    }

    activeBrowserTasks.add(groupId);
    browserTaskResults[groupId] = { status: 'running', startTime: new Date(), tasks: [] };

    // Emit start event
    io.emit('browser_task_start', { groupId });

    // Background execution with real runner
    (async () => {
        const runnerPath = path.join(PROJECT_ROOT, '..', 'browser-control', 'runner.js');
        const runnerDir = path.dirname(runnerPath);

        const child = spawn('node', [runnerPath, groupId], { cwd: runnerDir });

        child.stdout.on('data', (data) => {
            const lines = data.toString().split('\n');
            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const msg = JSON.parse(line);
                    if (msg.type === 'task_start') {
                        const taskResult = { name: msg.name, status: 'running' };
                        browserTaskResults[groupId].tasks.push(taskResult);
                        io.emit('browser_task_update', { groupId, taskName: msg.name, status: 'running' });
                    } else if (msg.type === 'task_success') {
                        const task = browserTaskResults[groupId].tasks.find(t => t.name === msg.name);
                        if (task) {
                            task.status = 'success';
                            task.detail = msg.detail;
                        }
                        io.emit('browser_task_update', { groupId, taskName: msg.name, status: 'success', detail: msg.detail });
                    } else if (msg.type === 'task_error') {
                        const task = browserTaskResults[groupId].tasks.find(t => t.name === msg.name);
                        if (task) {
                            task.status = 'error';
                            task.error = msg.error;
                        }
                        io.emit('browser_task_update', { groupId, taskName: msg.name, status: 'error', error: msg.error });
                    }
                } catch (e) {
                    // console.log('Runner non-json output:', line);
                }
            }
        });

        child.stderr.on('data', (data) => {
            console.error(`Runner Error [${groupId}]:`, data.toString());
        });

        child.on('close', (code) => {
            browserTaskResults[groupId].status = code === 0 ? 'completed' : 'error';
            browserTaskResults[groupId].endTime = new Date();
            activeBrowserTasks.delete(groupId);
            io.emit('browser_task_complete', { groupId, result: browserTaskResults[groupId] });
        });
    })();

    res.json({ success: true, message: 'Task group started' });
});

//  Get status of all docker compose environments
app.get('/api/docker/environments', async (req, res) => {
    const environments = {};

    for (const [id, env] of Object.entries(DOCKER_ENVIRONMENTS)) {
        const composeCmd = env.composeFiles
            .map(f => `-f ${f}`)
            .join(' ');

        const statusCheck = await new Promise((resolve) => {
            exec(
                `docker compose ${composeCmd} ps --format json`,
                { cwd: env.path },
                (err, stdout, stderr) => {
                    if (err) {
                        resolve({ running: false, services: [], error: stderr || err.message });
                        return;
                    }

                    try {
                        // Parse docker compose ps output (one JSON object per line)
                        const lines = stdout.trim().split('\n').filter(l => l.trim());
                        const services = lines.map(line => {
                            try {
                                return JSON.parse(line);
                            } catch {
                                return null;
                            }
                        }).filter(Boolean);

                        const runningCount = services.filter(s => s.State === 'running').length;

                        resolve({
                            running: runningCount > 0,
                            total: services.length,
                            runningCount,
                            services: services.map(s => ({
                                name: s.Name,
                                state: s.State,
                                status: s.Status
                            }))
                        });
                    } catch (e) {
                        resolve({ running: false, services: [], error: 'Failed to parse status' });
                    }
                }
            );
        });

        environments[id] = {
            ...env,
            ...statusCheck
        };
    }

    res.json({ environments });
});

// Control docker compose environments (start/stop/restart)
app.post('/api/docker/environments/:envId/:action', async (req, res) => {
    const { envId, action } = req.params;
    const env = DOCKER_ENVIRONMENTS[envId];

    if (!env) {
        return res.status(404).json({ success: false, error: 'Environment not found' });
    }

    if (!['start', 'stop', 'restart', 'down'].includes(action)) {
        return res.status(400).json({ success: false, error: 'Invalid action' });
    }

    const composeCmd = env.composeFiles
        .map(f => `-f ${f}`)
        .join(' ');

    const command = action === 'start'
        ? `docker compose ${composeCmd} up -d`
        : action === 'down'
            ? `docker compose ${composeCmd} down`
            : `docker compose ${composeCmd} ${action}`;

    const result = await new Promise((resolve) => {
        exec(command, { cwd: env.path }, (err, stdout, stderr) => {
            if (err) {
                resolve({ success: false, error: stderr || err.message, output: stdout });
            } else {
                resolve({ success: true, output: stdout || stderr });
            }
        });
    });

    res.json(result);
});

const PORT = process.env.DASHBOARD_PORT || 4242;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`vLLM Mastermind Dashboard running on http://0.0.0.0:${PORT}`);
});
