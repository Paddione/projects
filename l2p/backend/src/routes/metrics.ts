import { Router, Request, Response } from 'express';
import { metricsRegistry } from '../middleware/metrics.js';

const router = Router();

// Expose Prometheus metrics
router.get('/', async (_req: Request, res: Response) => {
  try {
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    const metrics = await metricsRegistry.metrics();
    res.status(200).send(metrics);
  } catch (_err) {
    res.status(500).json({ error: 'Failed to collect metrics' });
  }
});

export default router;
