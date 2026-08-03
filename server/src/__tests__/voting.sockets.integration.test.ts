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
  state?: unknown;
};

interface VotingRoundStart {
  kind: string;
  phase: 'statement' | 'voting';
  prompt: { title: string | null; subtitle: string | null };
  options: { id: string; label: string }[];
  round: number;
  totalRounds: number;
  statementBy?: string | null;
  statement?: string | null;
  custom?: boolean;
  endsAt: number;
}

interface VotingReveal {
  kind: string;
  tallies: { optionId: string; label: string; count: number }[];
  totalVotes: number;
  winnerId: string | null;
  winnerLabel: string | null;
  haveCount?: number;
  haveNotCount?: number;
}

interface VoteUpdate {
  kind: string;
  tallies: { optionId: string; label: string; count: number }[];
  totalVotes: number;
}

/**
 * M6 journey: two browsers play voting games end-to-end over real sockets
 * (PRD §5.13/§5.16): WYR round flow (round-start → votes → live update →
 * all-in reveal → host next), player-submitted dilemma queue, and the NHIE
 * statement/rotation flow. Rounds are skipped via the host's next-round so
 * the test runs in well under a second.
 */
describe('Voting games (M6) — DB-backed socket integration', () => {
  let httpServer: ReturnType<typeof createHttpServer>;
  let io: SocketServer;
  let engine: RoomEngine;
  let port = 0;
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

  /** Create + join a room with two named players; returns host + room code. */
  async function joinRoom(gameId: string): Promise<{ host: ClientSocket; roomCode: string }> {
    const host = await connect(port);
    const created = await emitAck(host, ClientEvents.createRoom, { gameId });
    if (!created.ok || !created.roomCode) {
      throw new Error(`create-room failed: ${created.error}`);
    }
    const roomCode = created.roomCode;
    const joined = await emitAck(host, ClientEvents.joinRoom, { roomCode, playerName: 'Alice' });
    if (!joined.ok) {
      throw new Error(`join failed: ${joined.error}`);
    }
    const bob = await connect(port);
    const joinedBob = await emitAck(bob, ClientEvents.joinRoom, { roomCode, playerName: 'Bob' });
    if (!joinedBob.ok) {
      throw new Error(`bob join failed: ${joinedBob.error}`);
    }
    return { host, roomCode };
  }

  async function startGame(host: ClientSocket, roomCode: string): Promise<void> {
    const started = await emitAck(host, ClientEvents.startGame, { roomCode });
    if (!started.ok) {
      throw new Error(`start-game failed: ${started.error}`);
    }
  }

  /** Vote + wait for the vote-update broadcast. */
  async function voteAndWait(
    client: ClientSocket,
    other: ClientSocket,
    roomCode: string,
    optionId: string
  ): Promise<VoteUpdate> {
    const updatePromise = waitFor<VoteUpdate>(other, ServerEvents.voteUpdate);
    const ack = await emitAck(client, ClientEvents.castVote, { roomCode, optionId });
    if (!ack.ok) {
      throw new Error(`cast-vote failed: ${ack.error}`);
    }
    return updatePromise;
  }

  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await resetTestData();
    port = await startServer();
  });

  afterEach(async () => {
    for (const client of clients) {
      client.disconnect();
    }
    clients.length = 0;
    io.close();
    await new Promise((resolve) => httpServer.close(resolve));
  });

  it('Would You Rather: full round flow, live tallies, all-in reveal, custom dilemma queue', async () => {
    const { host, roomCode } = await joinRoom('would-you-rather');
    const bob = clients[clients.length - 1]!;

    // Start → both clients get a voting round-start (listener first: the
    // round-start is emitted before the ack resolves).
    const firstRoundPromise = waitFor<VotingRoundStart>(host, ServerEvents.roundStart);
    await startGame(host, roomCode);
    const firstRound = await firstRoundPromise;
    expect(firstRound.kind).toBe('would-you-rather');
    expect(firstRound.phase).toBe('voting');
    expect(firstRound.options).toHaveLength(2);
    expect(firstRound.totalRounds).toBe(10);
    expect(typeof firstRound.endsAt).toBe('number');

    // Alice votes a → Bob sees the live update; Bob votes a → all-in reveal.
    await voteAndWait(host, bob, roomCode, 'a');
    const reveal = await (async () => {
      const revealPromise = waitFor<VotingReveal>(host, ServerEvents.voteReveal);
      await voteAndWait(bob, host, roomCode, 'a');
      return revealPromise;
    })();
    expect(reveal.kind).toBe('would-you-rather');
    expect(reveal.totalVotes).toBe(2);
    expect(reveal.winnerId).toBe('a');
    expect(reveal.winnerLabel).toBe(firstRound.options[0]?.label);

    // Queue a player-submitted dilemma → next round is the custom prompt.
    const queued = await emitAck(host, ClientEvents.submitPrompt, {
      roomCode,
      a: 'own option A',
      b: 'own option B',
    });
    expect(queued.ok).toBe(true);
    const customRoundPromise = waitFor<VotingRoundStart>(host, ServerEvents.roundStart);
    const advanced = await emitAck(host, ClientEvents.nextRound, { roomCode });
    expect(advanced.ok).toBe(true);
    const customRound = await customRoundPromise;
    expect(customRound.round).toBe(2);
    expect(customRound.custom).toBe(true);
    expect(customRound.options.map((option) => option.label)).toEqual([
      'own option A',
      'own option B',
    ]);

    // Skip to the end → game-end with the rounds summary. Both players vote
    // each round so the all-in reveal lands (phase → revealed → next works).
    for (let round = 2; round < 10; round += 1) {
      const ackVote = await emitAck(host, ClientEvents.castVote, { roomCode, optionId: 'a' });
      expect(ackVote.ok).toBe(true);
      const bobVote = await emitAck(bob, ClientEvents.castVote, { roomCode, optionId: 'a' });
      expect(bobVote.ok).toBe(true);
      const ackNext = await emitAck(host, ClientEvents.nextRound, { roomCode });
      expect(ackNext.ok).toBe(true);
    }
    const gameEndPromise = waitFor<{ kind: string; rounds: number }>(host, ServerEvents.gameEnd);
    const ackVote = await emitAck(host, ClientEvents.castVote, { roomCode, optionId: 'a' });
    expect(ackVote.ok).toBe(true);
    const bobVote = await emitAck(bob, ClientEvents.castVote, { roomCode, optionId: 'a' });
    expect(bobVote.ok).toBe(true);
    const ackNext = await emitAck(host, ClientEvents.nextRound, { roomCode });
    expect(ackNext.ok).toBe(true);
    const gameEnd = await gameEndPromise;
    expect(gameEnd.kind).toBe('would-you-rather');
    expect(gameEnd.rounds).toBe(10);
  });

  it('Never Have I Ever: statement phase, turn rotation, wildness reveal', async () => {
    const { host, roomCode } = await joinRoom('never-have-i-ever');
    const bob = clients[clients.length - 1]!;

    // Alice's turn first (host = Alice). Bob consumes his own start event too
    // (the events land asynchronously — a late listener would catch the
    // wrong round).
    const hostStartPromise = waitFor<VotingRoundStart>(host, ServerEvents.roundStart);
    const bobStartPromise = waitFor<VotingRoundStart>(bob, ServerEvents.roundStart);
    await startGame(host, roomCode);
    const [statementRound, bobStatement] = await Promise.all([hostStartPromise, bobStartPromise]);
    expect(statementRound.phase).toBe('statement');
    expect(bobStatement.phase).toBe('statement');
    expect(statementRound.kind).toBe('never-have-i-ever');
    expect(statementRound.statementBy).toBe('Alice');
    // The I HAVE / I HAVE NOT options are part of the statement round too.
    expect(statementRound.options.map((option) => option.id)).toEqual(['have', 'have-not']);

    // Alice submits a confession → everyone moves to voting.
    const votingRoundPromise = waitFor<VotingRoundStart>(bob, ServerEvents.roundStart);
    const submitted = await emitAck(host, ClientEvents.submitPrompt, {
      roomCode,
      statement: 'gone skydiving',
    });
    expect(submitted.ok).toBe(true);
    const votingRound = await votingRoundPromise;
    expect(votingRound.phase).toBe('voting');
    expect(votingRound.statement).toBe('gone skydiving');
    expect(votingRound.options.map((option) => option.id)).toEqual(['have', 'have-not']);

    // Bob votes I HAVE → all-in (author excluded) → anonymous reveal.
    const revealPromise = waitFor<VotingReveal>(host, ServerEvents.voteReveal);
    const bobAck = await emitAck(bob, ClientEvents.castVote, { roomCode, optionId: 'have' });
    expect(bobAck.ok).toBe(true);
    const reveal = await revealPromise;
    expect(reveal.haveCount).toBe(1);
    expect(reveal.haveNotCount).toBe(0);

    // Next turn rotates to Bob.
    const bobTurnPromise = waitFor<VotingRoundStart>(bob, ServerEvents.roundStart);
    const nextAck = await emitAck(host, ClientEvents.nextRound, { roomCode });
    expect(nextAck.ok).toBe(true);
    const bobTurn = await bobTurnPromise;
    expect(bobTurn.phase).toBe('statement');
    expect(bobTurn.statementBy).toBe('Bob');
  });

  it('This or That: fixed 6s rounds, live bars, herd scores at the end', async () => {
    const { host, roomCode } = await joinRoom('this-or-that');
    const bob = clients[clients.length - 1]!;

    const firstPromise = waitFor<VotingRoundStart>(host, ServerEvents.roundStart);
    await startGame(host, roomCode);
    const first = await firstPromise;
    expect(first.kind).toBe('this-or-that');
    expect(first.totalRounds).toBe(20);

    // Votes broadcast live updates; no reveal phase for TOT — the next
    // round-start arrives after the 6s vote timer.
    const update = await voteAndWait(host, bob, roomCode, 'a');
    expect(update.kind).toBe('this-or-that');
    expect(update.totalVotes).toBe(1);
    await voteAndWait(bob, host, roomCode, 'b');

    // The next round arrives on the 6s timer (all-in does NOT skip TOT).
    const second = await waitFor<VotingRoundStart>(host, ServerEvents.roundStart, 8000);
    expect(second.round).toBe(2);
  }, 12_000);
});
