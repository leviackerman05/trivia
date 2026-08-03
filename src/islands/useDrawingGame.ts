import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import { getSocket } from '../lib/socket';
import { ClientEvents, ServerEvents } from '../lib/events';
import {
  initialSkribblState,
  skribblReducer,
  type RoundHintPayload,
  type RoundStartPayload,
  type SkribblGameState,
  type SkribblRoundSummary,
} from '../lib/skribbl';
import type { Stroke } from '../lib/canvas';

/**
 * Drawing-game session hook (M5) — socket listeners + actions on top of the
 * pure skribblReducer. Shared by Skribbl Arena, One Line One Shape, Shadow
 * Sketch, and Draw the Lyric. Mounts while a game is running; `game-resync`
 * on mount and on every socket reconnect rebuilds the full state.
 */

export interface UseDrawingGame {
  game: SkribblGameState;
  actions: {
    chooseWord: (word: string) => Promise<{ ok: boolean; error?: string }>;
    sendStroke: (stroke: Stroke) => Promise<{ ok: boolean; error?: string }>;
    sendFill: (x: number, y: number, color: string) => Promise<{ ok: boolean; error?: string }>;
    undoStroke: () => Promise<{ ok: boolean; error?: string }>;
    clearCanvas: () => Promise<{ ok: boolean; error?: string }>;
    strokeLift: () => Promise<{ ok: boolean; error?: string; endsAt?: number }>;
    sendGuess: (text: string) => Promise<{ ok: boolean; error?: string }>;
    nextRound: () => Promise<{ ok: boolean; error?: string }>;
    restartGame: () => Promise<{ ok: boolean; error?: string }>;
    endRoundNow: () => Promise<{ ok: boolean; error?: string }>;
    setCustomWords: (words: string[]) => Promise<{ ok: boolean; error?: string; count?: number }>;
  };
}

interface AckResponse {
  ok: boolean;
  error?: string;
  message?: string;
  state?: {
    view: SkribblGameState['view'];
    round: number;
    totalRounds: number;
    drawerName: string | null;
    wordLength: number | null;
    choices: string[] | null;
    firstLetter: string | null;
    lastLetter: string | null;
    endsAt: number | null;
    scores: Record<string, number>;
    strokes: Stroke[];
    summary: SkribblRoundSummary | null;
    finalScores: { playerName: string; score: number }[] | null;
    winner: string | null;
    object?: string | null;
    silhouette?: string | null;
    lyric?: string | null;
    artist?: string | null;
    artistHint?: string | null;
    revealedSilhouette?: string | null;
    liftWarnings?: number;
  };
  strokeId?: string | null;
  endsAt?: number;
  count?: number;
}

const ACK_TIMEOUT_MS = 5000;

export function useDrawingGame(roomCode: string | null, myName: string | null): UseDrawingGame {
  const [game, dispatch] = useReducer(skribblReducer, undefined, initialSkribblState);
  const socketRef = useRef<Socket | null>(null);
  const roomCodeRef = useRef(roomCode);
  const myNameRef = useRef(myName);
  roomCodeRef.current = roomCode;
  myNameRef.current = myName;

  const emitAck = useCallback((event: string, payload: unknown): Promise<AckResponse> => {
    return new Promise((resolve) => {
      const socket = socketRef.current;
      if (!socket) {
        resolve({ ok: false, error: 'NOT_CONNECTED' });
        return;
      }
      const timer = setTimeout(() => resolve({ ok: false, error: 'TIMEOUT' }), ACK_TIMEOUT_MS);
      socket.emit(event, payload, (response: AckResponse) => {
        clearTimeout(timer);
        resolve(response);
      });
    });
  }, []);

  const resync = useCallback(async () => {
    const code = roomCodeRef.current;
    const name = myNameRef.current;
    if (!code || !name) {
      return;
    }
    const response = await emitAck(ClientEvents.gameResync, { roomCode: code });
    if (response.ok && response.state) {
      dispatch({ type: 'resync', myName: name, state: response.state });
    }
  }, [emitAck]);

  useEffect(() => {
    if (!roomCode || !myName) {
      return;
    }
    const socket = getSocket();
    socketRef.current = socket;

    const onRoundStart = (payload: RoundStartPayload) => {
      dispatch({ type: 'round-start', payload, myName: myNameRef.current ?? '' });
    };
    const onRoundHint = (payload: RoundHintPayload) => dispatch({ type: 'round-hint', payload });
    const onRoundTimer = (payload: { endsAt: number }) =>
      dispatch({ type: 'round-timer', endsAt: payload.endsAt });
    const onStroke = (stroke: Stroke) => dispatch({ type: 'stroke-added', stroke });
    const onUndo = (payload: { strokeId: string }) =>
      dispatch({ type: 'stroke-removed', strokeId: payload.strokeId });
    const onClear = () => dispatch({ type: 'canvas-cleared' });
    const onRoundEnd = (payload: SkribblRoundSummary) => dispatch({ type: 'round-end', payload });
    const onGameEnd = (payload: {
      scores: { playerName: string; score: number }[];
      winner: string;
    }) => dispatch({ type: 'game-end', payload });
    const onGuessResult = (payload: {
      correct: boolean;
      points?: number;
      alreadyGuessed?: boolean;
    }) => dispatch({ type: 'guess-result', ...payload });
    const onGameRestart = () => dispatch({ type: 'reset' });
    const onConnect = () => {
      void resync();
    };

    socket.on('connect', onConnect);
    socket.on(ServerEvents.roundStart, onRoundStart);
    socket.on(ServerEvents.roundHint, onRoundHint);
    socket.on(ServerEvents.roundTimer, onRoundTimer);
    socket.on(ServerEvents.drawStroke, onStroke);
    socket.on(ServerEvents.undoStroke, onUndo);
    socket.on(ServerEvents.clearCanvas, onClear);
    socket.on(ServerEvents.roundEnd, onRoundEnd);
    socket.on(ServerEvents.gameEnd, onGameEnd);
    socket.on(ServerEvents.guessResult, onGuessResult);
    socket.on(ServerEvents.gameRestart, onGameRestart);

    void resync();

    return () => {
      socket.off('connect', onConnect);
      socket.off(ServerEvents.roundStart, onRoundStart);
      socket.off(ServerEvents.roundHint, onRoundHint);
      socket.off(ServerEvents.roundTimer, onRoundTimer);
      socket.off(ServerEvents.drawStroke, onStroke);
      socket.off(ServerEvents.undoStroke, onUndo);
      socket.off(ServerEvents.clearCanvas, onClear);
      socket.off(ServerEvents.roundEnd, onRoundEnd);
      socket.off(ServerEvents.gameEnd, onGameEnd);
      socket.off(ServerEvents.guessResult, onGuessResult);
      socket.off(ServerEvents.gameRestart, onGameRestart);
      socketRef.current = null;
    };
  }, [roomCode, myName, resync]);

  const chooseWord = useCallback(
    async (word: string) => {
      const code = roomCodeRef.current;
      if (!code) {
        return { ok: false, error: 'NOT_IN_ROOM' };
      }
      const response = await emitAck(ClientEvents.chooseWord, { roomCode: code, word });
      return { ok: response.ok, error: response.error };
    },
    [emitAck]
  );

  /**
   * Optimistic send: the drawer's own strokes join the local log immediately
   * (so repaints never erase them and undo can remove them), then the server
   * authorizes + relays them. The drawer is excluded from the echo.
   */
  const sendStroke = useCallback(
    async (stroke: Stroke) => {
      const code = roomCodeRef.current;
      if (!code) {
        return { ok: false, error: 'NOT_IN_ROOM' };
      }
      dispatch({ type: 'stroke-added', stroke });
      const response = await emitAck(ClientEvents.drawStroke, { roomCode: code, ...stroke });
      return { ok: response.ok, error: response.error };
    },
    [emitAck]
  );

  /** Flood fill at (x, y) with the current color — same optimistic path. */
  const sendFill = useCallback(
    async (x: number, y: number, color: string) => {
      const code = roomCodeRef.current;
      if (!code) {
        return { ok: false, error: 'NOT_IN_ROOM' };
      }
      const stroke: Stroke = {
        strokeId: crypto.randomUUID(),
        type: 'fill',
        x,
        y,
        prevX: x,
        prevY: y,
        color,
        brushSize: 4,
        tool: 'pen',
      };
      dispatch({ type: 'stroke-added', stroke });
      const response = await emitAck(ClientEvents.drawStroke, { roomCode: code, ...stroke });
      return { ok: response.ok, error: response.error };
    },
    [emitAck]
  );

  const undoStroke = useCallback(async () => {
    const code = roomCodeRef.current;
    if (!code) {
      return { ok: false, error: 'NOT_IN_ROOM' };
    }
    const response = await emitAck(ClientEvents.undoStroke, { roomCode: code });
    return { ok: response.ok, error: response.error };
  }, [emitAck]);

  const clearCanvas = useCallback(async () => {
    const code = roomCodeRef.current;
    if (!code) {
      return { ok: false, error: 'NOT_IN_ROOM' };
    }
    const response = await emitAck(ClientEvents.clearCanvas, { roomCode: code });
    return { ok: response.ok, error: response.error };
  }, [emitAck]);

  /** One Line, One Shape: report a pen lift → server deducts 10s. */
  const strokeLift = useCallback(async () => {
    const code = roomCodeRef.current;
    if (!code) {
      return { ok: false, error: 'NOT_IN_ROOM' };
    }
    const response = await emitAck(ClientEvents.strokeLift, { roomCode: code });
    if (response.ok && typeof response.endsAt === 'number') {
      dispatch({ type: 'stroke-lift', endsAt: response.endsAt });
    }
    return { ok: response.ok, error: response.error, endsAt: response.endsAt };
  }, [emitAck]);

  /** Guess errors surface as visible feedback instead of failing silently. */
  const guessErrorMessage = (error: string | undefined): string | undefined => {
    switch (error) {
      case 'DRAWER_CANNOT_GUESS':
        return "You're the drawer — you can't guess your own word!";
      case 'ROUND_OVER':
        return 'Time is up — the round already ended.';
      case 'NOT_PLAYER':
        return 'Joining you into this round — guess again!';
      case 'WRONG_PHASE':
        return 'Guessing is only open during the drawing phase.';
      case 'RATE_LIMITED':
        return 'Too many guesses — pause for a moment.';
      default:
        return undefined;
    }
  };

  const sendGuess = useCallback(
    async (text: string) => {
      const code = roomCodeRef.current;
      if (!code) {
        return { ok: false, error: 'NOT_IN_ROOM' };
      }
      const response = await emitAck(ClientEvents.sendGuess, { roomCode: code, text });
      if (!response.ok) {
        const message = guessErrorMessage(response.error);
        if (message) {
          dispatch({ type: 'guess-result', correct: false, message });
        }
      }
      return { ok: response.ok, error: response.error };
    },
    [emitAck]
  );

  const nextRound = useCallback(async () => {
    const code = roomCodeRef.current;
    if (!code) {
      return { ok: false, error: 'NOT_IN_ROOM' };
    }
    const response = await emitAck(ClientEvents.nextRound, { roomCode: code });
    return { ok: response.ok, error: response.error };
  }, [emitAck]);

  const restartGame = useCallback(async () => {
    const code = roomCodeRef.current;
    if (!code) {
      return { ok: false, error: 'NOT_IN_ROOM' };
    }
    const response = await emitAck(ClientEvents.restartGame, { roomCode: code });
    return { ok: response.ok, error: response.error };
  }, [emitAck]);

  const endRoundNow = useCallback(async () => {
    const code = roomCodeRef.current;
    if (!code) {
      return { ok: false, error: 'NOT_IN_ROOM' };
    }
    const response = await emitAck(ClientEvents.endRoundNow, { roomCode: code });
    return { ok: response.ok, error: response.error };
  }, [emitAck]);

  const setCustomWords = useCallback(
    async (words: string[]) => {
      const code = roomCodeRef.current;
      if (!code) {
        return { ok: false, error: 'NOT_IN_ROOM' };
      }
      const response = await emitAck(ClientEvents.setCustomWords, { roomCode: code, words });
      return { ok: response.ok, error: response.error, count: response.count };
    },
    [emitAck]
  );

  return {
    game,
    actions: {
      chooseWord,
      sendStroke,
      sendFill,
      undoStroke,
      clearCanvas,
      strokeLift,
      sendGuess,
      nextRound,
      restartGame,
      endRoundNow,
      setCustomWords,
    },
  };
}
