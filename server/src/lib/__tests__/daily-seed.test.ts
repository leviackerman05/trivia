import { describe, expect, it } from 'vitest';
import { hashString, selectDailyQuestions } from '../daily-seed.js';

describe('daily challenge seeding (M8, PRD §5.15)', () => {
  it('selects 10 questions deterministically per UTC date', () => {
    const dayA = selectDailyQuestions('2026-08-04');
    const dayAAgain = selectDailyQuestions('2026-08-04');
    const dayB = selectDailyQuestions('2026-08-05');
    expect(dayA).toHaveLength(10);
    expect(dayAAgain).toEqual(dayA);
    expect(dayA).not.toEqual(dayB);
  });

  it('every question carries the four-option shape with a valid answer index', () => {
    const questions = selectDailyQuestions('2026-08-04');
    for (const question of questions) {
      expect(question.options).toHaveLength(4);
      expect(question.answer).toBeGreaterThanOrEqual(0);
      expect(question.answer).toBeLessThan(4);
      expect(question.question.length).toBeGreaterThan(5);
    }
  });

  it('spans all five categories across the pool', () => {
    const questions = selectDailyQuestions('2026-08-04', 50);
    const categories = new Set(questions.map((question) => question.category));
    for (const expected of ['General', 'Science', 'History', 'Pop Culture', 'Sports']) {
      expect(categories.has(expected)).toBe(true);
    }
  });

  it('hashString is stable and non-colliding for day keys', () => {
    expect(hashString('2026-08-04')).toBe(hashString('2026-08-04'));
    expect(hashString('2026-08-04')).not.toBe(hashString('2026-08-05'));
  });
});
