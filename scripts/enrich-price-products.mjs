#!/usr/bin/env node
/**
 * M10, enrich price-products.json with real product photos via the
 * Openverse API (CC-licensed image search, PRD §13-safe). License
 * preference: CC0/PDM first (no attribution), then CC-BY/CC-BY-SA with the
 * creator + license stored as `credit` and shown under the image. Products
 * without a usable photo keep their emoji as the UI fallback.
 *
 * Run: node scripts/enrich-price-products.mjs   (network)
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const path = join(root, 'src/data/price-products.json');

const BAD_TOKENS = [
  'logo',
  'icon',
  'diagram',
  'schematic',
  'blueprint',
  'drawing',
  'graph',
  'chart',
  'poster',
  'meetup',
  'store front',
  'shop sign',
  'wikipedia',
];
const FREE_LICENSES = new Set(['cc0', 'pdm', 'publicdomain']);

async function searchOpenverse(term, attempt = 0) {
  // M14, quoted phrase + the word "product" biases results toward the item
  // itself instead of random photos that happen to share a word.
  const url =
    `https://api.openverse.org/v1/images/?q=${encodeURIComponent(`"${term}" product`)}` +
    '&license_type=commercial&page_size=20';
  const response = await fetch(url, {
    headers: { 'User-Agent': 'TriviaHub-dev/1.0 (price-game product images)' },
  });
  if (response.status === 429 && attempt < 4) {
    await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
    return searchOpenverse(term, attempt + 1);
  }
  if (!response.ok) {
    return [];
  }
  const body = await response.json();
  return (body.results ?? []).map((entry) => ({
    url: entry.url,
    title: entry.title ?? '',
    license: entry.license ?? '',
    creator: entry.creator ?? null,
    width: typeof entry.width === 'number' ? entry.width : 0,
    height: typeof entry.height === 'number' ? entry.height : 0,
  }));
}

function pickResult(candidates, productName) {
  const nameTokens = productName
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 3);
  const clean = (entry) => {
    const lower = entry.title.toLowerCase();
    if (BAD_TOKENS.some((token) => lower.includes(token))) return false;
    if (
      !/\.(jpe?g|png|webp|gif|heic)$/.test(entry.url.toLowerCase()) &&
      !entry.url.includes('staticflickr')
    ) {
      return false; // want raster photos, not pages
    }
    return true;
  };
  const usable = candidates.filter(clean);
  if (usable.length === 0) {
    return null;
  }
  const rank = (entry) => {
    const lower = entry.title.toLowerCase();
    const shared = nameTokens.filter((token) => lower.includes(token)).length;
    // M14, the image must plausibly BE the product: at least one
    // significant name token in the title, full-name matches rank highest.
    if (shared === 0) {
      return -1;
    }
    const free = FREE_LICENSES.has(entry.license) ? 2 : 0;
    const fullName = lower.includes(productName.toLowerCase()) ? 4 : 0;
    const size = entry.width >= 640 && entry.height >= 480 ? 1 : 0;
    return shared * 3 + fullName + size + free;
  };
  const ranked = usable
    .map((entry) => ({ entry, rank: rank(entry) }))
    .filter(({ rank: value }) => value > 0)
    .sort((a, b) => b.rank - a.rank);
  return ranked[0]?.entry ?? null;
}

async function withConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

const products = JSON.parse(readFileSync(path, 'utf8'));
// M14, re-enrich EVERY product: the first pass's queries returned plenty of
// off-topic photos, and the improved query + ranking replaces them.
const todo = products.map((product, index) => ({ product, index }));

const outcomes = await withConcurrency(todo, 4, async ({ product }) => {
  try {
    const term = product.searchTerm ?? product.name;
    const candidates = await searchOpenverse(term);
    const picked = pickResult(candidates, product.name);
    return picked ? { ok: true, picked } : { ok: false };
  } catch {
    return { ok: false };
  }
});

let withImages = 0;
for (const [offset, outcome] of outcomes.entries()) {
  const entry = todo[offset];
  if (!entry || !outcome.ok) {
    continue;
  }
  const { picked } = outcome;
  entry.product.image = picked.url;
  if (!FREE_LICENSES.has(picked.license) && picked.creator) {
    entry.product.credit = { creator: picked.creator, license: picked.license };
  } else if (!FREE_LICENSES.has(picked.license)) {
    entry.product.credit = { creator: null, license: picked.license };
  }
  withImages += 1;
}

writeFileSync(path, JSON.stringify(products, null, 2) + '\n');
const total = products.filter((product) => product.image).length;
console.log(`\n${withImages} newly enriched, ${total}/${products.length} products have photos.`);
