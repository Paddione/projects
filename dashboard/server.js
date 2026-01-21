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

// K3s Proxy Service (replaces @kubernetes/client-node)
const { K3sProxyService } = require('./services/k3s-proxy-service');
const { createK8sRoutes } = require('./routes/k8s-routes');

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
 * - Core Services: auth
 * - Applications: l2p, payment, videovault
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

// Control mode: 'docker' or 'kubernetes'
const CONTROL_MODE = process.env.CONTROL_MODE || 'docker';
const IS_KUBERNETES_MODE = CONTROL_MODE === 'kubernetes';

// K3s Proxy Service setup (replaces @kubernetes/client-node)
const K8S_PROXY_URL = process.env.K8S_PROXY_URL || 'http://127.0.0.1:8001';
const K8S_NAMESPACE_INFRA = process.env.KUBERNETES_NAMESPACE_INFRA || 'korczewski-infra';
const K8S_NAMESPACE_SERVICES = process.env.KUBERNETES_NAMESPACE_SERVICES || 'korczewski-services';
const K8S_NAMESPACES = [K8S_NAMESPACE_INFRA, K8S_NAMESPACE_SERVICES];

let k3sProxy = null;

if (IS_KUBERNETES_MODE) {
    k3sProxy = new K3sProxyService(K8S_PROXY_URL, K8S_NAMESPACES);
    console.log(`K3s Proxy Service initialized with base URL: ${K8S_PROXY_URL}`);
    console.log(`Monitoring namespaces: ${K8S_NAMESPACES.join(', ')}`);
}

const DB_URL = process.env.DATABASE_URL || 'postgresql://webui:webui@localhost:5438/webui';
const PROJECT_ROOT = process.env.PROJECT_ROOT || path.resolve(__dirname, '..');
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

// Authentication middleware - relies on Traefik ForwardAuth headers
const requireAuth = async (req, res, next) => {
    // In Kubernetes mode with ForwardAuth, Traefik injects auth headers
    // If these headers are present, the user is authenticated
    const authUser = req.headers['x-auth-user'];
    const authEmail = req.headers['x-auth-email'];
    const authRole = req.headers['x-auth-role'];
    const authUserId = req.headers['x-auth-user-id'];

    if (authUser && authEmail && authRole) {
        // User authenticated by Traefik ForwardAuth
        req.user = {
            username: authUser,
            email: authEmail,
            role: authRole,
            userId: authUserId ? parseInt(authUserId) : null
        };
        req.session.user = req.user;
        req.session.authenticated = true;
        return next();
    }

    // For development/Docker mode, try OAuth token authentication
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

    // Fallback to session-based authentication (for development)
    if (req.session && req.session.authenticated) {
        return next();
    }

    // Reject API requests
    if (req.path.startsWith('/api/')) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // In production with ForwardAuth, this should never be reached
    // Redirect to auth service
    if (AUTH_SERVICE_URL) {
        const redirectUrl = encodeURIComponent(`https://dashboard.korczewski.de${req.path}`);
        return res.redirect(`${AUTH_SERVICE_URL}/login?redirect=${redirectUrl}`);
    }

    return res.status(401).json({ success: false, message: 'Authentication required' });
};

const serveDashboard = (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
};

// Health endpoint (no auth required - for k8s probes)
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        mode: IS_KUBERNETES_MODE ? 'kubernetes' : 'docker',
        timestamp: new Date().toISOString()
    });
});

app.get('/', requireAuth, serveDashboard);
app.get('/index.html', requireAuth, serveDashboard);

// Serve static assets
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// Logout endpoint - clears session
app.get('/api/logout', (req, res) => {
    req.session.destroy();
    // Redirect to auth service logout
    if (AUTH_SERVICE_URL) {
        return res.redirect(`${AUTH_SERVICE_URL}/logout`);
    }
    res.json({ success: true });
});

app.use(requireAuth);



const SERVICES = [
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

// =============================================================================
// KUBERNETES HELPERS (using K3s Proxy Service)
// =============================================================================

// Kubernetes service definitions (maps to k8s deployments)
const K8S_SERVICES = [
    {
        id: 'auth',
        name: 'Auth Service',
        namespace: K8S_NAMESPACE_SERVICES,
        deployment: 'auth',
        url: 'https://auth.korczewski.de',
        description: 'Centralized authentication service with JWT and OAuth.',
        group: 'core'
    },
    {
        id: 'l2p-frontend',
        name: 'L2P Frontend',
        namespace: K8S_NAMESPACE_SERVICES,
        deployment: 'l2p-frontend',
        url: 'https://l2p.korczewski.de',
        description: 'Learn2Play multiplayer quiz frontend.',
        group: 'business'
    },
    {
        id: 'l2p-backend',
        name: 'L2P Backend',
        namespace: K8S_NAMESPACE_SERVICES,
        deployment: 'l2p-backend',
        url: 'https://l2p.korczewski.de/api',
        description: 'Learn2Play backend with Socket.io.',
        group: 'business'
    },
    {
        id: 'payment',
        name: 'Payment Service',
        namespace: K8S_NAMESPACE_SERVICES,
        deployment: 'payment',
        url: 'https://payment.korczewski.de',
        description: 'Stripe payment processing with Next.js.',
        group: 'business'
    },
    {
        id: 'videovault',
        name: 'VideoVault',
        namespace: K8S_NAMESPACE_SERVICES,
        deployment: 'videovault',
        url: 'https://videovault.korczewski.de',
        description: 'Client-first video management platform.',
        group: 'creative'
    },
    {
        id: 'postgres',
        name: 'PostgreSQL',
        namespace: K8S_NAMESPACE_INFRA,
        deployment: 'postgres',
        statefulset: true,
        description: 'Shared PostgreSQL database for all services.',
        group: 'infrastructure'
    },
    {
        id: 'traefik',
        name: 'Traefik Proxy',
        namespace: K8S_NAMESPACE_INFRA,
        deployment: 'traefik',
        url: 'https://traefik.korczewski.de',
        description: 'Reverse proxy and TLS termination.',
        group: 'infrastructure'
    },
    {
        id: 'dashboard',
        name: 'Dashboard',
        namespace: K8S_NAMESPACE_INFRA,
        deployment: 'dashboard',
        url: 'https://dashboard.korczewski.de',
        description: 'Kubernetes cluster control center.',
        group: 'infrastructure'
    }
];

// Discover all pods across managed namespaces (using K3s Proxy)
async function discoverK8sPods() {
    if (!k3sProxy) return [];
    return await k3sProxy.getPods();
}

// Get all deployments with their status (using K3s Proxy)
async function discoverK8sDeployments() {
    if (!k3sProxy) return {};
    return await k3sProxy.getDeployments();
}

// Get service status for all k8s services
async function getK8sServiceStatus() {
    if (!k3sProxy) return {};

    const statuses = {};
    const deployments = await discoverK8sDeployments();

    for (const service of K8S_SERVICES) {
        const key = `${service.namespace}/${service.deployment}`;
        const deployment = deployments[key];

        if (deployment) {
            statuses[service.id] = deployment.running;
        } else {
            statuses[service.id] = false;
        }
    }

    return statuses;
}

// Control a Kubernetes deployment (scale, restart) using K3s Proxy
async function controlK8sDeployment(serviceId, action) {
    if (!k3sProxy) return { success: false, error: 'K3s Proxy not available' };

    const service = K8S_SERVICES.find(s => s.id === serviceId);
    if (!service) return { success: false, error: 'Service not found' };

    return await k3sProxy.controlDeployment(service.namespace, service.deployment, action);
}

// Get logs from a Kubernetes pod using K3s Proxy
async function getK8sPodLogs(serviceId, lines = 120) {
    if (!k3sProxy) return 'K3s Proxy not available';

    const service = K8S_SERVICES.find(s => s.id === serviceId);
    if (!service) return 'Service not found';

    return await k3sProxy.getServiceLogs(service.deployment, lines);
}

// Get cluster info using K3s Proxy
async function getK8sClusterInfo() {
    if (!k3sProxy) return null;
    return await k3sProxy.getClusterInfo();
}

// Get aggregated health status
async function getK8sHealth() {
    if (!k3sProxy) return null;
    return await k3sProxy.getAggregatedHealth();
}

// Get node metrics
async function getK8sNodeMetrics() {
    if (!k3sProxy) return [];
    return await k3sProxy.getNodeMetrics();
}

// Get Traefik routes
async function getK8sTraefikStatus() {
    if (!k3sProxy) return null;
    return await k3sProxy.getTraefikStatus();
}

// Get Helm releases
async function getK8sHelmReleases() {
    if (!k3sProxy) return [];
    return await k3sProxy.getAllHelmReleases();
}

// Get Kubernetes version
async function getK8sVersion() {
    if (!k3sProxy) return null;
    return await k3sProxy.getVersion();
}

// =============================================================================

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
            const logPath = service.logPath || `/tmp/${service.id}.log`;
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

            } else {
                await new Promise((resolve) => {
                    // Kill node processes running in the service path
                    const searchPattern = service.path.split('/').pop();
                    exec(`pkill -9 -f "${searchPattern}"`, (err) => resolve());
                });
            }
        }

        if (action === 'start' || action === 'restart') {
            if (service.type === 'docker') {
                const container = docker.getContainer(service.containerName);
                await container.start();
            } else {
                // Start generic process
                const logFile = service.logPath || `/tmp/${service.id}.log`;
                const logDir = path.dirname(logFile);
                if (!fs.existsSync(logDir)) {
                    fs.mkdirSync(logDir, { recursive: true });
                }

                const out = fs.openSync(logFile, 'a');
                const err = fs.openSync(logFile, 'a');

                const parts = service.startCmd.split(' ');
                const cmd = parts[0];
                const args = parts.slice(1);

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
        const system = await getSystemStats();

        if (IS_KUBERNETES_MODE) {
            // Kubernetes mode - fetch all data using K3s Proxy
            const [statuses, pods, deployments, clusterInfo, health, nodeMetrics, traefikStatus, helmReleases, version] = await Promise.all([
                getK8sServiceStatus(),
                discoverK8sPods(),
                discoverK8sDeployments(),
                getK8sClusterInfo(),
                getK8sHealth(),
                getK8sNodeMetrics(),
                getK8sTraefikStatus(),
                getK8sHelmReleases(),
                getK8sVersion()
            ]);

            const running = Object.values(statuses).filter(Boolean).length;
            const proxyAvailable = k3sProxy ? await k3sProxy.checkProxyAvailable() : false;

            socket.emit('status_update', {
                vram,
                statuses,
                errors: lastErrors,
                system,
                pods: pods,
                deployments: deployments,
                clusterInfo: clusterInfo,
                // New k8s data from kubectl proxy
                health: health,
                nodeMetrics: nodeMetrics,
                traefikRoutes: traefikStatus?.ingressRoutes || [],
                traefikMiddlewares: traefikStatus?.middlewares || [],
                helmReleases: helmReleases,
                version: version,
                proxyAvailable: proxyAvailable,
                summary: { running, total: K8S_SERVICES.length },
                config: {
                    nodeEnv: NODE_ENV,
                    isDevelopment: IS_DEVELOPMENT,
                    isProduction: IS_PRODUCTION,
                    controlMode: 'kubernetes',
                    proxyUrl: K8S_PROXY_URL
                }
            });
        } else {
            // Docker mode
            const statuses = await getServiceStatus();
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
                    isProduction: IS_PRODUCTION,
                    controlMode: 'docker'
                }
            });
        }
    };

    const interval = setInterval(sendUpdate, 2000);
    sendUpdate();

    socket.on('control_service', async (data) => {
        const { serviceId, action } = data;
        if (IS_KUBERNETES_MODE) {
            await controlK8sDeployment(serviceId, action);
        } else {
            await controlService(serviceId, action);
        }
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
    if (IS_KUBERNETES_MODE) {
        res.json(K8S_SERVICES);
    } else {
        res.json(SERVICES);
    }
});

// API: Get current environment info (for dashboard header badges)
app.get('/api/environment-info', (req, res) => {
    res.json({
        environment: NODE_ENV,
        hotReload: IS_DEVELOPMENT,
        controlMode: IS_KUBERNETES_MODE ? 'kubernetes' : 'docker'
    });
});

// New API: Get all running containers/pods
app.get('/api/containers', async (req, res) => {
    try {
        if (IS_KUBERNETES_MODE) {
            const pods = await discoverK8sPods();
            res.json({ containers: pods, type: 'pods' });
        } else {
            const containers = await discoverDockerContainers();
            res.json({ containers, type: 'docker' });
        }
    } catch (error) {
        console.error('Error fetching containers:', error);
        res.status(500).json({ error: 'Failed to fetch containers' });
    }
});

// =============================================================================
// KUBERNETES-SPECIFIC API ENDPOINTS (via K3s Proxy)
// =============================================================================

// Mount the new k8s routes when in Kubernetes mode
if (IS_KUBERNETES_MODE && k3sProxy) {
    const k8sRoutes = createK8sRoutes(k3sProxy);
    app.use('/api/k8s', k8sRoutes);
    console.log('Mounted K8s routes at /api/k8s');
}

// Legacy endpoints (kept for backwards compatibility)
// Get all Kubernetes pods
app.get('/api/k8s/pods', async (req, res) => {
    if (!IS_KUBERNETES_MODE) {
        return res.status(400).json({ error: 'Not in Kubernetes mode' });
    }
    try {
        const pods = await discoverK8sPods();
        res.json({ pods });
    } catch (error) {
        console.error('Error fetching pods:', error);
        res.status(500).json({ error: 'Failed to fetch pods' });
    }
});

// Get all Kubernetes deployments
app.get('/api/k8s/deployments', async (req, res) => {
    if (!IS_KUBERNETES_MODE) {
        return res.status(400).json({ error: 'Not in Kubernetes mode' });
    }
    try {
        const deployments = await discoverK8sDeployments();
        res.json({ deployments });
    } catch (error) {
        console.error('Error fetching deployments:', error);
        res.status(500).json({ error: 'Failed to fetch deployments' });
    }
});

// Get cluster info
app.get('/api/k8s/cluster', async (req, res) => {
    if (!IS_KUBERNETES_MODE) {
        return res.status(400).json({ error: 'Not in Kubernetes mode' });
    }
    try {
        const clusterInfo = await getK8sClusterInfo();
        res.json({ cluster: clusterInfo });
    } catch (error) {
        console.error('Error fetching cluster info:', error);
        res.status(500).json({ error: 'Failed to fetch cluster info' });
    }
});

// Control a Kubernetes deployment
app.post('/api/k8s/deployments/:id/:action', async (req, res) => {
    if (!IS_KUBERNETES_MODE) {
        return res.status(400).json({ error: 'Not in Kubernetes mode' });
    }
    const { id, action } = req.params;
    if (!['start', 'stop', 'restart'].includes(action)) {
        return res.status(400).json({ success: false, message: 'Invalid action' });
    }
    try {
        const result = await controlK8sDeployment(id, action);
        res.json(result);
    } catch (error) {
        console.error(`Error ${action}ing deployment ${id}:`, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get logs for a Kubernetes service
app.get('/api/k8s/logs/:serviceId', async (req, res) => {
    if (!IS_KUBERNETES_MODE) {
        return res.status(400).json({ error: 'Not in Kubernetes mode' });
    }
    const { serviceId } = req.params;
    const lines = parseInt(req.query.tail || '120', 10);
    try {
        const logs = await getK8sPodLogs(serviceId, lines);
        res.json({ logs });
    } catch (error) {
        console.error(`Error fetching logs for ${serviceId}:`, error);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

// =============================================================================

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

app.get('/api/services/:id/logs', async (req, res) => {
    const lines = parseInt(req.query.tail || '120', 10);
    if (IS_KUBERNETES_MODE) {
        const logs = await getK8sPodLogs(req.params.id, lines);
        res.json({ logs });
    } else {
        const service = SERVICES.find(s => s.id === req.params.id);
        const logs = await getServiceLogs(service, lines);
        res.json({ logs });
    }
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
    console.log(`VRAM Mastermind Dashboard running on http://0.0.0.0:${PORT}`);
});
