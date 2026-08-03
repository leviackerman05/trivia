/**
 * Rhyme or Crime (M7, PRD §5.2) — pure game logic. The dataset encodes the
 * CMU-pronouncing-dictionary work at generation time (prompt + category +
 * valid rhyming answers), so validation is a dataset lookup: the guess must
 * be one of the answers (case/space-insensitive). Scoring: +10 correct, +5
 * speed bonus under 10s, streak multiplier ×2 after 3 consecutive, ×3 after 5.
 */

import { normalizeAnswer } from './solo';

export interface RhymeEntry {
  prompt: string;
  category: string;
  answers: string[];
}

export const RHYME_ROUND_SECONDS = 60;
export const RHYME_SPEED_BONUS_MS = 10_000;
export const RHYME_TOTAL_ROUNDS = 5;

export function pickRhymeRounds(
  entries: RhymeEntry[],
  count = RHYME_TOTAL_ROUNDS,
  seed = 0
): RhymeEntry[] {
  const pool = [...entries];
  const rounds: RhymeEntry[] = [];
  let cursor = seed;
  while (rounds.length < count && pool.length > 0) {
    const index = cursor % pool.length;
    rounds.push(pool[index]!);
    pool.splice(index, 1);
    cursor += 1;
  }
  return rounds;
}

export interface RhymeVerdict {
  correct: boolean;
  /** A valid answer to reveal after a miss. */
  reveal: string;
  basePoints: number;
  streakMultiplier: number;
  points: number;
}

export function judgeRhymeAnswer(
  entry: RhymeEntry,
  guess: string,
  elapsedMs: number
): RhymeVerdict {
  const normalized = normalizeAnswer(guess);
  const correct = entry.answers.some((answer) => normalizeAnswer(answer) === normalized);
  const reveal = entry.answers[0] ?? entry.prompt;
  const basePoints = correct ? 10 + (elapsedMs <= RHYME_SPEED_BONUS_MS ? 5 : 0) : 0;
  return { correct, reveal, basePoints, streakMultiplier: 1, points: basePoints };
}

/** Consecutive-correct multiplier: ×2 from the 3rd, ×3 from the 5th. */
export function streakMultiplier(consecutiveCorrect: number): number {
  if (consecutiveCorrect >= 5) {
    return 3;
  }
  if (consecutiveCorrect >= 3) {
    return 2;
  }
  return 1;
}

export function applyMultiplier(verdict: RhymeVerdict, consecutiveCorrect: number): RhymeVerdict {
  const multiplier = verdict.correct ? streakMultiplier(consecutiveCorrect) : 1;
  return { ...verdict, streakMultiplier: multiplier, points: verdict.basePoints * multiplier };
}
