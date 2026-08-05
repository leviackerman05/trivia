import { describe, expect, it } from 'vitest';
import drawingPromptsJson from '../../data/daily-drawing-prompts.json';
import { dailyGameSeed } from '../daily';
import { pickDailyPrompt, type DrawingPrompt } from '../daily-drawing';

const entries = drawingPromptsJson as DrawingPrompt[];

/** N consecutive UTC date keys ending today (the house 90-day window). */
function dateKeys(count: number): string[] {
  const keys: string[] = [];
  const date = new Date('2026-08-05T00:00:00Z');
  for (let i = 0; i < count; i += 1) {
    keys.push(date.toISOString().slice(0, 10));
    date.setUTCDate(date.getUTCDate() - 1);
  }
  return keys;
}

/** Curated trademark/character blocklist (DAILY-DESIGN §9, smoke gate). */
const TRADEMARK_TOKENS = [
  'mickey',
  'pokémon',
  'pokemon',
  'disney',
  'pixar',
  'marvel',
  'star wars',
  'harry potter',
  'nike',
  'spider-man',
  'superman',
  'batman',
  'minecraft',
  'fortnite',
  'nintendo',
  'mario',
  'sonic',
  'barbie',
  'lego',
];

describe('pickDailyPrompt (DAILY-DESIGN §3.4)', () => {
  it('is deterministic: the same seed always yields the same prompt', () => {
    const seed = dailyGameSeed('2026-08-05', 'drawing');
    expect(pickDailyPrompt(entries, seed)).toEqual(pickDailyPrompt(entries, seed));
  });

  it('covers the whole pool over consecutive dates', () => {
    const seen = new Set<string>();
    for (const key of dateKeys(90)) {
      seen.add(pickDailyPrompt(entries, dailyGameSeed(key, 'drawing')).prompt);
    }
    // 15 entries × consecutive seeds ⇒ full coverage within the window.
    expect(seen.size).toBeGreaterThan(1);
    for (const entry of entries) {
      expect(seen.has(entry.prompt)).toBe(true);
    }
  });

  it('returns valid entries for any seed (no crashes, always in bounds)', () => {
    for (const seed of [0, 1, 42, 999999, 4294967295]) {
      const prompt = pickDailyPrompt(entries, seed);
      expect(entries.includes(prompt)).toBe(true);
    }
  });
});

describe('daily-drawing-prompts dataset QA (sample; full 150-entry gate lands with F9)', () => {
  it('has 12+ unique prompts', () => {
    expect(entries.length).toBeGreaterThanOrEqual(12);
    expect(new Set(entries.map((entry) => entry.prompt)).size).toBe(entries.length);
  });

  it('is balanced across categories and difficulties', () => {
    const categories = new Map<string, number>();
    const difficulties = new Set<number>();
    for (const entry of entries) {
      categories.set(entry.category, (categories.get(entry.category) ?? 0) + 1);
      difficulties.add(entry.difficulty);
    }
    expect(categories.size).toBeGreaterThanOrEqual(4);
    for (const count of categories.values()) {
      expect(count).toBeGreaterThanOrEqual(2);
    }
    expect(difficulties.has(1)).toBe(true);
    expect(difficulties.has(2)).toBe(true);
    expect(difficulties.has(3)).toBe(true);
  });

  it('uses only enforceable constraints and valid difficulties', () => {
    for (const entry of entries) {
      expect(entry.prompt.trim().length).toBeGreaterThan(8);
      expect(entry.emoji.length).toBeGreaterThan(0);
      expect([1, 2, 3]).toContain(entry.difficulty);
      for (const constraint of entry.constraints ?? []) {
        expect(['no_text', 'no_letters']).toContain(constraint);
      }
    }
  });

  it('passes the trademark blocklist gate (no branded characters)', () => {
    const joined = entries.map((entry) => entry.prompt.toLowerCase()).join(' | ');
    for (const token of TRADEMARK_TOKENS) {
      expect(joined.includes(token), `blocked token: ${token}`).toBe(false);
    }
  });
});
