import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import { getSocket } from '../lib/socket';
import { ClientEvents, ServerEvents } from '../lib/events';
import {
  initialTriviaState,
  triviaRoomReducer,
  type TriviaGameState,
  type TriviaMode,
  type TriviaQuestionView,
  type TriviaRoundResult,
  type TriviaScoreRow,
} from '../lib/trivia-room';

/**
 * Trivia room session hook (M8) — socket listeners + actions over the pure
 * triviaRoomReducer. Mounts on the Trivia page's room section; `game-resync`
 * on mount/reconnect rebuilds state (without the correct answer).
 */

export interface UseTriviaGame {
  game: TriviaGameState;
  actions: {
    answer: (optionIndex: number) => Promise<{ ok: boolean; error?: string }>;
    setMode: (mode: TriviaMode) => Promise<{ ok: boolean; error?: string }>;
    nextRound: () => Promise<{ ok: boolean; error?: string }>;
    restartGame: () => Promise<{ ok: boolean; error?: string }>;
  };
}

interface AckResponse {
  ok: boolean;
  error?: string;
  message?: string;
  points?: number;
  correct?: boolean;
  state?: {
    view: TriviaGameState['view'];
    mode: TriviaMode;
    question: TriviaQuestionView | null;
    round: number;
    totalRounds: number;
    myAnswer: { optionIndex: number; points: number } | null;
    reveal: { correctIndex: number; results: TriviaRoundResult[] } | null;
    scores: TriviaScoreRow[];
  };
}

const ACK_TIMEOUT_MS = 5000;

export function useTriviaGame(roomCode: string | null, myName: string | null): UseTriviaGame {
  const [game, dispatch] = useReducer(triviaRoomReducer, undefined, initialTriviaState);
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
      mode?: TriviaMode;
      question?: TriviaQuestionView;
      round?: number;
      totalRounds?: number;
      endsAt?: number;
    }) => {
      if (
        payload.kind !== 'trivia' ||
        payload.phase !== 'question' ||
        !payload.question ||
        typeof payload.endsAt !== 'number' ||
        (payload.mode !== 'race' && payload.mode !== 'wrong-answers')
      ) {
        return;
      }
      dispatch({
        type: 'question-start',
        myName: myNameRef.current ?? '',
        payload: {
          mode: payload.mode,
          question: payload.question,
          round: payload.round ?? 0,
          totalRounds: payload.totalRounds ?? 0,
          endsAt: payload.endsAt,
        },
      });
    };
    const onReveal = (payload: {
      kind?: string;
      correctIndex?: number;
      results?: TriviaRoundResult[];
      scores?: TriviaScoreRow[];
    }) => {
      if (
        payload.kind === 'trivia' &&
        typeof payload.correctIndex === 'number' &&
        Array.isArray(payload.results)
      ) {
        dispatch({
          type: 'reveal',
          payload: {
            correctIndex: payload.correctIndex,
            results: payload.results,
            scores: Array.isArray(payload.scores) ? payload.scores : [],
          },
        });
      }
    };
    const onGameEnd = (payload: Record<string, unknown>) => {
      if (payload.kind === 'trivia') {
        dispatch({ type: 'game-end', payload });
      }
    };
    const onGameRestart = () => dispatch({ type: 'reset' });
    const onConnect = () => {
      void resync();
    };

    socket.on('connect', onConnect);
    socket.on(ServerEvents.roundStart, onRoundStart);
    socket.on(ServerEvents.roundReveal, onReveal);
    socket.on(ServerEvents.gameEnd, onGameEnd);
    socket.on(ServerEvents.gameRestart, onGameRestart);

    void resync();

    return () => {
      socket.off('connect', onConnect);
      socket.off(ServerEvents.roundStart, onRoundStart);
      socket.off(ServerEvents.roundReveal, onReveal);
      socket.off(ServerEvents.gameEnd, onGameEnd);
      socket.off(ServerEvents.gameRestart, onGameRestart);
      socketRef.current = null;
    };
  }, [roomCode, myName, resync]);

  const answer = useCallback(
    async (optionIndex: number): Promise<{ ok: boolean; error?: string }> => {
      const code = roomCodeRef.current;
      if (!code) {
        return { ok: false, error: 'NOT_IN_ROOM' };
      }
      const response = await emitAck(ClientEvents.answerQuestion, { roomCode: code, optionIndex });
      if (response.ok && typeof response.points === 'number') {
        dispatch({
          type: 'answered',
          optionIndex,
          points: response.points,
          correct: response.correct === true,
        });
      } else if (response.error === 'ALREADY_ANSWERED') {
        dispatch({ type: 'feedback', text: 'You already answered this one!' });
      }
      return { ok: response.ok, error: response.error };
    },
    [emitAck]
  );

  const setMode = useCallback(
    async (mode: TriviaMode): Promise<{ ok: boolean; error?: string }> => {
      const code = roomCodeRef.current;
      if (!code) {
        return { ok: false, error: 'NOT_IN_ROOM' };
      }
      const response = await emitAck(ClientEvents.setTriviaMode, { roomCode: code, mode });
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

  return { game, actions: { answer, setMode, nextRound, restartGame } };
}
