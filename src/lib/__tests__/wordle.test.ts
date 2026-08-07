import { describe, expect, it } from 'vitest';
import { isWordleWord, letterStates, pickDailyWord, wordleScore, wordleWords } from '../wordle';
import skribblWordsJson from '../../../server/src/data/skribbl-words.json';

const bank = skribblWordsJson as { word: string; difficulty: string }[];

describe('wordle-words.json dataset (R20, from the 5,686-word bank)', () => {
  it('is 1,000+ common 5-letter words', () => {
    expect(wordleWords.length).toBeGreaterThanOrEqual(1000);
  });

  it('contains only unique lowercase 5-letter words', () => {
    expect(new Set(wordleWords).size).toBe(wordleWords.length);
    for (const word of wordleWords) {
      expect(isWordleWord(word), word).toBe(true);
    }
  });

  it('is sorted', () => {
    const sorted = [...wordleWords].sort();
    expect(wordleWords).toEqual(sorted);
  });

  it('is a subset of the bank (no NYT list, no invented words)', () => {
    const bankFive = new Set(
      bank.filter((entry) => /^[a-z]{5}$/.test(entry.word)).map((e) => e.word)
    );
    for (const word of wordleWords) {
      expect(bankFive.has(word), word).toBe(true);
    }
  });
});

describe('isWordleWord', () => {
  it('accepts lowercase 5-letter words only', () => {
    expect(isWordleWord('apple')).toBe(true);
    expect(isWordleWord('APPLE')).toBe(false);
    expect(isWordleWord('apples')).toBe(false);
    expect(isWordleWord('aple')).toBe(false);
    expect(isWordleWord('appl3')).toBe(false);
    expect(isWordleWord('')).toBe(false);
    expect(isWordleWord(42)).toBe(false);
  });
});

describe('letterStates (classic duplicate-correct feedback)', () => {
  it('solves a perfect guess', () => {
    expect(letterStates('candy', 'candy')).toEqual({
      states: ['correct', 'correct', 'correct', 'correct', 'correct'],
      solved: true,
    });
  });

  it('marks a fully absent guess', () => {
    expect(letterStates('abcde', 'fghij')).toEqual({
      states: ['absent', 'absent', 'absent', 'absent', 'absent'],
      solved: false,
    });
  });

  it('mixes correct and wrong-position', () => {
    expect(letterStates('train', 'brain')).toEqual({
      states: ['absent', 'correct', 'correct', 'correct', 'correct'],
      solved: false,
    });
  });

  it('handles duplicates: greens consume answer letters first', () => {
    // 'LEVEL' vs 'LEVER': the trailing L has no second L left in the answer.
    expect(letterStates('level', 'lever').states).toEqual([
      'correct',
      'correct',
      'correct',
      'correct',
      'absent',
    ]);
    // 'ERROR' vs 'RADAR': only ONE r is yellow (the answer has one r).
    expect(letterStates('error', 'radar').states).toEqual([
      'absent',
      'wrong-position',
      'absent',
      'absent',
      'correct',
    ]);
    // 'APPLE' vs 'SPEAK': a is wrong-position, the second P and the L are absent.
    expect(letterStates('apple', 'speak').states).toEqual([
      'wrong-position',
      'correct',
      'absent',
      'absent',
      'wrong-position',
    ]);
  });

  it('normalizes case', () => {
    expect(letterStates('CANDY', 'candy').solved).toBe(true);
    expect(letterStates('candy', 'CANDY').solved).toBe(true);
  });
});

describe('wordleScore ([D066] scoring by attempt, owner 2026-08-07)', () => {
  it('scores 100/85/70/55/40/25 by attempt, 0 on a failed solve', () => {
    expect(wordleScore(1)).toBe(100);
    expect(wordleScore(2)).toBe(85);
    expect(wordleScore(3)).toBe(70);
    expect(wordleScore(4)).toBe(55);
    expect(wordleScore(5)).toBe(40);
    expect(wordleScore(6)).toBe(25);
  });

  it('scores a failed solve and out-of-range attempts as 0', () => {
    expect(wordleScore(0)).toBe(0);
    expect(wordleScore(7)).toBe(0);
    expect(wordleScore(-1)).toBe(0);
  });
});

describe('pickDailyWord (D050 deterministic per-day pick)', () => {
  it('returns the same word for the same UTC day', () => {
    expect(pickDailyWord('2026-08-05')).toBe(pickDailyWord('2026-08-05'));
  });

  it('varies across days and always picks from the list', () => {
    const days = Array.from({ length: 30 }, (_, i) => `2026-08-${String(i + 1).padStart(2, '0')}`);
    const picks = days.map((day) => pickDailyWord(day));
    for (const word of picks) {
      expect(wordleWords).toContain(word);
    }
    expect(new Set(picks).size).toBeGreaterThan(1);
  });

  it('falls back deterministically on an empty list (defensive)', () => {
    expect(pickDailyWord('2026-08-05', [])).toBe('aegis');
  });
});
