/**
 * Post-build smoke test: serves the production `dist/` output and verifies
 * that the key routes render with expected content. Run AFTER `astro build`
 * (CI does: build → smoke). Deterministic, no Astro internals involved.
 *
 * Usage: pnpm smoke
 */
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';

const DIST_DIR = join(process.cwd(), 'dist');
const PORT = 4321;
const PAGE_WEIGHT_BUDGET_BYTES = 100 * 1024; // PRD §10: static pages < 100 KB

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

if (!existsSync(DIST_DIR)) {
  console.error('dist/ not found. Run `pnpm build` first.');
  process.exit(1);
}

const checks = [
  { path: '/', contains: 'Today at Trivia & Games' },
  { path: '/', contains: 'application/ld+json' },
  { path: '/daily', contains: 'Today at Trivia & Games' },
  { path: '/daily/trivia', contains: 'Daily Trivia' },
  { path: '/daily/sudoku', contains: 'Daily Sudoku' },
  { path: '/daily/emoji-plot', contains: 'Daily Emoji Plot' },
  { path: '/daily/timeline-tussle', contains: 'Daily Timeline' },
  { path: '/daily/price-is-right', contains: 'Daily Price Guess' },
  { path: '/daily/rhyme-or-crime', contains: 'Daily Rhyme' },
  { path: '/daily/genre-swap', contains: 'Daily Genre Swap' },
  { path: '/daily/genre-bender', contains: 'Daily Genre-Bender' },
  // M20 Phase 0.5: the removed daily 404s (the smoke server returns 404 for
  // missing files; checks may override the expected status).
  { path: '/daily/geography', status: 404 },
  { path: '/daily/movies', contains: 'Daily Movie' },
  { path: '/daily/music', contains: 'Daily Music' },
  { path: '/daily/drawing', contains: 'Daily Drawing' },
  { path: '/daily/archive', contains: 'Your daily archive' },
  { path: '/categories', contains: 'Browse by category' },
  { path: '/faq', contains: 'Frequently Asked Questions' },
  { path: '/faq', contains: 'application/ld+json' },
  { path: '/privacy-policy', contains: 'Privacy Policy' },
  { path: '/terms-and-conditions', contains: 'Terms &amp; Conditions' },
  { path: '/about-us', contains: 'About Trivia & Games' },
  { path: '/contact-us', contains: 'Contact Us' },
  { path: '/game/skribbl-arena', contains: 'Skribbl Arena' },
  { path: '/game/trivia', contains: 'More games like this' },
];

// PRD §6.2, every game page ships a 150-160-char meta description and the
// WebApplication + FAQPage JSON-LD blocks.
const GAME_SLUGS = [
  'skribbl-arena',
  'copycat-challenge',
  'draw-the-lyric',
  'one-line-one-shape',
  'shadow-sketch',
  'would-you-rather',
  'most-likely-to',
  'never-have-i-ever',
  'this-or-that',
  'rhyme-or-crime',
  'emoji-plot',
  'timeline-tussle',
  'price-is-right',
  'genre-swap',
  'genre-bender',
  'world-peek',
  'charades',
  'guess-who',
  'trivia',
  'sudoku',
];

// PRD §10: static pages < 100 KB total page weight (HTML + CSS + JS, no images).
const weightChecks = ['/', '/faq', '/game/skribbl-arena', '/daily/drawing'];

// PRD §10: bundle-size budget per game island (shared runtime excluded, it
// is cached once per visitor; the gate is on the per-island chunks).
const BUNDLE_BUDGET_BYTES = 300 * 1024;
const SHARED_RUNTIME_PREFIX = 'client.';

/**
 * PRD §10: static pages < 100 KB total page weight *excluding game
 * JavaScript bundles* (the interactive islands). We measure HTML + CSS;
 * game JS bundles get their own budget once islands ship (Lighthouse gate).
 */
function pageWeightBytes(html) {
  const assets = [...html.matchAll(/(?:src|href)="\/_astro\/[^"]+\.css"/g)].map((match) =>
    match[0].slice(match[0].indexOf('"') + 1, -1)
  );
  let total = Buffer.byteLength(html, 'utf8');
  for (const asset of assets) {
    const assetPath = join(DIST_DIR, asset.replace(/^\//, ''));
    if (isFile(assetPath)) {
      total += statSync(assetPath).size;
    }
  }
  return total;
}

function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function filePathFor(urlPath) {
  if (urlPath === '/') return join(DIST_DIR, 'index.html');
  const candidate = join(DIST_DIR, urlPath);
  if (isFile(candidate)) return candidate; // e.g. /robots.txt
  if (isFile(`${candidate}.html`)) return `${candidate}.html`;
  return join(DIST_DIR, urlPath, 'index.html'); // e.g. /faq/index.html
}

function contentType(path) {
  return MIME[extname(path)] ?? 'application/octet-stream';
}

const server = createServer(async (req, res) => {
  try {
    const urlPath = normalize(
      decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname)
    );
    const filePath = filePathFor(urlPath);
    if (!filePath.startsWith(DIST_DIR) || !existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const body = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': contentType(filePath) });
    res.end(body);
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Smoke server error');
  }
});

// Pre-flight: if another server (usually `pnpm dev`) already holds the
// port, the dual IPv4/IPv6 bind lets this script start anyway, and the
// fetches below measure the dev server's heavier HTML instead of dist/ —
// a false budget failure (observed ~111 KB vs ~96 KB on the homepage).
try {
  const probe = await fetch(`http://localhost:${PORT}`, {
    signal: AbortSignal.timeout(1000),
  });
  if (probe.ok) {
    console.error(
      `Smoke aborted: port ${PORT} is already serving (likely a dev server). ` +
        `Kill it first, e.g. pkill -f 'astro.mjs dev', then re-run.`
    );
    process.exit(1);
  }
} catch {
  // Nothing listening — safe to start.
}

server.listen(PORT, async () => {
  console.log(`Smoke server on http://localhost:${PORT}`);
  try {
    for (const check of checks) {
      const response = await fetch(`http://localhost:${PORT}${check.path}`);
      const body = await response.text();
      const expectedStatus = check.status ?? 200;
      if (response.status !== expectedStatus) {
        throw new Error(`${check.path} → HTTP ${response.status}, expected ${expectedStatus}`);
      }
      if (check.contains !== undefined && !body.includes(check.contains)) {
        throw new Error(`${check.path} → missing expected content: "${check.contains}"`);
      }
      console.log(`✓ ${check.path}${expectedStatus === 200 ? '' : ` (${expectedStatus})`}`);
    }

    for (const path of weightChecks) {
      const response = await fetch(`http://localhost:${PORT}${path}`);
      const html = await response.text();
      const bytes = pageWeightBytes(html);
      if (bytes >= PAGE_WEIGHT_BUDGET_BYTES) {
        throw new Error(
          `${path} → page weight ${(bytes / 1024).toFixed(1)} KB exceeds the 100 KB budget (PRD §10)`
        );
      }
      console.log(`✓ ${path} weight ${(bytes / 1024).toFixed(1)} KB`);
    }

    // PRD §6.2, per-game meta description length + JSON-LD presence.
    for (const slug of GAME_SLUGS) {
      const response = await fetch(`http://localhost:${PORT}/game/${slug}`);
      const html = await response.text();
      const meta = html.match(/<meta name="description" content="([^"]*)"/);
      if (!meta) {
        throw new Error(`/game/${slug} → missing meta description`);
      }
      const length = meta[1].length;
      if (length < 150 || length > 160) {
        throw new Error(`/game/${slug} → meta description is ${length} chars (need 150-160)`);
      }
      if (!html.includes('"WebApplication"') || !html.includes('"FAQPage"')) {
        throw new Error(`/game/${slug} → missing WebApplication/FAQPage JSON-LD`);
      }
      console.log(`✓ /game/${slug} SEO (${length}-char meta + JSON-LD)`);
    }

    // PRD §10, bundle-size budget per game island chunk.
    for (const file of (await readdir(DIST_DIR + '/_astro')).filter((name) =>
      name.endsWith('.js')
    )) {
      if (file.startsWith(SHARED_RUNTIME_PREFIX)) {
        continue; // one-time shared runtime (React + socket client)
      }
      const size = statSync(join(DIST_DIR, '_astro', file)).size;
      if (size > BUNDLE_BUDGET_BYTES) {
        throw new Error(
          `bundle ${file} is ${(size / 1024).toFixed(1)} KB, over the ${BUNDLE_BUDGET_BYTES / 1024} KB island budget (PRD §10)`
        );
      }
    }
    console.log('✓ island bundles within budget');

    console.log('Smoke checks passed.');
    process.exitCode = 0;
  } catch (error) {
    console.error(`Smoke check failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
