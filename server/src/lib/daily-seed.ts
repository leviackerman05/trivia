import { getPrisma } from './prisma.js';
import triviaQuestionsJson from '../data/trivia-questions.json' with { type: 'json' };

/**
 * Daily challenge seeding (M8, PRD §5.15 + §8.1), the server owns the daily
 * question set so every player's challenge and leaderboard are comparable.
 * Deterministic per UTC date (FNV-1a + seeded shuffle, matching the client's
 * old selection so nothing breaks); upserted idempotently on first read of
 * the day, no cron needed.
 */

export interface TriviaQuestion {
  category: string;
  question: string;
  options: string[];
  answer: number;
}

export interface DailyChallengeData {
  questions: TriviaQuestion[];
}

const TRIVIA_DAILY_QUESTIONS = 10;

/** FNV-1a string hash (mirrors src/lib/trivia.ts, deterministic cross-platform). */
export function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** mulberry32 seeded PRNG. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The daily question set for a UTC date (same day → same set, in order). */
export function selectDailyQuestions(
  dateKey: string,
  count = TRIVIA_DAILY_QUESTIONS
): TriviaQuestion[] {
  const rand = seededRandom(hashString(dateKey));
  const pool = [...(triviaQuestionsJson as TriviaQuestion[])];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const swap = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = swap;
  }
  return pool.slice(0, Math.min(count, pool.length));
}

/** Upsert today's trivia challenge (idempotent). Returns the challenge data. */
export async function ensureDailyChallenges(
  dateKey: string
): Promise<{ gameId: string; data: DailyChallengeData }[]> {
  const prisma = getPrisma();
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  const existing = await prisma.dailyChallenge.findUnique({
    where: { gameId_date: { gameId: 'trivia', date } },
  });
  if (existing) {
    return [{ gameId: 'trivia', data: existing.data as unknown as DailyChallengeData }];
  }
  const data: DailyChallengeData = { questions: selectDailyQuestions(dateKey) };
  await prisma.dailyChallenge.upsert({
    where: { gameId_date: { gameId: 'trivia', date } },
    update: { data: data as unknown as object },
    create: { gameId: 'trivia', date, data: data as unknown as object },
  });
  return [{ gameId: 'trivia', data }];
}
