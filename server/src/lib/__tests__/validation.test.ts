import { describe, expect, it } from 'vitest';
import {
  isGameId,
  isRoomCode,
  isSubmissionId,
  sanitizeChatMessage,
  sanitizeNickname,
  validateDrawingFlagInput,
  validateDrawingSubmissionInput,
  validateDrawingVoteInput,
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

/** 1x1 transparent PNG (valid signature, ~70 bytes decoded). */
const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

function dataUrl(payload: string): string {
  return `data:image/png;base64,${payload}`;
}

describe('isSubmissionId (M19)', () => {
  it('accepts cuid-shaped ids', () => {
    expect(isSubmissionId('cm8f2abc1234567890abcdefg')).toBe(true);
    expect(isSubmissionId('12345678')).toBe(true);
  });

  it('rejects garbage, short ids, and non-strings', () => {
    expect(isSubmissionId('abc')).toBe(false);
    expect(isSubmissionId('a'.repeat(65))).toBe(false);
    expect(isSubmissionId('has-dashes!')).toBe(false);
    expect(isSubmissionId(42)).toBe(false);
  });
});

describe('validateDrawingSubmissionInput (M19)', () => {
  const valid = {
    memberKey: 'member-0001',
    playerName: '  Aditi ',
    dateKey: '2026-08-05',
    promptIndex: 3,
    image: TINY_PNG,
  };

  it('accepts a valid upload and sanitizes the playerName', () => {
    expect(validateDrawingSubmissionInput(valid)).toEqual({
      ok: true,
      value: {
        memberKey: 'member-0001',
        playerName: 'Aditi',
        dateKey: '2026-08-05',
        promptIndex: 3,
        image: TINY_PNG,
      },
    });
  });

  it('rejects a bad memberKey, dateKey, and promptIndex', () => {
    expect(validateDrawingSubmissionInput({ ...valid, memberKey: 'x' }).ok).toBe(false);
    expect(validateDrawingSubmissionInput({ ...valid, dateKey: '2026/08/05' }).ok).toBe(false);
    expect(validateDrawingSubmissionInput({ ...valid, promptIndex: -1 }).ok).toBe(false);
    expect(validateDrawingSubmissionInput({ ...valid, promptIndex: 1.5 }).ok).toBe(false);
    expect(validateDrawingSubmissionInput({ ...valid, promptIndex: 10_001 }).ok).toBe(false);
    expect(validateDrawingSubmissionInput({ ...valid, promptIndex: 10_000 }).ok).toBe(true);
  });

  it('rejects images that are not base64 PNG data URLs', () => {
    expect(validateDrawingSubmissionInput({ ...valid, image: 'not-a-url' }).ok).toBe(false);
    expect(
      validateDrawingSubmissionInput({ ...valid, image: 'data:image/jpeg;base64,AAAA' }).ok
    ).toBe(false);
    expect(validateDrawingSubmissionInput({ ...valid, image: dataUrl('not-base64!') }).ok).toBe(
      false
    );
  });

  it('rejects non-PNG payloads even with valid base64 (signature check)', () => {
    expect(validateDrawingSubmissionInput({ ...valid, image: dataUrl('QUJDRA==') }).ok).toBe(false);
  });

  it('enforces the 1.4M-char data URL cap', () => {
    const oversized = dataUrl('A'.repeat(1_400_001));
    expect(oversized.length).toBeGreaterThan(1_400_000);
    expect(validateDrawingSubmissionInput({ ...valid, image: oversized }).ok).toBe(false);
    const boundary = dataUrl('A'.repeat(1_399_000));
    expect(boundary.length).toBeLessThanOrEqual(1_400_000);
  });

  it('enforces the 1 MB decoded-byte cap', () => {
    // ~1,005,000 bytes decoded: passes the 1.4M-char cap, fails the byte cap.
    const payload = 'A'.repeat(1_340_000);
    expect(payload.length).toBeLessThanOrEqual(1_400_000);
    expect(validateDrawingSubmissionInput({ ...valid, image: dataUrl(payload) }).ok).toBe(false);
  });
});

describe('validateDrawingVoteInput (M19)', () => {
  it('accepts a memberKey and rejects malformed payloads', () => {
    expect(validateDrawingVoteInput({ memberKey: 'member-0001' })).toEqual({
      ok: true,
      value: { memberKey: 'member-0001' },
    });
    expect(validateDrawingVoteInput({}).ok).toBe(false);
    expect(validateDrawingVoteInput({ memberKey: 'x' }).ok).toBe(false);
    expect(validateDrawingVoteInput('nope').ok).toBe(false);
  });
});

describe('validateDrawingFlagInput (M19)', () => {
  it('accepts a memberKey with or without a reason', () => {
    expect(validateDrawingFlagInput({ memberKey: 'member-0001' })).toEqual({
      ok: true,
      value: { memberKey: 'member-0001' },
    });
    expect(validateDrawingFlagInput({ memberKey: 'member-0001', reason: 'spam' })).toEqual({
      ok: true,
      value: { memberKey: 'member-0001', reason: 'spam' },
    });
  });

  it('sanitizes the reason (control chars stripped, trimmed)', () => {
    expect(validateDrawingFlagInput({ memberKey: 'member-0001', reason: '  spam\u0007 ' })).toEqual(
      {
        ok: true,
        value: { memberKey: 'member-0001', reason: 'spam' },
      }
    );
    // Whitespace-only reasons collapse to undefined.
    expect(validateDrawingFlagInput({ memberKey: 'member-0001', reason: '   ' })).toEqual({
      ok: true,
      value: { memberKey: 'member-0001' },
    });
  });

  it('caps reasons at 200 characters and rejects non-strings', () => {
    expect(validateDrawingFlagInput({ memberKey: 'member-0001', reason: 'a'.repeat(201) }).ok).toBe(
      false
    );
    expect(validateDrawingFlagInput({ memberKey: 'member-0001', reason: 42 }).ok).toBe(false);
  });
});
