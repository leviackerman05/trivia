import { describe, expect, it } from 'vitest';
import wordsJson from '../../data/skribbl-words.json' with { type: 'json' };

/**
 * Word bank integrity (PRD §5.1: 500+ words, 5 difficulty levels).
 * The bank lives server-side on purpose (DECISIONS D022): shipping it to the
 * browser would let guessers preload the answers.
 */

const DIFFICULTIES = ['easy', 'medium', 'hard', 'expert', 'master'] as const;

describe('skribbl word bank (server/src/data/skribbl-words.json)', () => {
  it('has 500+ unique words across 5 difficulties', () => {
    expect(wordsJson.length).toBeGreaterThanOrEqual(500);
    const lowercased = wordsJson.map((entry) => entry.word.toLowerCase());
    expect(new Set(lowercased).size).toBe(wordsJson.length);
  });

  it('has at least 80 words per difficulty level', () => {
    for (const difficulty of DIFFICULTIES) {
      const count = wordsJson.filter((entry) => entry.difficulty === difficulty).length;
      expect(count, `${difficulty} has ${count} words`).toBeGreaterThanOrEqual(80);
    }
  });

  it('only uses valid difficulties and safe characters', () => {
    for (const entry of wordsJson) {
      expect(DIFFICULTIES).toContain(entry.difficulty);
      expect(entry.word.length).toBeGreaterThanOrEqual(1);
      expect(entry.word.length).toBeLessThanOrEqual(24);
      // Letters, spaces, hyphens, apostrophes only, keeps payloads and URLs safe.
      expect(entry.word, entry.word).toMatch(/^[a-z' -]+$/);
    }
  });
});
