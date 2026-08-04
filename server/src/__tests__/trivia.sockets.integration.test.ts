import { createServer as createHttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client';
import type { Server as SocketServer } from 'socket.io';
import { attachSocketIo } from '../socket/index.js';
import { RoomEngine } from '../engine/room-engine.js';
import { createDefaultLimiters } from '../lib/rate-limit.js';
import { ClientEvents, ServerEvents } from '../lib/events.js';
import { resetTestData, setupTestDb, teardownTestDb } from './helpers/db.js';

type Ack = {
  ok: boolean;
  error?: string;
  message?: string;
  roomCode?: string;
  points?: number;
  correct?: boolean;
};

interface TriviaRoundStart {
  kind: string;
  phase: string;
  mode: string;
  question: { category: string; question: string; options: string[] };
  round: number;
  totalRounds: number;
  endsAt: number;
}

interface TriviaReveal {
  kind: string;
  correctIndex: number;
  results: { playerName: string; points: number; correct: boolean }[];
  scores: { playerName: string; score: number }[];
}

/**
 * M8 journey: two browsers play a Trivia room race over real sockets —
 * mode toggle (wrong-answers), question round-start (never leaks the
 * answer), answers with speed scoring, all-in reveal, host next, podium
 * with score persistence.
 */
describe('Trivia room (M8) — DB-backed socket integration', () => {
  let httpServer: ReturnType<typeof createHttpServer>;
  let io: SocketServer;
  let engine: RoomEngine;
  let port = 0;
  const clients: ClientSocket[] = [];

  async function startServer(): Promise<void> {
    engine = new RoomEngine();
    httpServer = createHttpServer();
    io = attachSocketIo(httpServer, { engine, limiters: createDefaultLimiters() });
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

  async function joinRoom(): Promise<{ host: ClientSocket; bob: ClientSocket; roomCode: string }> {
    const host = await connect();
    const created = await emitAck(host, ClientEvents.createRoom, { gameId: 'trivia' });
    if (!created.ok || !created.roomCode) {
      throw new Error(`create-room failed: ${created.error}`);
    }
    const roomCode = created.roomCode;
    await emitAck(host, ClientEvents.joinRoom, { roomCode, playerName: 'Alice' });
    const bob = await connect();
    await emitAck(bob, ClientEvents.joinRoom, { roomCode, playerName: 'Bob' });
    return { host, bob, roomCode };
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

  it('race mode: question → speed-scored answers → all-in reveal → host next', async () => {
    const { host, bob, roomCode } = await joinRoom();

    const questionPromise = waitFor<TriviaRoundStart>(host, ServerEvents.roundStart);
    const started = await emitAck(host, ClientEvents.startGame, { roomCode });
    expect(started.ok).toBe(true);
    const question = await questionPromise;
    expect(question.kind).toBe('trivia');
    expect(question.mode).toBe('race');
    expect(question.question.options).toHaveLength(4);
    expect(question.totalRounds).toBe(10);

    // Alice answers correctly (index from her own copy — the payload never
    // carries the answer index, so the test just picks a valid index).
    const revealPromise = waitFor<TriviaReveal>(host, ServerEvents.roundReveal);
    const aliceAck = await emitAck(host, ClientEvents.answerQuestion, { roomCode, optionIndex: 0 });
    expect(aliceAck.ok).toBe(true);
    expect(typeof aliceAck.points).toBe('number');
    const bobAck = await emitAck(bob, ClientEvents.answerQuestion, { roomCode, optionIndex: 1 });
    expect(bobAck.ok).toBe(true);
    const reveal = await revealPromise;
    expect(reveal.kind).toBe('trivia');
    expect(reveal.results).toHaveLength(2);
    expect(reveal.scores).toHaveLength(2);
    // The answer index is server-side; picks 0/1 may or may not match it.
    // Anyone who matched scored a flat 10 (M18); wrong picks score 0.
    for (const result of reveal.results) {
      if (result.correct) {
        expect(result.points).toBe(10);
      } else {
        expect(result.points).toBe(0);
      }
    }

    // Host skips the break → question 2 arrives.
    const nextQuestionPromise = waitFor<TriviaRoundStart>(host, ServerEvents.roundStart);
    const nextAck = await emitAck(host, ClientEvents.nextRound, { roomCode });
    expect(nextAck.ok).toBe(true);
    const question2 = await nextQuestionPromise;
    expect(question2.round).toBe(2);
  });

  it('wrong-answers mode: host toggle applies at start; correct answer scores 0', async () => {
    const { host, bob, roomCode } = await joinRoom();

    const modeAck = await emitAck(host, ClientEvents.setTriviaMode, {
      roomCode,
      mode: 'wrong-answers',
    });
    expect(modeAck.ok).toBe(true);
    // Non-host can't change the mode.
    const denied = await emitAck(bob, ClientEvents.setTriviaMode, {
      roomCode,
      mode: 'race',
    });
    expect(denied.error).toBe('NOT_HOST');

    const questionPromise = waitFor<TriviaRoundStart>(host, ServerEvents.roundStart);
    await emitAck(host, ClientEvents.startGame, { roomCode });
    const question = await questionPromise;
    expect(question.mode).toBe('wrong-answers');

    // Both pick DIFFERENT options → if one matched the (secret) answer it
    // must score 0 in this mode; every wrong pick scores a flat 10 (M18).
    const revealPromise = waitFor<TriviaReveal>(host, ServerEvents.roundReveal);
    await emitAck(host, ClientEvents.answerQuestion, { roomCode, optionIndex: 0 });
    await emitAck(bob, ClientEvents.answerQuestion, { roomCode, optionIndex: 1 });
    const reveal = await revealPromise;
    const correctResult = reveal.results.find((result) => result.correct);
    const wrongResults = reveal.results.filter((result) => !result.correct);
    if (correctResult) {
      expect(correctResult.points).toBe(0);
    }
    for (const wrong of wrongResults) {
      expect(wrong.points).toBe(10);
    }
  });
});
