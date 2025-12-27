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

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: ["http://localhost:4242", "http://dashboard.korczewski.de", "https://dashboard.korczewski.de"],
        credentials: true
    }
});
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password123';
const DB_URL = process.env.DATABASE_URL || 'postgresql://webui:webui@localhost:5432/webui';
const dbPool = new Pool({
    connectionString: DB_URL,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    max: 5
});
const ALLOWED_ROLES = new Set(['admin', 'user', 'pending']);

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
    origin: ["http://localhost:4242", "http://dashboard.korczewski.de", "https://dashboard.korczewski.de"],
    credentials: true
}));

// Authentication middleware
const requireAuth = (req, res, next) => {
    if (req.session && req.session.authenticated) {
        return next();
    }
    if (req.path === '/login.html' || req.path === '/api/login') {
        return next();
    }
    if (req.path.startsWith('/api/')) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
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
        model: 'Qwen/Qwen2.5-Coder-7B-Instruct-AWQ',
        description: 'High-throughput LLM serving engine compatible with OpenAI API.',
        vramEstimate: '8-12 GB',
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
        path: '/home/patrick/vllm/ai-image-gen/forge',
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
    }
];

// In-memory store for last errors
const lastErrors = {};

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

// Helper to check if a process is running (for Forge)
async function isForgeRunning() {
    return new Promise((resolve) => {
        exec('ps aux | grep -v grep | grep "launch.py"', (err, stdout) => {
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
            statuses[service.id] = await isForgeRunning();
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
            } else {
                await new Promise((resolve) => {
                    exec('pkill -9 -f "launch.py"', (err) => resolve());
                });
            }
        }

        if (action === 'start' || action === 'restart') {
            if (service.type === 'docker') {
                const container = docker.getContainer(service.containerName);
                await container.start();
            } else {
                // Start Forge
                const out = fs.openSync('/tmp/forge.log', 'a');
                const err = fs.openSync('/tmp/forge.log', 'a');
                const child = spawn('./webui.sh', ['--listen', '--port', '7863', '--cuda-malloc', '--always-gpu', '--share', '--enable-insecure-extension-access'], {
                    cwd: service.path,
                    detached: true,
                    stdio: ['ignore', out, err]
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
    if (!session || !session.authenticated) {
        console.log('Unauthorized socket connection attempt');
        socket.disconnect();
        return;
    }

    console.log('Authenticated client connected');

    const sendUpdate = async () => {
        const vram = await getVramInfo();
        const statuses = await getServiceStatus();
        const system = await getSystemStats();
        const running = Object.values(statuses).filter(Boolean).length;
        socket.emit('status_update', { vram, statuses, errors: lastErrors, system, summary: { running, total: SERVICES.length } });
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

const PORT = process.env.DASHBOARD_PORT || 4242;
server.listen(PORT, () => {
    console.log(`vLLM Mastermind Dashboard running on http://localhost:${PORT}`);
});
