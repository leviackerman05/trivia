/**
 * Trivia solo logic (PRD §5.15 + owner request 2026-08-04: instant play).
 * Pure functions only — the TriviaSolo island is a thin UI on top.
 *
 * Daily challenge model: the question set is seeded by UTC date, so every
 * player sees the same 10 questions on the same day and the leaderboard is
 * comparable. The static dataset (100 questions, M4-era) is expanded toward
 * the PRD's 500+ target in a later milestone.
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
export const TRIVIA_BASE_SCORE = 100;
export const TRIVIA_SPEED_BONUS_PER_SECOND = 10;

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
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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
 * PRD §5.15 scoring: base + speed bonus per remaining second.
 * No answer (timeout) scores 0. Max: 100 + 10 × 15 = 250 per question.
 */
export function scoreTriviaAnswer(secondsRemaining: number, correct: boolean): number {
  if (!correct || secondsRemaining <= 0) {
    return 0;
  }
  return TRIVIA_BASE_SCORE + TRIVIA_SPEED_BONUS_PER_SECOND * secondsRemaining;
}

/**
 * Idempotency key for a completed solo game. Must match the server's
 * clientKey charset ([A-Za-z0-9._:-], 8–128 chars) — the player name is
 * hashed, never embedded raw. One key per completed game; retries reuse it.
 */
export function triviaClientKey(dateKey: string, playerName: string, nonce: string): string {
  return `trivia:${dateKey}:${hashString(playerName).toString(16)}:${nonce}`;
}
