import { describe, expect, it } from 'vitest';
import emojiPlotsJson from '../../data/emoji-plots.json';
import { pickEmojiQuestions, type EmojiPlotEntry } from '../emoji-plot';
import { optionSeed, pickDistinct, shuffleOptions, shuffleQuestion } from '../pick';

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

describe('shuffleOptions / shuffleQuestion (R7, D055)', () => {
  const question = { category: 't', question: 'q', options: ['a', 'b', 'c', 'd'], answer: 2 };

  it('is a permutation: same multiset, no duplicates, same length', () => {
    const shuffled = shuffleOptions(question.options, 42);
    expect(shuffled).toHaveLength(question.options.length);
    expect([...shuffled].sort()).toEqual([...question.options].sort());
    expect(new Set(shuffled).size).toBe(shuffled.length);
  });

  it('is deterministic for the same seed', () => {
    expect(shuffleOptions(question.options, 7)).toEqual(shuffleOptions(question.options, 7));
  });

  it('remaps the answer to the shuffled position of the correct option', () => {
    for (const seed of [0, 1, 5, 42, 99]) {
      const shuffled = shuffleQuestion(question, seed);
      expect(shuffled.options[shuffled.answer]).toBe(question.options[question.answer]);
      expect(new Set(shuffled.options)).toEqual(new Set(question.options));
    }
  });

  it('never mutates the input question', () => {
    const snapshot = structuredClone(question);
    for (const seed of [0, 1, 2, 3]) {
      shuffleQuestion(question, seed);
      expect(question).toEqual(snapshot);
    }
  });

  it('spreads answer positions over 100 seeds (every position 0–3 occurs)', () => {
    const positions = new Set<number>();
    for (let seed = 0; seed < 100; seed += 1) {
      positions.add(shuffleQuestion(question, seed).answer);
    }
    expect(positions).toEqual(new Set([0, 1, 2, 3]));
  });

  it('no seed keeps position 0 for all 10 rounds of a day', () => {
    for (let daySeed = 0; daySeed < 100; daySeed += 1) {
      const rounds = Array.from({ length: 10 }, (_, round) =>
        shuffleQuestion(question, optionSeed(daySeed, round))
      );
      expect(
        rounds.some((round) => round.answer !== 0),
        `day seed ${daySeed}`
      ).toBe(true);
    }
  });

  it('optionSeed varies across rounds and days', () => {
    expect(optionSeed(1, 0)).not.toBe(optionSeed(1, 1));
    expect(optionSeed(1, 0)).not.toBe(optionSeed(2, 0));
  });
});
