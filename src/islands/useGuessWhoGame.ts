import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import { getSocket } from '../lib/socket';
import { ClientEvents, ServerEvents } from '../lib/events';
import {
  guessWhoReducer,
  initialGuessWhoState,
  type CelebrityView,
  type GuessWhoGameState,
  type QuestionEntry,
} from '../lib/guess-who';

/** Guess Who session hook (M9) — room events + actions over guessWhoReducer. */

export interface UseGuessWhoGame {
  game: GuessWhoGameState;
  actions: {
    askQuestion: (text: string) => Promise<{ ok: boolean; error?: string }>;
    answerYesNo: (yes: boolean) => Promise<{ ok: boolean; error?: string }>;
    submitGuess: (text: string) => Promise<{ ok: boolean; error?: string }>;
    restartGame: () => Promise<{ ok: boolean; error?: string }>;
  };
}

interface AckResponse {
  ok: boolean;
  error?: string;
  message?: string;
  state?: {
    view: GuessWhoGameState['view'];
    answerer: string | null;
    questionCount: number;
    maxQuestions: number;
    questions: QuestionEntry[];
    winner: string | null;
    celebrity: CelebrityView | null;
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
      answerer?: string;
      questionCount?: number;
      maxQuestions?: number;
      celebrity?: CelebrityView;
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
          answerer: payload.answerer ?? '',
          questionCount: payload.questionCount ?? 0,
          maxQuestions: payload.maxQuestions ?? 20,
          celebrity: payload.celebrity,
        },
      });
    };
    const onQuestions = (payload: {
      kind?: string;
      questions?: QuestionEntry[];
      questionCount?: number;
      maxQuestions?: number;
      finished?: boolean;
    }) => {
      if (payload.kind === 'guess-who' && Array.isArray(payload.questions)) {
        dispatch({
          type: 'questions-updated',
          payload: {
            questions: payload.questions,
            questionCount: payload.questionCount ?? 0,
            maxQuestions: payload.maxQuestions ?? 20,
            finished: payload.finished === true,
          },
        });
      }
    };
    const onGameEnd = (payload: Record<string, unknown>) => {
      if (payload.kind === 'guess-who') {
        dispatch({ type: 'game-end', payload });
      }
    };
    const onGameRestart = () => dispatch({ type: 'reset' });
    const onConnect = () => {
      void resync();
    };

    socket.on('connect', onConnect);
    socket.on(ServerEvents.roundStart, onRoundStart);
    socket.on(ServerEvents.roundReveal, onQuestions);
    socket.on(ServerEvents.gameEnd, onGameEnd);
    socket.on(ServerEvents.gameRestart, onGameRestart);

    void resync();

    return () => {
      socket.off('connect', onConnect);
      socket.off(ServerEvents.roundStart, onRoundStart);
      socket.off(ServerEvents.roundReveal, onQuestions);
      socket.off(ServerEvents.gameEnd, onGameEnd);
      socket.off(ServerEvents.gameRestart, onGameRestart);
      socketRef.current = null;
    };
  }, [roomCode, myName, resync]);

  const askQuestion = useCallback(
    async (text: string): Promise<{ ok: boolean; error?: string }> => {
      const code = roomCodeRef.current;
      if (!code) {
        return { ok: false, error: 'NOT_IN_ROOM' };
      }
      const response = await emitAck(ClientEvents.askQuestion, { roomCode: code, text });
      if (!response.ok) {
        dispatch({ type: 'feedback', text: 'That question was rejected — 3–140 characters.' });
      }
      return { ok: response.ok, error: response.error };
    },
    [emitAck]
  );

  const answerYesNo = useCallback(
    async (yes: boolean): Promise<{ ok: boolean; error?: string }> => {
      const code = roomCodeRef.current;
      if (!code) {
        return { ok: false, error: 'NOT_IN_ROOM' };
      }
      const response = await emitAck(ClientEvents.answerQuestion, { roomCode: code, yes });
      return { ok: response.ok, error: response.error };
    },
    [emitAck]
  );

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

  const restartGame = useCallback(async () => {
    const code = roomCodeRef.current;
    if (!code) {
      return { ok: false, error: 'NOT_IN_ROOM' };
    }
    const response = await emitAck(ClientEvents.restartGame, { roomCode: code });
    return { ok: response.ok, error: response.error };
  }, [emitAck]);

  return { game, actions: { askQuestion, answerYesNo, submitGuess, restartGame } };
}
