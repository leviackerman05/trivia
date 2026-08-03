/**
 * Emoji Plot (M7, PRD §5.3) — pure game logic. 10 questions × 30s; hints at
 * 15s (year) and 25s (first letter); scoring 100 / 50 / 25 by hint level.
 * Acceptance uses fuzzyMatchTitle (ignore "The", Levenshtein ≤ 2, partial
 * titles). "Create your own" challenges travel as a shareable URL whose
 * answer is base64-obfuscated so it isn't visible at a glance.
 */

import { fuzzyMatchTitle, normalizeAnswer } from './solo';

export interface EmojiPlotEntry {
  emoji: string;
  title: string;
  year: number;
  kind: 'movie' | 'book';
}

export const EMOJI_PLOT_SECONDS = 30;
export const EMOJI_YEAR_HINT_MS = 15_000;
export const EMOJI_LETTER_HINT_MS = 25_000;
export const EMOJI_TOTAL_QUESTIONS = 10;

export type EmojiHintLevel = 'none' | 'year' | 'letter';

export function hintLevelAt(elapsedMs: number): EmojiHintLevel {
  if (elapsedMs >= EMOJI_LETTER_HINT_MS) {
    return 'letter';
  }
  if (elapsedMs >= EMOJI_YEAR_HINT_MS) {
    return 'year';
  }
  return 'none';
}

export function pickEmojiQuestions(
  entries: EmojiPlotEntry[],
  count = EMOJI_TOTAL_QUESTIONS,
  seed = 0
): EmojiPlotEntry[] {
  const pool = [...entries];
  const questions: EmojiPlotEntry[] = [];
  let cursor = seed;
  while (questions.length < count && pool.length > 0) {
    const index = cursor % pool.length;
    questions.push(pool[index]!);
    pool.splice(index, 1);
    cursor += 1;
  }
  return questions;
}

export function scoreEmojiGuess(hintLevel: EmojiHintLevel): number {
  switch (hintLevel) {
    case 'none':
      return 100;
    case 'year':
      return 50;
    case 'letter':
      return 25;
  }
}

export function judgeEmojiGuess(
  entry: EmojiPlotEntry,
  guess: string,
  _hintLevel: EmojiHintLevel
): boolean {
  return fuzzyMatchTitle(guess, entry.title);
}

export function firstLetterHint(title: string): string {
  const normalized = normalizeAnswer(title);
  const letters = [...normalized].filter((char) => char !== ' ');
  return letters[0] ?? '';
}

/** Encode a create-your-own challenge into a shareable URL fragment. */
export function encodeChallenge(emoji: string, title: string): string {
  const payload = `${emoji}::${normalizeAnswer(title)}`;
  return btoa(unescape(encodeURIComponent(payload)));
}

export function decodeChallenge(encoded: string): { emoji: string; answer: string } | null {
  try {
    const payload = decodeURIComponent(escape(atob(encoded)));
    const [emoji, answer] = payload.split('::');
    if (!emoji || !answer) {
      return null;
    }
    return { emoji, answer };
  } catch {
    return null;
  }
}
