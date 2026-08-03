import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import { getSocket } from '../lib/socket';
import { ClientEvents, ServerEvents } from '../lib/events';
import { charadesReducer, initialCharadesState, type CharadesGameState } from '../lib/charades';

/** Charades session hook (M9) — room events + actions over charadesReducer. */

export interface UseCharadesGame {
  game: CharadesGameState;
  actions: {
    markCorrect: () => Promise<{ ok: boolean; error?: string }>;
    setCategory: (
      category: 'hollywood' | 'bollywood' | 'mixed'
    ) => Promise<{ ok: boolean; error?: string }>;
    skip: () => Promise<{ ok: boolean; error?: string }>;
    restartGame: () => Promise<{ ok: boolean; error?: string }>;
  };
}

interface AckResponse {
  ok: boolean;
  error?: string;
  message?: string;
  score?: number;
  state?: {
    view: CharadesGameState['view'];
    category: 'hollywood' | 'bollywood' | 'mixed';
    round: number;
    totalRounds: number;
    actor: string | null;
    score: number;
    movie: string | null;
  };
}

const ACK_TIMEOUT_MS = 5000;

export function useCharadesGame(roomCode: string | null, myName: string | null): UseCharadesGame {
  const [game, dispatch] = useReducer(charadesReducer, undefined, initialCharadesState);
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
      category?: 'hollywood' | 'bollywood' | 'mixed';
      round?: number;
      totalRounds?: number;
      score?: number;
      endsAt?: number;
      actor?: string;
      movie?: string;
    }) => {
      if (
        payload.kind !== 'charades' ||
        payload.phase !== 'acting' ||
        typeof payload.endsAt !== 'number'
      ) {
        return;
      }
      dispatch({
        type: 'round-start',
        myName: myNameRef.current ?? '',
        payload: {
          kind: payload.kind,
          phase: payload.phase,
          category: payload.category ?? 'mixed',
          round: payload.round ?? 0,
          totalRounds: payload.totalRounds ?? 0,
          score: payload.score ?? 0,
          endsAt: payload.endsAt,
          actor: payload.actor,
          movie: payload.movie,
        },
      });
    };
    const onRoundEnd = (payload: {
      kind?: string;
      scored?: boolean;
      score?: number;
      nextActor?: string | null;
    }) => {
      if (payload.kind === 'charades') {
        dispatch({
          type: 'round-end',
          scored: payload.scored === true,
          score: payload.score ?? 0,
          nextActor: payload.nextActor ?? null,
        });
      }
    };
    const onGameEnd = (payload: Record<string, unknown>) => {
      if (payload.kind === 'charades') {
        dispatch({ type: 'game-end', payload });
      }
    };
    const onGameRestart = () => dispatch({ type: 'reset' });
    const onConnect = () => {
      void resync();
    };

    socket.on('connect', onConnect);
    socket.on(ServerEvents.roundStart, onRoundStart);
    socket.on(ServerEvents.roundEnd, onRoundEnd);
    socket.on(ServerEvents.gameEnd, onGameEnd);
    socket.on(ServerEvents.gameRestart, onGameRestart);

    void resync();

    return () => {
      socket.off('connect', onConnect);
      socket.off(ServerEvents.roundStart, onRoundStart);
      socket.off(ServerEvents.roundEnd, onRoundEnd);
      socket.off(ServerEvents.gameEnd, onGameEnd);
      socket.off(ServerEvents.gameRestart, onGameRestart);
      socketRef.current = null;
    };
  }, [roomCode, myName, resync]);

  const markCorrect = useCallback(async () => {
    const code = roomCodeRef.current;
    if (!code) {
      return { ok: false, error: 'NOT_IN_ROOM' };
    }
    const response = await emitAck(ClientEvents.markCorrect, { roomCode: code });
    return { ok: response.ok, error: response.error };
  }, [emitAck]);

  const setCategory = useCallback(
    async (category: 'hollywood' | 'bollywood' | 'mixed') => {
      const code = roomCodeRef.current;
      if (!code) {
        return { ok: false, error: 'NOT_IN_ROOM' };
      }
      const response = await emitAck(ClientEvents.setCharadesCategory, {
        roomCode: code,
        category,
      });
      return { ok: response.ok, error: response.error };
    },
    [emitAck]
  );

  const skip = useCallback(async () => {
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

  return { game, actions: { markCorrect, setCategory, skip, restartGame } };
}
