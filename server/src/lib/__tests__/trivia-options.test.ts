import { describe, expect, it } from 'vitest';
import { shuffleTriviaDeck } from '../trivia-options.js';
import type { TriviaQuestion } from '../daily-seed.js';

/** Fixture deck: 4-option questions plus a ≠4-option edge case. */
const DECK: TriviaQuestion[] = [
  {
    category: 'science',
    question: 'What is H2O?',
    options: ['Water', 'Salt', 'Oxygen', 'Helium'],
    answer: 0,
  },
  {
    category: 'history',
    question: 'Which year?',
    options: ['1492', '1066', '1776', '1969'],
    answer: 2,
  },
  {
    category: 'sports',
    question: '3-option edge case',
    options: ['A', 'B', 'C'],
    answer: 1,
  },
  {
    category: 'trivia-content',
    question: '5-option edge case',
    options: ['One', 'Two', 'Three', 'Four', 'Five'],
    answer: 4,
  },
];

function assertAnswerRemapped(original: TriviaQuestion[], shuffled: TriviaQuestion[]): void {
  expect(shuffled).toHaveLength(original.length);
  for (let i = 0; i < original.length; i += 1) {
    const source = original[i]!;
    const target = shuffled[i]!;
    // Same question, options are a permutation, and the correct option is
    // the same string at the remapped index.
    expect(target.question).toBe(source.question);
    expect([...target.options].sort()).toEqual([...source.options].sort());
    expect(target.options[target.answer]).toBe(source.options[source.answer]);
  }
}

describe('shuffleTriviaDeck (R7, room-side answer randomization)', () => {
  it('is deterministic per room code: same code ⇒ same deck order', () => {
    const first = shuffleTriviaDeck(DECK, 'ABC123');
    const second = shuffleTriviaDeck(DECK, 'ABC123');
    expect(first).toEqual(second);
  });

  it('produces different orderings for different room codes', () => {
    const first = shuffleTriviaDeck(DECK, 'ABC123');
    const second = shuffleTriviaDeck(DECK, 'ZZZ999');
    expect(first.map((q) => q.options)).not.toEqual(second.map((q) => q.options));
  });

  it('remaps the answer index on every question (any option count)', () => {
    const shuffled = shuffleTriviaDeck(DECK, 'ABC123');
    assertAnswerRemapped(DECK, shuffled);
  });

  it('shuffles the option positions themselves (not a no-op)', () => {
    const shuffled = shuffleTriviaDeck(DECK, 'ABC123');
    // Across the deck, at least one question must have moved its options.
    const moved = DECK.some((question, i) => {
      const target = shuffled[i]!;
      return question.options.some((option, index) => target.options[index] !== option);
    });
    expect(moved).toBe(true);
  });

  it('never mutates the input deck', () => {
    const snapshot = JSON.parse(JSON.stringify(DECK)) as TriviaQuestion[];
    shuffleTriviaDeck(DECK, 'ABC123');
    expect(DECK).toEqual(snapshot);
  });

  it('returns the input unchanged for an empty pool', () => {
    expect(shuffleTriviaDeck([], 'ABC123')).toEqual([]);
  });
});
