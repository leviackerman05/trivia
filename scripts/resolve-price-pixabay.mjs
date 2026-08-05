/**
 * Price Is Right — Pixabay image resolver (D056 pipeline pattern).
 *
 * Stock-API source per owner decision 2026-08-05 (Amazon PA-API stays the
 * documented upgrade once Associates approval lands). Pixabay license:
 * free commercial use, no attribution required (photographer stored).
 *
 * Stages:
 *   S1 search  — per product: searchTerm -> top-5 Pixabay photos
 *   S2 rank    — tag-token overlap with name + searchTerm; deterministic
 *   S3 review  — scripts/.cache/price-review/review-list.csv (spot-check)
 *   S4 apply   — downloads top pick -> public/images/price/{id}.jpg
 *   S5 resolve — writes src/data/price-resolved.json (source: pixabay)
 *
 * Usage: PIXABAY_KEY=<key> node scripts/resolve-price-pixabay.mjs
 * (key in .env: PIXABAY_KEY=... — free from pixabay.com/api/docs)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PRODUCTS_PATH = join(root, 'src/data/price-products.json');
const RESOLVED_PATH = join(root, 'src/data/price-resolved.json');
const IMAGE_DIR = join(root, 'public/images/price');
const REVIEW_DIR = join(root, 'scripts/.cache/price-review');
const ENV_PATH = join(root, '.env');

const PIXABAY_API = 'https://pixabay.com/api/';
const TOP_N = 5;
const FX_INR_PER_USD = 83; // build-time conversion for the D059 price pair

function loadEnv() {
  if (!existsSync(ENV_PATH)) return;
  for (const line of readFileSync(ENV_PATH, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+)\s*$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
}

loadEnv();
const key = process.env.PIXABAY_KEY;
if (!key) {
  console.error(
    'resolve-price-pixabay: PIXABAY_KEY is not set. Add it to .env (free from pixabay.com/api/docs).'
  );
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function tokenOverlap(tags, a, b) {
  const tokens = (s) =>
    new Set(
      (s ?? '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length > 2)
    );
  const set = tokens(tags);
  let hits = 0;
  for (const t of tokens(a)) if (set.has(t)) hits += 1;
  for (const t of tokens(b)) if (set.has(t)) hits += 1;
  return hits;
}

async function searchPhotos(query) {
  const url = `${PIXABAY_API}?key=${encodeURIComponent(key)}&q=${encodeURIComponent(query)}&per_page=${TOP_N}&image_type=photo&safesearch=true`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Pixabay HTTP ${response.status} for "${query}"`);
  }
  const data = await response.json();
  if (data.totalHits === 0) {
    return [];
  }
  return (data.hits ?? []).map((hit) => ({
    id: hit.id,
    tags: hit.tags ?? '',
    photographer: hit.user,
    url: hit.largeImageURL ?? hit.webformatURL ?? null,
  }));
}

async function download(url, dest) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`download HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(dest, buffer);
}

const products = JSON.parse(readFileSync(PRODUCTS_PATH, 'utf8'));
const resolved = {};
const flags = [];
mkdirSync(REVIEW_DIR, { recursive: true });
mkdirSync(IMAGE_DIR, { recursive: true });
const reviewRows = [];

for (const [productIndex, product] of products.entries()) {
  let photos;
  try {
    photos = await searchPhotos(product.searchTerm ?? product.name);
  } catch (error) {
    flags.push({ id: product.id, reason: error.message });
    await sleep(250);
    continue;
  }
  if (photos.length === 0) {
    flags.push({ id: product.id, reason: 'no-candidates' });
    await sleep(250);
    continue;
  }
  const scored = photos
    .map((photo, index) => ({
      photo,
      score: tokenOverlap(photo.tags, product.name, product.searchTerm),
      index,
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const best = scored[0].photo;
  reviewRows.push({
    id: product.id,
    name: product.name,
    tags: best.tags,
    photographer: best.photographer,
  });

  const dest = join(IMAGE_DIR, `${product.id}.jpg`);
  try {
    await download(best.url, dest);
  } catch (error) {
    flags.push({ id: product.id, reason: `download-failed: ${error.message}` });
    await sleep(250);
    continue;
  }

  resolved[product.id] = {
    status: 'resolved',
    source: 'pixabay',
    asin: null,
    image: `/images/price/${product.id}.jpg`,
    detailPageUrl: null, // no affiliate link for Pixabay — "See it on Amazon" stays hidden
    prices: { usd: product.price, inr: Math.round(product.price * FX_INR_PER_USD) },
    priceUpdatedAt: new Date().toISOString(),
    approvedAt: new Date().toISOString(),
  };
  if ((productIndex + 1) % 25 === 0 || productIndex + 1 === products.length) {
    console.log(
      `  [${productIndex + 1}/${products.length}] resolved so far: ${Object.keys(resolved).length}`
    );
  }
  await sleep(250);
}

writeFileSync(RESOLVED_PATH, JSON.stringify(resolved, null, 2) + '\n');
writeFileSync(
  join(REVIEW_DIR, 'review-list.csv'),
  'id,name,tags,photographer\n' +
    reviewRows.map((r) => `${r.id},"${r.name}","${r.tags}","${r.photographer}"`).join('\n') +
    '\n'
);
console.log(
  `\nResolved ${Object.keys(resolved).length}/${products.length} products -> ${RESOLVED_PATH}`
);
console.log(
  `Review list: ${join(REVIEW_DIR, 'review-list.csv')} — spot-check flagged rows (low/no tag overlap).`
);
if (flags.length > 0) {
  console.log(
    `Flags (${flags.length}): ${flags
      .slice(0, 10)
      .map((f) => `${f.id} (${f.reason})`)
      .join(', ')}${flags.length > 10 ? ' …' : ''}`
  );
  process.exitCode = 1;
}
