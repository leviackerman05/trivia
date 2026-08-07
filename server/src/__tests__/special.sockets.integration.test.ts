import { createServer as createHttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client';
import type { Server as SocketServer } from 'socket.io';
import { attachSocketIo } from '../socket/index.js';
import { RoomEngine } from '../engine/room-engine.js';
import { createDefaultLimiters } from '../lib/rate-limit.js';
import { ClientEvents, ServerEvents } from '../lib/events.js';
import {
  buildGuessWhoDeck,
  GUESS_WHO_GENRES,
  GUESS_WHO_REGIONS,
  type GuessWhoFilter,
} from '../lib/guess-who-deck.js';
import { hashString } from '../lib/random.js';
import { GUESS_WHO_TOTAL_ROUNDS, type Celebrity } from '../engine/guess-who-engine.js';
import { resetTestData, setupTestDb, teardownTestDb } from './helpers/db.js';

type Ack = {
  ok: boolean;
  error?: string;
  message?: string;
  roomCode?: string;
  score?: number;
  /** D064: echo of the applied Guess Who filter on the start-game ack. */
  filter?: { region: string; genre: string };
};

interface SpecialRoundStart {
  kind: string;
  phase: string;
  [key: string]: unknown;
}

/** D064: fielded synthetic pool (the shipped celebrities.json is pre-L12).
 * 8 bollywood/music (4 t1, 2 t2, 2 t3), 2 hollywood/music, 2 row/politics,
 * 2 legacy rows without the new fields. */
function celeb(
  name: string,
  region: NonNullable<Celebrity['region']>,
  genre: NonNullable<Celebrity['genre']>,
  difficulty: 1 | 2 | 3
): Celebrity {
  return {
    name,
    gender: 'm',
    alive: true,
    profession: 'Entertainer',
    nationality: 'Test',
    ageRange: '30s',
    hairColor: 'brown',
    famousFor: `Famous for ${name}`,
    facts: [`Fact one about ${name}`, `Fact two about ${name}`, `Fact three about ${name}`],
    region,
    genre,
    difficulty,
  };
}

const TEST_POOL: Celebrity[] = [
  // bollywood + music (8: t1×4, t2×2, t3×2)
  celeb('Arijit Singh', 'bollywood', 'music', 1),
  celeb('Neha Kakkar', 'bollywood', 'music', 1),
  celeb('Udit Narayan', 'bollywood', 'music', 1),
  celeb('Sonu Nigam', 'bollywood', 'music', 1),
  celeb('Shreya Ghoshal', 'bollywood', 'music', 2),
  celeb('A. R. Rahman', 'bollywood', 'music', 2),
  celeb('Lata Mangeshkar', 'bollywood', 'music', 3),
  celeb('Kishore Kumar', 'bollywood', 'music', 3),
  // hollywood + music (2)
  celeb('Taylor Swift', 'hollywood', 'music', 1),
  celeb('Elvis Presley', 'hollywood', 'music', 3),
  // row + politics (2)
  celeb('Nelson Mandela', 'row', 'politics', 1),
  celeb('Mahatma Gandhi', 'row', 'politics', 3),
  // legacy rows (no region/genre/difficulty — default to region 'row')
  {
    name: 'Legacy One',
    gender: 'f',
    alive: false,
    profession: 'Actor',
    nationality: 'Unknown',
    ageRange: '60s',
    hairColor: 'grey',
    famousFor: 'Old films',
    facts: ['Fact a', 'Fact b', 'Fact c'],
  },
  {
    name: 'Legacy Two',
    gender: 'm',
    alive: false,
    profession: 'Writer',
    nationality: 'Unknown',
    ageRange: '70s',
    hairColor: 'white',
    famousFor: 'Old books',
    facts: ['Fact x', 'Fact y', 'Fact z'],
  },
];

/**
 * M9 journeys: Charades (category toggle → actor-only movie → Correct!
 * scores + rotates → game end) and Guess Who (owner redesign: the name is
 * hidden from everyone, traits + facts + letter hints go to all, guesses
 * are server-verified → reveal) over real sockets.
 */
describe('Charades + Guess Who (M9), DB-backed socket integration', () => {
  let httpServer: ReturnType<typeof createHttpServer>;
  let io: SocketServer;
  let engine: RoomEngine;
  let port = 0;
  const clients: ClientSocket[] = [];

  async function startServer(): Promise<void> {
    engine = new RoomEngine();
    httpServer = createHttpServer();
    io = attachSocketIo(httpServer, {
      engine,
      limiters: createDefaultLimiters(),
      // D064: the shipped pool has no region/genre fields yet (pre-L12), so
      // the filter journey runs against the synthetic fielded pool.
      celebrities: TEST_POOL,
    });
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    port = (httpServer.address() as AddressInfo).port;
  }

  function connect(): Promise<ClientSocket> {
    const client: ClientSocket = ioc(`http://localhost:${port}`, { transports: ['websocket'] });
    clients.push(client);
    return new Promise((resolve, reject) => {
      client.once('connect', () => resolve(client));
      client.once('connect_error', reject);
    });
  }

  function emitAck(client: ClientSocket, event: string, payload: unknown): Promise<Ack> {
    return new Promise((resolve) => {
      client.emit(event, payload, (response: Ack) => resolve(response));
    });
  }

  function waitFor<T>(client: ClientSocket, event: string, timeoutMs = 4000): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs);
      client.once(event, (payload: T) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });
  }

  async function joinRoom(
    gameId: string
  ): Promise<{ host: ClientSocket; guest: ClientSocket; roomCode: string }> {
    const host = await connect();
    const created = await emitAck(host, ClientEvents.createRoom, { gameId });
    if (!created.ok || !created.roomCode) {
      throw new Error(`create-room failed: ${created.error}`);
    }
    const roomCode = created.roomCode;
    await emitAck(host, ClientEvents.joinRoom, { roomCode, playerName: 'Alice' });
    const guest = await connect();
    await emitAck(guest, ClientEvents.joinRoom, { roomCode, playerName: 'Bob' });
    return { host, guest, roomCode };
  }

  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await resetTestData();
    await startServer();
  });

  afterEach(async () => {
    for (const client of clients) {
      client.disconnect();
    }
    clients.length = 0;
    io.close();
    await new Promise((resolve) => httpServer.close(resolve));
  });

  it('Charades: category toggle, actor-only movie, Correct! scores and rotates', async () => {
    const { host, guest, roomCode } = await joinRoom('charades');

    const categoryAck = await emitAck(host, ClientEvents.setCharadesCategory, {
      roomCode,
      category: 'bollywood',
    });
    expect(categoryAck.ok).toBe(true);
    // Non-host cannot change the category.
    const denied = await emitAck(guest, ClientEvents.setCharadesCategory, {
      roomCode,
      category: 'hollywood',
    });
    expect(denied.error).toBe('NOT_HOST');

    const hostStartPromise = waitFor<SpecialRoundStart>(host, ServerEvents.roundStart);
    const guestStartPromise = waitFor<SpecialRoundStart>(guest, ServerEvents.roundStart);
    const started = await emitAck(host, ClientEvents.startGame, { roomCode });
    expect(started.ok).toBe(true);
    const [hostRound, guestRound] = [await hostStartPromise, await guestStartPromise];
    expect(hostRound.kind).toBe('charades');
    expect(hostRound.category).toBe('bollywood');
    // Alice (host) is the first actor: only her payload carries the movie.
    expect(typeof hostRound.movie).toBe('string');
    expect(guestRound.movie).toBeUndefined();

    // Anyone can press Correct! → +1 and rotation to Bob.
    const roundEndPromise = waitFor<{
      kind: string;
      scored: boolean;
      score: number;
      nextActor: string | null;
    }>(guest, ServerEvents.roundEnd);
    const nextStartPromise = waitFor<SpecialRoundStart>(guest, ServerEvents.roundStart);
    const correct = await emitAck(guest, ClientEvents.markCorrect, { roomCode });
    expect(correct.ok).toBe(true);
    expect(correct.score).toBe(1);
    const roundEnd = await roundEndPromise;
    expect(roundEnd.scored).toBe(true);
    expect(roundEnd.score).toBe(1);
    const nextRound = await nextStartPromise;
    expect(nextRound.actor).toBe('Bob');
    // Bob is the actor now: his device holds the movie.
    expect(typeof nextRound.movie).toBe('string');

    // Host skip on the acting phase → game end after Bob's round.
    const gameEndPromise = waitFor<{ kind: string; score: number }>(guest, ServerEvents.gameEnd);
    const skip = await emitAck(host, ClientEvents.nextRound, { roomCode });
    expect(skip.ok).toBe(true);
    const gameEnd = await gameEndPromise;
    expect(gameEnd.kind).toBe('charades');
    expect(gameEnd.score).toBe(1);
  });

  it('Guess Who (owner redesign): the name is hidden from EVERYONE, hints reveal letters, a correct guess reveals', async () => {
    const { host, guest, roomCode } = await joinRoom('guess-who');

    // Deterministic round 1: filter the pool to 8 bollywood/music entries.
    const FILTER: GuessWhoFilter = { region: 'bollywood', genre: 'music' };
    const setFilter = await emitAck(host, ClientEvents.setGuessWhoFilter, { roomCode, ...FILTER });
    expect(setFilter.ok).toBe(true);
    const target = buildGuessWhoDeck(
      TEST_POOL,
      FILTER,
      GUESS_WHO_TOTAL_ROUNDS,
      hashString(`${roomCode}:1`)
    )[0]!;

    const hostStartPromise = waitFor<SpecialRoundStart>(host, ServerEvents.roundStart);
    const guestStartPromise = waitFor<SpecialRoundStart>(guest, ServerEvents.roundStart);
    const started = await emitAck(host, ClientEvents.startGame, { roomCode });
    expect(started.ok).toBe(true);
    const [hostRound, guestRound] = [await hostStartPromise, await guestStartPromise];
    expect(hostRound.kind).toBe('guess-who');
    // NOBODY sees the name — not even the host (owner redesign).
    expect(hostRound.celebrity).toBeUndefined();
    expect(guestRound.celebrity).toBeUndefined();
    expect(hostRound).not.toHaveProperty('answerer');
    // Everyone gets the same clue: traits + facts, no name, no balance fields.
    const clue = hostRound.clue as Record<string, unknown>;
    expect(clue.famousFor).toBe(target.famousFor);
    expect(clue).not.toHaveProperty('name');
    expect(clue).not.toHaveProperty('region');
    expect(clue).not.toHaveProperty('genre');
    expect(clue).not.toHaveProperty('difficulty');
    expect(guestRound.clue).toEqual(hostRound.clue);
    // Skribbl-style pattern: same length as the name, revealed letters match.
    const pattern = hostRound.namePattern as string;
    expect(pattern.length).toBe(target.name.length);
    expect(pattern).toMatch(/[A-Za-z0-9]/);
    expect(hostRound.endsAt as number).toBeGreaterThan(Date.now());

    // The old yes/no question flow is gone (no answerer to judge).
    const asked = await emitAck(guest, ClientEvents.askQuestion, {
      roomCode,
      text: 'Are they alive?',
    });
    expect(asked.ok).toBe(false);

    // A wrong guess continues; the correct one reveals (round 1 of 5).
    const wrong = await emitAck(guest, ClientEvents.sendGuess, { roomCode, text: 'Rihanna' });
    expect(wrong.ok).toBe(true);
    const revealPromise = waitFor<{
      kind: string;
      celebrity: { name: string; facts: string[] } | null;
      winner: string | null;
      finished: boolean;
    }>(guest, ServerEvents.guessReveal);
    const right = await emitAck(guest, ClientEvents.sendGuess, { roomCode, text: target.name });
    expect(right.ok).toBe(true);
    const reveal = await revealPromise;
    expect(reveal.kind).toBe('guess-who');
    expect(reveal.celebrity?.name).toBe(target.name);
    expect(Array.isArray(reveal.celebrity?.facts)).toBe(true);
    expect(reveal.winner).toBe('Bob');
    // Round 1 of 5: the game is NOT finished, the host advances it.
    expect(reveal.finished).toBe(false);
  });

  it('Guess Who (D064): filter journey — options on join, host-only set, deck applied, rematch re-deals', async () => {
    const FILTER: GuessWhoFilter = { region: 'bollywood', genre: 'music' };

    const host = await connect();
    const created = await emitAck(host, ClientEvents.createRoom, { gameId: 'guess-who' });
    if (!created.ok || !created.roomCode) {
      throw new Error(`create-room failed: ${created.error}`);
    }
    const roomCode = created.roomCode;

    // The host's own join is the room-created path: options arrive there.
    const hostOptionsPromise = waitFor<{
      regions: { value: string; count: number }[];
      genres: { value: string; count: number }[];
    }>(host, ServerEvents.guessWhoFilterOptions);
    await emitAck(host, ClientEvents.joinRoom, { roomCode, playerName: 'Alice' });
    const hostOptions = await hostOptionsPromise;
    expect(hostOptions.regions[0]).toEqual({ value: 'all', count: TEST_POOL.length });
    expect(hostOptions.regions.find((cell) => cell.value === 'bollywood')?.count).toBe(8);
    expect(hostOptions.regions.find((cell) => cell.value === 'row')?.count).toBe(4); // 2 + 2 legacy
    expect(hostOptions.genres.find((cell) => cell.value === 'music')?.count).toBe(10);
    expect(hostOptions.genres.find((cell) => cell.value === 'technology')?.count).toBe(0);

    // Joining players get the same options (idempotent).
    const guest = await connect();
    const guestOptionsPromise = waitFor<{
      regions: { value: string; count: number }[];
      genres: { value: string; count: number }[];
    }>(guest, ServerEvents.guessWhoFilterOptions);
    await emitAck(guest, ClientEvents.joinRoom, { roomCode, playerName: 'Bob' });
    const guestOptions = await guestOptionsPromise;
    expect(guestOptions.regions).toEqual(hostOptions.regions);

    // Non-host set-filter rejected; enum-validated.
    const denied = await emitAck(guest, ClientEvents.setGuessWhoFilter, {
      roomCode,
      region: 'bollywood',
      genre: 'all',
    });
    expect(denied.error).toBe('NOT_HOST');
    const badRegion = await emitAck(host, ClientEvents.setGuessWhoFilter, {
      roomCode,
      region: 'krypton',
      genre: 'all',
    });
    expect(badRegion.error).toBe('INVALID_PAYLOAD');
    const badGenre = await emitAck(host, ClientEvents.setGuessWhoFilter, {
      roomCode,
      region: 'all',
      genre: 'podcasts',
    });
    expect(badGenre.error).toBe('INVALID_PAYLOAD');

    const setFilter = await emitAck(host, ClientEvents.setGuessWhoFilter, { roomCode, ...FILTER });
    expect(setFilter.ok).toBe(true);

    // Expected deck for serial 1 — deterministic per (pool, filter, seed).
    const expectedDeck = buildGuessWhoDeck(
      TEST_POOL,
      FILTER,
      GUESS_WHO_TOTAL_ROUNDS,
      hashString(`${roomCode}:1`)
    );
    expect(expectedDeck).toHaveLength(GUESS_WHO_TOTAL_ROUNDS);
    expect(expectedDeck.filter((entry) => entry.difficulty === 1).length).toBeLessThanOrEqual(2);

    // Play all 5 rounds: every clue matches the filter, in deck order, and
    // the name only ever appears in the reveal payload (owner redesign).
    const secrets: string[] = [];
    for (let round = 1; round <= GUESS_WHO_TOTAL_ROUNDS; round += 1) {
      const hostStart = waitFor<SpecialRoundStart>(host, ServerEvents.roundStart);
      const guestStart = waitFor<SpecialRoundStart>(guest, ServerEvents.roundStart);
      if (round === 1) {
        const started = await emitAck(host, ClientEvents.startGame, { roomCode });
        expect(started.ok).toBe(true);
        expect(started.filter).toEqual(FILTER);
      } else {
        const advanced = await emitAck(host, ClientEvents.guessWhoNext, { roomCode });
        expect(advanced.ok).toBe(true);
      }
      const [hostRound, guestRound] = [await hostStart, await guestStart];
      // Both devices get the same clue; nobody gets the name.
      const clue = (hostRound.clue ?? guestRound.clue) as Record<string, unknown> | undefined;
      expect(clue?.famousFor).toBe(expectedDeck[round - 1]!.famousFor);
      expect(hostRound.celebrity).toBeUndefined();
      expect(guestRound.celebrity).toBeUndefined();
      expect(clue).not.toHaveProperty('name');
      expect(clue).not.toHaveProperty('region');
      expect(clue).not.toHaveProperty('genre');
      expect(clue).not.toHaveProperty('difficulty');
      // Skribbl-style pattern: same length as the name; any revealed letter
      // matches the name at the same index (never a wrong letter).
      const pattern = hostRound.namePattern as string;
      const name = expectedDeck[round - 1]!.name;
      expect(pattern.length).toBe(name.length);
      for (let index = 0; index < pattern.length; index += 1) {
        if (/[A-Za-z0-9]/.test(pattern[index]!)) {
          expect(pattern[index]).toBe(name[index]);
        }
      }

      // Anyone can guess now — even the host (owner redesign).
      const revealPromise = waitFor<{ celebrity: { name: string } | null }>(
        host,
        ServerEvents.guessReveal
      );
      const guessed = await emitAck(host, ClientEvents.sendGuess, {
        roomCode,
        text: name,
      });
      expect(guessed.ok).toBe(true);
      const reveal = await revealPromise;
      expect(reveal.celebrity?.name).toBe(name);
      // The reveal payload is stripped of balance fields too.
      expect(reveal.celebrity).not.toHaveProperty('region');
      expect(reveal.celebrity).not.toHaveProperty('genre');
      expect(reveal.celebrity).not.toHaveProperty('difficulty');
      secrets.push(reveal.celebrity!.name);
    }
    expect(secrets).toEqual(expectedDeck.map((entry) => entry.name));
    expect(new Set(secrets).size).toBe(GUESS_WHO_TOTAL_ROUNDS);

    // End the game, restart in the SAME room: serial 1 → 2 re-deals.
    const gameEndPromise = waitFor<{ kind: string }>(guest, ServerEvents.gameEnd);
    const advancedLast = await emitAck(host, ClientEvents.guessWhoNext, { roomCode });
    expect(advancedLast.ok).toBe(true);
    await gameEndPromise;

    const restarted = await emitAck(host, ClientEvents.restartGame, { roomCode });
    expect(restarted.ok).toBe(true);
    // The pending filter resets with the lobby (clearRoomGame, like charades)
    // — the host re-applies it for the rematch.
    const reSet = await emitAck(host, ClientEvents.setGuessWhoFilter, { roomCode, ...FILTER });
    expect(reSet.ok).toBe(true);
    const expectedDeck2 = buildGuessWhoDeck(
      TEST_POOL,
      FILTER,
      GUESS_WHO_TOTAL_ROUNDS,
      hashString(`${roomCode}:2`)
    );
    expect(expectedDeck2).not.toEqual(expectedDeck);

    const rematchHostStart = waitFor<SpecialRoundStart>(host, ServerEvents.roundStart);
    const rematchGuestStart = waitFor<SpecialRoundStart>(guest, ServerEvents.roundStart);
    const restartedStart = await emitAck(host, ClientEvents.startGame, { roomCode });
    expect(restartedStart.ok).toBe(true);
    expect(restartedStart.filter).toEqual(FILTER);
    const [rematchHostRound] = [await rematchHostStart, await rematchGuestStart];
    const rematchClue = rematchHostRound.clue as { famousFor?: string } | undefined;
    expect(rematchClue?.famousFor).toBe(`Famous for ${expectedDeck2[0]!.name}`);
    expect(rematchHostRound).not.toHaveProperty('celebrity');
  });

  it('Guess Who (D064): filter options reach a listener mounted AFTER the join ack (resync path)', async () => {
    const host = await connect();
    const created = await emitAck(host, ClientEvents.createRoom, { gameId: 'guess-who' });
    if (!created.ok || !created.roomCode) {
      throw new Error(`create-room failed: ${created.error}`);
    }
    const roomCode = created.roomCode;

    // Real FE timing: the socket listener mounts only after the join ack
    // resolves, so the join-time emission is always dropped. The only
    // post-mount round-trip is gameResync — which must re-emit the options.
    const joined = await emitAck(host, ClientEvents.joinRoom, { roomCode, playerName: 'Alice' });
    expect(joined.ok).toBe(true);

    const optionsPromise = waitFor<{
      regions: { value: string; count: number }[];
      genres: { value: string; count: number }[];
    }>(host, ServerEvents.guessWhoFilterOptions);
    const resync = await emitAck(host, ClientEvents.gameResync, { roomCode });
    // Lobby resync acks NOT_STARTED (no session yet) — the options still
    // arrive because the emit precedes the snapshot path.
    expect(resync.error).toBe('NOT_STARTED');
    const options = await optionsPromise;

    // Counts contract: all + the closed region union / the 12-genre union,
    // legacy rows counted as 'row' (2 explicit + 2 legacy in TEST_POOL).
    expect(options.regions[0]).toEqual({ value: 'all', count: TEST_POOL.length });
    expect(options.regions.map((cell) => cell.value)).toEqual(['all', ...GUESS_WHO_REGIONS]);
    expect(options.regions.find((cell) => cell.value === 'row')?.count).toBe(4);
    expect(options.genres[0]).toEqual({ value: 'all', count: TEST_POOL.length });
    expect(options.genres.map((cell) => cell.value)).toEqual(['all', ...GUESS_WHO_GENRES]);
    expect(options.genres.find((cell) => cell.value === 'music')?.count).toBe(10);
  });

  it('Copycat (M13): the reveal waits for both players to load the image, then counts 10s', async () => {
    const { host, guest, roomCode } = await joinRoom('copycat-challenge');

    const hostReveal = waitFor<{ phase: string; image: { url: string }; endsAt: number }>(
      host,
      ServerEvents.roundStart
    );
    const guestReveal = waitFor<{ phase: string; image: { url: string }; endsAt: number }>(
      guest,
      ServerEvents.roundStart
    );
    const started = await emitAck(host, ClientEvents.startGame, { roomCode });
    expect(started.ok).toBe(true);

    const [hostRound, _guestRound] = [await hostReveal, await guestReveal];
    expect(hostRound.phase).toBe('image-reveal');
    expect(hostRound.image.url).toBeTruthy();
    // Fallback cap first (30s); the post-load 10s timer overrides it.
    expect(hostRound.endsAt).toBeGreaterThan(Date.now() + 10_000);

    // Only one player loaded → no round-timer yet.
    await emitAck(host, ClientEvents.copycatImageLoaded, { roomCode });
    const timerPromise = waitFor<{ phase: string; endsAt: number }>(host, ServerEvents.roundTimer);
    // The guest loads now → both loaded → the 10s countdown starts.
    await emitAck(guest, ClientEvents.copycatImageLoaded, { roomCode });
    const timer = await timerPromise;
    expect(timer.phase).toBe('image-reveal');
    expect(timer.endsAt).toBeGreaterThan(Date.now() + 5_000);
    expect(timer.endsAt).toBeLessThanOrEqual(Date.now() + 10_500);

    // The reveal then advances to the drawing phase (10s after both loaded).
    const drawPromise = waitFor<{ phase: string }>(guest, ServerEvents.roundStart, 15_000);
    const draw = await drawPromise;
    expect(draw.phase).toBe('drawing');
  }, 20_000);
});
