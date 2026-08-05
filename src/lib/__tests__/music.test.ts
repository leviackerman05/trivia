import { describe, expect, it } from 'vitest';
import musicJson from '../../data/daily-music.json';
import { dailyGameSeed } from '../daily';
import { MUSIC_TIER_QUOTAS, pickMusicRounds, type MusicEntry } from '../music';

const entries = musicJson as MusicEntry[];

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

describe('pickMusicRounds (DAILY-DESIGN §3.3)', () => {
  it('is deterministic: same date and slug yield identical rounds', () => {
    const seed = dailyGameSeed('2026-08-05', 'music');
    expect(pickMusicRounds(entries, 10, seed)).toEqual(pickMusicRounds(entries, 10, seed));
  });

  it('differs across consecutive days', () => {
    const monday = pickMusicRounds(entries, 10, dailyGameSeed('2026-08-04', 'music')).map(
      (round) => round.title
    );
    const tuesday = pickMusicRounds(entries, 10, dailyGameSeed('2026-08-05', 'music')).map(
      (round) => round.title
    );
    expect(monday).not.toEqual(tuesday);
  });

  it('keeps the tier mix exactly 3 easy / 4 medium / 3 hard over 90 dates', () => {
    for (const key of dateKeys(90)) {
      const rounds = pickMusicRounds(entries, 10, dailyGameSeed(key, 'music'));
      expect(rounds, key).toHaveLength(10);
      const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
      for (const round of rounds) {
        counts[round.difficulty] += 1;
      }
      expect(counts[1], key).toBe(MUSIC_TIER_QUOTAS[1]);
      expect(counts[2], key).toBe(MUSIC_TIER_QUOTAS[2]);
      expect(counts[3], key).toBe(MUSIC_TIER_QUOTAS[3]);
    }
  });

  it('picks 10 distinct entries per day and never ships bpmSource', () => {
    const rounds = pickMusicRounds(entries, 10, dailyGameSeed('2026-08-05', 'music'));
    expect(rounds).toHaveLength(10);
    expect(new Set(rounds.map((round) => round.title)).size).toBe(10);
    for (const round of rounds) {
      expect('bpmSource' in round).toBe(false);
    }
  });

  it('fills tier shortfalls from the remaining pool (deterministic)', () => {
    // 5 easy / 2 medium / 5 hard: medium shortfalls by 2, filled from leftovers.
    const sparse = [...entries.filter((entry) => entry.difficulty !== 2), entries[6]!, entries[7]!];
    expect(sparse.filter((entry) => entry.difficulty === 2)).toHaveLength(2);
    const seed = dailyGameSeed('2026-08-05', 'music');
    const first = pickMusicRounds(sparse, 10, seed);
    const second = pickMusicRounds(sparse, 10, seed);
    expect(first).toEqual(second);
    expect(first).toHaveLength(10);
    expect(new Set(first.map((round) => round.title)).size).toBe(10);
    // Tier quotas come first (3 easy + 2 medium + 3 hard), then 2 fillers
    // from the leftover easy/hard pool — the medium tier is exhausted.
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
    for (const round of first) {
      counts[round.difficulty] += 1;
    }
    expect(counts[1]).toBeGreaterThanOrEqual(3);
    expect(counts[2]).toBe(2);
    expect(counts[3]).toBeGreaterThanOrEqual(3);
    expect(counts[1] + counts[2] + counts[3]).toBe(10);
  });

  it('returns fewer rounds without crashing when the pool is smaller than count', () => {
    const tiny = entries.slice(0, 6);
    const rounds = pickMusicRounds(tiny, 10, dailyGameSeed('2026-08-05', 'music'));
    expect(rounds).toHaveLength(6);
    expect(new Set(rounds.map((round) => round.title)).size).toBe(6);
  });
});

describe('daily-music dataset QA (sample; full 120-entry gate lands with F9)', () => {
  it('has 12+ entries with unique titles', () => {
    expect(entries.length).toBeGreaterThanOrEqual(12);
    expect(new Set(entries.map((entry) => entry.title)).size).toBe(entries.length);
  });

  it('has at least the daily quotas per difficulty tier', () => {
    for (const tier of [1, 2, 3] as const) {
      expect(entries.filter((entry) => entry.difficulty === tier).length).toBeGreaterThanOrEqual(
        MUSIC_TIER_QUOTAS[tier]
      );
    }
  });

  it('embeds 4 title options with the answer at the answer index', () => {
    for (const entry of entries) {
      expect(entry.options).toHaveLength(4);
      expect(entry.answer).toBeGreaterThanOrEqual(0);
      expect(entry.answer).toBeLessThanOrEqual(3);
      expect(entry.options[entry.answer]).toBe(entry.title);
    }
  });

  it('has integer BPM, a clue emoji, and internal bpmSource on every entry', () => {
    for (const entry of entries) {
      expect(Number.isInteger(entry.bpm)).toBe(true);
      expect(entry.bpm).toBeGreaterThan(40);
      expect(entry.emoji.length).toBeGreaterThanOrEqual(2);
      expect(entry.bpmSource.trim().length).toBeGreaterThan(0);
      expect(entry.year).toBeGreaterThan(1950);
    }
  });
});
