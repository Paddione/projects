import { Router, type Request, type Response } from 'express';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    status: 'OK',
    service: 'sos',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage().rss,
  });
});

router.get('/ready', (_req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  res.json({ status: 'ready' });
});

router.get('/live', (_req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    status: 'alive',
    uptime: process.uptime(),
    pid: process.pid,
  });
});

export default router;
