/**
 * Server-side daily game registry (Phase 1.5 + R18/R20 amendments).
 *
 * The full registry with metadata lives client-side in src/lib/daily.ts
 * (hub cards, sitemap, planned games). The server only needs to know which
 * daily games are live, because those are the only ones that accept daily
 * runs. A lockstep test (client games.test.ts) keeps the two in sync, the
 * same pattern as PLAYABLE_ROOM_GAMES.
 *
 * Owner demotion (2026-08-07): emoji-plot, price-is-right, rhyme-or-crime,
 * genre-swap, genre-bender, and drawing duplicate their normal games, so
 * they leave the live set. Their streak/run rows stay in the DB untouched
 * (data-inert, no migration) — they are simply never served or scored
 * again. Owner amendment (same day, D067): chess moved to a client-side
 * CPU game (chess.js + Stockfish WASM) and leaves the daily registry; its
 * dormant puzzle data stays in server/src/data/chess-puzzles.json. Daily
 * Wordle (R20) joins the live set.
 */

export const LIVE_DAILY_GAMES = [
  'trivia',
  'sudoku',
  'timeline-tussle',
  // Client-engine dailies that survived the 2026-08-07 demotion.
  'movies',
  'music',
  // R20: Daily Wordle — registry line only; the day's word is picked
  // CLIENT-side (D050 seeded pool), so the server has no wordle data.
  'wordle',
] as const;

export type LiveDailyGameSlug = (typeof LIVE_DAILY_GAMES)[number];

export function isLiveDailyGame(slug: string): slug is LiveDailyGameSlug {
  return (LIVE_DAILY_GAMES as readonly string[]).includes(slug);
}
