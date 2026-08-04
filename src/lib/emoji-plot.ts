/**
 * Emoji Plot (M7/M14, PRD §5.3), pure game logic. 10 questions; hints are
 * BUTTON-DRIVEN (M14, no more auto-hints): a year hint and skribbl-style
 * progressive letter reveals. Scoring starts at 100 and drops 50 for the
 * year hint and 10 per revealed letter (floor 10). Acceptance uses
 * fuzzyMatchTitle (ignore "The", Levenshtein ≤ 2, partial titles).
 * "Create your own" challenges travel as a shareable URL whose answer is
 * base64-obfuscated so it isn't visible at a glance.
 */

import { fuzzyMatchTitle, normalizeAnswer } from './solo';

export interface EmojiPlotEntry {
  emoji: string;
  title: string;
  year: number;
  kind: 'movie' | 'book';
}

export const EMOJI_TOTAL_QUESTIONS = 10;

/** Skribbl-style: reveal letters from the start, blanks elsewhere. */
export function revealedTitle(title: string, lettersRevealed: number): string {
  const normalized = normalizeAnswer(title);
  let revealed = 0;
  return [...normalized]
    .map((char) => {
      if (char === ' ') {
        return ' ';
      }
      if (revealed < lettersRevealed) {
        revealed += 1;
        return char;
      }
      return '•';
    })
    .join('');
}

/** Score: 100 base − 50 for the year hint − 10 per revealed letter (min 10). */
export function scoreEmojiGuess(options: { yearUsed: boolean; lettersRevealed: number }): number {
  return Math.max(10, 100 - (options.yearUsed ? 50 : 0) - options.lettersRevealed * 10);
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

export function judgeEmojiGuess(entry: EmojiPlotEntry, guess: string): boolean {
  return fuzzyMatchTitle(guess, entry.title);
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
