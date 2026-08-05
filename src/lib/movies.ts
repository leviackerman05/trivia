/**
 * Daily Movies — "Real or Fake?" (DAILY-DESIGN §3.2).
 *
 * 10 rounds/day: each round shows one synopsis (real or fake, seeded) and
 * the player answers Real/Fake. The real count varies 4–6 per day so the
 * mix is never a learnable pattern; side assignment is a deterministic
 * cursor shuffle of the day's slots. Pure functions only.
 */

import { hashString } from './trivia';
import { pickDistinct } from './pick';

export interface MoviePair {
  title: string;
  year: number;
  genre: string;
  /** Original prose synopsis of the real film. */
  real: string;
  /** Original prose wrong-plot synopsis (same tonal register). */
  fake: string;
  difficulty: 1 | 2 | 3;
}

export interface MovieRound {
  entry: MoviePair;
  shown: 'real' | 'fake';
  /** The synopsis the player judges. */
  text: string;
}

export const MOVIE_ROUNDS_PER_DAY = 10;
/** Seeded real-count floor: 4 + hash % 3 ⇒ 4–6 real per day. */
export const MOVIE_REAL_COUNT_MIN = 4;

/** Cursor shuffle of a fixed slot list (the pickDistinct technique). */
function shuffleSlots<T>(slots: T[], seed: number): T[] {
  const pool = [...slots];
  const shuffled: T[] = [];
  let cursor = seed;
  while (pool.length > 0) {
    const index = cursor % pool.length;
    shuffled.push(pool.splice(index, 1)[0]!);
    cursor += 1;
  }
  return shuffled;
}

export function pickMovieRounds(
  entries: MoviePair[],
  count = MOVIE_ROUNDS_PER_DAY,
  seed = 0
): MovieRound[] {
  const picked = pickDistinct(entries, count, seed);
  // 4–6 real per day, never a fixed pattern; clamped for small pools.
  const realCount = Math.min(
    MOVIE_REAL_COUNT_MIN + (hashString(`${seed}:real-count`) % 3),
    picked.length
  );
  const slots: Array<'real' | 'fake'> = [];
  for (let i = 0; i < picked.length; i += 1) {
    slots.push(i < realCount ? 'real' : 'fake');
  }
  const sides = shuffleSlots(slots, hashString(`${seed}:sides`));
  return picked.map((entry, index) => {
    const shown = sides[index]!;
    return { entry, shown, text: shown === 'real' ? entry.real : entry.fake };
  });
}
