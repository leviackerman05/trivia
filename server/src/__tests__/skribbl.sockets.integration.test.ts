import { createServer as createHttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client';
import type { Server as SocketServer } from 'socket.io';
import { attachSocketIo } from '../socket/index.js';
import { RoomEngine } from '../engine/room-engine.js';
import { createDefaultLimiters } from '../lib/rate-limit.js';
import { ClientEvents, ServerEvents } from '../lib/events.js';
import { getPrisma } from '../lib/prisma.js';
import { resetTestData, setupTestDb, teardownTestDb } from './helpers/db.js';

type Ack = {
  ok: boolean;
  error?: string;
  message?: string;
  roomCode?: string;
  state?: unknown;
  count?: number;
  strokeId?: string | null;
};

interface RoundStartPayload {
  round: number;
  totalRounds: number;
  drawerName: string;
  wordLength: number | null;
  choices?: string[];
  endsAt?: number;
}

interface RoundEndPayload {
  roundNumber: number;
  word: string;
  drawerName: string;
  correct: { playerName: string; points: number }[];
  drawerPoints: number;
  scores: { playerName: string; score: number }[];
}

interface GameEndPayload {
  scores: { playerName: string; score: number }[];
  winner: string;
}

interface StrokePayload {
  strokeId: string;
  type?: 'pen' | 'fill';
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  color: string;
  brushSize: number;
  tool: 'pen' | 'eraser';
}

/** Poll a predicate against the DB until it returns a truthy value (best-effort writes land async). */
async function waitForDb<T>(predicate: () => Promise<T | null>, timeoutMs = 4000): Promise<T> {
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

/**
 * M4 journey: two browsers play a full Skribbl Arena game end-to-end over
 * real sockets (PRD §5.1): create → join → start → word select (drawer-only
 * choices) → drawing (stroke broadcast) → guessing (scoring + hints path) →
 * all rounds → final podium → leaderboard persistence → restart.
 */
describe('Skribbl Arena full game (M4) — DB-backed socket integration', () => {
  let httpServer: ReturnType<typeof createHttpServer>;
  let io: SocketServer;
  let engine: RoomEngine;
  const clients: ClientSocket[] = [];

  async function startServer(): Promise<number> {
    engine = new RoomEngine();
    httpServer = createHttpServer();
    io = attachSocketIo(httpServer, { engine, limiters: createDefaultLimiters() });
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

  function waitFor<T>(client: ClientSocket, event: string, timeoutMs = 4000): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs);
      client.once(event, (payload: T) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });
  }

  /** Waits for the round-start addressed to this client and returns it. */
  async function nextRoundStart(client: ClientSocket): Promise<RoundStartPayload> {
    return waitFor<RoundStartPayload>(client, ServerEvents.roundStart);
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

  it('plays a complete 2-player game with correct scores, hints path, replay, and persistence', async () => {
    const port = await startServer();
    const host = await connect(port);
    const guest = await connect(port);

    // --- Lobby: create + join ------------------------------------------------
    const created = await emitAck(host, ClientEvents.createRoom, { gameId: 'skribbl-arena' });
    expect(created.ok).toBe(true);
    const roomCode = created.roomCode!;
    await emitAck(host, ClientEvents.joinRoom, { roomCode, playerName: 'Host' });
    await emitAck(guest, ClientEvents.joinRoom, { roomCode, playerName: 'Guest' });

    // --- Custom words (host) + validation -------------------------------------
    const badWords = await emitAck(host, ClientEvents.setCustomWords, {
      roomCode,
      words: ['ok', 'bad!word'],
    });
    expect(badWords.ok).toBe(false);
    expect(badWords.error).toBe('INVALID_WORD_LIST');
    const custom = await emitAck(host, ClientEvents.setCustomWords, {
      roomCode,
      words: ['pizza', 'astronaut', 'banana', 'dragon'],
    });
    expect(custom.ok).toBe(true);
    expect(custom.count).toBe(4);
    const nonHostWords = await emitAck(guest, ClientEvents.setCustomWords, {
      roomCode,
      words: ['a', 'b', 'c'],
    });
    expect(nonHostWords.error).toBe('NOT_HOST');

    // --- Start: needs 2 players, host-only -------------------------------------
    const lonelyStart = await emitAck(guest, ClientEvents.startGame, { roomCode });
    expect(lonelyStart.error).toBe('NOT_HOST');
    // Both round-start events arrive (word-select; choices are drawer-only).
    const hostSelect = nextRoundStart(host);
    const guestSelect = nextRoundStart(guest);
    const started = await emitAck(host, ClientEvents.startGame, { roomCode });
    expect(started.ok).toBe(true);
    const hostSelectPayload = await hostSelect;
    const guestSelectPayload = await guestSelect;
    expect(hostSelectPayload).toMatchObject({ round: 1, totalRounds: 6, wordLength: null });
    expect(guestSelectPayload).toMatchObject({ round: 1, totalRounds: 6, wordLength: null });
    // Exactly one client is the drawer and only they receive the 3 choices.
    const hostIsDrawer = Array.isArray(hostSelectPayload.choices);
    const guestIsDrawer = Array.isArray(guestSelectPayload.choices);
    expect(hostIsDrawer).not.toBe(guestIsDrawer);
    const drawer = hostIsDrawer ? host : guest;
    const guesser = hostIsDrawer ? guest : host;
    const drawerName = hostIsDrawer ? 'Host' : 'Guest';
    const guesserName = hostIsDrawer ? 'Guest' : 'Host';
    const choices = (hostIsDrawer ? hostSelectPayload : guestSelectPayload).choices!;
    expect(choices).toHaveLength(3);
    expect(choices.every((word) => ['pizza', 'astronaut', 'banana', 'dragon'].includes(word))).toBe(
      true
    );

    // --- Six rounds: choose → draw → guess → reveal ----------------------------
    for (let round = 1; round <= 6; round += 1) {
      // Round 1 already started; subsequent rounds start after nextRound.
      if (round > 1) {
        const nextHost = nextRoundStart(host);
        const nextGuest = nextRoundStart(guest);
        const advanced = await emitAck(host, ClientEvents.nextRound, { roomCode });
        expect(advanced.ok).toBe(true);
        const nextPayloads = [await nextHost, await nextGuest];
        // Drawer rotates every round — whoever has choices this round is the drawer.
        const drawerPayload = nextPayloads.find((payload) => Array.isArray(payload.choices));
        const choicesPayload = drawerPayload!;
        const currentDrawer = drawerPayload!.drawerName;
        const drawerClient = currentDrawer === 'Host' ? host : guest;
        const guesserClient = currentDrawer === 'Host' ? guest : host;
        const guesserName = currentDrawer === 'Host' ? 'Guest' : 'Host';
        const word = choicesPayload.choices![0]!;
        const drawingPromise = waitFor<RoundStartPayload>(guesserClient, ServerEvents.roundStart);
        await emitAck(drawerClient, ClientEvents.chooseWord, { roomCode, word });
        const drawing = await drawingPromise;
        expect(drawing).toMatchObject({
          round,
          drawerName: currentDrawer,
          endsAt: expect.any(Number),
        });
        // Drawer strokes broadcast to the guesser.
        const strokePromise = waitFor<StrokePayload>(guesserClient, ServerEvents.drawStroke);
        const stroke: StrokePayload = {
          strokeId: `s${round}`,
          x: 120,
          y: 80,
          prevX: 10,
          prevY: 10,
          color: '#000000',
          brushSize: 4,
          tool: 'pen',
        };
        const sent = await emitAck(drawerClient, ClientEvents.drawStroke, { roomCode, ...stroke });
        expect(sent.ok).toBe(true);
        const received = await strokePromise;
        expect(received).toMatchObject(stroke);
        // Non-drawer strokes are rejected.
        const rejected = await emitAck(guesserClient, ClientEvents.drawStroke, {
          roomCode,
          ...stroke,
          strokeId: `x${round}`,
        });
        expect(rejected.error).toBe('NOT_DRAWER');
        // Wrong guess → private feedback; correct guess → points + early round end.
        const wrongPromise = waitFor<{ correct: boolean }>(guesserClient, ServerEvents.guessResult);
        await emitAck(guesserClient, ClientEvents.sendGuess, { roomCode, text: 'wrong guess' });
        expect((await wrongPromise).correct).toBe(false);

        const roundEndPromise = waitFor<RoundEndPayload>(host, ServerEvents.roundEnd);
        const guessResultPromise = waitFor<{ correct: boolean; points?: number }>(
          guesserClient,
          ServerEvents.guessResult
        );
        await emitAck(guesserClient, ClientEvents.sendGuess, { roomCode, text: word });
        const guessResult = await guessResultPromise;
        expect(guessResult.correct).toBe(true);
        expect(guessResult.points).toBeGreaterThanOrEqual(0);
        const roundEnd = await roundEndPromise;
        expect(roundEnd).toMatchObject({ roundNumber: round, word, drawerName: currentDrawer });
        expect(roundEnd.correct).toEqual([{ playerName: guesserName, points: guessResult.points }]);
        expect(roundEnd.scores.find((s) => s.playerName === drawerName)?.score).toBeGreaterThan(0);
        continue;
      }

      // --- Round 1 (already in word-select from start) --------------------------
      const word = choices[0]!;
      const drawingPromise = waitFor<RoundStartPayload>(guesser, ServerEvents.roundStart);
      await emitAck(drawer, ClientEvents.chooseWord, { roomCode, word });
      const drawing = await drawingPromise;
      expect(drawing).toMatchObject({ round: 1, drawerName, endsAt: expect.any(Number) });
      expect(drawing.wordLength).toBe(word.length);

      // Stroke broadcast + replay source: the drawer's segments echo to the room.
      const strokePromise = waitFor<StrokePayload>(guesser, ServerEvents.drawStroke);
      const stroke: StrokePayload = {
        strokeId: 's1',
        x: 50,
        y: 60,
        prevX: 5,
        prevY: 5,
        color: '#ed1c24',
        brushSize: 6,
        tool: 'pen',
      };
      await emitAck(drawer, ClientEvents.drawStroke, { roomCode, ...stroke });
      expect(await strokePromise).toMatchObject(stroke);

      // Undo removes the stroke everywhere.
      const undoPromise = waitFor<{ strokeId: string }>(guesser, ServerEvents.undoStroke);
      await emitAck(drawer, ClientEvents.undoStroke, { roomCode });
      expect((await undoPromise).strokeId).toBe('s1');

      // A correct guess ends the round early (2 players → all guessed).
      const roundEndPromise = waitFor<RoundEndPayload>(guest, ServerEvents.roundEnd);
      const guessResultPromise = waitFor<{ correct: boolean; points?: number }>(
        guesser,
        ServerEvents.guessResult
      );
      const guessAck = await emitAck(guesser, ClientEvents.sendGuess, {
        roomCode,
        text: ` ${word.toUpperCase()} `,
      });
      expect(guessAck.ok).toBe(true);
      const guessResult = await guessResultPromise;
      const roundEnd = await roundEndPromise;
      expect(roundEnd).toMatchObject({ roundNumber: 1, word, drawerName });
      expect(roundEnd.correct).toEqual([{ playerName: guesserName, points: guessResult.points }]);
    }

    // --- Final round completes → game end + podium -----------------------------
    const gameEndPromise = waitFor<GameEndPayload>(guest, ServerEvents.gameEnd);
    const advanced = await emitAck(host, ClientEvents.nextRound, { roomCode });
    expect(advanced.ok).toBe(true);
    const gameEnd = await gameEndPromise;
    expect(gameEnd.scores).toHaveLength(2);
    expect(gameEnd.winner).toBe(gameEnd.scores[0]!.playerName);
    const total = gameEnd.scores.reduce((sum, entry) => sum + entry.score, 0);
    expect(total).toBeGreaterThan(0);

    // Scores persisted best-effort (idempotent clientKey per room+player).
    const scoreRows = await waitForDb(async () => {
      const rows = await getPrisma().score.findMany({ orderBy: { playedAt: 'asc' } });
      return rows.length === 2 ? rows : null;
    });
    expect(scoreRows.map((row) => row.gameId)).toEqual(['skribbl-arena', 'skribbl-arena']);
    expect(scoreRows.every((row) => row.clientKey?.startsWith('skribbl-arena:'))).toBe(true);
    // Same game re-submission is impossible via sockets, but the key is unique per room.
    expect(new Set(scoreRows.map((row) => row.clientKey)).size).toBe(2);

    // --- Mid-game resync for a late joiner ---------------------------------------
    const late = await connect(port);
    const joined = await emitAck(late, ClientEvents.joinRoom, {
      roomCode,
      playerName: 'Late',
    });
    expect(joined.ok).toBe(true);
    const resync = await emitAck(late, ClientEvents.gameResync, { roomCode });
    expect(resync.ok).toBe(true);
    const snapshot = resync.state as {
      view: string;
      round: number;
      totalRounds: number;
      drawerName: string | null;
      scores: Record<string, number>;
      strokes: unknown[];
    };
    expect(snapshot.view).toBe('game-end');
    expect(snapshot.totalRounds).toBe(6);
    expect(snapshot.scores.Host ?? snapshot.scores.Guest).toBeGreaterThanOrEqual(0);

    // --- Restart (host-only) returns the room to the lobby ------------------------
    const restartPromise = waitFor<unknown>(guest, ServerEvents.gameRestart);
    const restart = await emitAck(host, ClientEvents.restartGame, { roomCode });
    expect(restart.ok).toBe(true);
    await restartPromise;
    expect((await emitAck(host, ClientEvents.startGame, { roomCode })).ok).toBe(true);
  }, 30_000);

  it('supports solo testing: one player starts, draws, and ends rounds early', async () => {
    const port = await startServer();
    const solo = await connect(port);

    const created = await emitAck(solo, ClientEvents.createRoom, { gameId: 'skribbl-arena' });
    const roomCode = created.roomCode!;
    await emitAck(solo, ClientEvents.joinRoom, { roomCode, playerName: 'Solo' });

    // A single player can start (testing affordance) and is the drawer.
    const selectPromise = nextRoundStart(solo);
    const started = await emitAck(solo, ClientEvents.startGame, { roomCode });
    expect(started.ok).toBe(true);
    const select = await selectPromise;
    expect(select.drawerName).toBe('Solo');
    expect(select.choices).toHaveLength(3);

    // Pick a word → drawing round-start with a server deadline.
    const drawingPromise = nextRoundStart(solo);
    const chosen = await emitAck(solo, ClientEvents.chooseWord, {
      roomCode,
      word: select.choices![0]!,
    });
    expect(chosen.ok).toBe(true);
    const drawing = await drawingPromise;
    expect(drawing.endsAt).toEqual(expect.any(Number));

    // Drawer strokes work solo.
    const stroke = {
      strokeId: 's1',
      x: 10,
      y: 10,
      prevX: 0,
      prevY: 0,
      color: '#000000',
      brushSize: 4,
      tool: 'pen' as const,
    };
    expect((await emitAck(solo, ClientEvents.drawStroke, { roomCode, ...stroke })).ok).toBe(true);

    // No guessers → the round does NOT end early; the host can cut it short.
    const roundEndPromise = waitFor<RoundEndPayload>(solo, ServerEvents.roundEnd);
    const ended = await emitAck(solo, ClientEvents.endRoundNow, { roomCode });
    expect(ended.ok).toBe(true);
    const roundEnd = await roundEndPromise;
    expect(roundEnd).toMatchObject({ roundNumber: 1, drawerName: 'Solo' });
    expect(roundEnd.correct).toEqual([]);

    // Host skip advances to round 2.
    const nextPromise = nextRoundStart(solo);
    expect((await emitAck(solo, ClientEvents.nextRound, { roomCode })).ok).toBe(true);
    expect((await nextPromise).round).toBe(2);

    // M9: every room game has a round adapter now — charades starts too.
    const charades = await connect(port);
    const charadesCreated = await emitAck(charades, ClientEvents.createRoom, {
      gameId: 'charades',
    });
    const charadesCode = charadesCreated.roomCode!;
    await emitAck(charades, ClientEvents.joinRoom, {
      roomCode: charadesCode,
      playerName: 'C',
    });
    const charadesStart = await emitAck(charades, ClientEvents.startGame, {
      roomCode: charadesCode,
    });
    expect(charadesStart.ok).toBe(true);

    // M8: trivia's room mode is live, so starting now works.
    const trivia = await connect(port);
    const triviaCreated = await emitAck(trivia, ClientEvents.createRoom, { gameId: 'trivia' });
    const triviaCode = triviaCreated.roomCode!;
    await emitAck(trivia, ClientEvents.joinRoom, { roomCode: triviaCode, playerName: 'T' });
    const triviaStart = await emitAck(trivia, ClientEvents.startGame, { roomCode: triviaCode });
    expect(triviaStart.ok).toBe(true);
  });

  it('lets a mid-game joiner guess and relays fills/undo to everyone', async () => {
    const port = await startServer();
    const a = await connect(port);
    const b = await connect(port);

    const created = await emitAck(a, ClientEvents.createRoom, { gameId: 'skribbl-arena' });
    const roomCode = created.roomCode!;
    await emitAck(a, ClientEvents.joinRoom, { roomCode, playerName: 'A' });
    await emitAck(b, ClientEvents.joinRoom, { roomCode, playerName: 'B' });

    // Start with two players; round 1 word-select.
    const selectA = nextRoundStart(a);
    const selectB = nextRoundStart(b);
    await emitAck(a, ClientEvents.startGame, { roomCode });
    const [selA, selB] = [await selectA, await selectB];
    const drawer = selA.choices ? a : b;
    const guesser = drawer === a ? b : a;
    const word = (selA.choices ?? selB.choices)![0]!;

    const drawingPromise = waitFor<RoundStartPayload>(guesser, ServerEvents.roundStart);
    await emitAck(drawer, ClientEvents.chooseWord, { roomCode, word });
    await drawingPromise;

    // C joins mid-round and can guess immediately (previously NOT_PLAYER).
    const c = await connect(port);
    const joined = await emitAck(c, ClientEvents.joinRoom, { roomCode, playerName: 'C' });
    expect(joined.ok).toBe(true);
    const guessResultPromise = waitFor<{ correct: boolean; points?: number }>(
      c,
      ServerEvents.guessResult
    );
    const guessed = await emitAck(c, ClientEvents.sendGuess, { roomCode, text: word });
    expect(guessed.ok).toBe(true);
    const result = await guessResultPromise;
    expect(result).toMatchObject({ correct: true });

    // Fill strokes broadcast with their type intact.
    const fillPromise = waitFor<StrokePayload>(guesser, ServerEvents.drawStroke);
    const fill: StrokePayload = {
      strokeId: 'fill-1',
      type: 'fill',
      x: 40,
      y: 40,
      prevX: 40,
      prevY: 40,
      color: '#22b14c',
      brushSize: 4,
      tool: 'pen',
    };
    const sentFill = await emitAck(drawer, ClientEvents.drawStroke, { roomCode, ...fill });
    expect(sentFill.ok).toBe(true);
    expect(await fillPromise).toMatchObject({ type: 'fill', x: 40, y: 40, color: '#22b14c' });

    // Undo after the fill reaches EVERYONE, including the drawer (their own
    // log must drop the stroke too — this was the broken path).
    const undoPromise = waitFor<{ strokeId: string }>(drawer, ServerEvents.undoStroke);
    await emitAck(drawer, ClientEvents.undoStroke, { roomCode });
    expect((await undoPromise).strokeId).toBe('fill-1');
  });
});
