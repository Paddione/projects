import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import healthRouter from './routes/health.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Health endpoints
app.use('/health', healthRouter);
app.get('/api/health', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ status: 'OK', service: 'sos' });
});

// Static files
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// 404 for unknown API routes
app.all('/api/*', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

export default app;
