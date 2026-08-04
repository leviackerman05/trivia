/**
 * Server-side streak engine (Phase 1.5, D048).
 *
 * Pure and dependency-free so the rules are unit-testable and the route layer
 * stays thin. Semantics:
 *
 * - A streak is a run of consecutive UTC days with at least one completed
 *   daily game (per-game scopes) or any daily game (the "grand" scope).
 * - Playing the same day twice is a no-op (DailyRun enforces one run per
 *   game per day at the DB layer; the engine just never double-counts).
 * - Missed days reset the streak to 1, unless protection covers the gap:
 *   1. Freeze tokens (earned one per 7-day milestone, capped) cover any
 *      number of missed days up to the token count.
 *   2. The season restore covers exactly one missed day, once per calendar
 *      quarter, when freezes run out. It is the mercy rule, not a farm.
 * - Freeze tokens are earned on streak milestones (every 7 consecutive
 *   days), capped at MAX_FREEZES. Protection is consumed automatically on
 *   the play that bridges the gap.
 */

export interface StreakState {
  current: number;
  longest: number;
  /** UTC day key of the last counted play ("YYYY-MM-DD"), "" before first play. */
  lastDate: string;
}

export interface StreakInput {
  state: StreakState;
  /** UTC day key of the play being recorded. */
  today: string;
  /** Freeze tokens available before this play. */
  freezes: number;
  /** True when this season's one-day restore has been consumed. */
  restoreUsed: boolean;
  /** Calendar quarter key, e.g. "2026-Q3". */
  seasonKey: string;
}

export interface StreakResult {
  state: StreakState;
  freezesUsed: number;
  freezesEarned: number;
  restoreUsed: boolean;
}

export const MAX_FREEZES = 3;
export const FREEZE_MILESTONE_DAYS = 7;
const DAY_MS = 86_400_000;

/** UTC day key for a date (mirrors the client's dailyDateKey). */
export function dateKeyOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Whole days between two UTC day keys (b - a). */
export function daysBetween(earlier: string, later: string): number {
  const a = Date.UTC(
    Number(earlier.slice(0, 4)),
    Number(earlier.slice(5, 7)) - 1,
    Number(earlier.slice(8, 10))
  );
  const b = Date.UTC(
    Number(later.slice(0, 4)),
    Number(later.slice(5, 7)) - 1,
    Number(later.slice(8, 10))
  );
  return Math.round((b - a) / DAY_MS);
}

/** Calendar quarter key for a UTC date, e.g. "2026-Q3". */
export function seasonKeyOf(date: Date): string {
  const key = dateKeyOf(date);
  const year = key.slice(0, 4);
  const month = Number(key.slice(5, 7));
  return `${year}-Q${Math.floor((month - 1) / 3) + 1}`;
}

export function nextStreakDay(input: StreakInput): StreakResult {
  const { state, today } = input;
  let restoreUsed = input.restoreUsed;

  // First play ever: start at 1.
  if (state.lastDate === '') {
    const next: StreakState = { current: 1, longest: 1, lastDate: today };
    return { state: next, freezesUsed: 0, freezesEarned: 0, restoreUsed };
  }

  // Same day: never double-count.
  if (state.lastDate === today) {
    return { state, freezesUsed: 0, freezesEarned: 0, restoreUsed };
  }

  const gap = daysBetween(state.lastDate, today);

  // Consecutive day: grow the streak.
  if (gap === 1) {
    const current = state.current + 1;
    const longest = Math.max(state.longest, current);
    const freezesEarned = current % FREEZE_MILESTONE_DAYS === 0 ? 1 : 0;
    return {
      state: { current, longest, lastDate: today },
      freezesUsed: 0,
      freezesEarned,
      restoreUsed,
    };
  }

  // Gap: missed days between lastDate and today.
  const missed = gap - 1;

  // 1. Freeze tokens cover missed days first.
  const tokensToUse = Math.min(missed, input.freezes);
  const missedAfterFreezes = missed - tokensToUse;

  // Freezes fully covered the gap: the streak continues.
  if (missedAfterFreezes === 0) {
    const current = state.current + 1;
    const longest = Math.max(state.longest, current);
    const freezesEarned = current % FREEZE_MILESTONE_DAYS === 0 ? 1 : 0;
    return {
      state: { current, longest, lastDate: today },
      freezesUsed: tokensToUse,
      freezesEarned,
      restoreUsed,
    };
  }

  // 2. The season restore covers exactly one missed day.
  if (missedAfterFreezes === 1 && !restoreUsed) {
    restoreUsed = true;
    const current = state.current + 1;
    const longest = Math.max(state.longest, current);
    const freezesEarned = current % FREEZE_MILESTONE_DAYS === 0 ? 1 : 0;
    return {
      state: { current, longest, lastDate: today },
      freezesUsed: tokensToUse,
      freezesEarned,
      restoreUsed,
    };
  }

  // 3. Unprotected gap: the streak resets to 1 (today counts as day 1).
  //    Tokens that were not needed stay in the pool for the future.
  const next: StreakState = { current: 1, longest: state.longest, lastDate: today };
  return { state: next, freezesUsed: tokensToUse, freezesEarned: 0, restoreUsed };
}
