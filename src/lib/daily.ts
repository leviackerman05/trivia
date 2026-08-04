/**
 * Daily games framework (Phase 0/1, expanded in Phase A).
 *
 * A daily game is a registered entry: same content for everyone on the same
 * UTC day, one score per player per day, a streak, and a share card.
 * The registry is the single source of truth for the /daily hub, the
 * per-game /daily/[slug] pages, and the sitemap. Adding a new daily game is:
 * one registry entry + a deterministic per-day seed (dailyGameSeed) so the
 * island picks the same content for everyone. Trivia keeps its server-seeded
 * challenge (daily-challenge.*); the rest follow the sudoku pattern of a
 * client-side seeded pool (D050).
 */

import { hashString } from './trivia';

export type DailyCategory =
  'trivia' | 'puzzle' | 'word' | 'drawing' | 'geography' | 'movies' | 'music' | 'social';

export interface DailyGame {
  slug: string;
  name: string;
  emoji: string;
  category: DailyCategory;
  /** Short pitch shown on the hub card. */
  description: string;
  /** Minutes for a typical play. */
  estimatedMinutes: number;
  /** Difficulty tiers offered today (empty = single tier). */
  tiers: string[];
  /** True when /daily/[slug] renders a playable engine today. */
  live: boolean;
  /** Fallback game page for "coming soon" entries. */
  gameSlug?: string;
}

export const dailyGames: DailyGame[] = [
  {
    slug: 'trivia',
    name: 'Daily Trivia',
    emoji: '🧠',
    category: 'trivia',
    description: 'Ten seeded questions, same for everyone today. Speed scoring, daily leaderboard.',
    estimatedMinutes: 5,
    tiers: [],
    live: true,
  },
  {
    slug: 'sudoku',
    name: 'Daily Sudoku',
    emoji: '🔢',
    category: 'puzzle',
    description: 'One seeded grid for the whole world. Finish it, score 200, race the board.',
    estimatedMinutes: 15,
    tiers: [],
    live: true,
  },
  {
    slug: 'emoji-plot',
    name: 'Daily Emoji Plot',
    emoji: '🎬',
    category: 'movies',
    description: 'Decode the movie and book of the day from emoji sequences.',
    estimatedMinutes: 5,
    tiers: [],
    live: true,
  },
  {
    slug: 'timeline-tussle',
    name: 'Daily Timeline',
    emoji: '📜',
    category: 'trivia',
    description: 'Order today history in the right sequence. Three events, one correct line.',
    estimatedMinutes: 5,
    tiers: [],
    live: true,
  },
  {
    slug: 'price-is-right',
    name: 'Daily Price Guess',
    emoji: '🏷️',
    category: 'trivia',
    description: 'Five products, one price each. Guess close, never over.',
    estimatedMinutes: 5,
    tiers: [],
    live: true,
  },
  {
    slug: 'rhyme-or-crime',
    name: 'Daily Rhyme',
    emoji: '🎵',
    category: 'word',
    description: 'A rhyme that fits the category. Today prompt is served fresh.',
    estimatedMinutes: 5,
    tiers: [],
    live: true,
  },
  {
    slug: 'genre-swap',
    name: 'Daily Genre Swap',
    emoji: '🎭',
    category: 'movies',
    description: 'Spot the original film behind a wildly wrong genre, ten rounds.',
    estimatedMinutes: 5,
    tiers: [],
    live: true,
  },
  {
    slug: 'genre-bender',
    name: 'Daily Genre-Bender',
    emoji: '📖',
    category: 'music',
    description: 'Name the song behind a sonnet-ified lyric, ten bended classics.',
    estimatedMinutes: 5,
    tiers: [],
    live: true,
  },
  {
    slug: 'geography',
    name: 'Daily Geography',
    emoji: '🌍',
    category: 'geography',
    description: 'Pin the place from a photo. Coming in the next milestone.',
    estimatedMinutes: 5,
    tiers: [],
    live: false,
    gameSlug: 'skribbl-arena',
  },
  {
    slug: 'movies',
    name: 'Daily Movie',
    emoji: '🍿',
    category: 'movies',
    description: 'Real or fake synopsis? Coming in the next milestone.',
    estimatedMinutes: 5,
    tiers: [],
    live: false,
    gameSlug: 'genre-swap',
  },
  {
    slug: 'music',
    name: 'Daily Music',
    emoji: '🎶',
    category: 'music',
    description: 'Name that melody. Coming in the next milestone.',
    estimatedMinutes: 5,
    tiers: [],
    live: false,
    gameSlug: 'genre-bender',
  },
  {
    slug: 'drawing',
    name: 'Daily Drawing',
    emoji: '✏️',
    category: 'drawing',
    description: 'Draw the prompt, then vote on the world best. Coming in the next milestone.',
    estimatedMinutes: 5,
    tiers: [],
    live: false,
    gameSlug: 'skribbl-arena',
  },
];

const bySlug = new Map(dailyGames.map((game) => [game.slug, game]));

export function getDailyGame(slug: string): DailyGame | undefined {
  return bySlug.get(slug);
}

/**
 * Deterministic per-day selection seed for a daily game (Phase A, D050).
 * Same UTC date + same game slug always yields the same seed, so everyone
 * plays the same content and replays of the day are stable. Mirrors the
 * existing sudoku pattern (client-side seeded pool); trivia keeps its
 * server-seeded challenge unchanged.
 */
export function dailyGameSeed(dateKey: string, slug: string): number {
  return hashString(`${dateKey}:${slug}`);
}

export function getLiveDailyGames(): DailyGame[] {
  return dailyGames.filter((game) => game.live);
}

export function getPlannedDailyGames(): DailyGame[] {
  return dailyGames.filter((game) => !game.live);
}

/**
 * Local play history for daily games: { [slug]: { [dateKey]: score } }.
 * Client-side for now; server-side history arrives with identity (vision
 * M1.5.1). Capped per game to the last 90 days to bound storage.
 */
export const DAILY_HISTORY_KEY = 'triviahub:daily-history:v1';
const HISTORY_WINDOW_DAYS = 90;

export interface DailyHistory {
  [slug: string]: { [dateKey: string]: number };
}

export function readDailyHistory(): DailyHistory {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    const raw = localStorage.getItem(DAILY_HISTORY_KEY);
    return raw ? (JSON.parse(raw) as DailyHistory) : {};
  } catch {
    return {};
  }
}

export function recordDailyHistory(slug: string, score: number, dateKey: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  const history = readDailyHistory();
  const gameEntry = history[slug] ?? {};
  gameEntry[dateKey] = score;
  history[slug] = gameEntry;
  // Prune entries older than the window so storage stays bounded.
  const cutoff = new Date(`${dateKey}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - HISTORY_WINDOW_DAYS);
  const cutoffKey = cutoff.toISOString().slice(0, 10);
  for (const slugKey of Object.keys(history)) {
    const entries = history[slugKey] ?? {};
    for (const day of Object.keys(entries)) {
      if (day < cutoffKey) {
        delete entries[day];
      }
    }
  }
  try {
    localStorage.setItem(DAILY_HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Storage full/blocked, history is best-effort.
  }
}

/** Played today per game (used by the hub status island). */
export function playedToday(history: DailyHistory, dateKey: string): string[] {
  return dailyGames
    .filter((game) => (history[game.slug] ?? {})[dateKey] !== undefined)
    .map((game) => game.slug);
}
