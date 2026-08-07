/**
 * Trivia topic hub (TRIVIA-TOPICS §3, M-T1): registry types, the exact
 * rotation seed contract, and the per-topic replay counter. Pure functions
 * only — no Math.random anywhere (D050); the seed strings are the
 * cross-boundary contract a future BE consumer implements identically.
 *
 * Seed strings (hashed with FNV-1a hashString):
 *   first set of the day  → `${topic}:${dateKey}`
 *   replay N (N ≥ 1)      → `${topic}:${dateKey}:${N}`
 *
 * The replay counter is monotonic per topic (never pruned). The FIRST play
 * of a day always uses replay 0 (the fresh same-for-everyone set) and
 * ignores the stored counter; "New questions" bumps the counter and seeds
 * with the new N. The dateKey in the seed makes the next day's first set
 * fresh regardless of how high the counter grew.
 *
 * The on-demand topic loader lives in src/islands/trivia/topicData.ts
 * (client layer): import.meta.glob is transformed by the browser build,
 * not by the node unit-test pipeline, so this lib stays pure.
 */

import { hashString, type TriviaQuestion } from './trivia';
import { optionSeed, pickDistinct, shuffleQuestion } from './pick';
import type { IconName } from './icons';
import registryJson from '../data/topics/registry.json';

export interface TopicRegistryRow {
  slug: string;
  label: string;
  region: 'US' | 'IN' | 'global';
  difficulty: 1 | 2 | 3;
  icon: IconName;
  launch: boolean;
}

/** Additive schema (§2.1): topic rows carry the file slug + a 1-3 difficulty. */
export type TopicQuestion = TriviaQuestion & { topic: string; difficulty: 1 | 2 | 3 };

export const topicRegistry = registryJson as TopicRegistryRow[];

export const TOPIC_QUESTIONS_PER_GAME = 10;
/** S7: the classic tile plays from the existing 525-pool under slug `classic`. */
export const CLASSIC_TOPIC_SLUG = 'classic';

/** Replay counter key (§3): value is `{ [topicSlug]: number }`, monotonic. */
export const TOPIC_REPLAY_KEY = 'triviahub:trivia-topic-replay:v1';

export function getTopicRow(slug: string): TopicRegistryRow | undefined {
  return topicRegistry.find((row) => row.slug === slug);
}

/** The exact seed contract (§3): replay 0 → bare topic:dateKey, N ≥ 1 → :N. */
export function topicSeed(topic: string, dateKey: string, replay: number): number {
  return hashString(replay > 0 ? `${topic}:${dateKey}:${replay}` : `${topic}:${dateKey}`);
}

/**
 * The rotation (§3.2): pickDistinct(entries, 10, seed) with pick order =
 * round order, then per-round option shuffles via the shipped optionSeed
 * convention. Generic over TriviaQuestion so classic (525-pool, no topic
 * fields) and topic files share one implementation.
 */
export function selectTopicQuestions<T extends TriviaQuestion>(
  entries: readonly T[],
  topic: string,
  dateKey: string,
  replay: number,
  count = TOPIC_QUESTIONS_PER_GAME
): T[] {
  const seed = topicSeed(topic, dateKey, replay);
  const picked = pickDistinct([...entries], count, seed);
  return picked.map((question, roundIndex) =>
    shuffleQuestion(question, optionSeed(seed, roundIndex))
  );
}

/** Read the monotonic replay counter for a topic (0 when missing/cleared). */
export function readTopicReplay(slug: string): number {
  if (typeof window === 'undefined') {
    return 0;
  }
  try {
    const raw = window.localStorage.getItem(TOPIC_REPLAY_KEY);
    const stored = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    return typeof stored[slug] === 'number' && stored[slug]! > 0 ? stored[slug]! : 0;
  } catch {
    return 0;
  }
}

/** "New questions": bump the topic's counter and return the new N. */
export function bumpTopicReplay(slug: string): number {
  const next = readTopicReplay(slug) + 1;
  if (typeof window === 'undefined') {
    return next;
  }
  try {
    const raw = window.localStorage.getItem(TOPIC_REPLAY_KEY);
    const stored = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    stored[slug] = next;
    window.localStorage.setItem(TOPIC_REPLAY_KEY, JSON.stringify(stored));
  } catch {
    // Storage unavailable (private mode): the in-memory value still works
    // for this session.
  }
  return next;
}
