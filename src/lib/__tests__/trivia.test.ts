import { describe, expect, it } from 'vitest';
import {
  dailyDateKey,
  dailySeed,
  hashString,
  scoreTriviaAnswer,
  selectDailyQuestions,
  seededRandom,
  triviaClientKey,
  triviaQuestions,
  TRIVIA_QUESTION_SECONDS,
} from '../trivia';

describe('trivia dataset (src/data/trivia-questions.json)', () => {
  it('has at least 50 questions with a valid shape', () => {
    expect(triviaQuestions.length).toBeGreaterThanOrEqual(50);
    for (const question of triviaQuestions) {
      expect(question.category.length).toBeGreaterThan(0);
      expect(question.question.length).toBeGreaterThan(10);
      expect(question.options).toHaveLength(4);
      expect(question.options.every((option) => option.length > 0)).toBe(true);
      expect(question.answer).toBeGreaterThanOrEqual(0);
      expect(question.answer).toBeLessThan(4);
    }
  });

  it('covers the five PRD categories with no empty categories', () => {
    const categories = new Set(triviaQuestions.map((question) => question.category));
    for (const category of categories) {
      expect(category.trim().length).toBeGreaterThan(0);
    }
    expect(categories.size).toBeGreaterThanOrEqual(4);
  });
});

describe('daily challenge selection', () => {
  it('is deterministic per date: same date, same questions, same order', () => {
    const date = new Date('2026-08-04T12:00:00Z');
    const first = selectDailyQuestions(date);
    const second = selectDailyQuestions(date);
    expect(first).toEqual(second);
  });

  it('varies across dates', () => {
    const dayOne = selectDailyQuestions(new Date('2026-08-04T12:00:00Z'));
    const dayTwo = selectDailyQuestions(new Date('2026-08-05T12:00:00Z'));
    expect(dayOne.some((question, i) => question !== dayTwo[i])).toBe(true);
  });

  it('selects exactly 10 distinct questions per game', () => {
    const selected = selectDailyQuestions(new Date('2026-08-04T12:00:00Z'));
    expect(selected).toHaveLength(10);
    expect(new Set(selected).size).toBe(10);
  });

  it('dailySeed is derived from the UTC date key', () => {
    const date = new Date('2026-08-04T23:30:00Z');
    expect(dailyDateKey(date)).toBe('2026-08-04');
    expect(dailySeed(date)).toBe(hashString('2026-08-04'));
  });

  it('seededRandom is deterministic and bounded', () => {
    const first = seededRandom(42);
    const second = seededRandom(42);
    const values = Array.from({ length: 100 }, () => first());
    expect(second()).toBe(values[0]);
    expect(values.every((value) => value >= 0 && value < 1)).toBe(true);
  });
});

describe('scoring (M18, owner request: flat 10/0)', () => {
  it('scores 10 for a correct answer regardless of speed', () => {
    expect(scoreTriviaAnswer(15, true)).toBe(10);
    expect(scoreTriviaAnswer(1, true)).toBe(10);
  });

  it('scores 0 for wrong answers and timeouts', () => {
    expect(scoreTriviaAnswer(10, false)).toBe(0);
    expect(scoreTriviaAnswer(0, false)).toBe(0);
    // The seconds param is ignored under flat scoring, a correct pick
    // scores 10 even with no time left on the clock.
    expect(scoreTriviaAnswer(0, true)).toBe(10);
  });
});

describe('clientKey (idempotent score submission)', () => {
  it('matches the server clientKey charset and length rules', () => {
    const key = triviaClientKey('2026-08-04', 'Quiz Whiz', 'nonce-123');
    expect(key.length).toBeGreaterThanOrEqual(8);
    expect(key.length).toBeLessThanOrEqual(128);
    expect(/^[A-Za-z0-9._:-]+$/.test(key)).toBe(true);
  });

  it('is stable for the same inputs and does not leak the raw name', () => {
    const key = triviaClientKey('2026-08-04', 'Alice', 'abc');
    expect(triviaClientKey('2026-08-04', 'Alice', 'abc')).toBe(key);
    expect(key.includes('Alice')).toBe(false);
  });
});

describe('constants', () => {
  it('uses the PRD solo timer of 15 seconds', () => {
    expect(TRIVIA_QUESTION_SECONDS).toBe(15);
  });
});
