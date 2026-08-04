import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAX_PLAYERS,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  ROOM_GRACE_MS,
  RoomEngine,
  type RoomPhase,
} from '../room-engine.js';

function makeEngine(overrides: { maxPlayers?: number; gameExists?: (id: string) => boolean } = {}) {
  return new RoomEngine({
    maxPlayers: overrides.maxPlayers,
    gameExists: overrides.gameExists ?? (() => true),
  });
}

async function createRoom(engine: RoomEngine, gameId = 'skribbl-arena') {
  const result = await engine.createRoom(gameId);
  if (!result.ok) throw new Error('createRoom failed');
  return result.value;
}

describe('RoomEngine, room creation', () => {
  it('creates a room in lobby phase with a 6-char code from the safe alphabet', async () => {
    const engine = makeEngine();
    const room = await createRoom(engine);
    expect(room.code).toMatch(new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`));
    expect(room.phase).toBe('lobby');
    expect(room.players.size).toBe(0);
  });

  it('rejects invalid and unknown gameIds', async () => {
    const engine = makeEngine({ gameExists: (id) => id === 'trivia' });
    expect((await engine.createRoom('')).ok).toBe(false);
    expect((await engine.createRoom('nope')).ok).toBe(false);
    expect((await engine.createRoom('trivia')).ok).toBe(true);
  });

  it('generates unique codes across many rooms', async () => {
    const engine = makeEngine();
    const codes = new Set<string>();
    for (let i = 0; i < 50; i += 1) {
      const room = await createRoom(engine);
      codes.add(room.code);
    }
    expect(codes.size).toBe(50);
  });

  it('normalizes room codes to uppercase (join with lowercase works)', async () => {
    const engine = makeEngine();
    const room = await createRoom(engine);
    const joined = engine.joinRoom(room.code.toLowerCase(), 'sock-a', 'Alice');
    expect(joined.ok).toBe(true);
  });
});

describe('RoomEngine, join/leave/rejoin', () => {
  it('first joiner becomes host; subsequent joiners do not', async () => {
    const engine = makeEngine();
    const room = await createRoom(engine);
    const a = engine.joinRoom(room.code, 'sock-a', 'Alice');
    const b = engine.joinRoom(room.code, 'sock-b', 'Bob');
    expect(a.ok && a.value.player.isHost).toBe(true);
    expect(b.ok && b.value.player.isHost).toBe(false);
    expect(room.players.size).toBe(2);
  });

  it('rejects duplicate connected nicknames', async () => {
    const engine = makeEngine();
    const room = await createRoom(engine);
    engine.joinRoom(room.code, 'sock-a', 'Alice');
    const dup = engine.joinRoom(room.code, 'sock-b', 'alice');
    expect(dup).toEqual({ ok: false, error: 'NICKNAME_TAKEN' });
  });

  it('reclaims a disconnected seat on rejoin, keeping host status', async () => {
    const engine = makeEngine();
    const room = await createRoom(engine);
    engine.joinRoom(room.code, 'sock-a', 'Alice');
    engine.joinRoom(room.code, 'sock-b', 'Bob');

    const disconnect = engine.markDisconnected(room.code, 'sock-a');
    expect(disconnect.ok && disconnect.value.hostChangedTo).toBe('Bob');

    const rejoin = engine.joinRoom(room.code, 'sock-a2', 'Alice');
    expect(rejoin.ok).toBe(true);
    if (rejoin.ok) {
      expect(rejoin.value.rejoined).toBe(true);
      expect(rejoin.value.player.isHost).toBe(false); // host moved to Bob
      expect(rejoin.value.player.connected).toBe(true);
    }
    expect(room.players.get('sock-a')).toBeUndefined();
    expect(room.players.get('sock-a2')).toBeDefined();
  });

  it('host migration picks the first connected player when the host leaves', async () => {
    const engine = makeEngine();
    const room = await createRoom(engine);
    engine.joinRoom(room.code, 'sock-a', 'Alice'); // host
    engine.joinRoom(room.code, 'sock-b', 'Bob');
    engine.joinRoom(room.code, 'sock-c', 'Carol');
    engine.markDisconnected(room.code, 'sock-c'); // Carol disconnected

    const left = engine.leaveRoom(room.code, 'sock-a');
    expect(left.ok && left.value.newHostName).toBe('Bob'); // Carol is disconnected

    const state = engine.toPublicState(room);
    expect(state.players.find((p) => p.name === 'Bob')?.isHost).toBe(true);
  });

  it('rejects joins to unknown rooms and caps at maxPlayers', async () => {
    const engine = makeEngine({ maxPlayers: 2 });
    const room = await createRoom(engine);
    expect(engine.joinRoom('ZZZZZZ', 'sock-a', 'Alice')).toEqual({
      ok: false,
      error: 'ROOM_NOT_FOUND',
    });
    expect(engine.joinRoom(room.code, 'sock-a', 'Alice').ok).toBe(true);
    expect(engine.joinRoom(room.code, 'sock-b', 'Bob').ok).toBe(true);
    expect(engine.joinRoom(room.code, 'sock-c', 'Carol')).toEqual({
      ok: false,
      error: 'ROOM_FULL',
    });
  });

  it('leaving from a room you are not in fails', async () => {
    const engine = makeEngine();
    const room = await createRoom(engine);
    expect(engine.leaveRoom(room.code, 'sock-x')).toEqual({ ok: false, error: 'NOT_IN_ROOM' });
  });
});

describe('RoomEngine, state machine (PRD §4.1)', () => {
  const EXPECTED_PATH: RoomPhase[] = ['lobby', 'game-setup', 'in-progress', 'results', 'lobby'];

  it('follows lobby → game-setup → in-progress → results → lobby', async () => {
    const engine = makeEngine();
    const room = await createRoom(engine);
    for (const phase of EXPECTED_PATH.slice(1)) {
      const result = engine.transition(room, phase);
      expect(result.ok).toBe(true);
      expect(room.phase).toBe(phase);
    }
  });

  it('rejects illegal transitions', async () => {
    const engine = makeEngine();
    const room = await createRoom(engine); // lobby
    expect(engine.transition(room, 'results')).toEqual({ ok: false, error: 'INVALID_PHASE' });
    expect(engine.transition(room, 'in-progress')).toEqual({ ok: false, error: 'INVALID_PHASE' });
  });

  it('startGame requires the host and moves lobby → game-setup', async () => {
    const engine = makeEngine();
    const room = await createRoom(engine);
    engine.joinRoom(room.code, 'sock-a', 'Alice'); // host
    engine.joinRoom(room.code, 'sock-b', 'Bob');

    const nonHost = engine.startGame(room.code, 'sock-b');
    expect(nonHost).toEqual({ ok: false, error: 'NOT_HOST' });

    const host = engine.startGame(room.code, 'sock-a');
    expect(host.ok).toBe(true);
    expect(room.phase).toBe('game-setup');
  });

  it('startGame rejects when not in the room', async () => {
    const engine = makeEngine();
    const room = await createRoom(engine);
    expect(engine.startGame(room.code, 'sock-x')).toEqual({ ok: false, error: 'NOT_IN_ROOM' });
  });
});

describe('RoomEngine, eviction', () => {
  it('evicts only rooms empty past the grace period', async () => {
    const engine = makeEngine();
    const emptyOld = await createRoom(engine);
    emptyOld.createdAt = Date.now() - ROOM_GRACE_MS - 1000;
    const emptyFresh = await createRoom(engine);
    const occupied = await createRoom(engine);
    engine.joinRoom(occupied.code, 'sock-a', 'Alice');

    const evicted = engine.evictExpired();
    expect(evicted.map((room) => room.code)).toContain(emptyOld.code);
    expect(evicted.map((room) => room.code)).not.toContain(emptyFresh.code);
    expect(evicted.map((room) => room.code)).not.toContain(occupied.code);
  });
});

describe('RoomEngine, public state', () => {
  it('exposes a serializable snapshot', async () => {
    const engine = makeEngine();
    const room = await createRoom(engine);
    engine.joinRoom(room.code, 'sock-a', 'Alice');
    engine.joinRoom(room.code, 'sock-b', 'Bob');
    engine.markDisconnected(room.code, 'sock-b');
    const state = engine.toPublicState(room);
    expect(state).toEqual({
      code: room.code,
      gameId: 'skribbl-arena',
      phase: 'lobby',
      hostName: 'Alice',
      players: [
        { name: 'Alice', isHost: true, connected: true },
        { name: 'Bob', isHost: false, connected: false },
      ],
    });
    expect(DEFAULT_MAX_PLAYERS).toBe(24);
  });
});
