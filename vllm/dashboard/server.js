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
        type: 'docker'
    },
    {
        id: 'vllm',
        name: 'vLLM (LLM)',
        containerName: 'vllm-rag',
        url: 'https://api.korczewski.de',
        model: 'Qwen/Qwen2.5-Coder-7B-Instruct-AWQ',
        description: 'High-throughput LLM serving engine compatible with OpenAI API.',
        vramEstimate: '8-12 GB',
        type: 'docker'
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
        startCmd: './webui.sh'
    },
    {
        id: 'infinity',
        name: 'Infinity (Embeddings)',
        containerName: 'infinity-embeddings',
        url: 'https://embeddings.korczewski.de',
        model: 'BAAI/bge-m3',
        description: 'Fast embedding inference server for vector search.',
        vramEstimate: '2-4 GB',
        type: 'docker'
    },
    {
        id: 'qdrant',
        name: 'Qdrant (Vector DB)',
        containerName: 'qdrant-rag',
        url: 'https://qdrant.korczewski.de/dashboard',
        model: 'Vector Search',
        description: 'Vector database for storing and searching document embeddings.',
        vramEstimate: '1-2 GB',
        type: 'docker'
    },
    {
        id: 'postgres',
        name: 'PostgreSQL (WebUI DB)',
        containerName: 'postgres-rag',
        model: 'SQL Database',
        description: 'Relational database for Open WebUI user data and settings.',
        vramEstimate: '< 500 MB',
        type: 'docker'
    },
    {
        id: 'ingest',
        name: 'Ingest Engine',
        containerName: 'rag-ingest-engine',
        model: 'Document Processing',
        description: 'Automated document ingestion and vectorization service.',
        vramEstimate: 'Low (CPU/Shared)',
        type: 'docker'
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
        socket.emit('status_update', { vram, statuses, errors: lastErrors });
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

const PORT = process.env.DASHBOARD_PORT || 4242;
server.listen(PORT, () => {
    console.log(`vLLM Mastermind Dashboard running on http://localhost:${PORT}`);
});
