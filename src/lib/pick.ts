/**
 * Shared deterministic picker (DAILY-DESIGN §2.1, D050).
 *
 * Extracted verbatim from `pickEmojiQuestions` (src/lib/emoji-plot.ts): a
 * cursor shuffle — index = cursor % pool.length, splice, cursor += 1 — so
 * the same seed always selects the same entries in the same order. New
 * daily engines use this; emoji-plot keeps its own copy this milestone.
 *
 * Pool-edge contract: when the pool has fewer entries than `count`, all
 * entries are returned in seeded order (islands render fewer rounds).
 */

import { hashString, seededRandom } from './trivia';

export function pickDistinct<T>(entries: T[], count: number, seed: number): T[] {
  const pool = [...entries];
  const picked: T[] = [];
  let cursor = seed;
  while (picked.length < count && pool.length > 0) {
    const index = cursor % pool.length;
    picked.push(pool[index]!);
    pool.splice(index, 1);
    cursor += 1;
  }
  return picked;
}

/**
 * [R7] Seeded Fisher-Yates over the given array (mulberry32 via
 * trivia.seededRandom). Near-uniform permutations — the cursor technique is
 * biased and must not be used for options. Never mutates the input.
 */
export function shuffleOptions<T>(options: readonly T[], seed: number): T[] {
  const random = seededRandom(seed);
  const shuffled = [...options];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const swap = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = swap;
  }
  return shuffled;
}

/**
 * [R7] Shuffle a { options, answer } question: options reordered, answer
 * remapped to the shuffled position of the original correct option. Returns
 * a new object; the input is never mutated.
 */
export function shuffleQuestion<Q extends { options: readonly string[]; answer: number }>(
  question: Q,
  seed: number
): Q {
  const options = shuffleOptions(question.options, seed);
  const correct = question.options[question.answer]!;
  return { ...question, options, answer: options.indexOf(correct) };
}

/** [R7] Per-round option sub-seed convention (varies across rounds AND days). */
export function optionSeed(seed: number, roundIndex: number): number {
  return hashString(`${seed}:round:${roundIndex}:options`);
}
