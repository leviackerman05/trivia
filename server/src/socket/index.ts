import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { resolveCorsOrigin } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import { ClientEvents, ServerEvents } from '../lib/events.js';
import { RateLimiter, ipKey, type Limiters } from '../lib/rate-limit.js';
import {
  isRoomCode,
  sanitizeChatMessage,
  validateChooseWordInput,
  validateGuessInput,
  validateJoinRoomInput,
  validateRoomCodeInput,
  validateRoomCreateInput,
  validateStrokePayload,
} from '../lib/validation.js';
import {
  createPersistedRoom,
  deleteRoomPlayer,
  persistBestEffort,
  setRoomStatus,
  upsertRoomPlayer,
} from '../lib/room-persistence.js';
import { getPrisma } from '../lib/prisma.js';
import { PLAYABLE_ROOM_GAMES } from '../lib/game-registry.js';
import { ROOM_GRACE_MS, type RoomEngine, type RoomState } from '../engine/room-engine.js';
import {
  SKRIBBL_BREAK_MS,
  SKRIBBL_FIRST_HINT_MS,
  SKRIBBL_ROUND_DURATION_MS,
  SKRIBBL_SECOND_HINT_MS,
  SKRIBBL_WORD_SELECT_TIMEOUT_MS,
  SkribblSession,
  type SkribblPhase,
} from '../engine/skribbl-engine.js';

export interface SocketGatewayDeps {
  engine: RoomEngine;
  limiters: Limiters;
}

interface Ack {
  (response: { ok: boolean; error?: string; message?: string; [key: string]: unknown }): void;
}

/** Payload of the PRD §8.2 events that carry a body. */
interface JoinPayload {
  roomCode?: unknown;
  playerName?: unknown;
}
interface ChatPayload {
  message?: unknown;
}

/** Per-room game timers owned by the gateway (session is transport-agnostic). */
interface RoomTimers {
  wordSelect?: NodeJS.Timeout;
  firstHint?: NodeJS.Timeout;
  secondHint?: NodeJS.Timeout;
  roundEnd?: NodeJS.Timeout;
  breakTimer?: NodeJS.Timeout;
}

const SKRIBBL_GAME_ID = 'skribbl-arena';

/**
 * Socket.io gateway — PRD §8.2 event handlers on top of the Room Engine.
 * The engine is authoritative; this layer validates, coordinates broadcasts,
 * and persists best-effort (gameplay never depends on the DB). M4 adds the
 * Skribbl Arena adapter: one SkribblSession per room + its timers.
 */
export function attachSocketIo(httpServer: HttpServer, deps: SocketGatewayDeps): Server {
  const { engine, limiters } = deps;
  const io = new Server(httpServer, {
    cors: { origin: resolveCorsOrigin() },
  });

  /** roomCode → SkribblSession (M4). M5 refactors this into per-game adapters. */
  const sessions = new Map<string, SkribblSession>();
  const timers = new Map<string, RoomTimers>();
  /** Host-provided custom word list, applied when the game starts. */
  const pendingCustomWords = new Map<string, string[]>();

  function roomOf(socket: Socket): RoomState | undefined {
    return engine.roomsOfSocket(socket.id)[0];
  }

  function consume(limiter: RateLimiter, socket: Socket, action: string): boolean {
    return limiter.consume(ipKey(socket.handshake.address, action));
  }

  function broadcastState(room: RoomState): void {
    io.to(room.code).emit(ServerEvents.gameStateUpdate, engine.toPublicState(room));
  }

  function scheduleEviction(): void {
    setTimeout(() => {
      const evicted = engine.evictExpired();
      for (const room of evicted) {
        clearRoomGame(room.code);
        persistBestEffort(setRoomStatus(room.code, 'finished'), `evict ${room.code}`);
        logger.info({ roomCode: room.code }, 'room evicted (empty past grace)');
      }
    }, ROOM_GRACE_MS).unref();
  }

  // --- Skribbl Arena adapter helpers (M4) -----------------------------------

  function clearTimers(roomCode: string): void {
    const roomTimers = timers.get(roomCode);
    if (!roomTimers) {
      return;
    }
    for (const timer of Object.values(roomTimers)) {
      clearTimeout(timer);
    }
    timers.delete(roomCode);
  }

  function clearRoomGame(roomCode: string): void {
    clearTimers(roomCode);
    sessions.delete(roomCode);
    pendingCustomWords.delete(roomCode);
  }

  function sessionOf(room: RoomState): SkribblSession | undefined {
    return sessions.get(room.code);
  }

  /** Socket id of the current drawer, if connected. */
  function drawerSocketId(room: RoomState): string | null {
    const session = sessionOf(room);
    if (!session?.currentDrawer) {
      return null;
    }
    for (const [socketId, player] of room.players) {
      if (player.name === session.currentDrawer && player.connected) {
        return socketId;
      }
    }
    return null;
  }

  /**
   * Round-start for everyone (word-select has no deadline; drawing does).
   * The 3 word choices are drawer-only: the drawer is excluded from the
   * public emit and receives a single tailored event instead, so clients
   * never see a choice-less round-start race.
   */
  function emitRoundStart(room: RoomState, phase: SkribblPhase): void {
    const session = sessionOf(room);
    if (!session) {
      return;
    }
    const base = {
      round: session.currentRound,
      totalRounds: session.totalRoundsValue,
      drawerName: session.currentDrawer,
      wordLength: phase === 'drawing' ? session.wordLength : null,
      endsAt:
        phase === 'drawing' && session.drawingStartedAt !== null
          ? session.drawingStartedAt + SKRIBBL_ROUND_DURATION_MS
          : undefined,
    };
    const drawerId = drawerSocketId(room);
    if (phase === 'word-select' && drawerId && session.choices) {
      io.to(room.code).except(drawerId).emit(ServerEvents.roundStart, base);
      io.to(drawerId).emit(ServerEvents.roundStart, { ...base, choices: session.choices });
      return;
    }
    io.to(room.code).emit(ServerEvents.roundStart, base);
  }

  function scheduleWordSelectTimeout(room: RoomState): void {
    const code = room.code;
    clearTimers(code);
    const roomTimers: RoomTimers = {
      wordSelect: setTimeout(() => {
        const session = sessionOf(room);
        if (!session || session.phaseValue !== 'word-select' || !session.choices) {
          return;
        }
        // Drawer idle → server picks a random choice (never blocks the room).
        const pick = session.choices[Math.floor(Math.random() * session.choices.length)];
        if (!pick) {
          return;
        }
        beginDrawing(room, pick);
      }, SKRIBBL_WORD_SELECT_TIMEOUT_MS),
    };
    timers.set(code, roomTimers);
  }

  function beginDrawing(room: RoomState, word: string): boolean {
    const session = sessionOf(room);
    if (!session) {
      return false;
    }
    const chosen = session.chooseWord(session.currentDrawer ?? '', word);
    if (!chosen.ok) {
      return false;
    }
    // Only the first round moves game-setup → in-progress; later rounds are
    // already in-progress (the RoomEngine has no per-round phases).
    if (room.phase !== 'in-progress') {
      const engineResult = engine.transition(room, 'in-progress');
      if (!engineResult.ok) {
        return false;
      }
    }
    clearTimers(room.code);
    emitRoundStart(room, 'drawing');
    broadcastState(room);
    const startedAt = session.drawingStartedAt;
    if (startedAt === null) {
      return false;
    }
    const roomTimers: RoomTimers = {
      firstHint: setTimeout(() => {
        io.to(room.code).emit(ServerEvents.roundHint, {
          round: session.currentRound,
          firstLetter: session.currentWord?.[0] ?? null,
          lastLetter: null,
        });
      }, SKRIBBL_FIRST_HINT_MS),
      secondHint: setTimeout(() => {
        const hints = session.hintsAt(Date.now());
        io.to(room.code).emit(ServerEvents.roundHint, {
          round: session.currentRound,
          firstLetter: hints.firstLetter,
          lastLetter: hints.lastLetter,
        });
      }, SKRIBBL_SECOND_HINT_MS),
      roundEnd: setTimeout(() => {
        endRound(room);
      }, SKRIBBL_ROUND_DURATION_MS),
    };
    timers.set(room.code, roomTimers);
    return true;
  }

  function endRound(room: RoomState): void {
    const session = sessionOf(room);
    if (!session) {
      return;
    }
    const ended = session.endRound();
    if (!ended.ok) {
      return;
    }
    clearTimers(room.code);
    io.to(room.code).emit(ServerEvents.roundEnd, {
      ...ended.value,
      scores: session.finalScores,
    });
    const roomTimers: RoomTimers = {
      breakTimer: setTimeout(() => {
        advanceRound(room);
      }, SKRIBBL_BREAK_MS),
    };
    timers.set(room.code, roomTimers);
  }

  function advanceRound(room: RoomState): void {
    const session = sessionOf(room);
    if (!session) {
      return;
    }
    const advanced = session.nextRound();
    if (!advanced.ok) {
      return;
    }
    clearTimers(room.code);
    if (advanced.value.finished) {
      finishGame(room);
      return;
    }
    emitRoundStart(room, 'word-select');
    scheduleWordSelectTimeout(room);
  }

  function finishGame(room: RoomState): void {
    const session = sessionOf(room);
    if (!session) {
      return;
    }
    clearTimers(room.code);
    const engineResult = engine.transition(room, 'results');
    if (!engineResult.ok) {
      return;
    }
    const scores = session.finalScores;
    io.to(room.code).emit(ServerEvents.gameEnd, { scores, winner: session.winnerName });
    broadcastState(room);
    persistBestEffort(setRoomStatus(room.code, 'finished'), `finish ${room.code}`);
    // Best-effort leaderboard persistence — idempotent per room+player.
    const startedAt = session.startedTimestamp;
    for (const entry of scores) {
      const clientKey = `skribbl:${room.code}:${startedAt}:${entry.playerName}`;
      persistBestEffort(
        getPrisma().score.create({
          data: {
            gameId: SKRIBBL_GAME_ID,
            playerName: entry.playerName,
            score: entry.score,
            clientKey,
          },
        }),
        `score ${room.code} ${entry.playerName}`
      );
    }
    logger.info({ roomCode: room.code, scores }, 'skribbl game finished');
  }

  function restartGame(room: RoomState): void {
    clearRoomGame(room.code);
    const engineResult = engine.transition(room, 'lobby');
    if (!engineResult.ok) {
      return;
    }
    persistBestEffort(setRoomStatus(room.code, 'lobby'), `restart ${room.code}`);
    io.to(room.code).emit(ServerEvents.gameRestart, {});
    broadcastState(room);
  }

  /** Full snapshot for a mid-game rejoin (game-resync). */
  function resyncSnapshot(room: RoomState, requesterName: string): unknown {
    const session = sessionOf(room);
    if (!session) {
      return null;
    }
    const hints = session.hintsAt(Date.now());
    const isDrawer = session.currentDrawer === requesterName;
    return {
      view: session.phaseValue,
      round: session.currentRound,
      totalRounds: session.totalRoundsValue,
      drawerName: session.currentDrawer,
      wordLength: session.wordLength,
      choices: session.phaseValue === 'word-select' && isDrawer ? session.choices : null,
      firstLetter: hints.firstLetter,
      lastLetter: hints.lastLetter,
      endsAt:
        session.phaseValue === 'drawing' && session.drawingStartedAt !== null
          ? session.drawingStartedAt + SKRIBBL_ROUND_DURATION_MS
          : null,
      scores: session.scores,
      strokes: session.strokesLog,
      summary: session.phaseValue === 'round-results' ? session.lastRoundSummary : null,
      finalScores: session.phaseValue === 'game-end' ? session.finalScores : null,
      winner: session.phaseValue === 'game-end' ? session.winnerName : null,
    };
  }

  io.on('connection', (socket) => {
    logger.info({ socketId: socket.id }, 'socket connected');

    socket.on(ClientEvents.createRoom, async (payload: unknown, ack?: Ack) => {
      if (!consume(limiters.roomCreate, socket, 'roomCreate')) {
        ack?.({ ok: false, error: 'RATE_LIMITED' });
        return;
      }
      const input = validateRoomCreateInput(payload);
      if (!input.ok) {
        ack?.({ ok: false, error: 'INVALID_PAYLOAD', message: input.error });
        return;
      }
      const game = await getPrisma().game.findUnique({ where: { slug: input.value.gameId } });
      if (!game) {
        ack?.({ ok: false, error: 'GAME_NOT_FOUND' });
        return;
      }
      const created = await createPersistedRoom(engine, input.value.gameId);
      if (!created.ok) {
        ack?.({ ok: false, error: created.error });
        return;
      }
      logger.info({ roomCode: created.room.code, gameId: created.room.gameId }, 'room created');
      ack?.({ ok: true, roomCode: created.room.code });
    });

    socket.on(ClientEvents.joinRoom, async (payload: unknown, ack?: Ack) => {
      const input = validateJoinRoomInput(payload as JoinPayload);
      if (!input.ok) {
        ack?.({ ok: false, error: 'INVALID_PAYLOAD', message: input.error });
        return;
      }
      if (!consume(limiters.joinRoom, socket, 'joinRoom')) {
        ack?.({ ok: false, error: 'RATE_LIMITED' });
        return;
      }
      const joined = engine.joinRoom(input.value.roomCode, socket.id, input.value.playerName);
      if (!joined.ok) {
        ack?.({ ok: false, error: joined.error });
        return;
      }
      const { room, player, rejoined } = joined.value;
      await socket.join(room.code);
      persistBestEffort(upsertRoomPlayer(room.code, player.name), `join ${room.code}`);

      // Mid-game joins join the live session so they can guess from the
      // current round on (they never draw — the rotation is fixed at start).
      const session = sessions.get(room.code);
      if (session && session.phaseValue !== 'game-end') {
        const added = session.addPlayer(player.name);
        if (!added.ok) {
          logger.warn(
            { roomCode: room.code, playerName: player.name, error: added.error },
            'could not add late joiner to session'
          );
        }
      }

      broadcastState(room);
      io.to(room.code).emit(rejoined ? ServerEvents.playerReconnected : ServerEvents.playerJoined, {
        playerName: player.name,
      });
      logger.info({ roomCode: room.code, playerName: player.name, rejoined }, 'player joined room');
      ack?.({ ok: true, state: engine.toPublicState(room), rejoined });
    });

    socket.on(ClientEvents.leaveRoom, async (payload: unknown, ack?: Ack) => {
      const room = roomOf(socket);
      if (!room) {
        ack?.({ ok: false, error: 'NOT_IN_ROOM' });
        return;
      }
      const roomCode =
        typeof (payload as JoinPayload).roomCode === 'string'
          ? (payload as JoinPayload).roomCode
          : room.code;
      if (typeof roomCode === 'string' && !isRoomCode(roomCode)) {
        ack?.({ ok: false, error: 'INVALID_ROOM_CODE' });
        return;
      }
      const playerName = room.players.get(socket.id)?.name ?? 'unknown';
      const result = engine.leaveRoom(room.code, socket.id);
      if (!result.ok) {
        ack?.({ ok: false, error: result.error });
        return;
      }
      await socket.leave(room.code);
      persistBestEffort(deleteRoomPlayer(room.code, playerName), `leave ${room.code}`);

      if (result.value.becameEmpty) {
        clearRoomGame(room.code);
        scheduleEviction();
        logger.info({ roomCode: room.code }, 'room empty — eviction scheduled');
      } else {
        broadcastState(room);
        io.to(room.code).emit(ServerEvents.playerLeft, { playerName });
        if (result.value.newHostName) {
          io.to(room.code).emit(ServerEvents.hostChanged, { hostName: result.value.newHostName });
        }
      }
      ack?.({ ok: true });
    });

    socket.on(ClientEvents.startGame, async (payload: unknown, ack?: Ack) => {
      const roomCode = (payload as JoinPayload).roomCode;
      if (typeof roomCode !== 'string' || !isRoomCode(roomCode)) {
        ack?.({ ok: false, error: 'INVALID_ROOM_CODE' });
        return;
      }
      // Only games with a shipped round adapter may leave the lobby — without
      // this gate, unimplemented games stranded rooms in game-setup with
      // nothing taking over ("Game in progress…" dead end). Solo Skribbl
      // rooms are allowed (1 player = testing affordance; friends can join
      // mid-game).
      const room = engine.getRoom(roomCode);
      if (!room) {
        ack?.({ ok: false, error: 'ROOM_NOT_FOUND' });
        return;
      }
      if (!PLAYABLE_ROOM_GAMES.has(room.gameId)) {
        ack?.({ ok: false, error: 'GAME_NOT_PLAYABLE_YET' });
        return;
      }
      const result = engine.startGame(roomCode, socket.id);
      if (!result.ok) {
        ack?.({ ok: false, error: result.error });
        return;
      }
      persistBestEffort(
        setRoomStatus(result.value.code, 'in-progress'),
        `start ${result.value.code}`
      );
      broadcastState(result.value);
      logger.info({ roomCode: result.value.code }, 'game started');

      // M4: Skribbl Arena — spin up the session and round 1 word-select.
      if (result.value.gameId === SKRIBBL_GAME_ID) {
        clearRoomGame(result.value.code);
        const session = new SkribblSession();
        const players = [...result.value.players.values()]
          .filter((player) => player.connected)
          .map((player) => player.name);
        const pending = pendingCustomWords.get(result.value.code);
        if (pending) {
          const applied = session.setCustomWords(pending);
          if (!applied.ok) {
            ack?.({ ok: false, error: 'INVALID_WORD_LIST' });
            return;
          }
        }
        const started = session.start(players);
        if (!started.ok) {
          ack?.({ ok: false, error: started.error });
          return;
        }
        sessions.set(result.value.code, session);
        emitRoundStart(result.value, 'word-select');
        scheduleWordSelectTimeout(result.value);
      }
      ack?.({ ok: true, state: engine.toPublicState(result.value) });
    });

    // --- M4 Skribbl Arena events --------------------------------------------

    socket.on(ClientEvents.setCustomWords, (payload: unknown, ack?: Ack) => {
      if (
        typeof (payload as JoinPayload).roomCode !== 'string' ||
        !isRoomCode((payload as JoinPayload).roomCode)
      ) {
        ack?.({ ok: false, error: 'INVALID_PAYLOAD', message: 'invalid room code' });
        return;
      }
      const room = roomOf(socket);
      if (!room || room.gameId !== SKRIBBL_GAME_ID) {
        ack?.({ ok: false, error: 'NOT_IN_ROOM' });
        return;
      }
      const player = room.players.get(socket.id);
      if (!player?.isHost) {
        ack?.({ ok: false, error: 'NOT_HOST' });
        return;
      }
      if (room.phase !== 'lobby') {
        ack?.({ ok: false, error: 'INVALID_PHASE' });
        return;
      }
      const raw = (payload as { words?: unknown }).words;
      if (!Array.isArray(raw)) {
        ack?.({ ok: false, error: 'INVALID_PAYLOAD', message: 'words must be an array' });
        return;
      }
      // Validate with the same rules the session applies at start.
      const probe = new SkribblSession();
      const validated = probe.setCustomWords(raw);
      if (!validated.ok) {
        ack?.({
          ok: false,
          error: 'INVALID_WORD_LIST',
          message: '3–200 words, letters/spaces/hyphens/apostrophes only',
        });
        return;
      }
      pendingCustomWords.set(
        room.code,
        raw.filter((entry) => typeof entry === 'string')
      );
      ack?.({ ok: true, count: validated.value.count });
    });

    socket.on(ClientEvents.chooseWord, (payload: unknown, ack?: Ack) => {
      const input = validateChooseWordInput(payload);
      if (!input.ok) {
        ack?.({ ok: false, error: 'INVALID_PAYLOAD', message: input.error });
        return;
      }
      const room = roomOf(socket);
      if (!room || room.gameId !== SKRIBBL_GAME_ID) {
        ack?.({ ok: false, error: 'NOT_IN_ROOM' });
        return;
      }
      const session = sessionOf(room);
      if (!session) {
        ack?.({ ok: false, error: 'NOT_STARTED' });
        return;
      }
      const player = room.players.get(socket.id);
      if (!player) {
        ack?.({ ok: false, error: 'NOT_IN_ROOM' });
        return;
      }
      if (!beginDrawing(room, input.value.word)) {
        ack?.({ ok: false, error: 'WRONG_PHASE', message: 'word no longer available' });
        return;
      }
      ack?.({ ok: true });
    });

    socket.on(ClientEvents.drawStroke, (payload: unknown, ack?: Ack) => {
      const room = roomOf(socket);
      if (!room || room.gameId !== SKRIBBL_GAME_ID) {
        ack?.({ ok: false, error: 'NOT_IN_ROOM' });
        return;
      }
      if (!consume(limiters.drawStroke, socket, 'drawStroke')) {
        ack?.({ ok: false, error: 'RATE_LIMITED' });
        return;
      }
      const input = validateStrokePayload(payload);
      if (!input.ok) {
        ack?.({ ok: false, error: 'INVALID_PAYLOAD', message: input.error });
        return;
      }
      const session = sessionOf(room);
      if (!session) {
        ack?.({ ok: false, error: 'NOT_STARTED' });
        return;
      }
      const player = room.players.get(socket.id);
      if (!player) {
        ack?.({ ok: false, error: 'NOT_IN_ROOM' });
        return;
      }
      if (player.name !== session.currentDrawer) {
        ack?.({ ok: false, error: 'NOT_DRAWER' });
        return;
      }
      const added = session.addStroke(player.name, input.value);
      if (!added.ok) {
        ack?.({ ok: false, error: added.error });
        return;
      }
      // Sender drew locally already — broadcast to the rest of the room.
      socket.to(room.code).emit(ServerEvents.drawStroke, input.value);
      ack?.({ ok: true });
    });

    socket.on(ClientEvents.undoStroke, (payload: unknown, ack?: Ack) => {
      const room = roomOf(socket);
      if (!room || room.gameId !== SKRIBBL_GAME_ID) {
        ack?.({ ok: false, error: 'NOT_IN_ROOM' });
        return;
      }
      const session = sessionOf(room);
      if (!session) {
        ack?.({ ok: false, error: 'NOT_STARTED' });
        return;
      }
      const player = room.players.get(socket.id);
      if (!player) {
        ack?.({ ok: false, error: 'NOT_IN_ROOM' });
        return;
      }
      const undone = session.undoStroke(player.name);
      if (!undone.ok) {
        ack?.({ ok: false, error: undone.error });
        return;
      }
      if (undone.value.strokeId !== null) {
        // Broadcast to the whole room INCLUDING the drawer: the drawer's own
        // strokes live in their local log too, so the same strokeId removal
        // keeps every client (and the replay) consistent.
        io.to(room.code).emit(ServerEvents.undoStroke, { strokeId: undone.value.strokeId });
      }
      ack?.({ ok: true, strokeId: undone.value.strokeId });
    });

    socket.on(ClientEvents.clearCanvas, (payload: unknown, ack?: Ack) => {
      const room = roomOf(socket);
      if (!room || room.gameId !== SKRIBBL_GAME_ID) {
        ack?.({ ok: false, error: 'NOT_IN_ROOM' });
        return;
      }
      const session = sessionOf(room);
      if (!session) {
        ack?.({ ok: false, error: 'NOT_STARTED' });
        return;
      }
      const player = room.players.get(socket.id);
      if (!player) {
        ack?.({ ok: false, error: 'NOT_IN_ROOM' });
        return;
      }
      const cleared = session.clearCanvas(player.name);
      if (!cleared.ok) {
        ack?.({ ok: false, error: cleared.error });
        return;
      }
      // Same reasoning as undo: everyone (including the drawer) clears.
      io.to(room.code).emit(ServerEvents.clearCanvas, {});
      ack?.({ ok: true });
    });

    socket.on(ClientEvents.sendGuess, (payload: unknown, ack?: Ack) => {
      const input = validateGuessInput(payload);
      if (!input.ok) {
        ack?.({ ok: false, error: 'INVALID_PAYLOAD', message: input.error });
        return;
      }
      const room = roomOf(socket);
      if (!room || room.gameId !== SKRIBBL_GAME_ID) {
        ack?.({ ok: false, error: 'NOT_IN_ROOM' });
        return;
      }
      if (!consume(limiters.guess, socket, 'guess')) {
        ack?.({ ok: false, error: 'RATE_LIMITED' });
        return;
      }
      const player = room.players.get(socket.id);
      if (!player) {
        ack?.({ ok: false, error: 'NOT_IN_ROOM' });
        return;
      }
      const session = sessionOf(room);
      // No live session, or not the drawing phase → plain chat message.
      if (!session || session.phaseValue !== 'drawing') {
        io.to(room.code).emit(ServerEvents.chatMessage, {
          kind: 'message',
          playerName: player.name,
          message: input.value.text,
          at: Date.now(),
        });
        ack?.({ ok: true, chat: true });
        return;
      }
      const result = session.submitGuess(player.name, input.value.text, Date.now());
      if (!result.ok) {
        if (result.error === 'ALREADY_GUESSED') {
          socket.emit(ServerEvents.guessResult, { correct: true, alreadyGuessed: true });
          ack?.({ ok: true });
          return;
        }
        ack?.({ ok: false, error: result.error });
        return;
      }
      if (result.value.correct) {
        socket.emit(ServerEvents.guessResult, {
          correct: true,
          points: result.value.points,
          alreadyGuessed: false,
        });
        io.to(room.code).emit(ServerEvents.guessFeedback, {
          playerName: player.name,
          correct: true,
          points: result.value.points,
        });
        io.to(room.code).emit(ServerEvents.chatMessage, {
          kind: 'system',
          playerName: 'System',
          message: `${player.name} guessed the word!`,
          at: Date.now(),
        });
        // Everyone solved it → end the round early (server-authoritative).
        if (session.allGuessed()) {
          endRound(room);
        }
      } else {
        socket.emit(ServerEvents.guessResult, { correct: false, alreadyGuessed: false });
      }
      ack?.({ ok: true });
    });

    /** Host-only: cut the current drawing phase short (solo testing, stalled rounds). */
    socket.on(ClientEvents.endRoundNow, (payload: unknown, ack?: Ack) => {
      const room = roomOf(socket);
      if (!room || room.gameId !== SKRIBBL_GAME_ID) {
        ack?.({ ok: false, error: 'NOT_IN_ROOM' });
        return;
      }
      const player = room.players.get(socket.id);
      if (!player?.isHost) {
        ack?.({ ok: false, error: 'NOT_HOST' });
        return;
      }
      const session = sessionOf(room);
      if (!session || session.phaseValue !== 'drawing') {
        ack?.({ ok: false, error: 'WRONG_PHASE' });
        return;
      }
      endRound(room);
      ack?.({ ok: true });
    });

    socket.on(ClientEvents.nextRound, (payload: unknown, ack?: Ack) => {
      const room = roomOf(socket);
      if (!room || room.gameId !== SKRIBBL_GAME_ID) {
        ack?.({ ok: false, error: 'NOT_IN_ROOM' });
        return;
      }
      const player = room.players.get(socket.id);
      if (!player?.isHost) {
        ack?.({ ok: false, error: 'NOT_HOST' });
        return;
      }
      const session = sessionOf(room);
      if (!session || session.phaseValue !== 'round-results') {
        ack?.({ ok: false, error: 'WRONG_PHASE' });
        return;
      }
      clearTimers(room.code);
      advanceRound(room);
      ack?.({ ok: true });
    });

    socket.on(ClientEvents.restartGame, (payload: unknown, ack?: Ack) => {
      const room = roomOf(socket);
      if (!room || room.gameId !== SKRIBBL_GAME_ID) {
        ack?.({ ok: false, error: 'NOT_IN_ROOM' });
        return;
      }
      const player = room.players.get(socket.id);
      if (!player?.isHost) {
        ack?.({ ok: false, error: 'NOT_HOST' });
        return;
      }
      if (room.phase !== 'results') {
        ack?.({ ok: false, error: 'WRONG_PHASE' });
        return;
      }
      restartGame(room);
      ack?.({ ok: true });
    });

    socket.on(ClientEvents.gameResync, (payload: unknown, ack?: Ack) => {
      const input = validateRoomCodeInput(payload);
      if (!input.ok) {
        ack?.({ ok: false, error: 'INVALID_PAYLOAD', message: input.error });
        return;
      }
      const room = engine.getRoom(input.value.roomCode);
      if (!room || room.gameId !== SKRIBBL_GAME_ID) {
        ack?.({ ok: false, error: 'ROOM_NOT_FOUND' });
        return;
      }
      const player = room.players.get(socket.id);
      if (!player) {
        ack?.({ ok: false, error: 'NOT_IN_ROOM' });
        return;
      }
      const snapshot = resyncSnapshot(room, player.name);
      if (!snapshot) {
        ack?.({ ok: false, error: 'NOT_STARTED' });
        return;
      }
      ack?.({ ok: true, state: snapshot });
    });

    socket.on(ClientEvents.chatMessage, async (payload: unknown, ack?: Ack) => {
      const room = roomOf(socket);
      if (!room) {
        ack?.({ ok: false, error: 'NOT_IN_ROOM' });
        return;
      }
      if (!consume(limiters.chat, socket, 'chat')) {
        ack?.({ ok: false, error: 'RATE_LIMITED' });
        return;
      }
      const message = sanitizeChatMessage((payload as ChatPayload).message);
      if (!message.ok) {
        ack?.({ ok: false, error: 'INVALID_PAYLOAD', message: message.error });
        return;
      }
      const player = room.players.get(socket.id);
      if (!player) {
        ack?.({ ok: false, error: 'NOT_IN_ROOM' });
        return;
      }
      io.to(room.code).emit(ServerEvents.chatMessage, {
        kind: 'message',
        playerName: player.name,
        message: message.value,
        at: Date.now(),
      });
      ack?.({ ok: true });
    });

    socket.on('disconnect', (reason) => {
      logger.info({ socketId: socket.id, reason }, 'socket disconnected');
      const rooms = engine.roomsOfSocket(socket.id);
      for (const room of rooms) {
        const playerName = room.players.get(socket.id)?.name ?? 'unknown';
        const result = engine.markDisconnected(room.code, socket.id);
        if (!result.ok) {
          continue;
        }
        broadcastState(room);
        io.to(room.code).emit(ServerEvents.playerDisconnected, { playerName });
        if (result.value.hostChangedTo) {
          io.to(room.code).emit(ServerEvents.hostChanged, { hostName: result.value.hostChangedTo });
        }
        // No connected players left → drop the game and let grace evict the room.
        if (room.players.size === 0) {
          clearRoomGame(room.code);
          scheduleEviction();
        }
      }
    });
  });

  return io;
}
