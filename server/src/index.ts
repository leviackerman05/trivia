import { createServer } from 'node:http';
import { createApp } from './app.js';
import { attachSocketIo } from './socket/index.js';
import { RoomEngine } from './engine/room-engine.js';
import { createDefaultLimiters } from './lib/rate-limit.js';
import { config } from './lib/config.js';
import { logger } from './lib/logger.js';
import { getPrisma } from './lib/prisma.js';

const engine = new RoomEngine();
const limiters = createDefaultLimiters();

const app = createApp({ engine, limiters });
const httpServer = createServer(app);
const io = attachSocketIo(httpServer, { engine, limiters });

httpServer.listen(config.port, () => {
  logger.info({ port: config.port }, 'partybrain server listening');
});

// Periodic limiter-bucket cleanup (in-memory maps stay bounded).
setInterval(() => {
  for (const limiter of Object.values(limiters)) {
    limiter.sweep();
  }
}, 5 * 60_000).unref();

function shutdown(signal: string): void {
  logger.info({ signal }, 'shutting down');
  io.close(() => {
    httpServer.close(async () => {
      await getPrisma().$disconnect();
      process.exit(0);
    });
  });
  // Hard-exit fallback if connections refuse to drain.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
