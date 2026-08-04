#!/usr/bin/env node
/**
 * M15 — Shadow Sketch silhouettes: tag every existing silhouette with a
 * genre (so hosts can pick a category) and append a new set of more
 * detailed, recognizable multi-part silhouettes (the owner called the
 * original set "childish"). Idempotent — re-running keeps existing genres
 * and only adds missing entries.
 *
 * Run: node scripts/generate-silhouettes.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const path = join(root, 'server/src/data/silhouettes.json');

const ANIMALS = new Set([
  'fish',
  'whale',
  'dolphin',
  'shark',
  'octopus',
  'jellyfish',
  'crab',
  'turtle',
  'snail',
  'butterfly',
  'bird',
  'owl',
  'cat',
  'dog',
  'rabbit',
  'mouse',
  'elephant',
  'giraffe',
  'lion',
  'bear',
  'pig',
  'frog',
  'penguin',
  'duck',
  'rooster',
  'bee',
  'ladybug',
  'spider',
  'snake',
  'lizard',
  'dinosaur',
]);
const NATURE = new Set([
  'leaf',
  'cactus',
  'pine tree',
  'mushroom',
  'acorn',
  'flower',
  'tulip',
  'sun',
  'moon',
  'star',
  'cloud',
  'rainbow',
  'snowflake',
  'lightning bolt',
  'snowman',
]);
const FOOD = new Set([
  'bread',
  'cupcake',
  'cake',
  'donut',
  'cookie',
  'lollipop',
  'ice cream cone',
  'popsicle',
  'egg',
  'cheese',
  'pizza',
  'hamburger',
  'apple',
  'pear',
  'banana',
  'cherry',
  'grapes',
  'watermelon',
  'strawberry',
  'pumpkin',
  'carrot',
  'eggplant',
  'chili pepper',
  'lemon',
]);
const PLACES = new Set([
  'house',
  'castle',
  'church',
  'barn',
  'igloo',
  'tent',
  'windmill',
  'lighthouse',
]);
const SPACE = new Set(['ghost', 'alien', 'robot', 'rocket', 'ufo', 'saturn']);
// Everything else (heart, sword, crown, cup, …) is OBJECTS.

function genreOf(name) {
  if (ANIMALS.has(name)) return 'animals';
  if (NATURE.has(name)) return 'nature';
  if (FOOD.has(name)) return 'food';
  if (PLACES.has(name)) return 'places';
  if (SPACE.has(name)) return 'space';
  return 'objects';
}

/** New detailed silhouettes: name, genre, multi-part path (100×100 box). */
const NEW_SILHOUETTES = [
  // --- Animals (9) ---
  {
    name: 'horse',
    genre: 'animals',
    path: 'M20 45 C10 40 12 30 22 28 C30 26 34 20 40 14 C44 10 52 8 55 14 C58 20 56 26 60 28 C72 30 82 36 84 48 C86 60 78 68 70 72 L72 96 L60 96 L58 76 C52 74 46 74 40 76 L38 96 L26 96 L28 70 C20 64 16 54 20 45 Z',
  },
  {
    name: 'deer',
    genre: 'animals',
    path: 'M40 8 L44 20 L52 10 L50 22 L60 16 L54 26 L46 30 L44 38 C38 44 30 48 26 56 C22 66 24 78 32 86 L30 96 L20 96 L22 84 C14 76 12 62 16 50 C20 38 28 32 36 30 L34 20 L40 8 Z',
  },
  {
    name: 'fox',
    genre: 'animals',
    path: 'M30 96 L34 70 L20 40 L38 52 L44 36 L40 20 L54 34 L62 20 L58 38 L72 52 L88 40 L74 70 L78 96 L62 96 L60 74 L48 74 L46 96 Z',
  },
  {
    name: 'wolf',
    genre: 'animals',
    path: 'M36 96 L34 78 L22 60 L12 40 L28 52 L34 42 L36 26 L48 38 L52 28 L56 40 L68 34 L64 52 L76 58 L62 66 L60 80 L60 96 L50 96 L48 76 L44 76 L42 96 Z',
  },
  {
    name: 'monkey',
    genre: 'animals',
    path: 'M28 40 C26 26 34 14 46 12 C52 20 50 30 54 34 C60 28 68 30 70 38 C72 46 68 54 62 56 L66 96 L58 96 L56 66 C54 64 50 64 48 66 L46 96 L38 96 L40 56 C32 52 30 46 28 40 Z',
  },
  {
    name: 'kangaroo',
    genre: 'animals',
    path: 'M28 96 L30 84 C24 78 20 68 22 58 C24 46 32 40 42 36 L40 20 L50 32 L56 22 L58 40 C66 44 72 52 72 62 C72 74 64 80 58 84 L62 96 L50 96 L48 84 C44 82 40 82 36 84 L34 96 Z',
  },
  {
    name: 'flamingo',
    genre: 'animals',
    path: 'M44 12 C50 8 58 10 60 16 C62 24 58 30 54 34 C50 38 48 42 48 48 L46 60 C44 68 38 74 30 78 L18 92 L12 84 L24 72 C30 66 34 60 36 52 L38 42 C34 36 32 28 36 20 C38 14 40 13 44 12 Z',
  },
  {
    name: 'seahorse',
    genre: 'animals',
    path: 'M36 96 L36 84 C30 82 26 76 28 68 C30 60 36 56 40 48 L42 36 C42 30 40 26 42 20 C44 14 50 12 54 16 C58 20 56 28 52 32 L50 40 C56 38 62 42 62 48 C62 54 56 56 52 54 L50 60 C54 66 52 74 46 78 L46 88 L54 96 Z',
  },
  {
    name: 'starfish',
    genre: 'animals',
    path: 'M48 4 L56 36 L88 26 L64 48 L84 72 L52 62 L48 96 L44 62 L12 72 L32 48 L8 26 L40 36 Z',
  },
  // --- Nature (6) ---
  {
    name: 'mountain',
    genre: 'nature',
    path: 'M2 96 L30 40 L42 62 L56 34 L72 60 L82 46 L98 96 Z M30 40 L34 32 L28 32 Z',
  },
  {
    name: 'wave',
    genre: 'nature',
    path: 'M2 60 C14 44 26 44 38 58 C50 72 62 72 74 56 C82 46 90 46 98 54 L98 96 L2 96 Z',
  },
  {
    name: 'seashell',
    genre: 'nature',
    path: 'M50 4 C70 10 78 30 72 50 C68 64 56 74 50 96 C44 74 32 64 28 50 C22 30 30 10 50 4 Z M50 16 C56 24 58 36 56 48 C54 58 52 66 50 76 C48 66 46 58 44 48 C42 36 44 24 50 16 Z',
  },
  {
    name: 'palm tree',
    genre: 'nature',
    path: 'M46 96 L50 40 L42 20 L52 26 L56 8 L58 26 L70 16 L60 30 L66 40 L50 42 L52 96 Z',
  },
  {
    name: 'tree',
    genre: 'nature',
    path: 'M44 96 L44 70 L28 54 L40 52 L24 36 L38 34 L30 18 L52 28 L50 12 L62 24 L74 12 L70 30 L86 32 L66 40 L78 50 L58 48 L52 70 L52 96 Z',
  },
  {
    name: 'fire',
    genre: 'nature',
    path: 'M52 4 C56 16 64 22 66 34 C68 44 64 52 58 58 C62 48 60 40 54 34 C54 44 50 52 44 58 C36 64 30 76 32 88 C32 92 34 96 38 96 L62 96 C66 96 68 92 68 88 C68 74 74 64 70 50 C66 34 58 18 52 4 Z',
  },
  // --- Food (5) ---
  {
    name: 'avocado',
    genre: 'food',
    path: 'M50 6 C68 6 82 20 84 40 C86 62 74 80 58 90 C54 93 46 93 42 90 C26 80 14 62 16 40 C18 20 32 6 50 6 Z M50 30 C58 30 64 38 64 48 C64 58 58 66 50 66 C42 66 36 58 36 48 C36 38 42 30 50 30 Z',
  },
  {
    name: 'sushi',
    genre: 'food',
    path: 'M18 40 L40 20 L76 56 L54 76 Z M28 60 L46 78 L40 84 L22 66 Z M58 34 L74 18 L86 30 L70 46 Z M50 50 L70 70 L64 76 L44 56 Z',
  },
  {
    name: 'taco',
    genre: 'food',
    path: 'M6 40 C20 72 80 72 94 40 C86 34 78 40 72 46 C62 54 38 54 28 46 C22 40 14 34 6 40 Z',
  },
  {
    name: 'popcorn',
    genre: 'food',
    path: 'M36 96 L40 74 L28 74 L32 96 Z M50 96 L52 64 L42 64 L44 96 Z M64 96 L68 74 L56 74 L60 96 Z M40 60 C34 52 34 42 40 34 C44 44 50 44 54 38 C56 48 52 56 46 60 Z M52 60 C46 52 48 42 56 36 C58 46 62 48 64 44 C64 52 60 58 52 60 Z',
  },
  {
    name: 'french fries',
    genre: 'food',
    path: 'M30 96 L32 40 L40 36 L44 96 Z M44 96 L46 28 L54 24 L58 96 Z M58 96 L62 34 L70 38 L68 96 Z M20 96 L78 96 L76 86 L22 86 Z',
  },
  // --- Objects (6) ---
  {
    name: 'phone',
    genre: 'objects',
    path: 'M34 4 L66 4 C70 4 72 6 72 10 L72 90 C72 94 70 96 66 96 L34 96 C30 96 28 94 28 90 L28 10 C28 6 30 4 34 4 Z M44 86 L56 86 L56 90 L44 90 Z',
  },
  {
    name: 'laptop',
    genre: 'objects',
    path: 'M16 20 L84 20 L84 62 L16 62 Z M8 72 L92 72 L88 80 L12 80 Z',
  },
  {
    name: 'headphones',
    genre: 'objects',
    path: 'M30 40 L30 64 C30 72 34 78 42 78 C50 78 54 72 54 64 L54 40 C54 28 46 18 34 16 C24 20 16 28 14 40 L12 66 C12 72 14 78 18 82 L24 76 L18 68 Z M70 40 L70 64 C70 72 66 78 58 78 C50 78 46 72 46 64 L46 40 C46 28 54 18 66 16 C76 20 84 28 86 40 L88 66 C88 72 86 78 82 82 L76 76 L82 68 Z',
  },
  {
    name: 'watch',
    genre: 'objects',
    path: 'M36 18 L36 10 L64 10 L64 18 C74 22 80 32 80 44 C80 58 72 68 62 72 L62 90 L38 90 L38 72 C28 68 20 58 20 44 C20 32 26 22 36 18 Z M50 28 C58 28 64 36 64 46 C64 56 58 64 50 64 C42 64 36 56 36 46 C36 36 42 28 50 28 Z',
  },
  {
    name: 'scissors',
    genre: 'objects',
    path: 'M20 8 C30 8 36 16 34 26 C32 34 24 38 18 34 C10 30 8 20 14 14 C16 10 18 8 20 8 Z M24 96 C32 96 38 90 38 82 C38 74 32 68 24 68 C16 68 10 74 10 82 C10 90 16 96 24 96 Z M34 34 L70 62 M36 78 L72 50 M66 44 C74 44 82 52 82 62 C82 72 74 80 66 80 C58 80 50 72 50 62 C50 52 58 44 66 44 Z',
  },
  {
    name: 'hammer',
    genre: 'objects',
    path: 'M18 26 L62 26 L62 44 L18 44 Z M36 44 L42 44 L42 96 L36 96 Z M18 26 C14 18 20 10 28 10 L52 10 C60 10 66 18 62 26 Z',
  },
  // --- Places (4) ---
  {
    name: 'pyramid',
    genre: 'places',
    path: 'M4 96 L48 10 L92 96 Z M24 96 L48 44 L72 96 Z M40 96 L48 72 L56 96 Z',
  },
  {
    name: 'bridge',
    genre: 'places',
    path: 'M2 70 C20 56 34 52 50 52 C66 52 80 56 98 70 L98 80 L2 80 Z M14 80 L14 96 L26 96 L26 80 Z M74 80 L74 96 L86 96 L86 80 Z',
  },
  {
    name: 'tower',
    genre: 'places',
    path: 'M40 4 L60 4 L60 14 L68 22 L68 96 L32 96 L32 22 L40 14 Z M28 30 L72 30 L72 40 L28 40 Z M22 52 L78 52 L78 62 L22 62 Z',
  },
  {
    name: 'fountain',
    genre: 'places',
    path: 'M36 96 L36 84 C28 78 24 68 28 58 C32 48 42 44 50 46 C58 44 68 48 72 58 C76 68 72 78 64 84 L64 96 Z M46 34 L54 34 L54 46 L46 46 Z M34 24 C38 16 44 12 50 12 C56 12 62 16 66 24 L58 24 C56 20 53 18 50 18 C47 18 44 20 42 24 Z',
  },
  // --- Space & fantasy (4) ---
  {
    name: 'dragon',
    genre: 'space',
    path: 'M16 34 C24 28 34 26 42 30 L52 20 L50 34 C58 38 62 46 62 56 C62 66 58 74 50 78 L52 96 L42 96 L40 80 C36 80 32 80 28 82 L26 96 L16 96 L20 80 C14 74 12 66 14 58 C16 50 14 42 16 34 Z M50 44 C54 48 54 56 50 60 C46 56 46 48 50 44 Z',
  },
  {
    name: 'unicorn',
    genre: 'space',
    path: 'M30 40 C20 44 14 54 16 66 C18 78 28 86 40 88 L44 96 L32 96 L30 84 C22 78 20 68 24 60 L30 52 L36 96 L26 96 L28 60 L20 40 Z M40 96 L38 84 C44 78 50 66 48 54 C46 42 38 34 30 34 L26 26 L34 28 L40 22 L38 32 C48 36 54 46 52 58 C50 70 46 84 42 92 L46 96 Z',
  },
  {
    name: 'comet',
    genre: 'space',
    path: 'M60 6 L74 22 L92 30 L76 40 L70 58 L60 44 L44 40 L52 30 L44 18 Z M36 52 L48 62 L44 76 L32 68 L18 72 L26 58 L14 46 Z',
  },
  {
    name: 'planet',
    genre: 'space',
    path: 'M30 50 C30 32 42 20 58 20 C74 20 86 32 86 50 C86 68 74 80 58 80 C42 80 30 68 30 50 Z M40 44 C46 40 52 38 58 38 C64 38 70 40 76 44 C74 38 68 34 60 34 C50 34 44 38 40 44 Z',
  },
];

const silhouettes = JSON.parse(readFileSync(path, 'utf8'));
for (const entry of silhouettes) {
  entry.genre = genreOf(entry.name);
}
const existing = new Set(silhouettes.map((entry) => entry.name));
for (const entry of NEW_SILHOUETTES) {
  if (!existing.has(entry.name)) {
    silhouettes.push({ name: entry.name, path: entry.path, genre: entry.genre });
  }
}
writeFileSync(path, JSON.stringify(silhouettes, null, 2) + '\n');
const byGenre = {};
for (const entry of silhouettes) {
  byGenre[entry.genre] = (byGenre[entry.genre] ?? 0) + 1;
}
console.log(`silhouettes: ${silhouettes.length} — ${JSON.stringify(byGenre)}`);
