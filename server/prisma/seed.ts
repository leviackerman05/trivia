import { PrismaClient } from '@prisma/client';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/**
 * Seeds the Game catalog from src/data/games.json (single source of truth).
 * Run with: pnpm --dir server db:seed
 */

const prisma = new PrismaClient();

interface CatalogEntry {
  slug: string;
  name: string;
  type: 'solo' | 'multiplayer-realtime' | 'multiplayer-voting';
}

async function main(): Promise<void> {
  const catalogPath = fileURLToPath(new URL('../../src/data/games.json', import.meta.url));
  const catalog = JSON.parse(await readFile(catalogPath, 'utf-8')) as CatalogEntry[];

  for (const game of catalog) {
    await prisma.game.upsert({
      where: { slug: game.slug },
      update: { name: game.name, type: game.type },
      create: { slug: game.slug, name: game.name, type: game.type },
    });
  }

  console.log(`Seeded ${catalog.length} games into the Game table.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
