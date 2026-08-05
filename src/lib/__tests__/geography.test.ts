import { describe, expect, it } from 'vitest';
import geographyJson from '../../data/daily-geography.json';
import { dailyGameSeed } from '../daily';
import {
  GEOGRAPHY_REGION_CAP,
  pickGeographyRounds,
  type GeographyEntry,
  type GeographyRegion,
} from '../geography';

const entries = geographyJson as GeographyEntry[];

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

const REGIONS: GeographyRegion[] = ['africa', 'americas', 'asia', 'europe', 'oceania'];

describe('pickGeographyRounds (DAILY-DESIGN §3.1)', () => {
  it('is deterministic: same date and slug yield identical rounds', () => {
    const seed = dailyGameSeed('2026-08-05', 'geography');
    expect(pickGeographyRounds(entries, 10, seed)).toEqual(pickGeographyRounds(entries, 10, seed));
  });

  it('differs across consecutive days', () => {
    const monday = pickGeographyRounds(entries, 10, dailyGameSeed('2026-08-04', 'geography')).map(
      (round) => round.place
    );
    const tuesday = pickGeographyRounds(entries, 10, dailyGameSeed('2026-08-05', 'geography')).map(
      (round) => round.place
    );
    expect(monday).not.toEqual(tuesday);
  });

  it('picks 10 distinct entries per day', () => {
    const seed = dailyGameSeed('2026-08-05', 'geography');
    const rounds = pickGeographyRounds(entries, 10, seed);
    expect(rounds).toHaveLength(10);
    expect(new Set(rounds.map((round) => round.place)).size).toBe(10);
  });

  it('respects the region cap (≤4 per region) over 90 consecutive dates', () => {
    for (const key of dateKeys(90)) {
      const rounds = pickGeographyRounds(entries, 10, dailyGameSeed(key, 'geography'));
      expect(rounds, key).toHaveLength(10);
      const counts = new Map<GeographyRegion, number>();
      for (const round of rounds) {
        counts.set(round.region, (counts.get(round.region) ?? 0) + 1);
      }
      for (const [region, count] of counts) {
        expect(count, `${key} ${region}`).toBeLessThanOrEqual(GEOGRAPHY_REGION_CAP);
      }
    }
  });

  it('returns fewer rounds without crashing when the pool is smaller than count', () => {
    const small = entries.slice(0, 5);
    const rounds = pickGeographyRounds(small, 10, dailyGameSeed('2026-08-05', 'geography'));
    expect(rounds).toHaveLength(5);
    expect(new Set(rounds.map((round) => round.place)).size).toBe(5);
  });
});

describe('daily-geography dataset QA (sample; full 120-entry gate lands with F9)', () => {
  it('has 12+ entries with unique places', () => {
    expect(entries.length).toBeGreaterThanOrEqual(12);
    expect(new Set(entries.map((entry) => entry.place)).size).toBe(entries.length);
  });

  it('covers all five region buckets', () => {
    const regions = new Set(entries.map((entry) => entry.region));
    for (const region of REGIONS) {
      expect(regions.has(region), region).toBe(true);
    }
  });

  it('embeds 4 options with the place at the answer index', () => {
    for (const entry of entries) {
      expect(entry.options).toHaveLength(4);
      expect(entry.answer).toBeGreaterThanOrEqual(0);
      expect(entry.answer).toBeLessThanOrEqual(3);
      expect(entry.options[entry.answer]).toBe(entry.place);
    }
  });

  it('has a hint, a Wikimedia photo URL, and valid credits on every entry', () => {
    for (const entry of entries) {
      expect(entry.hint.trim().length).toBeGreaterThan(10);
      expect(entry.url).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\//);
      if (entry.credit) {
        expect(['by', 'by-sa']).toContain(entry.credit.license);
        expect(entry.credit.creator.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
