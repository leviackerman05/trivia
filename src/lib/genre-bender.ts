/**
 * Genre-Bender (M8, PRD §5.10) — pure game logic. 10 questions × 20s; a
 * (paraphrased/original — licensing-safe, open question #2) lyric rewritten
 * as a Shakespearean sonnet; pick the song + artist from four options. The
 * year clue is a free hint (no penalty) per PRD's "optional BPM/year clue".
 */

import { buildOptions } from './solo';

export interface GenreBenderEntry {
  original: string;
  artist: string;
  bent: string;
  year: number;
}

export const GENRE_BENDER_SECONDS = 20;
export const GENRE_BENDER_TOTAL_QUESTIONS = 10;

export function pickGenreBenderQuestions(
  entries: GenreBenderEntry[],
  count = GENRE_BENDER_TOTAL_QUESTIONS,
  seed = 0
): GenreBenderEntry[] {
  const pool = [...entries];
  const questions: GenreBenderEntry[] = [];
  let cursor = seed;
  while (questions.length < count && pool.length > 0) {
    const index = cursor % pool.length;
    questions.push(pool[index]!);
    pool.splice(index, 1);
    cursor += 1;
  }
  return questions;
}

export function benderLabel(entry: GenreBenderEntry): string {
  return `${entry.original} — ${entry.artist}`;
}

export function genreBenderOptions(
  entry: GenreBenderEntry,
  allEntries: GenreBenderEntry[]
): string[] {
  return buildOptions(benderLabel(entry), allEntries.map(benderLabel));
}

export interface GenreBenderVerdict {
  correct: boolean;
  points: number;
  correctLabel: string;
}

export function judgeGenreBender(
  picked: string,
  correctLabel: string,
  elapsedMs: number
): GenreBenderVerdict {
  const correct = picked === correctLabel;
  const points = correct ? 10 + (elapsedMs <= 10_000 ? 5 : 0) : 0;
  return { correct, points, correctLabel };
}
