import { describe, expect, it } from 'vitest';
import type { Celebrity } from '../../engine/guess-who-engine.js';
import {
  buildGuessWhoDeck,
  GUESS_WHO_DEFAULT_FILTER,
  GUESS_WHO_GENRES,
  GUESS_WHO_REGIONS,
  toWireCelebrity,
  type GuessWhoFilter,
} from '../guess-who-deck.js';

const ALL: GuessWhoFilter = { region: 'all', genre: 'all' };
const BOLLYWOOD_MUSIC: GuessWhoFilter = { region: 'bollywood', genre: 'music' };

function celebrity(
  name: string,
  region: Celebrity['region'],
  genre: Celebrity['genre'],
  difficulty: 1 | 2 | 3
): Celebrity {
  return {
    name,
    gender: 'm',
    alive: true,
    profession: 'Entertainer',
    nationality: 'Test',
    ageRange: '30s',
    hairColor: 'brown',
    famousFor: `Famous for ${name}`,
    facts: [`Fact one about ${name}`, `Fact two about ${name}`, `Fact three about ${name}`],
    region,
    genre,
    difficulty,
  };
}

/** Synthetic D064 fielded pool: 6 bollywood/music, 4 bollywood/cinema,
 * 3 hollywood/music, 3 hollywood/sports, 2 row/politics, 2 legacy. */
const POOL: Celebrity[] = [
  // bollywood + music (6: t1×2, t2×2, t3×2)
  celebrity('Arijit Singh', 'bollywood', 'music', 1),
  celebrity('Neha Kakkar', 'bollywood', 'music', 1),
  celebrity('Shreya Ghoshal', 'bollywood', 'music', 2),
  celebrity('A. R. Rahman', 'bollywood', 'music', 2),
  celebrity('Lata Mangeshkar', 'bollywood', 'music', 3),
  celebrity('Kishore Kumar', 'bollywood', 'music', 3),
  // bollywood + cinema (4: t1×1, t2×2, t3×1)
  celebrity('Ranveer Singh', 'bollywood', 'cinema', 1),
  celebrity('Deepika Padukone', 'bollywood', 'cinema', 2),
  celebrity('Ranbir Kapoor', 'bollywood', 'cinema', 2),
  celebrity('Dilip Kumar', 'bollywood', 'cinema', 3),
  // hollywood + music (3: t1×1, t2×1, t3×1)
  celebrity('Taylor Swift', 'hollywood', 'music', 1),
  celebrity('Ed Sheeran', 'hollywood', 'music', 2),
  celebrity('Elvis Presley', 'hollywood', 'music', 3),
  // hollywood + sports (3: t1×2, t2×1)
  celebrity('LeBron James', 'hollywood', 'sports', 1),
  celebrity('Serena Williams', 'hollywood', 'sports', 1),
  celebrity('Usain Bolt', 'hollywood', 'sports', 2),
  // row + politics (2: t1×1, t3×1)
  celebrity('Nelson Mandela', 'row', 'politics', 1),
  celebrity('Mahatma Gandhi', 'row', 'politics', 3),
  // legacy rows: no region/genre/difficulty fields
  {
    name: 'Legacy One',
    gender: 'f',
    alive: false,
    profession: 'Actor',
    nationality: 'Unknown',
    ageRange: '60s',
    hairColor: 'grey',
    famousFor: 'Old films',
    facts: ['Fact a', 'Fact b', 'Fact c'],
  },
  {
    name: 'Legacy Two',
    gender: 'm',
    alive: false,
    profession: 'Writer',
    nationality: 'Unknown',
    ageRange: '70s',
    hairColor: 'white',
    famousFor: 'Old books',
    facts: ['Fact x', 'Fact y', 'Fact z'],
  },
];

describe('buildGuessWhoDeck (D064, GUESS-WHO-DESIGN §3.2)', () => {
  it('is deterministic per (pool, filter, seed) — golden for all/all', () => {
    const deck = buildGuessWhoDeck(POOL, ALL, 5, 42);
    expect(deck.map((entry) => entry.name)).toEqual([
      'Usain Bolt',
      'Taylor Swift',
      'Deepika Padukone',
      'Shreya Ghoshal',
      'Legacy One',
    ]);
  });

  it('is deterministic per (pool, filter, seed) — golden for bollywood/music', () => {
    const deck = buildGuessWhoDeck(POOL, BOLLYWOOD_MUSIC, 5, 42);
    expect(deck.map((entry) => entry.name)).toEqual([
      'Shreya Ghoshal',
      'Neha Kakkar',
      'Kishore Kumar',
      'A. R. Rahman',
      'Lata Mangeshkar',
    ]);
  });

  it('differs across seeds (rematch re-deals)', () => {
    const a = buildGuessWhoDeck(POOL, BOLLYWOOD_MUSIC, 5, 1);
    const b = buildGuessWhoDeck(POOL, BOLLYWOOD_MUSIC, 5, 2);
    expect(a.map((entry) => entry.name)).not.toEqual(b.map((entry) => entry.name));
  });

  it('keeps the deck-size invariant and the tier-1 cap on a rich pool', () => {
    const deck = buildGuessWhoDeck(POOL, ALL, 5, 7);
    expect(deck).toHaveLength(5); // min(5, 18)
    const tier1 = deck.filter((entry) => entry.difficulty === 1);
    expect(tier1.length).toBeLessThanOrEqual(2);
    // No repeats by construction.
    expect(new Set(deck.map((entry) => entry.name)).size).toBe(5);
  });

  it('applies the region+genre filter with AND semantics', () => {
    const deck = buildGuessWhoDeck(POOL, BOLLYWOOD_MUSIC, 5, 7);
    expect(deck).toHaveLength(5); // min(5, 6)
    for (const entry of deck) {
      expect(entry.region).toBe('bollywood');
      expect(entry.genre).toBe('music');
    }
  });

  it('pool-edge: filtered pool < roundCount ⇒ deck is the whole pool, no crash', () => {
    const narrow: GuessWhoFilter = { region: 'row', genre: 'politics' };
    const deck = buildGuessWhoDeck(POOL, narrow, 5, 3);
    expect(deck).toHaveLength(2); // exactly the filtered pool
    expect(new Set(deck.map((entry) => entry.name)).size).toBe(2);
    // Even an empty filter result is a valid (empty) deck.
    const empty: GuessWhoFilter = { region: 'row', genre: 'technology' };
    expect(buildGuessWhoDeck(POOL, empty, 5, 3)).toEqual([]);
  });

  it('degrades the tier-1 cap rather than shrinking the deck', () => {
    // 5 tier-1 + 1 tier-2: the cap (2) leaves the deck short, so it fills
    // from the rest of tier-1 — size invariant wins over the cap.
    const smallPool: Celebrity[] = [
      celebrity('T1-A', 'bollywood', 'music', 1),
      celebrity('T1-B', 'bollywood', 'music', 1),
      celebrity('T1-C', 'bollywood', 'music', 1),
      celebrity('T1-D', 'bollywood', 'music', 1),
      celebrity('T1-E', 'bollywood', 'music', 1),
      celebrity('T2-A', 'bollywood', 'music', 2),
    ];
    const deck = buildGuessWhoDeck(smallPool, BOLLYWOOD_MUSIC, 5, 9);
    expect(deck).toHaveLength(5); // min(5, 6)
    expect(deck.filter((entry) => entry.difficulty === 1).length).toBeGreaterThan(2);
    expect(new Set(deck.map((entry) => entry.name)).size).toBe(5);
  });

  it('legacy rows without the new fields never crash the builder', () => {
    // Missing region defaults to 'row' defensively: a 'row' filter includes
    // them, a genre filter excludes them (they have no genre), and the deck
    // is still full-sized when the rest of the pool satisfies the filter.
    const row: GuessWhoFilter = { region: 'row', genre: 'all' };
    const rowDeck = buildGuessWhoDeck(POOL, row, 20, 5);
    expect(rowDeck.some((entry) => entry.name === 'Legacy Two')).toBe(true);
    const music = buildGuessWhoDeck(POOL, { region: 'all', genre: 'music' }, 20, 5);
    expect(music.some((entry) => entry.name === 'Legacy One')).toBe(false);
    // All-legacy pool: defaults hold, deck is deterministic and full.
    const legacyOnly = POOL.filter((entry) => entry.region === undefined);
    const deck = buildGuessWhoDeck(legacyOnly, row, 5, 11);
    expect(deck).toHaveLength(2); // min(5, 2) — pool-edge
  });

  it('exported enums match the closed taxonomy (14 genres — owner 2026-08-06 cinema split)', () => {
    expect(GUESS_WHO_REGIONS).toEqual(['bollywood', 'hollywood', 'row']);
    expect(GUESS_WHO_GENRES).toHaveLength(14);
    expect(GUESS_WHO_GENRES).toContain('cinema-bollywood');
    expect(GUESS_WHO_GENRES).toContain('cinema-hollywood');
    expect(GUESS_WHO_DEFAULT_FILTER).toEqual({ region: 'all', genre: 'all' });
  });
});

describe('toWireCelebrity (D064, balance fields never leave the server)', () => {
  it('strips region/genre/difficulty and keeps the D041 traits', () => {
    const wire = toWireCelebrity(POOL[0]!);
    expect(wire).not.toBeNull();
    expect(wire).not.toHaveProperty('region');
    expect(wire).not.toHaveProperty('genre');
    expect(wire).not.toHaveProperty('difficulty');
    expect(wire!.name).toBe('Arijit Singh');
    expect(wire!.facts).toHaveLength(3);
    expect(wire!.gender).toBe('m');
  });

  it('returns null for a null celebrity', () => {
    expect(toWireCelebrity(null)).toBeNull();
  });
});
