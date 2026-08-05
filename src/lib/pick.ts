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
