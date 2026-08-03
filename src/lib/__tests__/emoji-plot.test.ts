import { describe, expect, it } from 'vitest';
import {
  decodeChallenge,
  encodeChallenge,
  firstLetterHint,
  hintLevelAt,
  judgeEmojiGuess,
  pickEmojiQuestions,
  scoreEmojiGuess,
  type EmojiPlotEntry,
} from '../emoji-plot';

const ENTRIES: EmojiPlotEntry[] = [
  { emoji: '👦⚡🧙🏰', title: "Harry Potter and the Sorcerer's Stone", year: 2001, kind: 'movie' },
  { emoji: '🦁👑👦🌍', title: 'The Lion King', year: 1994, kind: 'movie' },
  { emoji: '🐷🕸️🕷️', title: "Charlotte's Web", year: 1952, kind: 'book' },
];

describe('Emoji Plot logic (PRD §5.3)', () => {
  it('progressive hints: year at 15s, first letter at 25s', () => {
    expect(hintLevelAt(5_000)).toBe('none');
    expect(hintLevelAt(15_000)).toBe('year');
    expect(hintLevelAt(25_000)).toBe('letter');
    expect(hintLevelAt(29_999)).toBe('letter');
  });

  it('scoring by hint level: 100 / 50 / 25', () => {
    expect(scoreEmojiGuess('none')).toBe(100);
    expect(scoreEmojiGuess('year')).toBe(50);
    expect(scoreEmojiGuess('letter')).toBe(25);
  });

  it('judges guesses with fuzzy matching', () => {
    expect(judgeEmojiGuess(ENTRIES[0]!, 'harry potter', 'none')).toBe(true);
    expect(judgeEmojiGuess(ENTRIES[1]!, 'lion king', 'year')).toBe(true);
    expect(judgeEmojiGuess(ENTRIES[2]!, 'charlottes web', 'letter')).toBe(true);
    expect(judgeEmojiGuess(ENTRIES[1]!, 'titanic', 'none')).toBe(false);
  });

  it('first-letter hints skip spaces', () => {
    expect(firstLetterHint('The Lion King')).toBe('t');
  });

  it('challenge links round-trip through the base64 obfuscation', () => {
    const encoded = encodeChallenge('👦⚡🧙🏰', 'Harry Potter');
    expect(encoded).not.toContain('harry');
    const decoded = decodeChallenge(encoded);
    expect(decoded?.emoji).toBe('👦⚡🧙🏰');
    expect(decoded?.answer).toBe('harry potter');
    expect(decodeChallenge('not-valid!!')).toBeNull();
  });

  it('picks unique questions', () => {
    const picked = pickEmojiQuestions(ENTRIES, 3, 0);
    expect(picked).toHaveLength(3);
    expect(new Set(picked.map((entry) => entry.title)).size).toBe(3);
  });
});
