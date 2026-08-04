import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getPrisma, resetPrismaForTests } from '../../lib/prisma.js';

/**
 * Shared DB setup for integration tests. Requires a reachable PostgreSQL
 * (DATABASE_URL): local Docker container or the CI service container.
 * Tests share the dev database but only touch test-owned tables
 * (scores, rooms, room players, daily challenges), Game rows are seeded
 * from the catalog like prisma/seed.ts.
 */

export async function setupTestDb(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is required for integration tests. Start local Postgres (see DEVELOPMENT_GUIDE) or run in CI.'
    );
  }
  resetPrismaForTests();
  await seedGamesIfNeeded();
}

export async function resetTestData(): Promise<void> {
  const prisma = getPrisma();
  // Best-effort room persistence can still be in flight from the previous
  // test's sockets, retry briefly so deletes don't hit FK races.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      // Phase 1.5 tables first (FK children), then the original set.
      await prisma.dailyRun.deleteMany();
      await prisma.dailyStreak.deleteMany();
      await prisma.userProfile.deleteMany();
      await prisma.score.deleteMany();
      await prisma.roomPlayer.deleteMany();
      await prisma.room.deleteMany();
      await prisma.dailyChallenge.deleteMany();
      return;
    } catch (error) {
      if (attempt === 2) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
}

async function seedGamesIfNeeded(): Promise<void> {
  const prisma = getPrisma();
  const count = await prisma.game.count();
  if (count > 0) {
    return;
  }
  const catalogPath = join(process.cwd(), '..', 'src', 'data', 'games.json');
  const catalog = JSON.parse(await readFile(catalogPath, 'utf-8')) as {
    slug: string;
    name: string;
    type: string;
  }[];
  for (const game of catalog) {
    await prisma.game.upsert({
      where: { slug: game.slug },
      update: { name: game.name, type: game.type },
      create: { slug: game.slug, name: game.name, type: game.type },
    });
  }
}

export async function teardownTestDb(): Promise<void> {
  await getPrisma().$disconnect();
}
