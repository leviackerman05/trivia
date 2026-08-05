import { describe, expect, it } from 'vitest';
import moviesJson from '../../data/daily-movies.json';
import { dailyGameSeed } from '../daily';
import { MOVIE_REAL_COUNT_MIN, pickMovieRounds, type MoviePair } from '../movies';

const entries = moviesJson as MoviePair[];

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

describe('pickMovieRounds (DAILY-DESIGN §3.2)', () => {
  it('is deterministic: same date and slug yield identical rounds', () => {
    const seed = dailyGameSeed('2026-08-05', 'movies');
    expect(pickMovieRounds(entries, 10, seed)).toEqual(pickMovieRounds(entries, 10, seed));
  });

  it('differs across consecutive days', () => {
    const monday = pickMovieRounds(entries, 10, dailyGameSeed('2026-08-04', 'movies')).map(
      (round) => round.text
    );
    const tuesday = pickMovieRounds(entries, 10, dailyGameSeed('2026-08-05', 'movies')).map(
      (round) => round.text
    );
    expect(monday).not.toEqual(tuesday);
  });

  it('picks 10 distinct films per day, each with one shown side', () => {
    const seed = dailyGameSeed('2026-08-05', 'movies');
    const rounds = pickMovieRounds(entries, 10, seed);
    expect(rounds).toHaveLength(10);
    expect(new Set(rounds.map((round) => round.entry.title)).size).toBe(10);
    for (const round of rounds) {
      expect(['real', 'fake']).toContain(round.shown);
      expect(round.text).toBe(round.shown === 'real' ? round.entry.real : round.entry.fake);
    }
  });

  it('keeps the real count in 4–6 over 90 dates, and not 5 every day', () => {
    const counts = new Set<number>();
    for (const key of dateKeys(90)) {
      const rounds = pickMovieRounds(entries, 10, dailyGameSeed(key, 'movies'));
      const real = rounds.filter((round) => round.shown === 'real').length;
      expect(real, key).toBeGreaterThanOrEqual(4);
      expect(real, key).toBeLessThanOrEqual(6);
      counts.add(real);
    }
    // A fixed 5/5 pattern is a solver exploit — the seeded mix must vary.
    expect(counts.size).toBeGreaterThan(1);
    expect(counts.has(MOVIE_REAL_COUNT_MIN)).toBe(true);
  });
});

describe('daily-movies dataset QA (sample; full 300-entry gate lands with F9)', () => {
  it('has 12+ entries with unique titles', () => {
    expect(entries.length).toBeGreaterThanOrEqual(12);
    expect(new Set(entries.map((entry) => entry.title)).size).toBe(entries.length);
  });

  it('has all difficulty tiers populated', () => {
    const tiers = new Set(entries.map((entry) => entry.difficulty));
    expect(tiers.has(1)).toBe(true);
    expect(tiers.has(2)).toBe(true);
    expect(tiers.has(3)).toBe(true);
  });

  it('has substantial, length-bounded real and fake synopses on every entry', () => {
    for (const entry of entries) {
      for (const text of [entry.real, entry.fake]) {
        expect(text.length).toBeGreaterThanOrEqual(40);
        expect(text.length).toBeLessThanOrEqual(300);
      }
      expect(entry.year).toBeGreaterThan(1900);
      expect(entry.genre.trim().length).toBeGreaterThan(0);
    }
  });
});
