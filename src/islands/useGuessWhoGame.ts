import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import { getSocket } from '../lib/socket';
import { ClientEvents, ServerEvents } from '../lib/events';
import {
  guessWhoReducer,
  initialGuessWhoState,
  GUESS_WHO_TOTAL_ROUNDS,
  type GuessWhoClue,
  type GuessWhoFilter,
  type GuessWhoFilterOption,
  type GuessWhoGameState,
  type GuessWhoScoreRow,
} from '../lib/guess-who';

/** Guess Who session hook (M9/M17 + owner redesign), room events + actions
 * over guessWhoReducer. The name is hidden from every device; the server
 * verifies guesses and broadcasts letter hints via round-hint. */

export interface UseGuessWhoGame {
  game: GuessWhoGameState;
  actions: {
    submitGuess: (text: string) => Promise<{ ok: boolean; error?: string }>;
    nextCelebrity: () => Promise<{ ok: boolean; error?: string }>;
    restartGame: () => Promise<{ ok: boolean; error?: string }>;
    /** D064, host-only lobby filter (the server rejects non-hosts). */
    setFilter: (filter: GuessWhoFilter) => Promise<{ ok: boolean; error?: string }>;
  };
}

interface AckResponse {
  ok: boolean;
  error?: string;
  message?: string;
  state?: {
    view: GuessWhoGameState['view'];
    round: number;
    totalRounds: number;
    scores: GuessWhoScoreRow[];
    winner: string | null;
    clue?: GuessWhoClue;
    namePattern?: string;
    endsAt?: number;
  };
}

const ACK_TIMEOUT_MS = 5000;

export function useGuessWhoGame(roomCode: string | null, myName: string | null): UseGuessWhoGame {
  const [game, dispatch] = useReducer(guessWhoReducer, undefined, initialGuessWhoState);
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

    const onRoundStart = (payload: {
      kind?: string;
      phase?: string;
      round?: number;
      totalRounds?: number;
      scores?: GuessWhoScoreRow[];
      clue?: GuessWhoClue;
      namePattern?: string;
      endsAt?: number;
      filter?: GuessWhoFilter;
    }) => {
      if (payload.kind !== 'guess-who' || payload.phase !== 'questioning') {
        return;
      }
      dispatch({
        type: 'round-start',
        myName: myNameRef.current ?? '',
        payload: {
          kind: payload.kind,
          phase: payload.phase,
          round: payload.round ?? 1,
          totalRounds: payload.totalRounds ?? GUESS_WHO_TOTAL_ROUNDS,
          scores: Array.isArray(payload.scores) ? payload.scores : [],
          clue: payload.clue,
          namePattern: payload.namePattern,
          endsAt: payload.endsAt,
          filter: payload.filter,
        },
      });
    };
    const onRoundHint = (payload: { round?: number; pattern?: string }) => {
      if (typeof payload.pattern === 'string' && payload.pattern.length > 0) {
        dispatch({ type: 'hint', pattern: payload.pattern });
      }
    };
    const onGuessReveal = (payload: {
      kind?: string;
      celebrity?: { name: string; famousFor: string; facts: string[] } | null;
      winner?: string | null;
      scores?: GuessWhoScoreRow[];
      round?: number;
      totalRounds?: number;
      finished?: boolean;
    }) => {
      if (payload.kind !== 'guess-who') {
        return;
      }
      dispatch({
        type: 'reveal',
        payload: {
          celebrity: payload.celebrity ?? null,
          winner: payload.winner ?? null,
          scores: Array.isArray(payload.scores) ? payload.scores : [],
          round: payload.round ?? 1,
          totalRounds: payload.totalRounds ?? GUESS_WHO_TOTAL_ROUNDS,
          finished: payload.finished === true,
        },
      });
    };
    const onGameEnd = (payload: Record<string, unknown>) => {
      if (payload.kind === 'guess-who') {
        dispatch({ type: 'game-end', payload });
      }
    };
    const onFilterOptions = (payload: {
      regions?: GuessWhoFilterOption[];
      genres?: GuessWhoFilterOption[];
    }) => {
      if (Array.isArray(payload.regions) && Array.isArray(payload.genres)) {
        dispatch({
          type: 'filter-options',
          payload: { regions: payload.regions, genres: payload.genres },
        });
      }
    };
    const onGuessResult = (payload: { correct?: boolean; alreadyGuessed?: boolean }) => {
      // Owner redesign: wrong guesses get quiet feedback so players keep
      // trying; a correct one leads straight into the reveal broadcast.
      if (payload.correct === false) {
        dispatch({ type: 'feedback', text: 'Not quite, keep trying!' });
      } else if (payload.correct === true) {
        dispatch({ type: 'feedback', text: null });
      }
    };
    const onGameRestart = () => dispatch({ type: 'reset' });
    const onConnect = () => {
      void resync();
    };

    socket.on('connect', onConnect);
    socket.on(ServerEvents.roundStart, onRoundStart);
    socket.on(ServerEvents.roundHint, onRoundHint);
    socket.on(ServerEvents.guessReveal, onGuessReveal);
    socket.on(ServerEvents.gameEnd, onGameEnd);
    socket.on(ServerEvents.gameRestart, onGameRestart);
    socket.on(ServerEvents.guessWhoFilterOptions, onFilterOptions);
    socket.on(ServerEvents.guessResult, onGuessResult);

    void resync();

    return () => {
      socket.off('connect', onConnect);
      socket.off(ServerEvents.roundStart, onRoundStart);
      socket.off(ServerEvents.roundHint, onRoundHint);
      socket.off(ServerEvents.guessReveal, onGuessReveal);
      socket.off(ServerEvents.gameEnd, onGameEnd);
      socket.off(ServerEvents.gameRestart, onGameRestart);
      socket.off(ServerEvents.guessWhoFilterOptions, onFilterOptions);
      socket.off(ServerEvents.guessResult, onGuessResult);
      socketRef.current = null;
    };
  }, [roomCode, myName, resync]);

  const submitGuess = useCallback(
    async (text: string): Promise<{ ok: boolean; error?: string }> => {
      const code = roomCodeRef.current;
      if (!code) {
        return { ok: false, error: 'NOT_IN_ROOM' };
      }
      const response = await emitAck(ClientEvents.sendGuess, { roomCode: code, text });
      if (!response.ok) {
        dispatch({ type: 'feedback', text: 'That guess was rejected.' });
      }
      return { ok: response.ok, error: response.error };
    },
    [emitAck]
  );

  const nextCelebrity = useCallback(async () => {
    const code = roomCodeRef.current;
    if (!code) {
      return { ok: false, error: 'NOT_IN_ROOM' };
    }
    const response = await emitAck(ClientEvents.guessWhoNext, { roomCode: code });
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

  const setFilter = useCallback(
    async (filter: GuessWhoFilter) => {
      const code = roomCodeRef.current;
      if (!code) {
        return { ok: false, error: 'NOT_IN_ROOM' };
      }
      const response = await emitAck(ClientEvents.setGuessWhoFilter, {
        roomCode: code,
        region: filter.region,
        genre: filter.genre,
      });
      if (response.ok) {
        // D064, optimistic update so the toggle reflects the choice immediately
        // (the server only echoes the filter again at round start).
        dispatch({ type: 'set-filter', filter });
      }
      return { ok: response.ok, error: response.error };
    },
    [emitAck]
  );

  return {
    game,
    actions: { submitGuess, nextCelebrity, restartGame, setFilter },
  };
}
