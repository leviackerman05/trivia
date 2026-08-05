import type { Celebrity, CelebrityGenre, CelebrityRegion } from '../engine/guess-who-engine.js';
import { hashString, seededRandom } from './random.js';

/**
 * Guess Who deck builder (D064, GUESS-WHO-DESIGN §3.2): one game = one deck.
 * Pure + deterministic per (pool, filter, seed) — same inputs ⇒ same deck.
 * The socket layer seeds with `hashString(roomCode:gameSerial)` so rematches
 * re-deal. All three new Celebrity fields are server-internal balance
 * metadata: `toWireCelebrity` strips them from every wire payload.
 */

export interface GuessWhoFilter {
  region: 'all' | CelebrityRegion;
  genre: 'all' | CelebrityGenre;
}

export const GUESS_WHO_REGIONS: readonly CelebrityRegion[] = ['bollywood', 'hollywood', 'row'];

export const GUESS_WHO_GENRES: readonly CelebrityGenre[] = [
  'music',
  'cinema',
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
];

export const GUESS_WHO_DEFAULT_FILTER: GuessWhoFilter = { region: 'all', genre: 'all' };

/** The tier guard's ceiling: at most 2 of the 5 rounds are tier-1 (owner
 * decision 6.7 recommended default — best-effort, see buildGuessWhoDeck). */
const TIER1_CAP = 2;

/** The wire celebrity: the D041 traits only, never the balance fields. */
export type CelebrityWire = Omit<Celebrity, 'region' | 'genre' | 'difficulty'>;

/** Owner redesign: the questioning clue is the wire traits WITHOUT the name
 * — nobody (not even the host) sees the name until the reveal. */
export type CelebrityClue = Omit<CelebrityWire, 'name'>;

export function toWireCelebrity(celebrity: Celebrity | null): CelebrityWire | null {
  if (!celebrity) {
    return null;
  }
  return {
    name: celebrity.name,
    gender: celebrity.gender,
    alive: celebrity.alive,
    profession: celebrity.profession,
    nationality: celebrity.nationality,
    ageRange: celebrity.ageRange,
    hairColor: celebrity.hairColor,
    famousFor: celebrity.famousFor,
    facts: celebrity.facts,
  };
}

export function toWireClue(celebrity: Celebrity | null): CelebrityClue | null {
  if (!celebrity) {
    return null;
  }
  const wire = toWireCelebrity(celebrity);
  if (!wire) {
    return null;
  }
  return {
    gender: wire.gender,
    alive: wire.alive,
    profession: wire.profession,
    nationality: wire.nationality,
    ageRange: wire.ageRange,
    hairColor: wire.hairColor,
    famousFor: wire.famousFor,
    facts: wire.facts,
  };
}

function seededShuffle<T>(entries: T[], seed: number): T[] {
  const rand = seededRandom(seed);
  const result = [...entries];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const swap = result[i]!;
    result[i] = result[j]!;
    result[j] = swap;
  }
  return result;
}

/** AND semantics; legacy rows (pre-L12) default to region 'row' defensively
 * and simply fail a genre filter (they have no genre). */
function matchesFilter(entry: Celebrity, filter: GuessWhoFilter): boolean {
  if (filter.region !== 'all' && (entry.region ?? 'row') !== filter.region) {
    return false;
  }
  if (filter.genre !== 'all' && entry.genre !== filter.genre) {
    return false;
  }
  return true;
}

/**
 * Build the deck for one game. Algorithm (GUESS-WHO-DESIGN §3.2):
 *  1. Filter the pool (AND semantics; missing region ⇒ 'row').
 *  2. Pool-edge (filtered < roundCount): the deck is the whole filtered
 *     pool — no cap logic applies.
 *  3. Otherwise: seeded-shuffle each tier partition (sub-seeds derived from
 *     the main seed), fill tier-2 → tier-3 → tier-1 (cap 2), then degrade
 *     the cap if still short. The cap is a preference order, never a size
 *     constraint: the deck is always min(roundCount, filteredPool.length).
 *  4. Final seeded Fisher-Yates; take roundCount.
 */
export function buildGuessWhoDeck(
  pool: Celebrity[],
  filter: GuessWhoFilter,
  roundCount: number,
  seed: number
): Celebrity[] {
  const filtered = pool.filter((entry) => matchesFilter(entry, filter));
  if (filtered.length <= roundCount) {
    return seededShuffle(filtered, seed).slice(0, filtered.length);
  }
  const byTier: [Celebrity[], Celebrity[], Celebrity[]] = [[], [], []];
  for (const entry of filtered) {
    const tier = (entry.difficulty ?? 1) - 1;
    byTier[tier]!.push(entry);
  }
  const tier1 = seededShuffle(byTier[0]!, hashString(`${seed}:tier1`));
  const tier2 = seededShuffle(byTier[1]!, hashString(`${seed}:tier2`));
  const tier3 = seededShuffle(byTier[2]!, hashString(`${seed}:tier3`));
  const deck: Celebrity[] = [];
  const push = (entries: Celebrity[]) => {
    for (const entry of entries) {
      deck.push(entry);
      if (deck.length >= roundCount) {
        return;
      }
    }
  };
  push(tier2);
  push(tier3);
  push(tier1.slice(0, TIER1_CAP)); // the cap
  push(tier1.slice(TIER1_CAP)); // best-effort: degrade rather than shrink
  return seededShuffle(deck, seed).slice(0, roundCount);
}
