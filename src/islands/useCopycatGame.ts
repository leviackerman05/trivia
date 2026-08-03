import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import { getSocket } from '../lib/socket';
import { ClientEvents, ServerEvents } from '../lib/events';
import {
  copycatReducer,
  initialCopycatState,
  type CopycatAward,
  type CopycatAwardResult,
  type CopycatDrawing,
  type CopycatGameState,
  type CopycatImage,
  type CopycatVoteRow,
} from '../lib/copycat';
import type { Stroke } from '../lib/canvas';

/**
 * Copycat Challenge session hook (M5) — socket listeners + actions over the
 * pure copycatReducer. The private canvas stays local until submit; strokes
 * are never emitted (the server never sees them, only the flattened PNG).
 */

export interface UseCopycatGame {
  game: CopycatGameState;
  actions: {
    addStroke: (stroke: Stroke) => void;
    removeStroke: (strokeId: string) => void;
    clearCanvas: () => void;
    submitDrawing: (dataUrl: string) => Promise<{ ok: boolean; error?: string }>;
    castVote: (category: CopycatAward, target: string) => Promise<{ ok: boolean; error?: string }>;
  };
}

interface AckResponse {
  ok: boolean;
  error?: string;
  message?: string;
  state?: {
    view: CopycatGameState['view'];
    image: CopycatImage | null;
    drawings: CopycatDrawing[];
    awards: CopycatAwardResult[] | null;
  };
  allSubmitted?: boolean;
}

const ACK_TIMEOUT_MS = 5000;

export function useCopycatGame(roomCode: string | null, myName: string | null): UseCopycatGame {
  const [game, dispatch] = useReducer(copycatReducer, undefined, initialCopycatState);
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

    const onRoundStart = (payload: { phase?: string; image?: CopycatImage; endsAt?: number }) => {
      if (payload.phase !== 'image-reveal' && payload.phase !== 'drawing') {
        return;
      }
      if (typeof payload.endsAt !== 'number') {
        return;
      }
      dispatch({
        type: 'round-start',
        phase: payload.phase,
        myName: myNameRef.current ?? '',
        image: payload.image,
        endsAt: payload.endsAt,
      });
    };
    const onGallery = (payload: { phase?: string; images?: CopycatDrawing[] }) => {
      if (payload.phase === 'gallery' && Array.isArray(payload.images)) {
        dispatch({ type: 'gallery', drawings: payload.images });
      }
    };
    const onVoteStart = (payload: { endsAt?: number }) => {
      if (typeof payload.endsAt === 'number') {
        dispatch({ type: 'vote-start', endsAt: payload.endsAt });
      }
    };
    const onVoteUpdate = (payload: { category?: string; votes?: CopycatVoteRow[] }) => {
      if (
        (payload.category === 'recognizable' ||
          payload.category === 'funniest' ||
          payload.category === 'abstract') &&
        Array.isArray(payload.votes)
      ) {
        dispatch({ type: 'vote-update', category: payload.category, votes: payload.votes });
      }
    };
    const onVoteReveal = (payload: { awards?: CopycatAwardResult[] }) => {
      if (Array.isArray(payload.awards)) {
        dispatch({ type: 'vote-reveal', awards: payload.awards });
      }
    };
    const onGameEnd = (payload: { awards?: CopycatAwardResult[] }) => {
      if (Array.isArray(payload.awards)) {
        dispatch({ type: 'vote-reveal', awards: payload.awards });
      }
    };
    const onGameRestart = () => dispatch({ type: 'reset' });
    const onConnect = () => {
      void resync();
    };

    socket.on('connect', onConnect);
    socket.on(ServerEvents.roundStart, onRoundStart);
    socket.on(ServerEvents.roundEnd, onGallery);
    socket.on(ServerEvents.voteStart, onVoteStart);
    socket.on(ServerEvents.voteUpdate, onVoteUpdate);
    socket.on(ServerEvents.voteReveal, onVoteReveal);
    socket.on(ServerEvents.gameEnd, onGameEnd);
    socket.on(ServerEvents.gameRestart, onGameRestart);

    void resync();

    return () => {
      socket.off('connect', onConnect);
      socket.off(ServerEvents.roundStart, onRoundStart);
      socket.off(ServerEvents.roundEnd, onGallery);
      socket.off(ServerEvents.voteStart, onVoteStart);
      socket.off(ServerEvents.voteUpdate, onVoteUpdate);
      socket.off(ServerEvents.voteReveal, onVoteReveal);
      socket.off(ServerEvents.gameEnd, onGameEnd);
      socket.off(ServerEvents.gameRestart, onGameRestart);
      socketRef.current = null;
    };
  }, [roomCode, myName, resync]);

  const addStroke = useCallback((stroke: Stroke) => {
    dispatch({ type: 'stroke-added', stroke });
  }, []);

  const removeStroke = useCallback((strokeId: string) => {
    dispatch({ type: 'stroke-removed', strokeId });
  }, []);

  const clearCanvas = useCallback(() => {
    dispatch({ type: 'canvas-cleared' });
  }, []);

  const submitDrawing = useCallback(
    async (dataUrl: string): Promise<{ ok: boolean; error?: string }> => {
      const code = roomCodeRef.current;
      if (!code) {
        return { ok: false, error: 'NOT_IN_ROOM' };
      }
      const response = await emitAck(ClientEvents.submitDrawing, {
        roomCode: code,
        image: dataUrl,
      });
      if (response.ok) {
        dispatch({ type: 'submitted' });
      } else if (response.error === 'IMAGE_TOO_LARGE') {
        dispatch({
          type: 'feedback',
          text: 'That drawing is too complex to upload — simplify it and submit again.',
        });
      }
      return { ok: response.ok, error: response.error };
    },
    [emitAck]
  );

  const castVote = useCallback(
    async (category: CopycatAward, target: string): Promise<{ ok: boolean; error?: string }> => {
      const code = roomCodeRef.current;
      if (!code) {
        return { ok: false, error: 'NOT_IN_ROOM' };
      }
      const response = await emitAck(ClientEvents.castVote, {
        roomCode: code,
        category,
        target,
      });
      if (response.ok) {
        dispatch({ type: 'vote-cast', category, target });
      } else {
        dispatch({ type: 'feedback', text: 'That vote was rejected — try a different drawing.' });
      }
      return { ok: response.ok, error: response.error };
    },
    [emitAck]
  );

  return {
    game,
    actions: { addStroke, removeStroke, clearCanvas, submitDrawing, castVote },
  };
}
