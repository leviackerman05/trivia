import { describe, expect, it } from 'vitest';
import priceProductsJson from '../../data/price-products.json';
import priceResolvedJson from '../../data/price-resolved.json';
import {
  isResolvedRowShape,
  isStalePrice,
  loadPriceProducts,
  mergePriceProducts,
  type PriceProductView,
  type PriceResolvedEntry,
  type PriceResolvedRow,
  type PriceUnresolvedRow,
} from '../price';
import { amazonUrl } from '../amazon';

const resolvedById = priceResolvedJson as Record<string, PriceResolvedEntry>;
const products = priceProductsJson as PriceProductView[];

describe('price-resolved.json dataset (M20 S5 contract)', () => {
  it('covers every product in the authoring file (keys match ids)', () => {
    const ids = new Set(products.map((product) => product.id));
    expect(new Set(Object.keys(resolvedById))).toEqual(ids);
  });

  it('gives every unresolved row a non-empty reason', () => {
    const unresolved = Object.entries(resolvedById).filter(
      ([, row]) => row.status === 'unresolved'
    ) as [string, PriceUnresolvedRow][];
    expect(unresolved.length).toBeGreaterThan(0);
    for (const [id, row] of unresolved) {
      expect(row.reason, id).toBeTruthy();
      expect(row.reason.length, id).toBeGreaterThan(0);
    }
  });

  it('gives every resolved row the full resolution surface (risk 24 gate)', () => {
    const resolved = Object.entries(resolvedById).filter(
      ([, row]) => row.status === 'resolved'
    ) as [string, PriceResolvedRow][];
    for (const [id, row] of resolved) {
      expect(isResolvedRowShape(row), id).toBe(true);
      expect(row.image, id).toBe(`/images/price/${id}.jpg`);
      // amazon-source rows always carry asin + detailPageUrl (same fields).
      expect(row.asin.length, id).toBeGreaterThan(0);
      expect(row.detailPageUrl, id).toMatch(/^https:\/\//);
      expect(row.prices.usd, id).toBeGreaterThan(0);
      expect(row.prices.inr, id).toBeGreaterThan(0);
    }
  });
});

describe('isStalePrice (D059, 24h freshness)', () => {
  const now = new Date('2026-08-05T12:00:00.000Z');
  const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000).toISOString();

  it('flags prices older than 24h as stale', () => {
    expect(isStalePrice(hoursAgo(25), now)).toBe(true);
    expect(isStalePrice(hoursAgo(48), now)).toBe(true);
  });

  it('keeps fresh prices (≤24h) usable', () => {
    expect(isStalePrice(hoursAgo(23), now)).toBe(false);
    expect(isStalePrice(hoursAgo(24), now)).toBe(false);
    expect(isStalePrice(hoursAgo(0), now)).toBe(false);
  });

  it('treats unparseable timestamps as stale', () => {
    expect(isStalePrice('not-a-date', now)).toBe(true);
    expect(isStalePrice('', now)).toBe(true);
  });
});

describe('mergePriceProducts / loadPriceProducts (merged loader)', () => {
  const product: PriceProductView = {
    id: 'banana-slicer-pro',
    name: 'Banana Slicer Pro',
    emoji: '🍌',
    description: 'A curved blade.',
    price: 12,
    category: 'kitchen',
    specs: [],
  };
  const fresh = new Date(Date.now() - 3_600_000).toISOString();
  const stale = new Date(Date.now() - 48 * 3_600_000).toISOString();
  const resolvedRow = {
    status: 'resolved',
    source: 'amazon.com',
    asin: 'B0MOCK0001',
    image: '/images/price/banana-slicer-pro.jpg',
    detailPageUrl: 'https://www.amazon.com/dp/B0MOCK0001',
    prices: { usd: 11.5, inr: 990 },
    priceUpdatedAt: fresh,
    approvedAt: fresh,
  };

  it('exposes the resolved view for a fresh resolved row', () => {
    const [view] = mergePriceProducts([product], { 'banana-slicer-pro': resolvedRow });
    expect(view?.resolved).toEqual(resolvedRow);
  });

  it('falls back to the emoji path when the row is missing, stale, or unresolved', () => {
    const missing = mergePriceProducts([product], {});
    expect(missing[0]?.resolved).toBeUndefined();

    const staleRow = { ...resolvedRow, priceUpdatedAt: stale };
    const staleView = mergePriceProducts([product], { 'banana-slicer-pro': staleRow });
    expect(staleView[0]?.resolved).toBeUndefined();

    const unresolved = mergePriceProducts([product], {
      'banana-slicer-pro': { status: 'unresolved', reason: 'not-yet-resolved' },
    });
    expect(unresolved[0]?.resolved).toBeUndefined();
  });

  it('never throws on malformed resolved input (defensive: all-unresolved)', () => {
    expect(mergePriceProducts([product], null).length).toBe(1);
    expect(mergePriceProducts([product], undefined).length).toBe(1);
    expect(mergePriceProducts([product], 'garbage').length).toBe(1);
    expect(mergePriceProducts([product], [1, 2, 3]).length).toBe(1);
    expect(() =>
      mergePriceProducts([product], { 'banana-slicer-pro': { status: 'resolved' } })
    ).not.toThrow();
    expect(
      mergePriceProducts([product], { 'banana-slicer-pro': { status: 'resolved' } })[0]?.resolved
    ).toBeUndefined();
    expect(() => mergePriceProducts([], { x: resolvedRow })).not.toThrow();
  });

  it('loadPriceProducts loads the committed layers without throwing', () => {
    const views = loadPriceProducts();
    expect(views).toHaveLength(products.length);
    // Committed state is not-yet-resolved ⇒ emoji fallback everywhere.
    for (const view of views) {
      expect(view.resolved).toBeUndefined();
    }
  });
});

describe('amazonUrl (render-time tag append, D059)', () => {
  it('appends the market tag to a tag-free detail page URL', () => {
    const url = amazonUrl('https://www.amazon.com/dp/B0MOCK0001', 'US');
    expect(url).toBe('https://www.amazon.com/dp/B0MOCK0001?tag=triviahub-20');
  });

  it('handles URLs that already carry a query string', () => {
    const url = amazonUrl('https://www.amazon.in/dp/B0MOCK0001?th=1', 'IN');
    expect(url).toBe('https://www.amazon.in/dp/B0MOCK0001?th=1&tag=triviahub-21');
  });
});
