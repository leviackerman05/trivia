/**
 * Daily Geography — "Where in the World?" (DAILY-DESIGN §3.1).
 *
 * 10 rounds/day, deterministic per (dateKey, slug): a seeded pick of
 * entries, then a region-cap re-roll so no day skews toward one continent.
 * Pure functions only; the GeographyDaily island is a thin UI on top.
 */

import { pickDistinct } from './pick';

export interface GeographyCredit {
  creator: string;
  /** Only share-alike licenses render a credit line (PD/CC0 omit credit). */
  license: 'by' | 'by-sa';
}

export type GeographyRegion = 'africa' | 'americas' | 'asia' | 'europe' | 'oceania';

export interface GeographyEntry {
  place: string;
  url: string;
  credit?: GeographyCredit;
  options: string[];
  answer: number;
  hint: string;
  region: GeographyRegion;
}

export const GEOGRAPHY_ROUNDS_PER_DAY = 10;
/** P1 balance rule: at most 4 rounds per region bucket per day. */
export const GEOGRAPHY_REGION_CAP = 4;
/** Deterministic re-roll stride (DAILY-DESIGN §3.1 step 2). */
const REGION_REROLL_STRIDE = 31;
const REGION_REROLL_TRIES = 63;

function withinRegionCap(rounds: GeographyEntry[]): boolean {
  const counts = new Map<string, number>();
  for (const round of rounds) {
    counts.set(round.region, (counts.get(round.region) ?? 0) + 1);
  }
  return [...counts.values()].every((count) => count <= GEOGRAPHY_REGION_CAP);
}

/**
 * Seeded daily rounds. Re-rolls deterministically (seed + k * 31) until no
 * region exceeds the cap; after 63 tries returns the last candidate (a
 * theoretical backstop — with ≥10 entries per bucket a valid subset always
 * exists). Round order = returned array order.
 */
export function pickGeographyRounds(
  entries: GeographyEntry[],
  count = GEOGRAPHY_ROUNDS_PER_DAY,
  seed = 0
): GeographyEntry[] {
  let candidate = pickDistinct(entries, count, seed);
  for (let k = 1; k <= REGION_REROLL_TRIES; k += 1) {
    if (withinRegionCap(candidate)) {
      return candidate;
    }
    candidate = pickDistinct(entries, count, seed + k * REGION_REROLL_STRIDE);
  }
  return candidate;
}
