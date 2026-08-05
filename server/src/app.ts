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
  // Large-payload routes only: drawing uploads carry a ≤1 MB base64 PNG
  // (decoded); everything else stays under the 32 kb cap. Must be registered
  // BEFORE the global parser — Express's body-parser sets req._body on first
  // parse, so the 32 kb parser skips already-parsed /api/drawing/* bodies.
  app.use('/api/drawing', express.json({ limit: '1.5mb' }));
  // Small body cap, scores/messages are tiny; rejects oversized payloads early.
  app.use(express.json({ limit: '32kb' }));
  app.use(pinoHttp({ logger }));

  app.use(healthRouter);
  app.use('/api', createApiRouter(apiDeps));

  // Consistent JSON errors; never leak stack traces. Parser errors carry
  // error.status (body-parser) — preserve it so a 413 from the drawing
  // 1.5 MB parser surfaces as PAYLOAD_TOO_LARGE, not a masked 500 (R2).
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ error }, 'unhandled request error');
    const status =
      typeof (error as { status?: unknown }).status === 'number'
        ? (error as { status: number }).status
        : 500;
    const isPayloadTooLarge = status === 413;
    res.status(status).json({
      error: {
        code: isPayloadTooLarge ? 'PAYLOAD_TOO_LARGE' : 'INTERNAL',
        message: isPayloadTooLarge ? 'payload too large' : 'internal error',
      },
    });
  });

  return app;
}
