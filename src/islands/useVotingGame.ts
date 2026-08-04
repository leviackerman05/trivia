import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import { getSocket } from '../lib/socket';
import { ClientEvents, ServerEvents } from '../lib/events';
import {
  initialVotingState,
  votingReducer,
  type VotingGameState,
  type VotingKind,
  type VotingOption,
  type VotingReveal,
  type VotingTally,
} from '../lib/voting';

/**
 * Voting-game session hook (M6), socket listeners + actions over the pure
 * votingReducer. Shared by Would You Rather, Most Likely To, Never Have I
 * Ever, and This or That. `game-resync` on mount/reconnect rebuilds state.
 */

export interface UseVotingGame {
  game: VotingGameState;
  actions: {
    castVote: (optionId: string) => Promise<{ ok: boolean; error?: string }>;
    submitDilemma: (a: string, b: string) => Promise<{ ok: boolean; error?: string }>;
    submitStatement: (statement: string) => Promise<{ ok: boolean; error?: string }>;
    nextRound: () => Promise<{ ok: boolean; error?: string }>;
    restartGame: () => Promise<{ ok: boolean; error?: string }>;
    setVotingConfig: (config: {
      nhieTier?: string;
      nhieSource?: 'provided' | 'own' | 'both';
      totGenre?: string | null;
    }) => Promise<{ ok: boolean; error?: string }>;
  };
}

interface AckResponse {
  ok: boolean;
  error?: string;
  message?: string;
  state?: {
    view: VotingGameState['view'];
    kind: VotingKind;
    prompt: { title: string | null; subtitle: string | null };
    options: VotingOption[];
    round: number;
    totalRounds: number;
    statementBy: string | null;
    statement: string | null;
    tallies: VotingTally[];
    reveal: VotingReveal | null;
    myVote: string | null;
    endsAt: number | null;
  };
}

const ACK_TIMEOUT_MS = 5000;

const VOTING_KINDS: VotingKind[] = [
  'would-you-rather',
  'most-likely-to',
  'never-have-i-ever',
  'this-or-that',
];

export function useVotingGame(roomCode: string | null, myName: string | null): UseVotingGame {
  const [game, dispatch] = useReducer(votingReducer, undefined, initialVotingState);
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
      prompt?: { title: string | null; subtitle: string | null };
      options?: VotingOption[];
      round?: number;
      totalRounds?: number;
      statementBy?: string | null;
      statement?: string | null;
      custom?: boolean;
      endsAt?: number;
      suggestions?: string[];
      statementSource?: 'provided' | 'own' | 'both';
    }) => {
      if (
        !payload.kind ||
        !VOTING_KINDS.includes(payload.kind as VotingKind) ||
        (payload.phase !== 'statement' && payload.phase !== 'voting') ||
        typeof payload.endsAt !== 'number' ||
        !Array.isArray(payload.options)
      ) {
        return;
      }
      dispatch({
        type: 'round-start',
        myName: myNameRef.current ?? '',
        payload: {
          kind: payload.kind as VotingKind,
          phase: payload.phase,
          prompt: payload.prompt ?? { title: null, subtitle: null },
          options: payload.options,
          round: payload.round ?? 0,
          totalRounds: payload.totalRounds ?? 0,
          statementBy: payload.statementBy ?? null,
          statement: payload.statement ?? null,
          custom: payload.custom === true,
          endsAt: payload.endsAt,
          suggestions: payload.suggestions,
          statementSource: payload.statementSource ?? 'both',
        },
      });
    };
    const onVoteUpdate = (payload: {
      kind?: string;
      tallies?: VotingTally[];
      totalVotes?: number;
    }) => {
      if (Array.isArray(payload.tallies)) {
        dispatch({
          type: 'vote-update',
          tallies: payload.tallies,
          totalVotes: payload.totalVotes ?? 0,
        });
      }
    };
    const onVoteReveal = (payload: VotingReveal) => {
      if (Array.isArray(payload.tallies) && payload.kind && VOTING_KINDS.includes(payload.kind)) {
        dispatch({ type: 'vote-reveal', reveal: payload });
      }
    };
    const onGameEnd = (payload: Record<string, unknown>) => {
      if (typeof payload.kind === 'string' && VOTING_KINDS.includes(payload.kind as VotingKind)) {
        dispatch({ type: 'game-end', payload });
      }
    };
    const onGameRestart = () => dispatch({ type: 'reset' });
    const onConnect = () => {
      void resync();
    };

    socket.on('connect', onConnect);
    socket.on(ServerEvents.roundStart, onRoundStart);
    socket.on(ServerEvents.voteUpdate, onVoteUpdate);
    socket.on(ServerEvents.voteReveal, onVoteReveal);
    socket.on(ServerEvents.gameEnd, onGameEnd);
    socket.on(ServerEvents.gameRestart, onGameRestart);

    void resync();

    return () => {
      socket.off('connect', onConnect);
      socket.off(ServerEvents.roundStart, onRoundStart);
      socket.off(ServerEvents.voteUpdate, onVoteUpdate);
      socket.off(ServerEvents.voteReveal, onVoteReveal);
      socket.off(ServerEvents.gameEnd, onGameEnd);
      socket.off(ServerEvents.gameRestart, onGameRestart);
      socketRef.current = null;
    };
  }, [roomCode, myName, resync]);

  const castVote = useCallback(
    async (optionId: string): Promise<{ ok: boolean; error?: string }> => {
      const code = roomCodeRef.current;
      if (!code) {
        return { ok: false, error: 'NOT_IN_ROOM' };
      }
      const response = await emitAck(ClientEvents.castVote, { roomCode: code, optionId });
      if (response.ok) {
        dispatch({ type: 'vote-cast', optionId });
      } else if (response.error === 'ALREADY_VOTED') {
        dispatch({ type: 'vote-cast', optionId });
      } else {
        dispatch({ type: 'feedback', text: 'That vote was rejected, try again.' });
      }
      return { ok: response.ok, error: response.error };
    },
    [emitAck]
  );

  const submitDilemma = useCallback(
    async (a: string, b: string): Promise<{ ok: boolean; error?: string }> => {
      const code = roomCodeRef.current;
      if (!code) {
        return { ok: false, error: 'NOT_IN_ROOM' };
      }
      const response = await emitAck(ClientEvents.submitPrompt, { roomCode: code, a, b });
      if (response.ok) {
        dispatch({
          type: 'feedback',
          text: 'Added to the queue, it will appear in a future round.',
        });
      }
      return { ok: response.ok, error: response.error };
    },
    [emitAck]
  );

  const submitStatement = useCallback(
    async (statement: string): Promise<{ ok: boolean; error?: string }> => {
      const code = roomCodeRef.current;
      if (!code) {
        return { ok: false, error: 'NOT_IN_ROOM' };
      }
      const response = await emitAck(ClientEvents.submitPrompt, { roomCode: code, statement });
      if (!response.ok) {
        dispatch({ type: 'feedback', text: 'That statement was rejected, 3-120 characters.' });
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

  const setVotingConfig = useCallback(
    async (config: {
      nhieTier?: string;
      nhieSource?: 'provided' | 'own' | 'both';
      totGenre?: string | null;
    }): Promise<{ ok: boolean; error?: string }> => {
      const code = roomCodeRef.current;
      if (!code) {
        return { ok: false, error: 'NOT_IN_ROOM' };
      }
      const response = await emitAck(ClientEvents.setVotingConfig, { roomCode: code, ...config });
      return { ok: response.ok, error: response.error };
    },
    [emitAck]
  );

  return {
    game,
    actions: {
      castVote,
      submitDilemma,
      submitStatement,
      nextRound,
      restartGame,
      setVotingConfig,
    },
  };
}
