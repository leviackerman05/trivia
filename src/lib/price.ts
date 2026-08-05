/**
 * M20 price pipeline, merged client view (D055/D056/D059).
 *
 * `loadPriceProducts()` merges the word-first authoring file
 * (`price-products.json`) with the resolved layer (`price-resolved.json`,
 * produced at build time by `scripts/resolve-price-images.mjs`). A product
 * with a missing OR stale resolved entry (priceUpdatedAt older than 24h) is
 * treated as unresolved at render — authored price + emoji fallback — so
 * the game stays playable offline. The loader is defensive: a malformed
 * resolved layer never throws, it degrades to all-unresolved.
 */

import priceProductsJson from '../data/price-products.json';
import priceResolvedJson from '../data/price-resolved.json';

export interface PriceResolvedRow {
  status: 'resolved';
  source: string; // amazon.com | amazon.in | pexels | pixabay | wikimedia
  asin: string;
  image: string; // self-hosted /images/price/{id}.jpg
  detailPageUrl: string; // stored tag-free; tags appended at render
  prices: { usd: number; inr: number };
  priceUpdatedAt: string;
  approvedAt: string;
}

export interface PriceUnresolvedRow {
  status: 'unresolved';
  /** Every unresolved row carries a non-empty reason (S5 contract). */
  reason: 'no-candidates' | 'rejected' | 'offensive' | 'download-failed' | 'not-yet-resolved';
}

export type PriceResolvedEntry = PriceResolvedRow | PriceUnresolvedRow;

export interface PriceProductView {
  id: string;
  name: string;
  emoji: string;
  description: string;
  price: number;
  category: string;
  specs: string[];
  /** Present only when the resolved row exists AND is fresh (≤24h). */
  resolved?: PriceResolvedRow;
}

const STALE_MS = 24 * 60 * 60 * 1000;

/** A price older than 24h (or unparseable) is stale at render. */
export function isStalePrice(priceUpdatedAt: string, now: Date = new Date()): boolean {
  const updated = Date.parse(priceUpdatedAt);
  if (!Number.isFinite(updated)) {
    return true;
  }
  return now.getTime() - updated > STALE_MS;
}

/** Risk-24 gate: a resolved row must carry the full resolution surface. */
export function isResolvedRowShape(row: unknown): row is PriceResolvedRow {
  if (typeof row !== 'object' || row === null) {
    return false;
  }
  const candidate = row as Record<string, unknown>;
  const prices = candidate.prices as Record<string, unknown> | undefined;
  return (
    candidate.status === 'resolved' &&
    typeof candidate.source === 'string' &&
    typeof candidate.asin === 'string' &&
    typeof candidate.image === 'string' &&
    typeof candidate.detailPageUrl === 'string' &&
    typeof candidate.priceUpdatedAt === 'string' &&
    typeof prices === 'object' &&
    prices !== null &&
    typeof prices.usd === 'number' &&
    typeof prices.inr === 'number'
  );
}

/** Pure merge; never throws, malformed rows degrade to unresolved. */
export function mergePriceProducts(
  products: PriceProductView[],
  resolvedById: unknown
): PriceProductView[] {
  if (!Array.isArray(products)) {
    return [];
  }
  const rows =
    resolvedById && typeof resolvedById === 'object' && !Array.isArray(resolvedById)
      ? (resolvedById as Record<string, unknown>)
      : {};
  return products.map((product) => {
    const row = rows[product.id];
    const resolved = isResolvedRowShape(row) && !isStalePrice(row.priceUpdatedAt) ? row : undefined;
    return { ...product, resolved };
  });
}

export function loadPriceProducts(): PriceProductView[] {
  return mergePriceProducts(
    priceProductsJson as PriceProductView[],
    priceResolvedJson as Record<string, unknown>
  );
}
