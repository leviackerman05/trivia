/**
 * Server-side daily game registry (Phase 1.5).
 *
 * The full registry with metadata lives client-side in src/lib/daily.ts
 * (hub cards, sitemap, planned games). The server only needs to know which
 * daily games are live, because those are the only ones that accept daily
 * runs. A lockstep test (client games.test.ts) keeps the two in sync, the
 * same pattern as PLAYABLE_ROOM_GAMES.
 */

export const LIVE_DAILY_GAMES = [
  'trivia',
  'sudoku',
  'emoji-plot',
  'timeline-tussle',
  'price-is-right',
  'rhyme-or-crime',
  'genre-swap',
  'genre-bender',
  // M19 (DAILY-DESIGN §7): the four coming-soon dailies flip live together.
  'geography',
  'movies',
  'music',
  'drawing',
] as const;

export type LiveDailyGameSlug = (typeof LIVE_DAILY_GAMES)[number];

export function isLiveDailyGame(slug: string): slug is LiveDailyGameSlug {
  return (LIVE_DAILY_GAMES as readonly string[]).includes(slug);
}
