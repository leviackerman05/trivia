import { createServer as createHttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client';
import type { Server as SocketServer } from 'socket.io';
import { attachSocketIo } from '../socket/index.js';
import { RoomEngine } from '../engine/room-engine.js';
import { createDefaultLimiters, RateLimiter } from '../lib/rate-limit.js';
import { ClientEvents, ServerEvents } from '../lib/events.js';
import { getPrisma } from '../lib/prisma.js';
import { resetTestData, setupTestDb, teardownTestDb } from './helpers/db.js';

type Ack = {
  ok: boolean;
  error?: string;
  message?: string;
  roomCode?: string;
  state?: unknown;
  rejoined?: boolean;
};

interface PublicState {
  code: string;
  gameId: string;
  phase: string;
  players: { name: string; isHost: boolean; connected: boolean }[];
  hostName: string | null;
}

/** Poll a predicate against the DB until it returns a truthy value (best-effort writes land async). */
async function waitForDb<T>(predicate: () => Promise<T | null>, timeoutMs = 3000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let result: T | null;
  while (Date.now() < deadline) {
    result = await predicate();
    if (result) {
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('waitForDb timed out');
}

describe('Socket room lifecycle (PRD §8.2) — DB-backed integration', () => {
  let httpServer: ReturnType<typeof createHttpServer>;
  let io: SocketServer;
  let engine: RoomEngine;
  const clients: ClientSocket[] = [];

  async function startServer(
    overrides: { maxPlayers?: number; chatMax?: number } = {}
  ): Promise<number> {
    engine = new RoomEngine({ maxPlayers: overrides.maxPlayers });
    const limiters = createDefaultLimiters();
    if (overrides.chatMax) {
      limiters.chat = new RateLimiter(60_000, overrides.chatMax);
    }
    httpServer = createHttpServer();
    io = attachSocketIo(httpServer, { engine, limiters });
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    return (httpServer.address() as AddressInfo).port;
  }

  function connect(port: number): Promise<ClientSocket> {
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

  function waitFor<T>(client: ClientSocket, event: string): Promise<T> {
    return new Promise((resolve) => {
      client.once(event, (payload: T) => resolve(payload));
    });
  }

  beforeAll(async () => {
    await setupTestDb();
  }, 30_000);

  beforeEach(async () => {
    await resetTestData();
  });

  afterEach(async () => {
    for (const client of clients) {
      client.disconnect();
    }
    clients.length = 0;
    if (io) {
      await new Promise<void>((resolve) => io.close(() => resolve()));
    }
    if (httpServer) {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('creates a room, joins two players, broadcasts state, chats, and starts the game', async () => {
    const port = await startServer();
    const host = await connect(port);
    const guest = await connect(port);

    const created = await emitAck(host, ClientEvents.createRoom, { gameId: 'skribbl-arena' });
    expect(created.ok).toBe(true);
    expect(created.roomCode).toMatch(/^[A-Z2-9]{6}$/);
    const roomCode = created.roomCode!;

    // Guest joins first → becomes host (create-room does not join).
    const guestJoin = await emitAck(guest, ClientEvents.joinRoom, {
      roomCode,
      playerName: 'Guest',
    });
    expect(guestJoin.ok).toBe(true);
    expect(guestJoin.state).toMatchObject({
      code: roomCode,
      gameId: 'skribbl-arena',
      phase: 'lobby',
    });

    const hostJoin = await emitAck(host, ClientEvents.joinRoom, { roomCode, playerName: 'Host' });
    expect(hostJoin.ok).toBe(true);
    const state = hostJoin.state as PublicState;
    expect(state.players).toHaveLength(2);
    expect(state.hostName).toBe('Guest'); // first joiner is host

    // Chat echoes to the room with the sender's server-side name.
    const chatPromise = waitFor<{ kind: string; playerName: string; message: string }>(
      host,
      ServerEvents.chatMessage
    );
    const sent = await emitAck(guest, ClientEvents.chatMessage, { message: 'hello room!' });
    expect(sent.ok).toBe(true);
    const chat = await chatPromise;
    expect(chat).toMatchObject({ kind: 'message', playerName: 'Guest', message: 'hello room!' });

    // Non-host cannot start; host can (skribbl-arena is playable since M4).
    const nonHostStart = await emitAck(host, ClientEvents.startGame, { roomCode });
    expect(nonHostStart.ok).toBe(false);
    expect(nonHostStart.error).toBe('NOT_HOST');

    const startPromise = waitFor<{ phase: string }>(guest, ServerEvents.gameStateUpdate);
    const started = await emitAck(guest, ClientEvents.startGame, { roomCode });
    expect(started.ok).toBe(true);
    const advanced = await startPromise;
    expect(advanced.phase).toBe('game-setup');

    // Room + players persisted (best-effort writes land async — poll).
    const roomRow = await waitForDb(async () => {
      const row = await getPrisma().room.findUnique({
        where: { code: roomCode },
        include: { players: true },
      });
      return row?.status === 'in-progress' ? row : null;
    });
    expect(roomRow.status).toBe('in-progress');
    expect(roomRow.players.map((p) => p.playerName).sort()).toEqual(['Guest', 'Host']);
  });

  it('migrates host on disconnect and reclaims the seat on rejoin', async () => {
    const port = await startServer();
    const host = await connect(port);
    const guest = await connect(port);

    const created = await emitAck(host, ClientEvents.createRoom, { gameId: 'trivia' });
    await emitAck(host, ClientEvents.joinRoom, { roomCode: created.roomCode, playerName: 'Host' });
    await emitAck(guest, ClientEvents.joinRoom, {
      roomCode: created.roomCode,
      playerName: 'Guest',
    });

    const hostChangedPromise = waitFor<{ hostName: string }>(guest, ServerEvents.hostChanged);
    const disconnectedPromise = waitFor<{ playerName: string }>(
      guest,
      ServerEvents.playerDisconnected
    );
    host.disconnect(); // host leaves abruptly

    const disconnected = await disconnectedPromise;
    expect(disconnected.playerName).toBe('Host');
    const hostChanged = await hostChangedPromise;
    expect(hostChanged.hostName).toBe('Guest');

    // Rejoin with the same name reclaims the seat.
    const reconnected = await connect(port);
    const statePromise = waitFor<PublicState>(guest, ServerEvents.gameStateUpdate);
    const rejoin = await emitAck(reconnected, ClientEvents.joinRoom, {
      roomCode: created.roomCode,
      playerName: 'Host',
    });
    expect(rejoin.ok).toBe(true);
    expect(rejoin.rejoined).toBe(true);
    const state = await statePromise;
    expect(state.players).toHaveLength(2);
  });

  it('rejects duplicate nicknames and full rooms', async () => {
    const port = await startServer({ maxPlayers: 2 });
    const a = await connect(port);
    const b = await connect(port);
    const c = await connect(port);
    const d = await connect(port);

    const created = await emitAck(a, ClientEvents.createRoom, { gameId: 'trivia' });
    await emitAck(a, ClientEvents.joinRoom, { roomCode: created.roomCode, playerName: 'Alice' });
    await emitAck(c, ClientEvents.joinRoom, { roomCode: created.roomCode, playerName: 'Carol' });

    const dup = await emitAck(b, ClientEvents.joinRoom, {
      roomCode: created.roomCode,
      playerName: 'alice',
    });
    expect(dup.ok).toBe(false);
    expect(dup.error).toBe('NICKNAME_TAKEN');

    const full = await emitAck(d, ClientEvents.joinRoom, {
      roomCode: created.roomCode,
      playerName: 'Dave',
    });
    expect(full.ok).toBe(false);
    expect(full.error).toBe('ROOM_FULL');
  });

  it('rejects chat outside a room and rate-limits chat spam', async () => {
    const port = await startServer({ chatMax: 2 });
    const lonely = await connect(port);
    const outsider = await emitAck(lonely, ClientEvents.chatMessage, { message: 'nobody here' });
    expect(outsider.ok).toBe(false);
    expect(outsider.error).toBe('NOT_IN_ROOM');

    const a = await connect(port);
    const b = await connect(port);
    const created = await emitAck(a, ClientEvents.createRoom, { gameId: 'trivia' });
    await emitAck(a, ClientEvents.joinRoom, { roomCode: created.roomCode, playerName: 'A' });
    await emitAck(b, ClientEvents.joinRoom, { roomCode: created.roomCode, playerName: 'B' });

    expect((await emitAck(b, ClientEvents.chatMessage, { message: 'one' })).ok).toBe(true);
    expect((await emitAck(b, ClientEvents.chatMessage, { message: 'two' })).ok).toBe(true);
    const blocked = await emitAck(b, ClientEvents.chatMessage, { message: 'three' });
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toBe('RATE_LIMITED');
  });

  it('rejects unknown games and bad payloads on create/join', async () => {
    const port = await startServer();
    const client = await connect(port);

    const badGame = await emitAck(client, ClientEvents.createRoom, { gameId: 'nope' });
    expect(badGame.ok).toBe(false);
    expect(badGame.error).toBe('GAME_NOT_FOUND');

    const badPayload = await emitAck(client, ClientEvents.createRoom, { gameId: 42 });
    expect(badPayload.ok).toBe(false);
    expect(badPayload.error).toBe('INVALID_PAYLOAD');

    const badJoin = await emitAck(client, ClientEvents.joinRoom, {
      roomCode: 'SHORT',
      playerName: 'X',
    });
    expect(badJoin.ok).toBe(false);
    expect(badJoin.error).toBe('INVALID_PAYLOAD');
  });
});
