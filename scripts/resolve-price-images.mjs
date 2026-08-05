#!/usr/bin/env node
/**
 * M20 S1-S5b price-image pipeline (D055/D056/D059), mock-first.
 *
 * Amazon PA-API (ProductAdvertisingAPI v5) is the PRIMARY image + price
 * source (D056). Build-time resolution only — no runtime network anywhere.
 * When any PA-API key is missing, the pipeline runs on a MOCK adapter
 * (deterministic fixture candidates; the mock "image" is a fixture file),
 * so the whole flow is exercisable end-to-end with zero keys.
 *
 * Stages (each separately runnable and idempotent):
 *   --search   S1-S3: bulk ItemSearch (2 markets), ranking, review artifacts
 *   --apply    S4-S5: download approved images, write src/data/price-resolved.json
 *   --refresh  S5b:   GetItems price refresh (10 ASINs/request per market)
 *
 * Review gate: --apply only resolves products listed in
 * scripts/.cache/price-review/approved.json (the explicit approve step).
 * Nothing ships without an approve. scripts/.cache/ is gitignored.
 */

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
  existsSync,
  statSync,
} from 'node:fs';
import { createHash, createHmac } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PRODUCTS_PATH = join(root, 'src/data/price-products.json');
const RESOLVED_PATH = join(root, 'src/data/price-resolved.json');
const CACHE_DIR = join(root, 'scripts/.cache');
const REVIEW_DIR = join(CACHE_DIR, 'price-review');
const CANDIDATES_PATH = join(CACHE_DIR, 'price-candidates.json');
const APPROVED_PATH = join(REVIEW_DIR, 'approved.json');
const IMAGE_OUT_DIR = join(root, 'public/images/price');
const FIXTURE_IMAGE = join(root, 'scripts/fixtures/price-sample.jpg');

const MARKETS = [
  { code: 'US', host: 'webservices.amazon.com', region: 'us-east-1', domain: 'amazon.com' },
  { code: 'IN', host: 'webservices.amazon.in', region: 'eu-west-1', domain: 'amazon.in' },
];

/** PA-API SearchIndex by bucket (D059); `All` when no valid mapping. */
const SEARCH_INDEX_BY_CATEGORY = {
  kitchen: 'Kitchen',
  electronics: 'Electronics',
  home: 'HomeAndKitchen',
  outdoors: 'SportsAndOutdoors',
  bar: 'HomeAndKitchen',
  office: 'OfficeProducts',
  toys: 'Toys',
  sports: 'SportsAndOutdoors',
  beauty: 'Beauty',
  grocery: 'GroceryAndGourmetFood',
};

// Reused from the enrich script (L19-29 precedent): rejects logos, diagrams,
// posters and other non-product photos.
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

/** Offensive-term blocklist (jigger-class): auto-rejects a candidate. */
const OFFENSIVE_TOKENS = [
  'adult toy',
  'sex toy',
  'vibrator',
  'lingerie',
  'erotic',
  'nsfw',
  'vape',
  'tobacco',
  'cigarette',
  'weapon',
  'gun',
];

/** Product-family tokens: when present in the name, the title must also
 * contain the core token (ambiguity guard). */
const FAMILY_TOKENS = [
  'set',
  'kit',
  'pack',
  'pro',
  'xl',
  'deluxe',
  'premium',
  'plus',
  'mini',
  'max',
];

const PAAPI_RESOURCES = [
  'Images.Primary.Large',
  'ItemInfo.Title',
  'ItemInfo.Features',
  'Offers.Listings.Price',
  'DetailPageURL',
];

const RPS_DELAY_MS = 1000; // S1 pacing ≈ 1 rps
const MAX_RETRIES = 4;

// ---------------------------------------------------------------------------
// Small deterministic helpers (no new deps; mulberry32 is the in-repo PRNG).

function fnv1a(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Adapter: MOCK (no keys) vs REAL (PA-API SigV4).

function keysPresent() {
  return MARKETS.every(({ code }) => {
    const access = process.env[`PAAPI_ACCESS_KEY_${code}`];
    const secret = process.env[`PAAPI_SECRET_KEY_${code}`];
    const tag = process.env[`PAAPI_PARTNER_TAG_${code}`];
    return access && secret && tag;
  });
}

const adapterMode = keysPresent() ? 'real' : 'mock';

/** Deterministic mock candidates: 5 per product × market, stable per id. */
function mockSearch(product, market) {
  const rand = mulberry32(fnv1a(`${product.id}:${market.code}`));
  const basePrice = typeof product.price === 'number' ? product.price : 20;
  const asin = `B0MOCK${String(fnv1a(product.id) % 100000).padStart(4, '0')}`;
  const firstWord = product.name.split(/\s+/)[0] ?? product.name;
  const titles = [
    `${product.name} Standard Edition`, // full-name match (clear top)
    `${firstWord} Essentials`, // partial (single-token overlap)
    'Official Accessory Pack', // no overlap → rejected
    'Generic Gadget Bundle', // no overlap → rejected
    'Premium Household Item', // no overlap → rejected
  ];
  return titles.map((title) => ({
    asin,
    title,
    detailPageUrl: `https://www.${market.domain}/dp/${asin}`,
    imageUrl: `https://images.${market.domain}/images/P/${asin}._SL1200_.jpg`,
    priceUsd: Math.round(basePrice * (0.9 + rand() * 0.5) * 100) / 100,
    // Deterministic INR pair: 83-87 ₹/$ (D059 per-market price pair).
    priceInr: Math.round(basePrice * (83 + rand() * 4)),
  }));
}

/** Real PA-API search (SigV4-signed REST via node:crypto). */
async function paapiSearch(product, market) {
  const payload = JSON.stringify({
    Keywords: product.searchTerm ?? product.name,
    SearchIndex: SEARCH_INDEX_BY_CATEGORY[product.category] ?? 'All',
    ItemCount: 10,
    Resources: PAAPI_RESOURCES,
  });
  const body = await signedFetch('/paapi/v1/searchitems', payload, market);
  const items = body?.SearchResult?.Items ?? [];
  return items
    .filter((item) => item?.ASIN && item?.DetailPageURL)
    .map((item) => ({
      asin: item.ASIN,
      title: item.ItemInfo?.Title?.DisplayValue ?? '',
      detailPageUrl: item.DetailPageURL,
      imageUrl: item.Images?.Primary?.Large?.URL ?? '',
      priceUsd: priceAmount(item),
      priceInr: null, // filled by the --refresh GetItems pass per market
    }))
    .slice(0, 5);
}

/** S5b: PA-API GetItems, 10 ASINs per request per market. */
async function paapiGetItems(asinChunk, market) {
  const payload = JSON.stringify({
    ItemIds: asinChunk,
    ItemCount: asinChunk.length,
    Resources: ['Offers.Listings.Price', 'Images.Primary.Large'],
  });
  return signedFetch('/paapi/v1/getitems', payload, market);
}

function priceAmount(item) {
  const listing = item.Offers?.Listings?.[0];
  const amount = listing?.Price?.Amount;
  return typeof amount === 'number' ? amount / 100 : null;
}

async function signedFetch(path, payload, market) {
  const accessKey = process.env[`PAAPI_ACCESS_KEY_${market.code}`];
  const secretKey = process.env[`PAAPI_SECRET_KEY_${market.code}`];
  const partnerTag = process.env[`PAAPI_PARTNER_TAG_${market.code}`];
  const host = market.host;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = createHash('sha256').update(payload).digest('hex');
  const canonicalRequest = [
    'POST',
    path,
    '',
    `content-type:application/json; charset=utf-8\nhost:${host}\nx-amz-date:${amzDate}\n`,
    'content-type;host;x-amz-date',
    payloadHash,
  ].join('\n');
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${market.region}/ProductAdvertisingAPI/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');
  const kDate = createHmac('sha256', `AWS4${secretKey}`).update(dateStamp).digest();
  const kRegion = createHmac('sha256', kDate).update(market.region).digest();
  const kService = createHmac('sha256', kRegion).update('ProductAdvertisingAPI').digest();
  const kSigning = createHmac('sha256', kService).update('aws4_request').digest();
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');
  const authorization =
    `${algorithm} Credential=${accessKey}/${credentialScope}, ` +
    `SignedHeaders=content-type;host;x-amz-date, Signature=${signature}`;

  const response = await fetch(`https://${host}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Amz-Date': amzDate,
      'X-Amz-Target': 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems',
      Authorization: authorization,
      'Content-Encoding': 'amz-1.0',
      PartnerTag: partnerTag,
      PartnerType: 'Associates',
    },
    body: payload,
  });
  if (!response.ok) {
    throw new Error(`PA-API ${path} → HTTP ${response.status} (${await response.text()})`);
  }
  return response.json();
}

/** Retry with exponential backoff (429/5xx), ~1 rps pacing (S1). */
async function withRetry(task, label) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      const result = await task();
      await sleep(RPS_DELAY_MS);
      return result;
    } catch (error) {
      if (attempt === MAX_RETRIES - 1) {
        throw error;
      }
      await sleep(RPS_DELAY_MS * 2 ** attempt);
    }
  }
  throw new Error(`unreachable retry for ${label}`);
}

async function searchCandidates(product, market) {
  if (adapterMode === 'mock') {
    // Mock is a local deterministic generator — no server politeness needed.
    return mockSearch(product, market);
  }
  return withRetry(() => paapiSearch(product, market), `${product.id}@${market.code}`);
}

// ---------------------------------------------------------------------------
// S2 — ranking (enrich-script style).

function cleanTokens(value) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 3);
}

function rankCandidate(candidate, product) {
  const title = candidate.title.toLowerCase();
  const name = product.name.toLowerCase();
  if (BAD_TOKENS.some((token) => title.includes(token))) {
    return { ok: false, reason: 'rejected: bad token (logo/icon/diagram…)' };
  }
  if (OFFENSIVE_TOKENS.some((token) => title.includes(token))) {
    return { ok: false, reason: 'rejected: offensive blocklist' };
  }
  const url = (candidate.imageUrl ?? '').toLowerCase();
  const raster = /\.(jpe?g|png)$/.test(url) || url.includes('images.amazon');
  if (!raster) {
    return { ok: false, reason: 'rejected: non-raster URL' };
  }
  const large = url.includes('._sl1200_.') || url.includes('/images/p/');
  const shared = cleanTokens(product.name).filter((token) => title.includes(token)).length;
  if (shared === 0) {
    return { ok: false, reason: 'rejected: no title-token overlap' };
  }
  const hasFamilyToken = FAMILY_TOKENS.some((token) => name.includes(token));
  if (hasFamilyToken) {
    // Ambiguity guard: family-suffixed names ("Ice Maker Set") need the
    // core token in the title, not just the family word.
    const core = cleanTokens(product.name).filter((token) => !FAMILY_TOKENS.includes(token));
    if (core.length > 0 && !core.some((token) => title.includes(token))) {
      return { ok: false, reason: 'rejected: ambiguous (product-family token missing)' };
    }
  }
  const fullName = title.includes(name) ? 4 : 0;
  return {
    ok: true,
    score: shared * 3 + fullName + (large ? 1 : 0),
    reason:
      `${shared} token${shared === 1 ? '' : 's'} overlap` +
      `${fullName ? ', full-name match' : ''}${large ? ', large image' : ''}`,
  };
}

function rankCandidates(candidates, product) {
  return candidates
    .map((candidate, index) => ({ candidate, index, ...rankCandidate(candidate, product) }))
    .sort((a, b) => {
      if (a.ok !== b.ok) return a.ok ? -1 : 1;
      return (b.score ?? 0) - (a.score ?? 0);
    });
}

// ---------------------------------------------------------------------------
// S3 — human review artifacts (scripts/.cache/price-review/, never ships).

function csvEscape(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function writeReviewArtifacts(rows) {
  mkdirSync(REVIEW_DIR, { recursive: true });
  mkdirSync(join(REVIEW_DIR, 'thumbnails'), { recursive: true });

  const csvLines = [
    ['id', 'name', 'market', 'status', 'top-candidate', 'rank-reason', 'flags'].join(','),
  ];
  const htmlRows = [];
  for (const row of rows) {
    const top = row.ranked.find((entry) => entry.ok);
    const flags = row.flags.join(' | ') || 'none';
    csvLines.push(
      [
        row.id,
        row.name,
        row.market,
        top ? 'candidate' : (row.flags[0] ?? 'no-candidates'),
        top?.candidate.title ?? '',
        top?.reason ?? '',
        flags,
      ]
        .map(csvEscape)
        .join(',')
    );
    htmlRows.push(
      `<tr><td>${row.id}</td><td>${row.name}</td><td>${row.market}</td><td>${
        top ? top.candidate.title : flags
      }</td><td>${top?.reason ?? ''}</td><td>${flags}</td></tr>`
    );
    // Local thumbnail for the top candidate (mock: fixture copy).
    if (top) {
      const thumb = join(REVIEW_DIR, 'thumbnails', `${row.id}-${row.market}.jpg`);
      if (existsSync(FIXTURE_IMAGE)) {
        copyFileSync(FIXTURE_IMAGE, thumb);
      }
    }
  }
  writeFileSync(join(REVIEW_DIR, 'review.csv'), csvLines.join('\n') + '\n');
  writeFileSync(
    join(REVIEW_DIR, 'review.html'),
    `<!doctype html><html><head><meta charset="utf-8"><title>Price review</title></head>
<body><h1>Price image review (${rows.length} rows)</h1>
<p>Review candidates, then write <code>approved.json</code> ({ id: { market, candidateIndex } }) and run <code>--apply</code>. Nothing ships without an approve.</p>
<table border="1"><tr><th>id</th><th>name</th><th>market</th><th>top candidate</th><th>reason</th><th>flags</th></tr>${htmlRows.join('')}</table>
</body></html>\n`
  );
  writeFileSync(join(REVIEW_DIR, 'rows.json'), JSON.stringify(rows, null, 2) + '\n');
}

// ---------------------------------------------------------------------------
// S4 — download + self-host (real) / fixture copy (mock).

async function downloadImage(productId, imageUrl) {
  mkdirSync(IMAGE_OUT_DIR, { recursive: true });
  const target = join(IMAGE_OUT_DIR, `${productId}.jpg`);
  if (adapterMode === 'mock') {
    if (!existsSync(FIXTURE_IMAGE)) {
      return { ok: false, reason: 'download-failed: fixture missing' };
    }
    copyFileSync(FIXTURE_IMAGE, target);
    return { ok: true, bytes: statSync(target).size };
  }
  // Amazon URL size token: serve at ≤1200px, JPEG as-served (no webp).
  const url = imageUrl
    .replace(/\._SL\d+_\./i, '._SL1200_.')
    .replace(/(\.(?:jpe?g|png))$/i, '._SL1200_.$1');
  const response = await fetch(url);
  if (!response.ok) {
    return { ok: false, reason: `download-failed: HTTP ${response.status}` };
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(target, buffer);
  return { ok: true, bytes: buffer.length };
}

// ---------------------------------------------------------------------------
// S5 — resolved layer (src/data/price-resolved.json, keyed by product id).

function readProducts() {
  return JSON.parse(readFileSync(PRODUCTS_PATH, 'utf8'));
}

function readJsonOr(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

function loadApprovals() {
  const approvals = readJsonOr(APPROVED_PATH, {});
  return typeof approvals === 'object' && approvals !== null && !Array.isArray(approvals)
    ? approvals
    : {};
}

function unresolvedRow(reason) {
  return { status: 'unresolved', reason };
}

function resolvedRow({ product, candidate, market, approvedAt }) {
  return {
    status: 'resolved',
    source: market.domain,
    asin: candidate.asin,
    image: `/images/price/${product.id}.jpg`,
    detailPageUrl: candidate.detailPageUrl,
    prices: {
      usd: candidate.priceUsd ?? null,
      inr: candidate.priceInr ?? null,
    },
    priceUpdatedAt: new Date().toISOString(),
    approvedAt,
  };
}

/** --apply: download approved images and write the full resolved layer. */
async function applyResolved() {
  const products = readProducts();
  const candidatesByProduct = readJsonOr(CANDIDATES_PATH, {});
  const approvals = loadApprovals();
  const approvedIds = Object.keys(approvals);
  if (approvedIds.length === 0) {
    console.log('No approvals found — writing all products as not-yet-resolved.');
  }
  const resolvedById = {};
  const now = new Date();
  for (const product of products) {
    const approval = approvals[product.id];
    const market = MARKETS.find((entry) => entry.code === approval?.market);
    const rankedList = candidatesByProduct[product.id]?.[approval?.market];
    const entry = rankedList?.[approval?.candidateIndex];
    // The review gate: only candidates that ranked ok AND were explicitly
    // approved ship. Everything else stays unresolved.
    if (!market || !entry?.ok) {
      resolvedById[product.id] = unresolvedRow(approval ? 'rejected' : 'not-yet-resolved');
      continue;
    }
    const candidate = entry.candidate;
    const downloaded = await downloadImage(product.id, candidate.imageUrl);
    if (!downloaded.ok) {
      resolvedById[product.id] = unresolvedRow('download-failed');
      continue;
    }
    resolvedById[product.id] = resolvedRow({
      product,
      candidate,
      market,
      approvedAt: now.toISOString(),
    });
  }
  writeFileSync(RESOLVED_PATH, JSON.stringify(resolvedById, null, 2) + '\n');
  const resolvedCount = Object.values(resolvedById).filter(
    (row) => row.status === 'resolved'
  ).length;
  console.log(
    `price-resolved.json: ${resolvedCount}/${products.length} resolved (${adapterMode} adapter)`
  );
}

/** S5b --refresh: GetItems price refresh (10 ASINs/request per market). */
async function refreshPrices() {
  const resolvedById = readJsonOr(RESOLVED_PATH, {});
  const resolved = Object.entries(resolvedById).filter(
    ([, row]) => row && row.status === 'resolved'
  );
  if (resolved.length === 0) {
    console.log('No resolved rows to refresh.');
    return;
  }
  const updatedAt = new Date().toISOString();
  for (const market of MARKETS) {
    const asins = resolved.map(([, row]) => row.asin);
    for (let offset = 0; offset < asins.length; offset += 10) {
      const chunk = asins.slice(offset, offset + 10);
      if (adapterMode === 'mock') {
        // Mock refresh: deterministic re-derivation, timestamp bumped.
        for (const asin of chunk) {
          const entry = resolved.find(([, row]) => row.asin === asin);
          if (entry) {
            entry[1].prices.usd = Math.round(entry[1].prices.usd * 1.02 * 100) / 100;
            entry[1].priceUpdatedAt = updatedAt;
          }
        }
        continue;
      }
      const body = await withRetry(() => paapiGetItems(chunk, market), `refresh ${market.code}`);
      const items = body?.ItemsResult?.Items ?? [];
      for (const item of items) {
        const entry = resolved.find(([, row]) => row.asin === item.ASIN);
        if (entry) {
          const amount = priceAmount(item);
          if (amount !== null && amount > 0) {
            if (market.code === 'US') {
              entry[1].prices.usd = amount;
            } else {
              entry[1].prices.inr = amount;
            }
            entry[1].priceUpdatedAt = updatedAt;
          }
        }
      }
    }
  }
  writeFileSync(RESOLVED_PATH, JSON.stringify(resolvedById, null, 2) + '\n');
  console.log(`price refresh: ${resolved.length} rows updated (${adapterMode} adapter)`);
}

/** S1-S3 --search: bulk search, rank, write review artifacts. */
async function searchAndReview() {
  const products = readProducts();
  mkdirSync(CACHE_DIR, { recursive: true });
  const candidatesByProduct = {};
  const rows = [];
  for (const product of products) {
    const byMarket = {};
    for (const market of MARKETS) {
      const candidates = await searchCandidates(product, market);
      // Cache the RANKED list (with ok/reason) — --apply only ships
      // candidates that passed S2 and were explicitly approved.
      byMarket[market.code] = rankCandidates(candidates, product).map(
        ({ candidate, index, ok, reason, score }) => ({ candidate, index, ok, reason, score })
      );
      const ranked = rankCandidates(candidates, product);
      const flags = [];
      const usable = ranked.filter((entry) => entry.ok);
      if (usable.length === 0) {
        flags.push('no-candidates');
      } else {
        // Ambiguous = the top score is tied (reviewer decides); a single
        // clear best candidate needs no human call.
        const topScore = usable[0]?.score ?? 0;
        if (usable.filter((entry) => entry.score === topScore).length > 1) {
          flags.push('ambiguous');
        }
      }
      for (const entry of ranked) {
        if (!entry.ok && entry.reason.startsWith('rejected: offensive')) {
          flags.push('offensive');
        }
      }
      rows.push({
        id: product.id,
        name: product.name,
        market: market.code,
        ranked: ranked.map(({ candidate, index, ok, reason, score }) => ({
          candidate,
          index,
          ok,
          reason,
          score,
        })),
        flags,
      });
    }
    candidatesByProduct[product.id] = byMarket;
    console.log(`searched ${product.id}`);
  }
  writeFileSync(CANDIDATES_PATH, JSON.stringify(candidatesByProduct, null, 2) + '\n');
  writeReviewArtifacts(rows);
  console.log(
    `search done (${adapterMode} adapter): ${products.length} products × ${MARKETS.length} markets; review artifacts in scripts/.cache/price-review/`
  );
}

// ---------------------------------------------------------------------------

const mode = process.argv.find((arg) => arg.startsWith('--'));
async function main() {
  console.log(`resolve-price-images: ${adapterMode} adapter (${mode ?? 'no mode'})`);
  if (mode === '--search') {
    await searchAndReview();
  } else if (mode === '--apply') {
    await applyResolved();
  } else if (mode === '--refresh') {
    await refreshPrices();
  } else {
    console.error('Usage: node scripts/resolve-price-images.mjs --search | --apply | --refresh');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(
    `resolve-price-images failed: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
});
