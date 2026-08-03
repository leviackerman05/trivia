#!/usr/bin/env node
/**
 * M10 — enrich price-products.json with real product photos via the
 * Openverse API (CC-licensed image search — PRD §13-safe). License
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
  const url =
    `https://api.openverse.org/v1/images/?q=${encodeURIComponent(term)}` +
    '&license_type=commercial&page_size=10';
  const response = await fetch(url, {
    headers: { 'User-Agent': 'PartyBrain-dev/1.0 (price-game product images)' },
  });
  if (response.status === 429 && attempt < 3) {
    await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
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
    const free = FREE_LICENSES.has(entry.license) ? 2 : 0;
    return shared * 3 + free;
  };
  return [...usable].sort((a, b) => rank(b) - rank(a))[0] ?? null;
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
const todo = products
  .map((product, index) => ({ product, index }))
  .filter(({ product }) => !product.image || !product.credit);

const outcomes = await withConcurrency(todo, 8, async ({ product }) => {
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
console.log(`\n${withImages} newly enriched — ${total}/${products.length} products have photos.`);
