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
  validatePromptInput,
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
import { ROOM_GRACE_MS, type RoomEngine, type RoomState } from '../engine/room-engine.js';
import {
  DRAWING_WORD_SELECT_TIMEOUT_MS,
  DrawingGameSession,
  type DrawingEntry,
  type DrawingGameConfig,
  type DrawingGameSession as DrawingSession,
} from '../engine/drawing-game.js';
import {
  COPYCAT_AWARDS,
  COPYCAT_DRAW_MS,
  COPYCAT_REVEAL_AFTER_LOAD_MS,
  COPYCAT_REVEAL_MAX_MS,
  COPYCAT_VOTE_MS,
  CopycatSession,
  type CopycatAward,
  type CopycatImage,
} from '../engine/copycat-engine.js';
import {
  VotingSession,
  type VotingConfig,
  type VotingSession as VotingGameSession,
} from '../engine/voting-engine.js';
import {
  TriviaSession,
  type TriviaConfig,
  type TriviaMode,
  type TriviaSession as TriviaGameSession,
} from '../engine/trivia-engine.js';
import {
  CharadesSession,
  type CharadesCategory,
  type CharadesSession as CharadesGameSession,
} from '../engine/charades-engine.js';
import {
  GuessWhoSession,
  GUESS_WHO_MAX_QUESTIONS,
  type Celebrity,
  type GuessWhoSession as GuessWhoGameSession,
} from '../engine/guess-who-engine.js';
import { PLAYABLE_ROOM_GAMES } from '../lib/game-registry.js';

import wordsJson from '../data/skribbl-words.json' with { type: 'json' };
import objectsJson from '../data/one-line-objects.json' with { type: 'json' };
import silhouettesJson from '../data/silhouettes.json' with { type: 'json' };
import lyricsJson from '../data/lyrics.json' with { type: 'json' };
import copycatImagesJson from '../data/copycat-images.json' with { type: 'json' };
import wyrJson from '../data/wyr.json' with { type: 'json' };
import mltJson from '../data/most-likely-to.json' with { type: 'json' };
import nhieJson from '../data/never-have-i-ever.json' with { type: 'json' };
import totJson from '../data/this-or-that.json' with { type: 'json' };
import triviaQuestionsJson from '../data/trivia-questions.json' with { type: 'json' };
import charadesMoviesJson from '../data/charades-movies.json' with { type: 'json' };
import celebritiesJson from '../data/celebrities.json' with { type: 'json' };
import type { TriviaQuestion } from '../engine/trivia-engine.js';
import type { CharadesMovie } from '../engine/charades-engine.js';

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

/** Per-room game timers owned by the gateway (sessions are transport-agnostic). */
interface RoomTimers {
  wordSelect?: NodeJS.Timeout;
  firstHint?: NodeJS.Timeout;
  secondHint?: NodeJS.Timeout;
  roundEnd?: NodeJS.Timeout;
  breakTimer?: NodeJS.Timeout;
  reveal?: NodeJS.Timeout;
  drawEnd?: NodeJS.Timeout;
  voteEnd?: NodeJS.Timeout;
  statementEnd?: NodeJS.Timeout;
  questionEnd?: NodeJS.Timeout;
  actingEnd?: NodeJS.Timeout;
}

/** A live game session: drawing, Copycat, voting, Trivia, Charades, Guess Who. */
type GameSession =
  | DrawingSession
  | CopycatSession
  | VotingGameSession
  | TriviaGameSession
  | CharadesGameSession
  | GuessWhoGameSession;

const DRAWING_CONFIGS: Record<string, DrawingGameConfig> = {
  'skribbl-arena': {
    gameId: 'skribbl-arena',
    wordMode: 'choices',
    roundDurationMs: 60_000,
    firstHintMs: 30_000,
    secondHintMs: 45_000,
    allowCustomWords: true,
  },
  'one-line-one-shape': {
    gameId: 'one-line-one-shape',
    wordMode: 'direct',
    roundDurationMs: 60_000,
    liftPenaltyMs: 10_000,
  },
  'shadow-sketch': {
    gameId: 'shadow-sketch',
    wordMode: 'direct',
    roundDurationMs: 90_000,
    silhouetteRevealMs: 60_000,
  },
  'draw-the-lyric': {
    gameId: 'draw-the-lyric',
    wordMode: 'lyric',
    roundDurationMs: 90_000,
    artistHintMs: 45_000,
    fixedGuesserPoints: 100,
    fixedDrawerPoints: 50,
  },
};

const VOTING_CONFIGS: Record<string, VotingConfig> = {
  'would-you-rather': {
    kind: 'would-you-rather',
    voteMs: 30_000,
    revealMs: 8_000,
    totalRounds: () => 10,
    allowSelfVote: false,
  },
  'most-likely-to': {
    kind: 'most-likely-to',
    voteMs: 30_000,
    revealMs: 8_000,
    totalRounds: () => 10,
    allowSelfVote: true,
  },
  'never-have-i-ever': {
    kind: 'never-have-i-ever',
    voteMs: 20_000,
    revealMs: 8_000,
    statementMs: 30_000,
    totalRounds: (playerCount) => Math.min(10, Math.max(4, playerCount * 2)),
    allowSelfVote: false,
  },
  'this-or-that': {
    kind: 'this-or-that',
    voteMs: 6_000,
    revealMs: 0,
    totalRounds: () => 20,
    allowSelfVote: false,
  },
};

/** Host-submitted WYR dilemmas / NHIE statements, applied on the next round. */

type WyrEntry = { a: string; b: string };
type MltPrompt = { prompt: string };
type NhieSuggestion = { statement: string };
type TotPair = { a: string; b: string };

function votingDatasetsFor(gameId: string): {
  wyr?: WyrEntry[];
  mlt?: MltPrompt[];
  nhie?: NhieSuggestion[];
  tot?: TotPair[];
} {
  switch (gameId) {
    case 'would-you-rather':
      return { wyr: wyrJson as WyrEntry[] };
    case 'most-likely-to':
      return { mlt: mltJson as MltPrompt[] };
    case 'never-have-i-ever':
      return { nhie: nhieJson as NhieSuggestion[] };
    case 'this-or-that':
      return { tot: totJson as TotPair[] };
    default:
      return {};
  }
}

const TRIVIA_CONFIG: TriviaConfig = {
  mode: 'race',
  questionMs: 10_000,
  totalRounds: 10,
  breakMs: 6_000,
};

function entriesFrom(gameId: string): DrawingEntry[] {
  switch (gameId) {
    case 'skribbl-arena':
      return (wordsJson as { word: string }[]).map((entry) => ({
        word: entry.word,
        data: { word: entry.word },
      }));
    case 'one-line-one-shape':
      return (objectsJson as { object: string }[]).map((entry) => ({
        word: entry.object,
        data: { object: entry.object },
      }));
    case 'shadow-sketch':
      return (silhouettesJson as { name: string; path: string }[]).map((entry) => ({
        word: entry.name,
        data: { name: entry.name, path: entry.path },
      }));
    case 'draw-the-lyric':
      return (lyricsJson as { title: string; artist: string; lyric: string }[]).map((entry) => ({
        word: entry.title,
        data: { title: entry.title, artist: entry.artist, lyric: entry.lyric },
      }));
    default:
      return [];
  }
}

/**
 * Socket.io gateway — PRD §8.2 event handlers on top of the Room Engine.
 * The engine is authoritative; this layer validates, coordinates broadcasts,
 * and persists best-effort. M5 generalizes the Skribbl adapter into
 * config-driven drawing games (DRAWING_CONFIGS) plus the Copycat adapter.
 */
export function attachSocketIo(httpServer: HttpServer, deps: SocketGatewayDeps): Server {
  const { engine, limiters } = deps;
  const io = new Server(httpServer, {
    cors: { origin: resolveCorsOrigin() },
  });

  /** roomCode → live game session (drawing games + copycat + voting). */
  const sessions = new Map<string, GameSession>();
  const timers = new Map<string, RoomTimers>();
  /** Host-provided custom word list, applied when the game starts. */
  const pendingCustomWords = new Map<string, string[]>();
  /** WYR dilemmas / NHIE statements queued by players for future rounds. */
  const pendingPrompts = new Map<string, { a: string; b: string }[]>();
  /** Host-chosen Trivia room mode, applied when the game starts. */
  const pendingTriviaModes = new Map<string, TriviaMode>();
  /** Host-chosen Charades category, applied when the game starts. */
  const pendingCharadesCategories = new Map<string, CharadesCategory>();
  /** Voting phase deadlines (ms epoch) so resync can rebuild client timers. */
  const votingDeadlines = new Map<string, number>();
  /** M13 — Copycat: players whose image finished loading (reveal waits). */
  const copycatLoaded = new Map<string, Set<string>>();
  /** M13 — Copycat: the post-load 10s timer is scheduled once per reveal. */
  const copycatPostLoadScheduled = new Set<string>();

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

  // --- Game adapter helpers (M4/M5) -----------------------------------------

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
    pendingPrompts.delete(roomCode);
    pendingTriviaModes.delete(roomCode);
    pendingCharadesCategories.delete(roomCode);
    votingDeadlines.delete(roomCode);
    copycatLoaded.delete(roomCode);
    copycatPostLoadScheduled.delete(roomCode);
  }

  function sessionOf(room: RoomState): GameSession | undefined {
    return sessions.get(room.code);
  }

  function drawingOf(room: RoomState): DrawingSession | undefined {
    const session = sessions.get(room.code);
    return session instanceof DrawingGameSession ? session : undefined;
  }

  function copycatOf(room: RoomState): CopycatSession | undefined {
    const session = sessions.get(room.code);
    return session instanceof CopycatSession ? session : undefined;
  }

  function votingOf(room: RoomState): VotingGameSession | undefined {
    const session = sessions.get(room.code);
    return session instanceof VotingSession ? session : undefined;
  }

  function triviaOf(room: RoomState): TriviaGameSession | undefined {
    const session = sessions.get(room.code);
    return session instanceof TriviaSession ? session : undefined;
  }

  function charadesOf(room: RoomState): CharadesGameSession | undefined {
    const session = sessions.get(room.code);
    return session instanceof CharadesSession ? session : undefined;
  }

  function guessWhoOf(room: RoomState): GuessWhoGameSession | undefined {
    const session = sessions.get(room.code);
    return session instanceof GuessWhoSession ? session : undefined;
  }

  function isCharadesRoom(room: RoomState): boolean {
    return room.gameId === 'charades';
  }

  function isGuessWhoRoom(room: RoomState): boolean {
    return room.gameId === 'guess-who';
  }

  function isTriviaRoom(room: RoomState): boolean {
    return room.gameId === 'trivia';
  }

  function isVotingRoom(room: RoomState): boolean {
    return VOTING_CONFIGS[room.gameId] !== undefined;
  }

  function isCopycatRoom(room: RoomState): boolean {
    return room.gameId === 'copycat-challenge';
  }

  /** Socket id of the current drawer, if connected. */
  function drawerSocketId(room: RoomState): string | null {
    const session = drawingOf(room);
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
   * Round-start for the shared-canvas drawing games. Word-select has no
   * deadline; drawing carries endsAt. Game-specific private fields (object,
   * silhouette, lyric) go ONLY to the drawer; everyone else gets one event.
   */
  function emitDrawingRoundStart(room: RoomState, phase: 'word-select' | 'drawing'): void {
    const session = drawingOf(room);
    if (!session) {
      return;
    }
    const config = DRAWING_CONFIGS[room.gameId];
    const base: Record<string, unknown> = {
      round: session.currentRound,
      totalRounds: session.totalRoundsValue,
      drawerName: session.currentDrawer,
      wordLength: phase === 'drawing' ? session.wordLength : null,
      endsAt: phase === 'drawing' ? session.roundEndsAt : undefined,
    };
    const drawerId = drawerSocketId(room);
    let privateFields: Record<string, unknown> = {};
    if (phase === 'drawing' && session.currentEntry) {
      const data = session.currentEntry.data;
      if (config?.gameId === 'one-line-one-shape') {
        privateFields = { object: data.object };
      } else if (config?.gameId === 'shadow-sketch') {
        privateFields = { silhouette: data.path };
      } else if (config?.gameId === 'draw-the-lyric') {
        privateFields = { lyric: data.lyric, artist: data.artist };
      }
    }
    if (phase === 'word-select' && drawerId && session.choices) {
      io.to(room.code).except(drawerId).emit(ServerEvents.roundStart, base);
      io.to(drawerId).emit(ServerEvents.roundStart, { ...base, choices: session.choices });
      return;
    }
    io.to(room.code).emit(ServerEvents.roundStart, base);
    if (drawerId && Object.keys(privateFields).length > 0) {
      io.to(drawerId).emit(ServerEvents.roundStart, { ...base, ...privateFields });
    }
  }

  function scheduleWordSelectTimeout(room: RoomState): void {
    const code = room.code;
    clearTimers(code);
    const roomTimers: RoomTimers = {
      wordSelect: setTimeout(() => {
        const session = drawingOf(room);
        if (!session || session.phaseValue !== 'word-select' || !session.choices) {
          return;
        }
        // Drawer idle → server picks a random choice (never blocks the room).
        const pick = session.choices[Math.floor(Math.random() * session.choices.length)];
        if (!pick) {
          return;
        }
        beginDrawing(room, pick);
      }, DRAWING_WORD_SELECT_TIMEOUT_MS),
    };
    timers.set(code, roomTimers);
  }

  function beginDrawing(room: RoomState, word?: string): boolean {
    const session = drawingOf(room);
    if (!session) {
      return false;
    }
    let chosen: { ok: boolean; error?: string };
    if (session.phaseValue === 'word-select' && word) {
      chosen = session.chooseWord(session.currentDrawer ?? '', word);
    } else if (session.phaseValue === 'word-select') {
      chosen = session.assignWordForDirectMode();
    } else {
      return false;
    }
    if (!chosen.ok) {
      return false;
    }
    // Only the first round moves game-setup → in-progress.
    if (room.phase !== 'in-progress') {
      const engineResult = engine.transition(room, 'in-progress');
      if (!engineResult.ok) {
        return false;
      }
    }
    clearTimers(room.code);
    emitDrawingRoundStart(room, 'drawing');
    broadcastState(room);
    const config = DRAWING_CONFIGS[room.gameId];
    const startedAt = session.drawingStartedAt;
    if (startedAt === null) {
      return false;
    }
    const roomTimers: RoomTimers = {};
    if (config?.firstHintMs && config.secondHintMs) {
      roomTimers.firstHint = setTimeout(() => {
        const hints = session.letterHintsAt(Date.now());
        io.to(room.code).emit(ServerEvents.roundHint, {
          round: session.currentRound,
          firstLetter: hints.firstLetter,
          lastLetter: null,
        });
      }, config.firstHintMs);
      roomTimers.secondHint = setTimeout(() => {
        const hints = session.letterHintsAt(Date.now());
        io.to(room.code).emit(ServerEvents.roundHint, {
          round: session.currentRound,
          firstLetter: hints.firstLetter,
          lastLetter: hints.lastLetter,
        });
      }, config.secondHintMs);
    }
    if (config?.artistHintMs) {
      roomTimers.secondHint = setTimeout(() => {
        const artist = session.artistAt(Date.now());
        if (artist) {
          io.to(room.code).emit(ServerEvents.roundHint, { round: session.currentRound, artist });
        }
      }, config.artistHintMs);
    }
    if (config?.silhouetteRevealMs) {
      roomTimers.secondHint = setTimeout(() => {
        io.to(room.code).emit(ServerEvents.roundHint, {
          round: session.currentRound,
          silhouette: session.currentEntry?.data.path ?? null,
        });
      }, config.silhouetteRevealMs);
    }
    roomTimers.roundEnd = setTimeout(() => {
      endRound(room);
    }, config?.roundDurationMs ?? 60_000);
    timers.set(room.code, roomTimers);
    return true;
  }

  function endRound(room: RoomState): void {
    const session = drawingOf(room);
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
      }, 10_000),
    };
    timers.set(room.code, roomTimers);
  }

  function advanceRound(room: RoomState): void {
    const session = drawingOf(room);
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
    // Direct-mode games skip word-select: assign + start drawing immediately.
    if (DRAWING_CONFIGS[room.gameId]?.wordMode !== 'choices') {
      beginDrawing(room);
      return;
    }
    emitDrawingRoundStart(room, 'word-select');
    scheduleWordSelectTimeout(room);
  }

  function finishGame(room: RoomState): void {
    const session = drawingOf(room);
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
    const startedAt = session.startedTimestamp;
    for (const entry of scores) {
      const clientKey = `${room.gameId}:${room.code}:${startedAt}:${entry.playerName}`;
      persistBestEffort(
        getPrisma().score.create({
          data: {
            gameId: room.gameId,
            playerName: entry.playerName,
            score: entry.score,
            clientKey,
          },
        }),
        `score ${room.code} ${entry.playerName}`
      );
    }
    logger.info({ roomCode: room.code, scores }, 'drawing game finished');
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
    if (session instanceof CopycatSession) {
      return {
        view: session.phaseValue,
        image: session.currentImage
          ? { title: session.currentImage.title, url: session.currentImage.url }
          : null,
        drawings: session.drawings,
        awards: session.finalAwards,
      };
    }
    if (session instanceof VotingSession) {
      return {
        view: session.phaseValue,
        kind: VOTING_CONFIGS[room.gameId]?.kind ?? room.gameId,
        prompt: session.roundPrompt,
        options: session.roundOptions,
        round: session.currentRound,
        totalRounds: session.totalRoundsValue,
        statementBy: session.currentStatementBy,
        statement: session.currentStatement,
        tallies: session.tallies,
        reveal: session.lastReveal,
        myVote: session.voteOf(requesterName),
        endsAt: votingDeadlines.get(room.code) ?? null,
      };
    }
    if (session instanceof TriviaSession) {
      const question = session.currentQuestion;
      return {
        view: session.phaseValue,
        kind: 'trivia',
        mode: session.mode,
        round: session.currentRound,
        totalRounds: session.totalRoundsValue,
        // The correct answer index NEVER leaves the server in the question
        // payload — clients only see options + category.
        question: question
          ? { category: question.category, question: question.question, options: question.options }
          : null,
        myAnswer: session.answerOf(requesterName),
        reveal: session.lastReveal,
        scores: session.scoreboard,
      };
    }
    if (session instanceof CharadesSession) {
      const isActor = session.currentActor === requesterName;
      return {
        view: session.phaseValue,
        kind: 'charades',
        category: session.categoryValue,
        round: session.currentRound,
        totalRounds: session.totalRoundsValue,
        actor: session.currentActor,
        score: session.scoreValue,
        // The movie title only goes to the actor's own device.
        movie: isActor ? (session.currentMovie?.title ?? null) : null,
      };
    }
    if (session instanceof GuessWhoSession) {
      const isAnswerer = session.answerer === requesterName;
      return {
        view: session.phaseValue,
        kind: 'guess-who',
        answerer: session.answerer,
        questionCount: session.questionCount,
        maxQuestions: session.maxQuestions,
        questions: session.questionLog,
        winner: session.winnerValue,
        // The secret celebrity only goes to the answerer's device.
        celebrity: isAnswerer
          ? {
              name: session.secretCelebrity?.name ?? null,
              gender: session.secretCelebrity?.gender ?? null,
              alive: session.secretCelebrity?.alive ?? null,
              profession: session.secretCelebrity?.profession ?? null,
              nationality: session.secretCelebrity?.nationality ?? null,
              ageRange: session.secretCelebrity?.ageRange ?? null,
              hairColor: session.secretCelebrity?.hairColor ?? null,
              famousFor: session.secretCelebrity?.famousFor ?? null,
            }
          : null,
      };
    }
    const hints = session.letterHintsAt(Date.now());
    const isDrawer = session.currentDrawer === requesterName;
    const config = DRAWING_CONFIGS[room.gameId];
    const entry = session.currentEntry;
    let privateFields: Record<string, unknown> = {};
    if (isDrawer && entry) {
      if (config?.gameId === 'one-line-one-shape') {
        privateFields = { object: entry.data.object };
      } else if (config?.gameId === 'shadow-sketch') {
        privateFields = { silhouette: entry.data.path };
      } else if (config?.gameId === 'draw-the-lyric') {
        privateFields = { lyric: entry.data.lyric, artist: entry.data.artist };
      }
    }
    return {
      view: session.phaseValue,
      round: session.currentRound,
      totalRounds: session.totalRoundsValue,
      drawerName: session.currentDrawer,
      wordLength: session.wordLength,
      choices: session.phaseValue === 'word-select' && isDrawer ? session.choices : null,
      firstLetter: hints.firstLetter,
      lastLetter: hints.lastLetter,
      endsAt: session.roundEndsAt,
      scores: session.scores,
      strokes: session.strokesLog,
      summary: session.phaseValue === 'round-results' ? session.lastRoundSummary : null,
      finalScores: session.phaseValue === 'game-end' ? session.finalScores : null,
      winner: session.phaseValue === 'game-end' ? session.winnerName : null,
      ...privateFields,
    };
  }

  // --- Copycat adapter helpers (M5) -----------------------------------------

  function startCopycat(room: RoomState): boolean {
    clearRoomGame(room.code);
    const session = new CopycatSession(copycatImagesJson as CopycatImage[]);
    const players = [...room.players.values()]
      .filter((player) => player.connected)
      .map((player) => player.name);
    const started = session.start(players);
    if (!started.ok) {
      return false;
    }
    sessions.set(room.code, session);
    const endsAt = Date.now() + COPYCAT_REVEAL_MAX_MS;
    io.to(room.code).emit(ServerEvents.roundStart, {
      phase: 'image-reveal',
      image: { title: started.value.image.title, url: started.value.image.url },
      endsAt,
    });
    // Fallback cap: a stuck player can't hang the room forever.
    const roomTimers: RoomTimers = {
      reveal: setTimeout(() => advanceToDrawing(room), COPYCAT_REVEAL_MAX_MS),
    };
    timers.set(room.code, roomTimers);
    return true;
  }

  /** M13 — reveal ends only when every connected player's image has loaded
   * (then 10s to study it). Scheduled by the image-loaded handler; the 30s
   * fallback in startCopycat stays as the stuck-player safety net. */
  function advanceToDrawing(room: RoomState): void {
    const session = copycatOf(room);
    if (!session || session.phaseValue !== 'image-reveal') {
      return;
    }
    const begun = session.beginDrawing();
    if (!begun.ok) {
      return;
    }
    const drawEndsAt = Date.now() + COPYCAT_DRAW_MS;
    io.to(room.code).emit(ServerEvents.roundStart, {
      phase: 'drawing',
      endsAt: drawEndsAt,
    });
    timers.set(room.code, {
      drawEnd: setTimeout(() => {
        openGallery(room);
      }, COPYCAT_DRAW_MS),
    });
  }

  function openGallery(room: RoomState): void {
    const session = copycatOf(room);
    if (!session || session.phaseValue !== 'drawing') {
      return;
    }
    const begun = session.beginVoting();
    if (!begun.ok) {
      return;
    }
    clearTimers(room.code);
    io.to(room.code).emit(ServerEvents.roundEnd, { phase: 'gallery', images: session.drawings });
    const endsAt = Date.now() + COPYCAT_VOTE_MS;
    io.to(room.code).emit(ServerEvents.voteStart, { categories: COPYCAT_AWARDS, endsAt });
    timers.set(room.code, {
      voteEnd: setTimeout(() => {
        finishVoting(room);
      }, COPYCAT_VOTE_MS),
    });
  }

  function finishVoting(room: RoomState): void {
    const session = copycatOf(room);
    if (!session || session.phaseValue !== 'voting') {
      return;
    }
    const finished = session.finish();
    if (!finished.ok) {
      return;
    }
    clearTimers(room.code);
    const engineResult = engine.transition(room, 'results');
    if (!engineResult.ok) {
      return;
    }
    io.to(room.code).emit(ServerEvents.voteReveal, { awards: finished.value.awards });
    io.to(room.code).emit(ServerEvents.gameEnd, { awards: finished.value.awards });
    broadcastState(room);
    persistBestEffort(setRoomStatus(room.code, 'finished'), `finish ${room.code}`);
    logger.info({ roomCode: room.code, awards: finished.value.awards }, 'copycat finished');
  }

  // --- Voting game adapter helpers (M6) ------------------------------------

  function emitVotingRoundStart(room: RoomState): void {
    const session = votingOf(room);
    if (!session) {
      return;
    }
    const config = VOTING_CONFIGS[room.gameId];
    const phase = session.phaseValue === 'statement' ? 'statement' : 'voting';
    const endsAt =
      Date.now() +
      (phase === 'statement' ? (config?.statementMs ?? 30_000) : (config?.voteMs ?? 30_000));
    votingDeadlines.set(room.code, endsAt);
    const { title, subtitle, custom } = session.roundPrompt;
    io.to(room.code).emit(ServerEvents.roundStart, {
      kind: config?.kind,
      phase,
      prompt: { title, subtitle },
      options: session.roundOptions,
      round: session.currentRound,
      totalRounds: session.totalRoundsValue,
      statementBy: session.currentStatementBy,
      statement: session.currentStatement,
      custom,
      endsAt,
    });
  }

  function startVoting(room: RoomState): boolean {
    clearRoomGame(room.code);
    const config = VOTING_CONFIGS[room.gameId];
    if (!config) {
      return false;
    }
    const session = new VotingSession(config, votingDatasetsFor(room.gameId));
    const players = [...room.players.values()]
      .filter((player) => player.connected)
      .map((player) => player.name);
    const started = session.start(players);
    if (!started.ok) {
      return false;
    }
    sessions.set(room.code, session);
    const engineResult = engine.transition(room, 'in-progress');
    if (!engineResult.ok) {
      return false;
    }
    emitVotingRoundStart(room);
    broadcastState(room);
    scheduleVotingTimer(room, session.phaseValue === 'statement' ? 'statement' : 'voting');
    logger.info({ roomCode: room.code, kind: config.kind }, 'voting game started');
    return true;
  }

  /** Arm the timer for the current phase (statement or voting). */
  function scheduleVotingTimer(room: RoomState, phase: 'statement' | 'voting'): void {
    const session = votingOf(room);
    if (!session) {
      return;
    }
    const config = VOTING_CONFIGS[room.gameId];
    clearTimers(room.code);
    const code = room.code;
    const roomTimers: RoomTimers = {};
    if (phase === 'statement') {
      roomTimers.statementEnd = setTimeout(() => {
        // NHIE: idle statement author → server picks a suggestion.
        const current = votingOf(room);
        if (!current || current.phaseValue !== 'statement' || !current.currentStatementBy) {
          return;
        }
        const pick = current.suggestionOptions(1)[0];
        if (!pick) {
          return;
        }
        const submitted = current.submitStatement(current.currentStatementBy, pick);
        if (!submitted.ok) {
          return;
        }
        emitVotingRoundStart(room);
        scheduleVotingTimer(room, 'voting');
      }, config?.statementMs ?? 30_000);
    } else {
      roomTimers.voteEnd = setTimeout(() => {
        revealVotingRound(room);
      }, config?.voteMs ?? 30_000);
    }
    timers.set(code, roomTimers);
  }

  /** Voting → revealed (all-in or timer). TOT reveals inline and advances. */
  function revealVotingRound(room: RoomState): void {
    const session = votingOf(room);
    if (!session || session.phaseValue !== 'voting') {
      return;
    }
    const revealed = session.reveal();
    if (!revealed.ok) {
      return;
    }
    const config = VOTING_CONFIGS[room.gameId];
    io.to(room.code).emit(ServerEvents.voteReveal, revealed.value.reveal);
    if (!config || config.revealMs <= 0) {
      // This or That: no revealed phase — straight to the next pair.
      advanceVotingRound(room);
      return;
    }
    clearTimers(room.code);
    timers.set(room.code, {
      breakTimer: setTimeout(() => {
        advanceVotingRound(room);
      }, config.revealMs),
    });
  }

  function advanceVotingRound(room: RoomState): void {
    const session = votingOf(room);
    if (!session) {
      return;
    }
    // WYR: player-submitted dilemmas are used before the dataset runs out.
    if (room.gameId === 'would-you-rather') {
      const queue = pendingPrompts.get(room.code) ?? [];
      const next = queue.shift();
      if (next) {
        if (queue.length === 0) {
          pendingPrompts.delete(room.code);
        } else {
          pendingPrompts.set(room.code, queue);
        }
        session.useCustomPrompt(next.a, next.b);
      }
    }
    const advanced = session.next();
    if (!advanced.ok) {
      return;
    }
    clearTimers(room.code);
    if (advanced.value.finished) {
      finishVotingGame(room);
      return;
    }
    emitVotingRoundStart(room);
    scheduleVotingTimer(room, session.phaseValue === 'statement' ? 'statement' : 'voting');
  }

  function finishVotingGame(room: RoomState): void {
    const session = votingOf(room);
    if (!session) {
      return;
    }
    clearTimers(room.code);
    const engineResult = engine.transition(room, 'results');
    if (!engineResult.ok) {
      return;
    }
    const payload = session.endPayload() as Record<string, unknown>;
    io.to(room.code).emit(ServerEvents.gameEnd, payload);
    broadcastState(room);
    persistBestEffort(setRoomStatus(room.code, 'finished'), `finish ${room.code}`);
    // This or That herd-alignment is a score; persist it like drawing games.
    if (Array.isArray(payload.scores)) {
      const startedAt = session.startedTimestamp;
      for (const entry of payload.scores as { playerName: string; score: number }[]) {
        const clientKey = `${room.gameId}:${room.code}:${startedAt}:${entry.playerName}`;
        persistBestEffort(
          getPrisma().score.create({
            data: {
              gameId: room.gameId,
              playerName: entry.playerName,
              score: entry.score,
              clientKey,
            },
          }),
          `score ${room.code} ${entry.playerName}`
        );
      }
    }
    logger.info({ roomCode: room.code, payload }, 'voting game finished');
  }

  // --- Trivia room adapter helpers (M8) ------------------------------------

  function emitTriviaQuestion(room: RoomState): void {
    const session = triviaOf(room);
    if (!session || !session.currentQuestion) {
      return;
    }
    const question = session.currentQuestion;
    const endsAt = Date.now() + TRIVIA_CONFIG.questionMs;
    io.to(room.code).emit(ServerEvents.roundStart, {
      kind: 'trivia',
      phase: 'question',
      mode: session.mode,
      question: {
        category: question.category,
        question: question.question,
        options: question.options,
      },
      round: session.currentRound,
      totalRounds: session.totalRoundsValue,
      endsAt,
    });
  }

  function startTrivia(room: RoomState): boolean {
    // Capture the host-chosen mode BEFORE clearing the room game state.
    const mode = pendingTriviaModes.get(room.code) ?? 'race';
    clearRoomGame(room.code);
    const session = new TriviaSession(triviaQuestionsJson as TriviaQuestion[], {
      ...TRIVIA_CONFIG,
      mode,
    });
    const players = [...room.players.values()]
      .filter((player) => player.connected)
      .map((player) => player.name);
    const started = session.start(players);
    if (!started.ok) {
      return false;
    }
    sessions.set(room.code, session);
    const engineResult = engine.transition(room, 'in-progress');
    if (!engineResult.ok) {
      return false;
    }
    emitTriviaQuestion(room);
    broadcastState(room);
    scheduleTriviaTimer(room);
    logger.info({ roomCode: room.code, mode }, 'trivia game started');
    return true;
  }

  /** 10s question timer → reveal (all-answered also reveals early). */
  function scheduleTriviaTimer(room: RoomState): void {
    clearTimers(room.code);
    timers.set(room.code, {
      questionEnd: setTimeout(() => {
        revealTriviaRound(room);
      }, TRIVIA_CONFIG.questionMs),
    });
  }

  function revealTriviaRound(room: RoomState): void {
    const session = triviaOf(room);
    if (!session || session.phaseValue !== 'question') {
      return;
    }
    const revealed = session.reveal();
    if (!revealed.ok) {
      return;
    }
    clearTimers(room.code);
    io.to(room.code).emit(ServerEvents.roundReveal, {
      kind: 'trivia',
      ...revealed.value,
      scores: session.scoreboard,
    });
    timers.set(room.code, {
      breakTimer: setTimeout(() => {
        advanceTriviaRound(room);
      }, TRIVIA_CONFIG.breakMs),
    });
  }

  function advanceTriviaRound(room: RoomState): void {
    const session = triviaOf(room);
    if (!session) {
      return;
    }
    const advanced = session.next();
    if (!advanced.ok) {
      return;
    }
    clearTimers(room.code);
    if (advanced.value.finished) {
      finishTriviaGame(room);
      return;
    }
    emitTriviaQuestion(room);
    scheduleTriviaTimer(room);
  }

  function finishTriviaGame(room: RoomState): void {
    const session = triviaOf(room);
    if (!session) {
      return;
    }
    clearTimers(room.code);
    const engineResult = engine.transition(room, 'results');
    if (!engineResult.ok) {
      return;
    }
    const payload = session.endPayload() as Record<string, unknown>;
    io.to(room.code).emit(ServerEvents.gameEnd, payload);
    broadcastState(room);
    persistBestEffort(setRoomStatus(room.code, 'finished'), `finish ${room.code}`);
    if (Array.isArray(payload.scores)) {
      const startedAt = session.startedTimestamp;
      for (const entry of payload.scores as { playerName: string; score: number }[]) {
        const clientKey = `${room.gameId}:${room.code}:${startedAt}:${entry.playerName}`;
        persistBestEffort(
          getPrisma().score.create({
            data: {
              gameId: room.gameId,
              playerName: entry.playerName,
              score: entry.score,
              clientKey,
            },
          }),
          `score ${room.code} ${entry.playerName}`
        );
      }
    }
    logger.info({ roomCode: room.code, payload }, 'trivia game finished');
  }

  // --- Charades + Guess Who adapter helpers (M9) ---------------------------

  function emitCharadesRoundStart(room: RoomState): void {
    const session = charadesOf(room);
    if (!session || !session.currentMovie) {
      return;
    }
    const actorId = roomActorSocketId(room, session.currentActor);
    const base = {
      kind: 'charades',
      phase: 'acting',
      category: session.categoryValue,
      actor: session.currentActor,
      round: session.currentRound,
      totalRounds: session.totalRoundsValue,
      score: session.scoreValue,
      endsAt: Date.now() + 60_000,
    };
    // The movie title is actor-only (D023 — like the drawer's word): the
    // base goes to everyone EXCEPT the actor; the actor gets the private one.
    if (actorId) {
      io.to(room.code).except(actorId).emit(ServerEvents.roundStart, base);
      io.to(actorId).emit(ServerEvents.roundStart, {
        ...base,
        movie: session.currentMovie.title,
      });
    } else {
      io.to(room.code).emit(ServerEvents.roundStart, base);
    }
  }

  function roomActorSocketId(room: RoomState, actorName: string | null): string | null {
    if (!actorName) {
      return null;
    }
    for (const [socketId, player] of room.players) {
      if (player.name === actorName && player.connected) {
        return socketId;
      }
    }
    return null;
  }

  function startCharades(room: RoomState): boolean {
    // Capture the host-chosen category BEFORE clearing the room game state.
    const category = pendingCharadesCategories.get(room.code) ?? 'mixed';
    clearRoomGame(room.code);
    const session = new CharadesSession(charadesMoviesJson as CharadesMovie[], { roundMs: 60_000 });
    const players = [...room.players.values()]
      .filter((player) => player.connected)
      .map((player) => player.name);
    const started = session.start(players, category);
    if (!started.ok) {
      return false;
    }
    sessions.set(room.code, session);
    const engineResult = engine.transition(room, 'in-progress');
    if (!engineResult.ok) {
      return false;
    }
    emitCharadesRoundStart(room);
    broadcastState(room);
    timers.set(room.code, {
      actingEnd: setTimeout(() => {
        advanceCharades(room);
      }, 60_000),
    });
    logger.info({ roomCode: room.code, category }, 'charades started');
    return true;
  }

  /** Correct! (scored) or timeout (0): rotate to the next actor. */
  function advanceCharades(room: RoomState, scored = false): void {
    const session = charadesOf(room);
    if (!session || session.phaseValue !== 'acting') {
      return;
    }
    const score = session.scoreValue;
    const advanced = session.next();
    if (!advanced.ok) {
      return;
    }
    clearTimers(room.code);
    if (advanced.value.finished) {
      io.to(room.code).emit(ServerEvents.roundEnd, {
        kind: 'charades',
        scored,
        score,
        nextActor: null,
      });
      finishCharades(room, score);
      return;
    }
    // Announce the result, then start the next round.
    io.to(room.code).emit(ServerEvents.roundEnd, {
      kind: 'charades',
      scored,
      score,
      nextActor: session.currentActor,
    });
    emitCharadesRoundStart(room);
    timers.set(room.code, {
      actingEnd: setTimeout(() => {
        advanceCharades(room);
      }, 60_000),
    });
  }

  function finishCharades(room: RoomState, score: number): void {
    const session = charadesOf(room);
    if (!session) {
      return;
    }
    clearTimers(room.code);
    const engineResult = engine.transition(room, 'results');
    if (!engineResult.ok) {
      return;
    }
    const payload = session.endPayload() as Record<string, unknown>;
    io.to(room.code).emit(ServerEvents.gameEnd, payload);
    broadcastState(room);
    persistBestEffort(setRoomStatus(room.code, 'finished'), `finish ${room.code}`);
    logger.info({ roomCode: room.code, score }, 'charades finished');
  }

  function startGuessWho(room: RoomState): boolean {
    clearRoomGame(room.code);
    const session = new GuessWhoSession(celebritiesJson as Celebrity[]);
    const players = [...room.players.values()]
      .filter((player) => player.connected)
      .map((player) => player.name);
    const host = [...room.players.values()].find((player) => player.isHost && player.connected);
    const answerer = host?.name ?? players[0] ?? '';
    const started = session.start(players, answerer);
    if (!started.ok) {
      return false;
    }
    sessions.set(room.code, session);
    const engineResult = engine.transition(room, 'in-progress');
    if (!engineResult.ok) {
      return false;
    }
    const answererId = roomActorSocketId(room, answerer);
    const base = {
      kind: 'guess-who',
      phase: 'questioning',
      answerer,
      questionCount: 0,
      maxQuestions: GUESS_WHO_MAX_QUESTIONS,
    };
    // The secret celebrity is answerer-only (D023): base to everyone except
    // the answerer, private payload to the answerer's device.
    if (answererId) {
      io.to(room.code).except(answererId).emit(ServerEvents.roundStart, base);
      io.to(answererId).emit(ServerEvents.roundStart, {
        ...base,
        celebrity: started.value.celebrity,
      });
    } else {
      io.to(room.code).emit(ServerEvents.roundStart, base);
    }
    broadcastState(room);
    logger.info({ roomCode: room.code, answerer }, 'guess-who started');
    return true;
  }

  function finishGuessWho(room: RoomState): void {
    const session = guessWhoOf(room);
    if (!session) {
      return;
    }
    clearTimers(room.code);
    const engineResult = engine.transition(room, 'results');
    if (!engineResult.ok) {
      return;
    }
    const payload = session.endPayload() as Record<string, unknown>;
    io.to(room.code).emit(ServerEvents.gameEnd, payload);
    broadcastState(room);
    persistBestEffort(setRoomStatus(room.code, 'finished'), `finish ${room.code}`);
    logger.info({ roomCode: room.code, payload }, 'guess-who finished');
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

      // Mid-game joins join the live session so they can guess/vote/draw.
      const session = sessions.get(room.code);
      if (session instanceof DrawingGameSession && session.phaseValue !== 'game-end') {
        const added = session.addPlayer(player.name);
        if (!added.ok) {
          logger.warn(
            { roomCode: room.code, error: added.error },
            'late join to drawing session failed'
          );
        }
      }
      if (session instanceof VotingSession && session.phaseValue !== 'game-end') {
        const added = session.addPlayer(player.name);
        if (!added.ok) {
          logger.warn(
            { roomCode: room.code, error: added.error },
            'late join to voting session failed'
          );
        }
      }
      if (session instanceof TriviaSession && session.phaseValue !== 'game-end') {
        const added = session.addPlayer(player.name);
        if (!added.ok) {
          logger.warn(
            { roomCode: room.code, error: added.error },
            'late join to trivia session failed'
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

      if (isCopycatRoom(result.value)) {
        if (!startCopycat(result.value)) {
          ack?.({ ok: false, error: 'NOT_ENOUGH_PLAYERS' });
          return;
        }
      } else if (isVotingRoom(result.value)) {
        if (!startVoting(result.value)) {
          ack?.({ ok: false, error: 'NOT_ENOUGH_PLAYERS' });
          return;
        }
      } else if (isTriviaRoom(result.value)) {
        if (!startTrivia(result.value)) {
          ack?.({ ok: false, error: 'NOT_ENOUGH_PLAYERS' });
          return;
        }
      } else if (isCharadesRoom(result.value)) {
        if (!startCharades(result.value)) {
          ack?.({ ok: false, error: 'NOT_ENOUGH_PLAYERS' });
          return;
        }
      } else if (isGuessWhoRoom(result.value)) {
        if (!startGuessWho(result.value)) {
          ack?.({ ok: false, error: 'NOT_ENOUGH_PLAYERS' });
          return;
        }
      } else if (DRAWING_CONFIGS[result.value.gameId]) {
        // Capture host-pasted words BEFORE clearing the room game state.
        const pending = pendingCustomWords.get(result.value.code);
        clearRoomGame(result.value.code);
        const session = new DrawingGameSession(
          entriesFrom(result.value.gameId),
          DRAWING_CONFIGS[result.value.gameId]!
        );
        const players = [...result.value.players.values()]
          .filter((player) => player.connected)
          .map((player) => player.name);
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
        // Direct-mode games (one-line/shadow/lyric) skip word-select.
        if (DRAWING_CONFIGS[result.value.gameId]!.wordMode === 'choices') {
          emitDrawingRoundStart(result.value, 'word-select');
          scheduleWordSelectTimeout(result.value);
        } else {
          beginDrawing(result.value);
        }
      }
      ack?.({ ok: true, state: engine.toPublicState(result.value) });
    });

    // --- Shared-canvas drawing game events (M4/M5) ---------------------------

    socket.on(ClientEvents.setCustomWords, (payload: unknown, ack?: Ack) => {
      if (
        typeof (payload as JoinPayload).roomCode !== 'string' ||
        !isRoomCode((payload as JoinPayload).roomCode)
      ) {
        ack?.({ ok: false, error: 'INVALID_PAYLOAD', message: 'invalid room code' });
        return;
      }
      const room = roomOf(socket);
      if (!room || !DRAWING_CONFIGS[room.gameId]) {
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
      const probe = new DrawingGameSession([], DRAWING_CONFIGS[room.gameId]!);
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
      if (!room || !DRAWING_CONFIGS[room.gameId]) {
        ack?.({ ok: false, error: 'NOT_IN_ROOM' });
        return;
      }
      const session = drawingOf(room);
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
      if (!room || !DRAWING_CONFIGS[room.gameId]) {
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
      const session = drawingOf(room);
      if (!session) {
        ack?.({ ok: false, error: 'NOT_STARTED' });
        return;
      }
      const player = room.players.get(socket.id);
      if (!player) {
        ack?.({ ok: false, error: 'NOT_IN_ROOM' });
        return;
      }
      const added = session.addStroke(player.name, input.value);
      if (!added.ok) {
        ack?.({ ok: false, error: added.error });
        return;
      }
      socket.to(room.code).emit(ServerEvents.drawStroke, input.value);
      ack?.({ ok: true });
    });

    socket.on(ClientEvents.undoStroke, (payload: unknown, ack?: Ack) => {
      const room = roomOf(socket);
      if (!room || !DRAWING_CONFIGS[room.gameId]) {
        ack?.({ ok: false, error: 'NOT_IN_ROOM' });
        return;
      }
      const session = drawingOf(room);
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
        io.to(room.code).emit(ServerEvents.undoStroke, { strokeId: undone.value.strokeId });
      }
      ack?.({ ok: true, strokeId: undone.value.strokeId });
    });

    socket.on(ClientEvents.clearCanvas, (payload: unknown, ack?: Ack) => {
      const room = roomOf(socket);
      if (!room || !DRAWING_CONFIGS[room.gameId]) {
        ack?.({ ok: false, error: 'NOT_IN_ROOM' });
        return;
      }
      const session = drawingOf(room);
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
      io.to(room.code).emit(ServerEvents.clearCanvas, {});
      ack?.({ ok: true });
    });

    /** One Line, One Shape: every pen lift deducts 10s (server-authoritative). */
    socket.on(ClientEvents.strokeLift, (payload: unknown, ack?: Ack) => {
      const room = roomOf(socket);
      if (!room || !DRAWING_CONFIGS[room.gameId]) {
        ack?.({ ok: false, error: 'NOT_IN_ROOM' });
        return;
      }
      const session = drawingOf(room);
      if (!session) {
        ack?.({ ok: false, error: 'NOT_STARTED' });
        return;
      }
      const player = room.players.get(socket.id);
      if (!player || player.name !== session.currentDrawer) {
        ack?.({ ok: false, error: 'NOT_DRAWER' });
        return;
      }
      const penalized = session.applyLiftPenalty();
      if (!penalized.ok) {
        ack?.({ ok: false, error: penalized.error });
        return;
      }
      io.to(room.code).emit(ServerEvents.roundTimer, { endsAt: penalized.value.endsAt });
      ack?.({ ok: true, endsAt: penalized.value.endsAt });
    });

    socket.on(ClientEvents.sendGuess, (payload: unknown, ack?: Ack) => {
      const input = validateGuessInput(payload);
      if (!input.ok) {
        ack?.({ ok: false, error: 'INVALID_PAYLOAD', message: input.error });
        return;
      }
      const room = roomOf(socket);
      if (!room) {
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

      // M9 — Guess Who: a guess can end the round at any time.
      if (isGuessWhoRoom(room)) {
        const gw = guessWhoOf(room);
        if (!gw) {
          ack?.({ ok: false, error: 'NOT_STARTED' });
          return;
        }
        const guessed = gw.submitGuess(player.name, input.value.text);
        if (!guessed.ok) {
          ack?.({ ok: false, error: guessed.error });
          return;
        }
        socket.emit(ServerEvents.guessResult, {
          correct: guessed.value.correct,
          alreadyGuessed: false,
        });
        if (guessed.value.correct) {
          io.to(room.code).emit(ServerEvents.guessFeedback, {
            playerName: player.name,
            correct: true,
            points: 1,
          });
          io.to(room.code).emit(ServerEvents.chatMessage, {
            kind: 'system',
            playerName: 'System',
            message: `${player.name} guessed it!`,
            at: Date.now(),
          });
          finishGuessWho(room);
        }
        ack?.({ ok: true });
        return;
      }

      if (!DRAWING_CONFIGS[room.gameId]) {
        ack?.({ ok: false, error: 'NOT_IN_ROOM' });
        return;
      }
      const session = drawingOf(room);
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
          message: `${player.name} got it!`,
          at: Date.now(),
        });
        if (session.allGuessed()) {
          endRound(room);
        }
      } else {
        socket.emit(ServerEvents.guessResult, { correct: false, alreadyGuessed: false });
      }
      ack?.({ ok: true });
    });

    /** Host-only: cut the current drawing phase short. */
    socket.on(ClientEvents.endRoundNow, (payload: unknown, ack?: Ack) => {
      const room = roomOf(socket);
      if (!room || !DRAWING_CONFIGS[room.gameId]) {
        ack?.({ ok: false, error: 'NOT_IN_ROOM' });
        return;
      }
      const player = room.players.get(socket.id);
      if (!player?.isHost) {
        ack?.({ ok: false, error: 'NOT_HOST' });
        return;
      }
      const session = drawingOf(room);
      if (!session || session.phaseValue !== 'drawing') {
        ack?.({ ok: false, error: 'WRONG_PHASE' });
        return;
      }
      endRound(room);
      ack?.({ ok: true });
    });

    socket.on(ClientEvents.nextRound, (payload: unknown, ack?: Ack) => {
      const room = roomOf(socket);
      if (
        !room ||
        (!DRAWING_CONFIGS[room.gameId] &&
          !isVotingRoom(room) &&
          !isTriviaRoom(room) &&
          !isCharadesRoom(room))
      ) {
        ack?.({ ok: false, error: 'NOT_IN_ROOM' });
        return;
      }
      const player = room.players.get(socket.id);
      if (!player?.isHost) {
        ack?.({ ok: false, error: 'NOT_HOST' });
        return;
      }
      const drawing = drawingOf(room);
      if (drawing && drawing.phaseValue === 'round-results') {
        clearTimers(room.code);
        advanceRound(room);
        ack?.({ ok: true });
        return;
      }
      const voting = votingOf(room);
      if (voting && voting.phaseValue === 'revealed') {
        clearTimers(room.code);
        advanceVotingRound(room);
        ack?.({ ok: true });
        return;
      }
      const trivia = triviaOf(room);
      if (trivia && trivia.phaseValue === 'revealed') {
        clearTimers(room.code);
        advanceTriviaRound(room);
        ack?.({ ok: true });
        return;
      }
      const charades = charadesOf(room);
      if (charades && charades.phaseValue === 'acting') {
        // Host skip: move on without scoring the current word.
        advanceCharades(room, false);
        ack?.({ ok: true });
        return;
      }
      ack?.({ ok: false, error: 'WRONG_PHASE' });
    });

    socket.on(ClientEvents.restartGame, (payload: unknown, ack?: Ack) => {
      const room = roomOf(socket);
      if (!room) {
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

    // --- Copycat Challenge events (M5/M13) ----------------------------------

    socket.on(ClientEvents.copycatImageLoaded, (payload: unknown, ack?: Ack) => {
      const input = validateRoomCodeInput(payload);
      if (!input.ok) {
        ack?.({ ok: false, error: 'INVALID_PAYLOAD', message: input.error });
        return;
      }
      const room = roomOf(socket);
      if (!room || !isCopycatRoom(room)) {
        ack?.({ ok: false, error: 'NOT_IN_ROOM' });
        return;
      }
      const player = room.players.get(socket.id);
      if (!player) {
        ack?.({ ok: false, error: 'NOT_IN_ROOM' });
        return;
      }
      const session = copycatOf(room);
      if (!session || session.phaseValue !== 'image-reveal') {
        ack?.({ ok: false });
        return;
      }
      const loaded = copycatLoaded.get(room.code) ?? new Set<string>();
      loaded.add(player.name);
      copycatLoaded.set(room.code, loaded);
      // Every connected player has the image → 10s to study it, then draw.
      const connected = [...room.players.values()]
        .filter((entry) => entry.connected)
        .every((entry) => loaded.has(entry.name));
      if (connected && !copycatPostLoadScheduled.has(room.code)) {
        copycatPostLoadScheduled.add(room.code);
        clearTimers(room.code);
        timers.set(room.code, {
          reveal: setTimeout(() => advanceToDrawing(room), COPYCAT_REVEAL_AFTER_LOAD_MS),
        });
        io.to(room.code).emit(ServerEvents.roundTimer, {
          phase: 'image-reveal',
          endsAt: Date.now() + COPYCAT_REVEAL_AFTER_LOAD_MS,
        });
      }
      ack?.({ ok: true });
    });

    socket.on(ClientEvents.submitDrawing, (payload: unknown, ack?: Ack) => {
      const input = validateRoomCodeInput(payload);
      if (!input.ok) {
        ack?.({ ok: false, error: 'INVALID_PAYLOAD', message: input.error });
        return;
      }
      const room = roomOf(socket);
      if (!room || !isCopycatRoom(room)) {
        ack?.({ ok: false, error: 'NOT_IN_ROOM' });
        return;
      }
      const session = copycatOf(room);
      if (!session) {
        ack?.({ ok: false, error: 'NOT_STARTED' });
        return;
      }
      const player = room.players.get(socket.id);
      if (!player) {
        ack?.({ ok: false, error: 'NOT_IN_ROOM' });
        return;
      }
      const image = (payload as { image?: unknown }).image;
      if (typeof image !== 'string') {
        ack?.({ ok: false, error: 'INVALID_PAYLOAD', message: 'image must be a data URL string' });
        return;
      }
      const submitted = session.submitDrawing(player.name, image);
      if (!submitted.ok) {
        ack?.({ ok: false, error: submitted.error });
        return;
      }
      // Everyone submitted → skip the remaining draw time.
      if (submitted.value.allSubmitted) {
        clearTimers(room.code);
        openGallery(room);
      }
      ack?.({ ok: true, allSubmitted: submitted.value.allSubmitted });
    });

    socket.on(ClientEvents.castVote, (payload: unknown, ack?: Ack) => {
      const input = validateRoomCodeInput(payload);
      if (!input.ok) {
        ack?.({ ok: false, error: 'INVALID_PAYLOAD', message: input.error });
        return;
      }
      const room = roomOf(socket);
      if (!room) {
        ack?.({ ok: false, error: 'NOT_IN_ROOM' });
        return;
      }
      const player = room.players.get(socket.id);
      if (!player) {
        ack?.({ ok: false, error: 'NOT_IN_ROOM' });
        return;
      }
      const session = copycatOf(room);
      if (session) {
        const category = (payload as { category?: unknown }).category;
        const target = (payload as { target?: unknown }).target;
        if (typeof category !== 'string' || typeof target !== 'string') {
          ack?.({ ok: false, error: 'INVALID_PAYLOAD' });
          return;
        }
        const voted = session.submitVote(player.name, category as CopycatAward, target);
        if (!voted.ok) {
          ack?.({ ok: false, error: voted.error });
          return;
        }
        const tally = session.tally(category as CopycatAward);
        io.to(room.code).emit(ServerEvents.voteUpdate, { category, votes: tally });
        if (voted.value.allVoted) {
          clearTimers(room.code);
          finishVoting(room);
        }
        ack?.({ ok: true });
        return;
      }
      const votingSession = votingOf(room);
      if (votingSession) {
        const optionId = (payload as { optionId?: unknown }).optionId;
        if (typeof optionId !== 'string' || optionId.length === 0 || optionId.length > 24) {
          ack?.({ ok: false, error: 'INVALID_PAYLOAD', message: 'invalid option' });
          return;
        }
        const voted = votingSession.submitVote(player.name, optionId);
        if (!voted.ok) {
          ack?.({ ok: false, error: voted.error });
          return;
        }
        io.to(room.code).emit(ServerEvents.voteUpdate, {
          kind: VOTING_CONFIGS[room.gameId]?.kind ?? room.gameId,
          tallies: votingSession.tallies,
          totalVotes: votingSession.totalVotes,
        });
        // All-in → reveal early (except This or That, which keeps its 6s beat).
        if (voted.value.allVoted && room.gameId !== 'this-or-that') {
          clearTimers(room.code);
          revealVotingRound(room);
        }
        ack?.({ ok: true });
        return;
      }
      ack?.({ ok: false, error: 'NOT_STARTED' });
    });

    /**
     * M6 — submit-prompt: WYR dilemmas go to the room queue (used on the
     * next round); NHIE statements start the current player's turn.
     */
    socket.on(ClientEvents.submitPrompt, (payload: unknown, ack?: Ack) => {
      const input = validatePromptInput(payload);
      if (!input.ok) {
        ack?.({ ok: false, error: 'INVALID_PAYLOAD', message: input.error });
        return;
      }
      const room = roomOf(socket);
      if (!room || !isVotingRoom(room)) {
        ack?.({ ok: false, error: 'NOT_IN_ROOM' });
        return;
      }
      const player = room.players.get(socket.id);
      if (!player) {
        ack?.({ ok: false, error: 'NOT_IN_ROOM' });
        return;
      }
      const session = votingOf(room);
      if (!session) {
        ack?.({ ok: false, error: 'NOT_STARTED' });
        return;
      }
      if (input.value.statement !== undefined) {
        if (room.gameId !== 'never-have-i-ever') {
          ack?.({
            ok: false,
            error: 'INVALID_PAYLOAD',
            message: 'statements are for Never Have I Ever',
          });
          return;
        }
        const submitted = session.submitStatement(player.name, input.value.statement);
        if (!submitted.ok) {
          ack?.({ ok: false, error: submitted.error });
          return;
        }
        emitVotingRoundStart(room);
        scheduleVotingTimer(room, 'voting');
        io.to(room.code).emit(ServerEvents.chatMessage, {
          kind: 'system',
          playerName: 'System',
          message: `${player.name} shared a confession — vote!`,
          at: Date.now(),
        });
        ack?.({ ok: true });
        return;
      }
      if (room.gameId !== 'would-you-rather') {
        ack?.({
          ok: false,
          error: 'INVALID_PAYLOAD',
          message: 'dilemmas are for Would You Rather',
        });
        return;
      }
      if (session.phaseValue !== 'voting' && session.phaseValue !== 'revealed') {
        ack?.({ ok: false, error: 'WRONG_PHASE' });
        return;
      }
      const queue = pendingPrompts.get(room.code) ?? [];
      if (queue.length >= 20) {
        ack?.({ ok: false, error: 'QUEUE_FULL' });
        return;
      }
      queue.push({ a: input.value.a!, b: input.value.b! });
      pendingPrompts.set(room.code, queue);
      io.to(room.code).emit(ServerEvents.chatMessage, {
        kind: 'system',
        playerName: 'System',
        message: `${player.name} added a dilemma to the queue`,
        at: Date.now(),
      });
      ack?.({ ok: true, queued: queue.length });
    });

    /**
     * M8 — Trivia room: host picks the mode in the lobby (race or
     * Wrong Answers Only); applied when the game starts.
     */
    socket.on(ClientEvents.setTriviaMode, (payload: unknown, ack?: Ack) => {
      const room = roomOf(socket);
      if (!room || !isTriviaRoom(room)) {
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
      const mode = (payload as { mode?: unknown }).mode;
      if (mode !== 'race' && mode !== 'wrong-answers') {
        ack?.({
          ok: false,
          error: 'INVALID_PAYLOAD',
          message: 'mode must be race or wrong-answers',
        });
        return;
      }
      pendingTriviaModes.set(room.code, mode);
      ack?.({ ok: true });
    });

    /** M8/M9 — answer-question: Trivia option picks + Guess Who yes/no. */
    socket.on(ClientEvents.answerQuestion, (payload: unknown, ack?: Ack) => {
      const room = roomOf(socket);
      if (!room) {
        ack?.({ ok: false, error: 'NOT_IN_ROOM' });
        return;
      }
      const player = room.players.get(socket.id);
      if (!player) {
        ack?.({ ok: false, error: 'NOT_IN_ROOM' });
        return;
      }

      // M9 — Guess Who: the answerer answers the latest question (yes/no).
      if (isGuessWhoRoom(room)) {
        const gw = guessWhoOf(room);
        if (!gw) {
          ack?.({ ok: false, error: 'NOT_STARTED' });
          return;
        }
        const yes = (payload as { yes?: unknown }).yes;
        if (typeof yes !== 'boolean') {
          ack?.({ ok: false, error: 'INVALID_PAYLOAD', message: 'yes must be a boolean' });
          return;
        }
        const answered = gw.answerQuestion(player.name, yes);
        if (!answered.ok) {
          ack?.({ ok: false, error: answered.error });
          return;
        }
        io.to(room.code).emit(ServerEvents.roundReveal, {
          kind: 'guess-who',
          questions: gw.questionLog,
          questionCount: gw.questionCount,
          maxQuestions: gw.maxQuestions,
          finished: answered.value.finished,
        });
        if (answered.value.finished) {
          finishGuessWho(room);
        }
        ack?.({ ok: true });
        return;
      }

      if (!isTriviaRoom(room)) {
        ack?.({ ok: false, error: 'NOT_IN_ROOM' });
        return;
      }
      const session = triviaOf(room);
      if (!session) {
        ack?.({ ok: false, error: 'NOT_STARTED' });
        return;
      }
      const optionIndex = (payload as { optionIndex?: unknown }).optionIndex;
      if (typeof optionIndex !== 'number' || !Number.isInteger(optionIndex)) {
        ack?.({ ok: false, error: 'INVALID_PAYLOAD', message: 'optionIndex must be an integer' });
        return;
      }
      const startedAt = session.questionStartedAtValue;
      const elapsed = startedAt === null ? 0 : Math.max(0, Date.now() - startedAt);
      const answered = session.submitAnswer(player.name, optionIndex, elapsed);
      if (!answered.ok) {
        ack?.({ ok: false, error: answered.error });
        return;
      }
      socket.emit(ServerEvents.guessResult, {
        correct: answered.value.correct,
        points: answered.value.points,
        alreadyGuessed: false,
      });
      if (answered.value.allAnswered) {
        clearTimers(room.code);
        revealTriviaRound(room);
      }
      ack?.({ ok: true, points: answered.value.points, correct: answered.value.correct });
    });

    /** M9 — Guess Who: ask a yes/no question about the secret celebrity. */
    socket.on(ClientEvents.askQuestion, (payload: unknown, ack?: Ack) => {
      const room = roomOf(socket);
      if (!room || !isGuessWhoRoom(room)) {
        ack?.({ ok: false, error: 'NOT_IN_ROOM' });
        return;
      }
      const player = room.players.get(socket.id);
      if (!player) {
        ack?.({ ok: false, error: 'NOT_IN_ROOM' });
        return;
      }
      const session = guessWhoOf(room);
      if (!session) {
        ack?.({ ok: false, error: 'NOT_STARTED' });
        return;
      }
      const text = (payload as { text?: unknown }).text;
      if (typeof text !== 'string' || text.trim().length < 3 || text.trim().length > 140) {
        ack?.({
          ok: false,
          error: 'INVALID_PAYLOAD',
          message: 'question must be 3–140 characters',
        });
        return;
      }
      const asked = session.askQuestion(player.name, text);
      if (!asked.ok) {
        ack?.({ ok: false, error: asked.error });
        return;
      }
      io.to(room.code).emit(ServerEvents.chatMessage, {
        kind: 'message',
        playerName: player.name,
        message: `Q${asked.value.number}: ${text.trim()}`,
        at: Date.now(),
      });
      io.to(room.code).emit(ServerEvents.roundReveal, {
        kind: 'guess-who',
        questions: session.questionLog,
        questionCount: session.questionCount,
        maxQuestions: session.maxQuestions,
        finished: false,
      });
      ack?.({ ok: true });
    });

    /** M9 — Charades: anyone presses Correct! when the team shouts it. */
    socket.on(ClientEvents.markCorrect, (payload: unknown, ack?: Ack) => {
      const room = roomOf(socket);
      if (!room || !isCharadesRoom(room)) {
        ack?.({ ok: false, error: 'NOT_IN_ROOM' });
        return;
      }
      const player = room.players.get(socket.id);
      if (!player) {
        ack?.({ ok: false, error: 'NOT_IN_ROOM' });
        return;
      }
      const session = charadesOf(room);
      if (!session || session.phaseValue !== 'acting') {
        ack?.({ ok: false, error: 'WRONG_PHASE' });
        return;
      }
      const scored = session.markCorrect(player.name);
      if (!scored.ok) {
        ack?.({ ok: false, error: scored.error });
        return;
      }
      io.to(room.code).emit(ServerEvents.guessFeedback, {
        playerName: player.name,
        correct: true,
        points: 1,
      });
      advanceCharades(room, true);
      ack?.({ ok: true, score: scored.value.score });
    });

    /** M9 — Charades: host picks the category in the lobby. */
    socket.on(ClientEvents.setCharadesCategory, (payload: unknown, ack?: Ack) => {
      const room = roomOf(socket);
      if (!room || !isCharadesRoom(room)) {
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
      const category = (payload as { category?: unknown }).category;
      if (category !== 'hollywood' && category !== 'bollywood' && category !== 'mixed') {
        ack?.({
          ok: false,
          error: 'INVALID_PAYLOAD',
          message: 'category must be hollywood, bollywood, or mixed',
        });
        return;
      }
      pendingCharadesCategories.set(room.code, category);
      ack?.({ ok: true });
    });

    socket.on(ClientEvents.gameResync, (payload: unknown, ack?: Ack) => {
      const input = validateRoomCodeInput(payload);
      if (!input.ok) {
        ack?.({ ok: false, error: 'INVALID_PAYLOAD', message: input.error });
        return;
      }
      const room = engine.getRoom(input.value.roomCode);
      if (!room) {
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
        if (room.players.size === 0) {
          clearRoomGame(room.code);
          scheduleEviction();
        }
      }
    });
  });

  return io;
}
