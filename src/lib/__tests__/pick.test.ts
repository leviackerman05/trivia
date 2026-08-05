import { describe, expect, it } from 'vitest';
import emojiPlotsJson from '../../data/emoji-plots.json';
import { pickEmojiQuestions, type EmojiPlotEntry } from '../emoji-plot';
import { pickDistinct } from '../pick';

const entries = emojiPlotsJson as EmojiPlotEntry[];

describe('pickDistinct (DAILY-DESIGN §2.1)', () => {
  it('matches pickEmojiQuestions on the same seed (golden behavior)', () => {
    for (const seed of [0, 1, 7, 42, 20260805]) {
      expect(pickDistinct(entries, 10, seed)).toEqual(pickEmojiQuestions(entries, 10, seed));
    }
  });

  it('is deterministic: same seed yields the same selection and order', () => {
    expect(pickDistinct(entries, 10, 42)).toEqual(pickDistinct(entries, 10, 42));
  });

  it('selects distinct entries without repeats', () => {
    const picked = pickDistinct(entries, 10, 7);
    expect(picked).toHaveLength(10);
    expect(new Set(picked).size).toBe(10);
  });

  it('returns all entries in seeded order when the pool is smaller than count', () => {
    const small = entries.slice(0, 5);
    const picked = pickDistinct(small, 10, 3);
    expect(picked).toHaveLength(5);
    expect(new Set(picked).size).toBe(5);
    expect(pickDistinct(small, 5, 3)).toEqual(picked);
  });
});
