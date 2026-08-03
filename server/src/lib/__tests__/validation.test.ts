import { describe, expect, it } from 'vitest';
import {
  isGameId,
  isRoomCode,
  sanitizeChatMessage,
  sanitizeNickname,
  validateJoinRoomInput,
  validateRoomCreateInput,
  validateScoreInput,
} from '../validation.js';

describe('sanitizeNickname', () => {
  it('accepts and trims a normal nickname', () => {
    expect(sanitizeNickname('  Alice  ')).toEqual({ ok: true, value: 'Alice' });
  });

  it('rejects non-strings', () => {
    expect(sanitizeNickname(42).ok).toBe(false);
    expect(sanitizeNickname(null).ok).toBe(false);
  });

  it('rejects empty and whitespace-only nicknames', () => {
    expect(sanitizeNickname('').ok).toBe(false);
    expect(sanitizeNickname('   ').ok).toBe(false);
  });

  it('strips control characters', () => {
    expect(sanitizeNickname('Ali\u0000ce')).toEqual({ ok: true, value: 'Alice' });
  });

  it('caps nicknames at 20 characters', () => {
    expect(sanitizeNickname('a'.repeat(21)).ok).toBe(false);
    expect(sanitizeNickname('a'.repeat(20)).ok).toBe(true);
  });
});

describe('sanitizeChatMessage', () => {
  it('accepts a normal message', () => {
    expect(sanitizeChatMessage('  hello room!  ')).toEqual({
      ok: true,
      value: 'hello room!',
    });
  });

  it('rejects empty messages and non-strings', () => {
    expect(sanitizeChatMessage('').ok).toBe(false);
    expect(sanitizeChatMessage(undefined).ok).toBe(false);
  });

  it('caps messages at 300 characters', () => {
    expect(sanitizeChatMessage('a'.repeat(301)).ok).toBe(false);
    expect(sanitizeChatMessage('a'.repeat(300)).ok).toBe(true);
  });
});

describe('isRoomCode', () => {
  it('accepts 6-character alphanumeric codes, case-insensitive', () => {
    expect(isRoomCode('ABC123')).toBe(true);
    expect(isRoomCode('abc123')).toBe(true);
    expect(isRoomCode('a1b2c3')).toBe(true);
  });

  it('rejects wrong lengths and invalid characters', () => {
    expect(isRoomCode('ABC12')).toBe(false);
    expect(isRoomCode('ABC1234')).toBe(false);
    expect(isRoomCode('ABC-23')).toBe(false);
    expect(isRoomCode(123456)).toBe(false);
  });
});

describe('isGameId', () => {
  it('accepts catalog slugs and rejects empty/oversized values', () => {
    expect(isGameId('skribbl-arena')).toBe(true);
    expect(isGameId('')).toBe(false);
    expect(isGameId('a'.repeat(65))).toBe(false);
  });
});

describe('validateScoreInput (PRD §8.1)', () => {
  it('accepts a valid score payload', () => {
    expect(
      validateScoreInput({ gameId: 'skribbl-arena', playerName: 'Alice', score: 120 })
    ).toEqual({
      ok: true,
      value: { gameId: 'skribbl-arena', playerName: 'Alice', score: 120 },
    });
  });

  it('sanitizes the playerName in the accepted value', () => {
    const result = validateScoreInput({ gameId: 'trivia', playerName: '  Bob\u0007 ', score: 0 });
    expect(result).toEqual({ ok: true, value: { gameId: 'trivia', playerName: 'Bob', score: 0 } });
  });

  it('accepts an optional clientKey and rejects malformed ones', () => {
    expect(
      validateScoreInput({ gameId: 'trivia', playerName: 'Bob', score: 1, clientKey: 'k-bob-0001' })
        .ok
    ).toBe(true);
    expect(
      validateScoreInput({ gameId: 'trivia', playerName: 'Bob', score: 1, clientKey: 'short' }).ok
    ).toBe(false);
    expect(
      validateScoreInput({
        gameId: 'trivia',
        playerName: 'Bob',
        score: 1,
        clientKey: 'has spaces!',
      }).ok
    ).toBe(false);
    expect(
      validateScoreInput({ gameId: 'trivia', playerName: 'Bob', score: 1, clientKey: 42 }).ok
    ).toBe(false);
  });

  it('rejects non-object bodies', () => {
    expect(validateScoreInput('nope').ok).toBe(false);
    expect(validateScoreInput(null).ok).toBe(false);
    expect(validateScoreInput([1, 2]).ok).toBe(false);
  });

  it('rejects invalid gameId and nickname', () => {
    expect(validateScoreInput({ gameId: '', playerName: 'Alice', score: 1 }).ok).toBe(false);
    expect(validateScoreInput({ gameId: 'trivia', playerName: '  ', score: 1 }).ok).toBe(false);
  });

  it('rejects negative, non-integer, and oversized scores', () => {
    expect(validateScoreInput({ gameId: 'trivia', playerName: 'Alice', score: -1 }).ok).toBe(false);
    expect(validateScoreInput({ gameId: 'trivia', playerName: 'Alice', score: 1.5 }).ok).toBe(
      false
    );
    expect(validateScoreInput({ gameId: 'trivia', playerName: 'Alice', score: 1_000_001 }).ok).toBe(
      false
    );
  });
});

describe('validateRoomCreateInput (PRD §8.1)', () => {
  it('accepts a valid gameId and rejects invalid payloads', () => {
    expect(validateRoomCreateInput({ gameId: 'skribbl-arena' })).toEqual({
      ok: true,
      value: { gameId: 'skribbl-arena' },
    });
    expect(validateRoomCreateInput({ gameId: '' }).ok).toBe(false);
    expect(validateRoomCreateInput('nope').ok).toBe(false);
    expect(validateRoomCreateInput(null).ok).toBe(false);
  });
});

describe('validateJoinRoomInput (PRD §8.2)', () => {
  it('accepts a room code + nickname and sanitizes the name', () => {
    expect(validateJoinRoomInput({ roomCode: 'abc123', playerName: '  Zara ' })).toEqual({
      ok: true,
      value: { roomCode: 'abc123', playerName: 'Zara' },
    });
  });

  it('rejects bad codes and empty nicknames', () => {
    expect(validateJoinRoomInput({ roomCode: 'SHORT', playerName: 'Zara' }).ok).toBe(false);
    expect(validateJoinRoomInput({ roomCode: 'ABC123', playerName: '  ' }).ok).toBe(false);
    expect(validateJoinRoomInput({ roomCode: 'ABC123' }).ok).toBe(false);
  });
});
