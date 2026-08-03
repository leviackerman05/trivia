import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { healthRouter } from './routes/health.js';
import { createApiRouter, type ApiDeps } from './routes/api.js';
import { resolveCorsOrigin } from './lib/config.js';
import { logger } from './lib/logger.js';
import { createDefaultLimiters, type Limiters } from './lib/rate-limit.js';
import { RoomEngine } from './engine/room-engine.js';

export interface AppDeps {
  engine: RoomEngine;
  limiters: Limiters;
}

export function createApp(deps: Partial<AppDeps> = {}): express.Express {
  const engine = deps.engine ?? new RoomEngine();
  const limiters = deps.limiters ?? createDefaultLimiters();
  const apiDeps: ApiDeps = { engine, limiters };

  const app = express();
  app.disable('x-powered-by');

  app.use(cors({ origin: resolveCorsOrigin() }));
  // Small body cap — scores/messages are tiny; rejects oversized payloads early.
  app.use(express.json({ limit: '32kb' }));
  app.use(pinoHttp({ logger }));

  app.use(healthRouter);
  app.use('/api', createApiRouter(apiDeps));

  // Consistent JSON errors; never leak stack traces.
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ error }, 'unhandled request error');
    res.status(500).json({ error: { code: 'INTERNAL', message: 'internal error' } });
  });

  return app;
}
