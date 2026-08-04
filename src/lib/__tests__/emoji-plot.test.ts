import { describe, expect, it } from 'vitest';
import {
  decodeChallenge,
  encodeChallenge,
  judgeEmojiGuess,
  pickEmojiQuestions,
  revealedTitle,
  scoreEmojiGuess,
  type EmojiPlotEntry,
} from '../emoji-plot';

const ENTRIES: EmojiPlotEntry[] = [
  { emoji: '👦⚡🧙🏰', title: "Harry Potter and the Sorcerer's Stone", year: 2001, kind: 'movie' },
  { emoji: '🦁👑👦🌍', title: 'The Lion King', year: 1994, kind: 'movie' },
  { emoji: '🐷🕸️🕷️', title: "Charlotte's Web", year: 1952, kind: 'book' },
];

describe('Emoji Plot logic (PRD §5.3, M14)', () => {
  it('M14: hints are button-driven, letter reveal is skribbl-style', () => {
    expect(revealedTitle('The Lion King', 0)).toBe('••• •••• ••••');
    expect(revealedTitle('The Lion King', 3)).toBe('the •••• ••••');
    expect(revealedTitle('The Lion King', 7)).toBe('the lion ••••');
    expect(revealedTitle('The Lion King', 11)).toBe('the lion king');
  });

  it('M14: scoring, 100 base, −50 year hint, −10 per letter (floor 10)', () => {
    expect(scoreEmojiGuess({ yearUsed: false, lettersRevealed: 0 })).toBe(100);
    expect(scoreEmojiGuess({ yearUsed: true, lettersRevealed: 0 })).toBe(50);
    expect(scoreEmojiGuess({ yearUsed: false, lettersRevealed: 3 })).toBe(70);
    expect(scoreEmojiGuess({ yearUsed: true, lettersRevealed: 3 })).toBe(20);
    expect(scoreEmojiGuess({ yearUsed: true, lettersRevealed: 12 })).toBe(10);
  });

  it('judges guesses with fuzzy matching', () => {
    expect(judgeEmojiGuess(ENTRIES[0]!, 'harry potter')).toBe(true);
    expect(judgeEmojiGuess(ENTRIES[1]!, 'lion king')).toBe(true);
    expect(judgeEmojiGuess(ENTRIES[2]!, 'charlottes web')).toBe(true);
    expect(judgeEmojiGuess(ENTRIES[1]!, 'titanic')).toBe(false);
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
