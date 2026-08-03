import { PrismaClient } from '@prisma/client';

/**
 * Lazy Prisma client accessor. The client is created on first use (per
 * process), which lets integration tests set DATABASE_URL before the first
 * query and keeps hot-reload/dev safe via a global singleton.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

let client: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!client) {
    client = globalForPrisma.prisma ?? new PrismaClient();
    if (process.env.NODE_ENV !== 'production') {
      globalForPrisma.prisma = client;
    }
  }
  return client;
}

/** Test-only: drop the cached client so a new DATABASE_URL takes effect. */
export function resetPrismaForTests(): void {
  client = null;
}
