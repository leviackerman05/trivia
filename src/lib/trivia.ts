/**
 * Trivia solo logic (PRD §5.15 + owner requests: instant play, M18 flat
 * scoring, 525-question / 10-category dataset). Pure functions only — the
 * TriviaSolo island is a thin UI on top.
 *
 * Daily challenge model: the question set is seeded by UTC date, so every
 * player sees the same 10 questions on the same day and the leaderboard is
 * comparable. M18: 10 points per correct answer, 0 for wrong (the dataset
 * lives in src/data/trivia-questions.json, mirrored to the server).
 */

import questionsJson from '../data/trivia-questions.json';

export interface TriviaQuestion {
  category: string;
  question: string;
  options: string[];
  answer: number;
}

export const triviaQuestions = questionsJson as TriviaQuestion[];

export const TRIVIA_QUESTIONS_PER_GAME = 10;
export const TRIVIA_QUESTION_SECONDS = 15;
/** M18 — flat scoring per the owner: 10 for a correct answer, 0 otherwise. */
export const TRIVIA_BASE_SCORE = 10;

/** FNV-1a string hash — deterministic across sessions and browsers. */
export function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** mulberry32 seeded PRNG — same seed always produces the same sequence. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** UTC date key (YYYY-MM-DD) — the daily challenge identity. */
export function dailyDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Deterministic per-day seed: same questions for everyone that day. */
export function dailySeed(date: Date): number {
  return hashString(dailyDateKey(date));
}

/**
 * The daily question set: seeded Fisher–Yates shuffle, first N questions.
 * Same date → same set, in the same order, for every player.
 */
export function selectDailyQuestions(
  date: Date,
  count = TRIVIA_QUESTIONS_PER_GAME
): TriviaQuestion[] {
  const rand = seededRandom(dailySeed(date));
  const pool = [...triviaQuestions];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const swap = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = swap;
  }
  return pool.slice(0, Math.min(count, pool.length));
}

/**
 * M18 scoring (owner request): 10 points for a correct answer, 0 for a
 * wrong one or a timeout. No speed bonus — the daily leaderboard is a
 * simple right-answer race. Max: 10 × 10 = 100 per game.
 */
export function scoreTriviaAnswer(_secondsRemaining: number, correct: boolean): number {
  return correct ? TRIVIA_BASE_SCORE : 0;
}

/**
 * Idempotency key for a completed solo game. Must match the server's
 * clientKey charset ([A-Za-z0-9._:-], 8–128 chars) — the player name is
 * hashed, never embedded raw. One key per completed game; retries reuse it.
 */
export function triviaClientKey(dateKey: string, playerName: string, nonce: string): string {
  return `trivia:${dateKey}:${hashString(playerName).toString(16)}:${nonce}`;
}
