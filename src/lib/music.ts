/**
 * Daily Music — "Name That Song" (DAILY-DESIGN §3.3).
 *
 * 10 rounds/day, stratified 3 easy / 4 medium / 3 hard so a day is never
 * all deep cuts. Clues are emoji + year + BPM only — no audio, no lyrics,
 * no album art (licensing walls, DAILY-SCOPE §6). `bpmSource` is internal
 * QA metadata and is stripped from the round type so it can never render.
 * Pure functions only.
 */

import { hashString } from './trivia';
import { pickDistinct } from './pick';

export interface MusicEntry {
  title: string;
  artist: string;
  year: number;
  genre: string;
  emoji: string;
  bpm: number;
  difficulty: 1 | 2 | 3;
  options: string[];
  answer: number;
  /** Internal QA metadata (two-source check); never rendered, never shipped. */
  bpmSource: string;
}

/** The round is the entry minus the internal QA metadata. */
export type MusicRound = Omit<MusicEntry, 'bpmSource'>;

export const MUSIC_ROUNDS_PER_DAY = 10;
/** Stratification quotas per difficulty tier (3 easy / 4 medium / 3 hard). */
export const MUSIC_TIER_QUOTAS: Record<1 | 2 | 3, number> = { 1: 3, 2: 4, 3: 3 };

/** Cursor shuffle of a slot list (the pickDistinct technique). */
function shuffleEntries<T>(entries: T[], seed: number): T[] {
  const pool = [...entries];
  const shuffled: T[] = [];
  let cursor = seed;
  while (pool.length > 0) {
    const index = cursor % pool.length;
    shuffled.push(pool.splice(index, 1)[0]!);
    cursor += 1;
  }
  return shuffled;
}

export function pickMusicRounds(
  entries: MusicEntry[],
  count = MUSIC_ROUNDS_PER_DAY,
  seed = 0
): MusicRound[] {
  const tier1 = entries.filter((entry) => entry.difficulty === 1);
  const tier2 = entries.filter((entry) => entry.difficulty === 2);
  const tier3 = entries.filter((entry) => entry.difficulty === 3);
  const picked = [
    ...pickDistinct(tier1, MUSIC_TIER_QUOTAS[1], hashString(`${seed}:t1`)),
    ...pickDistinct(tier2, MUSIC_TIER_QUOTAS[2], hashString(`${seed}:t2`)),
    ...pickDistinct(tier3, MUSIC_TIER_QUOTAS[3], hashString(`${seed}:t3`)),
  ];
  // Pool-edge fallback: fill any tier shortfall from the remaining pool,
  // then re-shuffle once. Deterministic in every branch.
  if (picked.length < count) {
    const pickedTitles = new Set(picked.map((entry) => entry.title));
    const leftovers = entries.filter((entry) => !pickedTitles.has(entry.title));
    picked.push(...pickDistinct(leftovers, count - picked.length, hashString(`${seed}:fill`)));
  }
  const ordered = shuffleEntries(picked, hashString(`${seed}:order`));
  return ordered.map(({ bpmSource: _bpmSource, ...round }) => round);
}
