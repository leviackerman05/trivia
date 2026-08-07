import { describe, expect, it } from 'vitest';
import celebritiesJson from '../celebrities.json' with { type: 'json' };

interface CelebrityRow {
  name: string;
  gender: string;
  alive: boolean;
  profession: string;
  nationality: string;
  ageRange: string;
  hairColor: string;
  famousFor: string;
  facts: string[];
  region: string;
  genre: string;
  difficulty: number;
}

const celebrities = celebritiesJson as CelebrityRow[];

/**
 * Guess Who celebrity dataset gates (GUESS-WHO-DESIGN §5, cumulative per lot).
 *
 * The gates enforce the design's v1 numbers when the pool reaches v1
 * (1,000 entries). Below v1 they enforce scaled interim floors so every
 * checkpoint lot stays green while lots are still landing:
 *
 *   | rule                | interim (< 1,000)   | v1 (≥ 1,000)        |
 *   | ------------------- | ------------------- | ------------------- |
 *   | region quotas       | each region ≥ 5     | b ≥ 400 h ≥ 400 r ≥ 200 |
 *   | genre balance       | ≥ 6 genres ≥ 5      | all 12 ≥ 20, none > 40% |
 *   | tier mix            | t1 ≤ 60%, t3 ≥ 5    | t1 ≤ 40%, t3 ≥ 15%  |
 *   | gender              | both ≥ 25%          | both ≥ 30%          |
 *
 * Everything else (schema, enums, uniqueness, deceased ≥ 10%, genre cap)
 * applies at every lot.
 */

const REGIONS = ['bollywood', 'hollywood', 'row'] as const;
const GENRES = [
  'music',
  'cinema',
  'cinema-bollywood',
  'cinema-hollywood',
  'television',
  'sports',
  'politics',
  'business',
  'science',
  'technology',
  'literature',
  'internet',
  'art-fashion',
  'royalty',
] as const;
const V1 = 1000;
const TOTAL = celebrities.length;

/** D064, the deck needs 5 per cell; chips hide cells below this. */
const CHIP_FLOOR = 5;

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

describe('celebrities.json schema (GUESS-WHO-DESIGN §5.1)', () => {
  it('every entry has the 9 base fields + region + genre + difficulty, correctly typed', () => {
    for (const entry of celebrities) {
      expect(typeof entry.name, entry.name).toBe('string');
      expect(entry.name.length, entry.name).toBeGreaterThan(0);
      expect(entry.gender, entry.name).toMatch(/^[mf]$/);
      expect(typeof entry.alive, entry.name).toBe('boolean');
      expect(entry.profession.length, entry.name).toBeGreaterThan(0);
      expect(entry.nationality.length, entry.name).toBeGreaterThan(0);
      expect(entry.ageRange, entry.name).toMatch(/^\d+s$/);
      expect(entry.hairColor.length, entry.name).toBeGreaterThan(0);
      expect(entry.famousFor.length, entry.name).toBeGreaterThan(0);
      expect(Array.isArray(entry.facts), entry.name).toBe(true);
      expect(entry.region, entry.name).toMatch(/^(bollywood|hollywood|row)$/);
      expect(entry.genre, entry.name).toBeTruthy();
      expect([1, 2, 3], entry.name).toContain(entry.difficulty);
    }
  });

  it('facts ≥ 3 non-empty strings', () => {
    for (const entry of celebrities) {
      expect(entry.facts.length, entry.name).toBeGreaterThanOrEqual(3);
      for (const fact of entry.facts) {
        expect(fact.length, `${entry.name}: ${fact}`).toBeGreaterThan(0);
      }
    }
  });

  it('famousFor is a work/role list of ≤ 5 comma-separated items', () => {
    for (const entry of celebrities) {
      const items = entry.famousFor
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      expect(items.length, `${entry.name}: ${entry.famousFor}`).toBeGreaterThan(0);
      expect(items.length, `${entry.name}: ${entry.famousFor}`).toBeLessThanOrEqual(5);
    }
  });
});

describe('celebrities.json enums (GUESS-WHO-DESIGN §5.2)', () => {
  it('region, genre, difficulty, gender, ageRange all land in the closed sets', () => {
    for (const entry of celebrities) {
      expect(REGIONS, entry.name).toContain(entry.region);
      expect(GENRES, entry.name).toContain(entry.genre);
      expect([1, 2, 3], entry.name).toContain(entry.difficulty);
      expect(entry.gender, entry.name).toMatch(/^[mf]$/);
      expect(entry.ageRange, entry.name).toMatch(/^\d+s$/);
    }
  });
});

describe('celebrities.json uniqueness (GUESS-WHO-DESIGN §5.4)', () => {
  it('normalized display names are unique across the file', () => {
    const seen = new Set<string>();
    for (const entry of celebrities) {
      const key = normalizeName(entry.name);
      expect(seen.has(key), `duplicate: ${entry.name}`).toBe(false);
      seen.add(key);
    }
  });
});

describe('celebrities.json region quotas (GUESS-WHO-DESIGN §5.3)', () => {
  it(`each region has ≥ ${CHIP_FLOOR} entries (chips render); at v1: b ≥ 400, h ≥ 400, r ≥ 200`, () => {
    const counts: Record<string, number> = { bollywood: 0, hollywood: 0, row: 0 };
    for (const entry of celebrities) {
      counts[entry.region] = (counts[entry.region] ?? 0) + 1;
    }
    for (const region of REGIONS) {
      expect(counts[region], region).toBeGreaterThanOrEqual(CHIP_FLOOR);
    }
    if (TOTAL >= V1) {
      expect(counts.bollywood, 'bollywood').toBeGreaterThanOrEqual(400);
      expect(counts.hollywood, 'hollywood').toBeGreaterThanOrEqual(400);
      expect(counts.row, 'row').toBeGreaterThanOrEqual(200);
    }
  });
});

describe('celebrities.json genre balance (GUESS-WHO-DESIGN §5.5)', () => {
  it('no single genre exceeds 40% of the pool', () => {
    for (const genre of GENRES) {
      const count = celebrities.filter((entry) => entry.genre === genre).length;
      expect(count, genre).toBeLessThanOrEqual(TOTAL * 0.4);
    }
  });

  it('interim: ≥ 6 genres hold ≥ 5 entries; at v1: every genre ≥ 20', () => {
    const counts = GENRES.map((genre) => ({
      genre,
      count: celebrities.filter((entry) => entry.genre === genre).length,
    }));
    const filled = counts.filter(({ count }) => count >= CHIP_FLOOR).length;
    expect(filled).toBeGreaterThanOrEqual(6);
    if (TOTAL >= V1) {
      for (const { genre, count } of counts) {
        expect(count, genre).toBeGreaterThanOrEqual(20);
      }
    }
  });
});

describe('celebrities.json difficulty mix (GUESS-WHO-DESIGN §5.6)', () => {
  it('interim: t1 ≤ 60%, t3 ≥ 5; at v1: t1 ≤ 40%, t3 ≥ 15%', () => {
    const tiers = celebrities.reduce(
      (acc, entry) => {
        acc[entry.difficulty] = (acc[entry.difficulty] ?? 0) + 1;
        return acc;
      },
      { 1: 0, 2: 0, 3: 0 } as Record<number, number>
    );
    if (TOTAL >= V1) {
      expect((tiers[1] ?? 0) / TOTAL).toBeLessThanOrEqual(0.4);
      expect((tiers[3] ?? 0) / TOTAL).toBeGreaterThanOrEqual(0.15);
    } else {
      expect((tiers[1] ?? 0) / TOTAL).toBeLessThanOrEqual(0.6);
      expect(tiers[3] ?? 0).toBeGreaterThanOrEqual(CHIP_FLOOR);
    }
  });
});

describe('celebrities.json alive/gender sanity (GUESS-WHO-DESIGN §5.7)', () => {
  it('interim: both genders ≥ 25%; at v1: both ≥ 30%', () => {
    const byGender = celebrities.reduce(
      (acc, entry) => {
        acc[entry.gender] = (acc[entry.gender] ?? 0) + 1;
        return acc;
      },
      { m: 0, f: 0 } as Record<string, number>
    );
    const floor = TOTAL >= V1 ? 0.3 : 0.25;
    expect((byGender.f ?? 0) / TOTAL).toBeGreaterThanOrEqual(floor);
    expect((byGender.m ?? 0) / TOTAL).toBeGreaterThanOrEqual(floor);
  });

  it('alive has both values and deceased ≥ 10%', () => {
    const alive = celebrities.filter((entry) => entry.alive).length;
    const deceased = celebrities.length - alive;
    expect(alive).toBeGreaterThan(0);
    expect(deceased).toBeGreaterThan(0);
    expect(deceased / celebrities.length).toBeGreaterThanOrEqual(0.1);
  });
});
