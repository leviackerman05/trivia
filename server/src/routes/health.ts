import { Router } from 'express';
import { getPrisma } from '../lib/prisma.js';

/**
 * Liveness/readiness probes for the platform (Railway/Render healthchecks).
 * /readyz pings the database (M3: data layer wired in).
 */
export const healthRouter = Router();

healthRouter.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

healthRouter.get('/readyz', async (_req, res) => {
  try {
    await getPrisma().$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'not-ready' });
  }
});
