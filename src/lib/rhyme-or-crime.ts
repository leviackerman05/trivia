/**
 * Rhyme or Crime (M7/M14, PRD §5.2) — pure game logic. The dataset encodes
 * the CMU-pronouncing-dictionary work at generation time (prompt + category +
 * valid rhyming answers). Judging is two-tier (M14): dataset answers are
 * authoritative (the dataset knowingly includes puns like witch→peach), and
 * ANY other word passes when its CMU rhyme key matches the prompt's (so
 * "hi" rhymes with "pie" even though it isn't in the answer list). Scoring:
 * +10 correct, +5 speed bonus under 10s, streak multiplier ×2 after 3
 * consecutive, ×3 after 5.
 */

import { normalizeAnswer } from './solo';
import phonemesJson from '../data/rhyme-phonemes.json';

/** word → CMU rhyme key (final stressed vowel + tail, stress stripped). */
const phonemeKeys = phonemesJson as Record<string, string>;

export interface RhymeEntry {
  prompt: string;
  category: string;
  answers: string[];
}

export const RHYME_ROUND_SECONDS = 60;
export const RHYME_SPEED_BONUS_MS = 10_000;
export const RHYME_TOTAL_ROUNDS = 5;

export function pickRhymeRounds(
  entries: RhymeEntry[],
  count = RHYME_TOTAL_ROUNDS,
  seed = 0,
  category: string | null = null
): RhymeEntry[] {
  const pool = (
    category ? entries.filter((entry) => entry.category === category) : [...entries]
  ).slice();
  const rounds: RhymeEntry[] = [];
  let cursor = seed;
  while (rounds.length < count && pool.length > 0) {
    const index = cursor % pool.length;
    rounds.push(pool[index]!);
    pool.splice(index, 1);
    cursor += 1;
  }
  return rounds;
}

export interface RhymeVerdict {
  correct: boolean;
  /** A valid answer to reveal after a miss. */
  reveal: string;
  basePoints: number;
  streakMultiplier: number;
  points: number;
}

/** Does the guess phonetically rhyme with the prompt (CMU rhyme keys)? */
export function phoneticallyRhymes(prompt: string, guess: string): boolean {
  const promptKey = phonemeKeys[normalizeAnswer(prompt)];
  const guessKey = phonemeKeys[normalizeAnswer(guess)];
  return Boolean(promptKey && guessKey && promptKey === guessKey);
}

/** Is the guess a word the rhyme dictionary knows? (unknown → "I don't know that word") */
export function isKnownWord(guess: string): boolean {
  return phonemeKeys[normalizeAnswer(guess)] !== undefined;
}

export function judgeRhymeAnswer(
  entry: RhymeEntry,
  guess: string,
  elapsedMs: number
): RhymeVerdict {
  const normalized = normalizeAnswer(guess);
  // Tier 1: the dataset's answer list (pun entries included) is authoritative.
  const inAnswers = entry.answers.some((answer) => normalizeAnswer(answer) === normalized);
  // Tier 2: any real rhyme the dictionary knows, e.g. "hi" for "pie".
  const correct = inAnswers || phoneticallyRhymes(entry.prompt, guess);
  const reveal = entry.answers[0] ?? entry.prompt;
  const basePoints = correct ? 10 + (elapsedMs <= RHYME_SPEED_BONUS_MS ? 5 : 0) : 0;
  return { correct, reveal, basePoints, streakMultiplier: 1, points: basePoints };
}

/** Consecutive-correct multiplier: ×2 from the 3rd, ×3 from the 5th. */
export function streakMultiplier(consecutiveCorrect: number): number {
  if (consecutiveCorrect >= 5) {
    return 3;
  }
  if (consecutiveCorrect >= 3) {
    return 2;
  }
  return 1;
}

export function applyMultiplier(verdict: RhymeVerdict, consecutiveCorrect: number): RhymeVerdict {
  const multiplier = verdict.correct ? streakMultiplier(consecutiveCorrect) : 1;
  return { ...verdict, streakMultiplier: multiplier, points: verdict.basePoints * multiplier };
}
