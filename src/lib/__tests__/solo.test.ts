import { describe, expect, it } from 'vitest';
import {
  dailyDateKey,
  fuzzyMatchTitle,
  levenshtein,
  nextStreak,
  normalizeAnswer,
  readStreak,
  yesterdayKey,
  type StreakState,
} from '../solo';

describe('solo shared utilities (M7)', () => {
  it('normalizes answers: case, punctuation, accents, whitespace', () => {
    expect(normalizeAnswer('  Harry-Potter!!! ')).toBe('harry potter');
    expect(normalizeAnswer('Café')).toBe('cafe');
    expect(normalizeAnswer('The Lion King')).toBe('the lion king');
  });

  it('levenshtein is bounded and correct', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('harry', 'harry')).toBe(0);
    expect(levenshtein('abc', 'abcdefg', 3)).toBe(4); // beyond the cap
  });

  it('fuzzyMatchTitle ignores "The", accepts typos and partial titles', () => {
    expect(fuzzyMatchTitle('harry potter', "Harry Potter and the Sorcerer's Stone")).toBe(true);
    expect(fuzzyMatchTitle('THE lion king', 'The Lion King')).toBe(true);
    expect(fuzzyMatchTitle('lion king', 'The Lion King')).toBe(true);
    expect(fuzzyMatchTitle('hary poter', 'Harry Potter')).toBe(true); // ≤ 2 edits
    expect(fuzzyMatchTitle('titanic', 'The Lion King')).toBe(false);
    expect(fuzzyMatchTitle('', 'The Lion King')).toBe(false);
    expect(fuzzyMatchTitle('The Lion King (1994)', 'The Lion King')).toBe(true); // verbose guess
  });

  it('streaks: consecutive days increment, same day is a no-op, gaps reset', () => {
    // Fresh streak.
    let state: StreakState = nextStreak({ count: 0, lastDate: '' }, '2026-08-01');
    expect(state).toEqual({ count: 1, lastDate: '2026-08-01' });
    // Same day again → unchanged.
    state = nextStreak(state, '2026-08-01');
    expect(state.count).toBe(1);
    // Next day → 2.
    state = nextStreak(state, '2026-08-02');
    expect(state.count).toBe(2);
    // Gap → reset to 1.
    state = nextStreak(state, '2026-08-05');
    expect(state).toEqual({ count: 1, lastDate: '2026-08-05' });
  });

  it('date helpers use UTC days', () => {
    expect(dailyDateKey(new Date('2026-08-04T12:00:00Z'))).toBe('2026-08-04');
    expect(yesterdayKey('2026-08-04')).toBe('2026-08-03');
    expect(yesterdayKey('2026-03-01')).toBe('2026-02-28');
  });
});

describe('streak storage (browser only)', () => {
  it('readStreak returns a safe default without localStorage', () => {
    // Vitest node env has no localStorage.
    expect(readStreak('x')).toEqual({ count: 0, lastDate: '' });
  });
});
