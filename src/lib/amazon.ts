/**
 * M20 price pipeline, Amazon affiliate surface (D056/D059).
 *
 * Tags are public render-time constants (not secrets — PA-API keys never
 * leave build env). `detailPageUrl` is stored tag-free in the resolved
 * layer; the tag is appended at render by `amazonUrl`.
 */

/** Public per-market Associates tags. Placeholders — fill with the real
 * Associates tags before launch. */
export const AMAZON_TAGS: Record<'US' | 'IN', string> = {
  US: 'triviahub-20',
  IN: 'triviahub-21',
};

/** Append the market's tag to a stored (tag-free) detail page URL. */
export function amazonUrl(detailPageUrl: string, market: 'US' | 'IN'): string {
  const separator = detailPageUrl.includes('?') ? '&' : '?';
  return `${detailPageUrl}${separator}tag=${encodeURIComponent(AMAZON_TAGS[market])}`;
}
