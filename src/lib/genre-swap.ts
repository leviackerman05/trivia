/**
 * Genre Swap (M8, PRD §5.9), pure game logic. 10 questions × 20s; a famous
 * movie plot rewritten in a wildly wrong genre; pick the original movie from
 * four options. Scoring: +10 correct, +5 speed bonus under 10s.
 */

import { buildOptions } from './solo';

export interface GenreSwapEntry {
  original: string;
  genre: string;
  description: string;
}

export const GENRE_SWAP_SECONDS = 20;
export const GENRE_SWAP_SPEED_BONUS_MS = 10_000;
export const GENRE_SWAP_TOTAL_QUESTIONS = 10;

export function pickGenreSwapQuestions(
  entries: GenreSwapEntry[],
  count = GENRE_SWAP_TOTAL_QUESTIONS,
  seed = 0
): GenreSwapEntry[] {
  const pool = [...entries];
  const questions: GenreSwapEntry[] = [];
  let cursor = seed;
  while (questions.length < count && pool.length > 0) {
    const index = cursor % pool.length;
    questions.push(pool[index]!);
    pool.splice(index, 1);
    cursor += 1;
  }
  return questions;
}

export interface GenreSwapVerdict {
  correct: boolean;
  points: number;
  correctLabel: string;
}

export function judgeGenreSwap(
  picked: string,
  correctLabel: string,
  elapsedMs: number
): GenreSwapVerdict {
  const correct = picked === correctLabel;
  const points = correct ? 10 + (elapsedMs <= GENRE_SWAP_SPEED_BONUS_MS ? 5 : 0) : 0;
  return { correct, points, correctLabel };
}

export function genreSwapOptions(
  entry: GenreSwapEntry,
  allOriginals: string[],
  random: () => number = Math.random
): string[] {
  return buildOptions(entry.original, allOriginals, 4, random);
}
