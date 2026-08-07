import { describe, expect, it, beforeEach } from 'vitest';
import {
  clearActiveRoom,
  getActiveRoom,
  isRejoinCandidate,
  isRejoinEviction,
  saveActiveRoom,
  type ActiveRoom,
} from '../room-storage';

/**
 * Persistent room membership (owner 2026-08-07): the storage round-trip and
 * the pure rejoin decisions the useRoom hook wires to the socket ack paths:
 *   ok            → the seat is kept (storage written by joinRoom)
 *   ROOM_NOT_FOUND → eviction: clear storage, show the lobby
 *   NICKNAME_TAKEN → eviction: clear storage, show the lobby
 *   wrong game     → isRejoinCandidate false: never auto-join another game
 */

const STORAGE = new Map<string, string>();

function installLocalStorage() {
  // The storage lib guards on typeof window (SSR safety), so a browser-like
  // window must exist for the round-trip tests to exercise real storage.
  (globalThis as { window?: unknown }).window = {} as Window;
  globalThis.localStorage = {
    getItem: (key: string) => STORAGE.get(key) ?? null,
    setItem: (key: string, value: string) => {
      STORAGE.set(key, value);
    },
    removeItem: (key: string) => {
      STORAGE.delete(key);
    },
    clear: () => STORAGE.clear(),
    key: (index: number) => [...STORAGE.keys()][index] ?? null,
    get length() {
      return STORAGE.size;
    },
  } as unknown as Storage;
}

describe('room-storage round-trip', () => {
  beforeEach(() => {
    STORAGE.clear();
    installLocalStorage();
  });

  it('saves and reads back the active room', () => {
    saveActiveRoom({ roomCode: 'ABCD12', playerName: 'Alice', gameSlug: 'guess-who' });
    const stored = getActiveRoom();
    expect(stored).not.toBeNull();
    expect(stored?.roomCode).toBe('ABCD12');
    expect(stored?.playerName).toBe('Alice');
    expect(stored?.gameSlug).toBe('guess-who');
    expect(typeof stored?.joinedAt).toBe('number');
  });

  it('overwrites the previous room on a new join', () => {
    saveActiveRoom({ roomCode: 'AAA111', playerName: 'Alice', gameSlug: 'guess-who' });
    saveActiveRoom({ roomCode: 'BBB222', playerName: 'Alice', gameSlug: 'charades' });
    expect(getActiveRoom()?.roomCode).toBe('BBB222');
    expect(getActiveRoom()?.gameSlug).toBe('charades');
  });

  it('clear removes the entry (explicit leave / eviction)', () => {
    saveActiveRoom({ roomCode: 'ABCD12', playerName: 'Alice', gameSlug: 'guess-who' });
    clearActiveRoom();
    expect(getActiveRoom()).toBeNull();
  });

  it('returns null without a window (SSR, no localStorage)', () => {
    // Node environment has no window: storage calls are no-ops and reads
    // return null, so the hook never auto-rejoins during server rendering.
    const originalWindow = globalThis.window;
    (globalThis as { window?: unknown }).window = undefined;
    try {
      expect(getActiveRoom()).toBeNull();
      saveActiveRoom({ roomCode: 'ABCD12', playerName: 'Alice', gameSlug: 'guess-who' });
      expect(getActiveRoom()).toBeNull();
    } finally {
      (globalThis as { window?: unknown }).window = originalWindow;
    }
  });

  it('returns null for malformed or wrong-shape payloads', () => {
    STORAGE.set('triviahub:active-room:v1', 'not json');
    expect(getActiveRoom()).toBeNull();
    STORAGE.set('triviahub:active-room:v1', JSON.stringify({ roomCode: 42 }));
    expect(getActiveRoom()).toBeNull();
    STORAGE.set(
      'triviahub:active-room:v1',
      JSON.stringify({ roomCode: '', playerName: 'x', gameSlug: 'y' })
    );
    expect(getActiveRoom()).toBeNull();
  });
});

describe('isRejoinCandidate (auto-rejoin gate)', () => {
  const stored: ActiveRoom = {
    roomCode: 'ABCD12',
    playerName: 'Alice',
    gameSlug: 'guess-who',
    joinedAt: 1,
  };

  it('rejoins when the stored game matches the current page', () => {
    expect(isRejoinCandidate(stored, 'guess-who')).toBe(true);
  });

  it('never auto-joins a different game room (wrong-game ack path)', () => {
    expect(isRejoinCandidate(stored, 'charades')).toBe(false);
    expect(isRejoinCandidate(stored, 'trivia')).toBe(false);
  });

  it('skips when the hook has no game slug or there is no stored room', () => {
    expect(isRejoinCandidate(stored, undefined)).toBe(false);
    expect(isRejoinCandidate(null, 'guess-who')).toBe(false);
  });
});

describe('isRejoinEviction (ack failure → clear storage)', () => {
  it('clears on ROOM_NOT_FOUND (room deleted while away)', () => {
    expect(isRejoinEviction('ROOM_NOT_FOUND')).toBe(true);
  });

  it('clears on NICKNAME_TAKEN (a connected player holds the name)', () => {
    expect(isRejoinEviction('NICKNAME_TAKEN')).toBe(true);
  });

  it('keeps the entry on transient failures (retry on next visit)', () => {
    expect(isRejoinEviction(undefined)).toBe(false);
    expect(isRejoinEviction('NOT_CONNECTED')).toBe(false);
    expect(isRejoinEviction('TIMEOUT')).toBe(false);
    expect(isRejoinEviction('RATE_LIMITED')).toBe(false);
  });
});
