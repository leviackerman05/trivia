/**
 * R20 (M21): Daily Wordle library (owner-mandated name 2026-08-05, was
 * "Verdal"). Our own word list (filtered from the existing 5,686-word bank —
 * NOT the NYT list) and our own visual treatment; no NYT art.
 *
 * Pure functions: word validation, letter-state feedback (correct /
 * wrong-position / absent with correct duplicate handling), and the
 * deterministic per-day pick via `dailyGameSeed` (D050 — same word for
 * everyone per UTC day, never Math.random in the daily path).
 */

import wordsJson from '../data/wordle-words.json';
import { dailyGameSeed } from './daily';

export const WORDLE_WORD_LENGTH = 5;
export const WORDLE_MAX_GUESSES = 6;

/**
 * [D066] Wordle scoring by attempt (owner 2026-08-07): solve in 1-6 guesses
 * = 100/85/70/55/40/25, a failed solve = 0.
 */
const WORDLE_SCORE_BY_ATTEMPT = [0, 100, 85, 70, 55, 40, 25];

export function wordleScore(attempts: number): number {
  return WORDLE_SCORE_BY_ATTEMPT[attempts] ?? 0;
}

export type LetterState = 'correct' | 'wrong-position' | 'absent';

export interface GuessFeedback {
  /** One state per letter of the guess, position-aligned. */
  states: LetterState[];
  solved: boolean;
}

/** The committed word list (unique, lowercase, 5 letters). */
export const wordleWords: string[] = wordsJson;

export function isWordleWord(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z]{5}$/.test(value);
}

/**
 * Deterministic daily pick: same UTC date ⇒ same word for everyone.
 * Falls back to a stable modulo pick when the list is empty (defensive).
 */
export function pickDailyWord(dateKey: string, words: string[] = wordleWords): string {
  if (words.length === 0) {
    return 'aegis';
  }
  return words[dailyGameSeed(dateKey, 'wordle') % words.length]!;
}

/**
 * Classic Wordle letter-state feedback with correct duplicate handling:
 * greens first, then yellows only up to the remaining count of each letter
 * in the answer (a second 'e' in the guess is gray when the answer has one
 * 'e', even if the first 'e' was already yellow/green).
 */
export function letterStates(guess: string, answer: string): GuessFeedback {
  const guessLetters = guess.toLowerCase().split('');
  const answerLetters = answer.toLowerCase().split('');

  const states: LetterState[] = guessLetters.map(() => 'absent');
  const remaining = new Map<string, number>();

  // Pass 1: exact matches (correct), counting leftover answer letters.
  for (let i = 0; i < guessLetters.length; i += 1) {
    if (guessLetters[i] === answerLetters[i]) {
      states[i] = 'correct';
    } else {
      remaining.set(answerLetters[i]!, (remaining.get(answerLetters[i]) ?? 0) + 1);
    }
  }
  // Pass 2: wrong-position only while the answer still has the letter.
  for (let i = 0; i < guessLetters.length; i += 1) {
    if (states[i] === 'correct') {
      continue;
    }
    const letter = guessLetters[i]!;
    const count = remaining.get(letter) ?? 0;
    if (count > 0) {
      states[i] = 'wrong-position';
      remaining.set(letter, count - 1);
    }
  }

  return { states, solved: states.every((state) => state === 'correct') };
}
