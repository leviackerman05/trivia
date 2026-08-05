import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { games } from '../lib/games';

/**
 * Structural route tests, verify PRD §3 routes exist as source files and that
 * the SEO artifacts (robots.txt, sitemap.xml) cover every route.
 * Render-level verification of the production build lives in
 * scripts/smoke.mjs (run after `astro build` in CI).
 */

const pagesDir = join(process.cwd(), 'src', 'pages');
const publicDir = join(process.cwd(), 'public');

const STATIC_PAGES = [
  'index.astro',
  'faq.astro',
  'privacy-policy.astro',
  'terms-and-conditions.astro',
  'about-us.astro',
  'contact-us.astro',
  '404.astro',
  '500.astro',
];

const SITEMAP_STATIC_URLS = [
  'https://playtriviahub.com/',
  '/faq',
  '/privacy-policy',
  '/terms-and-conditions',
  '/about-us',
  '/contact-us',
];

describe('PRD §3 required routes', () => {
  it('has a source file for every required static page', () => {
    const files = readdirSync(pagesDir);
    for (const page of STATIC_PAGES) {
      expect(files, `missing ${page}`).toContain(page);
    }
  });

  it('has the dynamic game page template', () => {
    expect(existsSync(join(pagesDir, 'game', '[slug].astro'))).toBe(true);
  });

  it('covers every game slug from the catalog', () => {
    const slugs = games.map((game) => game.slug);
    expect(slugs).toHaveLength(20);
  });
});

describe('SEO artifacts (PRD §6.4)', () => {
  it('robots.txt references the sitemap', () => {
    const robots = readFileSync(join(publicDir, 'robots.txt'), 'utf-8');
    expect(robots).toContain('Sitemap: https://playtriviahub.com/sitemap.xml');
  });

  it('sitemap.xml lists every game page (19) and every static page', () => {
    const sitemap = readFileSync(join(publicDir, 'sitemap.xml'), 'utf-8');
    for (const url of SITEMAP_STATIC_URLS) {
      expect(sitemap, `sitemap missing ${url}`).toContain(url);
    }
    for (const game of games) {
      expect(sitemap, `sitemap missing /game/${game.slug}`).toContain(`/game/${game.slug}`);
    }
  });

  it('_headers exists for Cloudflare Pages', () => {
    expect(existsSync(join(publicDir, '_headers'))).toBe(true);
  });
});
