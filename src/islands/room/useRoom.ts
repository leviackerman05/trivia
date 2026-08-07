import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { getSocket } from '../../lib/socket';
import { ClientEvents, ServerEvents } from '../../lib/events';
import type { ChatMessage, RoomState } from '../../lib/room-types';
import {
  clearActiveRoom,
  getActiveRoom,
  isRejoinCandidate,
  isRejoinEviction,
  saveActiveRoom,
} from '../../lib/room-storage';

export type RoomStatus = 'connecting' | 'connected' | 'disconnected';

interface AckResponse {
  ok: boolean;
  error?: string;
  message?: string;
  roomCode?: string;
  state?: RoomState;
  rejoined?: boolean;
}

export interface UseRoom {
  status: RoomStatus;
  error: string | null;
  room: RoomState | null;
  messages: ChatMessage[];
  /** The nickname this client joined with (null before joining). */
  myName: string | null;
  /** True while an automatic rejoin attempt is in flight (no lobby flicker). */
  rejoining: boolean;
  actions: {
    createRoom: (gameId: string, playerName: string) => Promise<{ ok: boolean; error?: string }>;
    joinRoom: (roomCode: string, playerName: string) => Promise<{ ok: boolean; error?: string }>;
    leaveRoom: () => void;
    sendMessage: (message: string) => Promise<{ ok: boolean; error?: string }>;
    startGame: () => Promise<{ ok: boolean; error?: string }>;
  };
}

const MAX_MESSAGES = 200;
const ACK_TIMEOUT_MS = 5000;

function ackErrorText(error: string | undefined): string {
  switch (error) {
    case 'ROOM_NOT_FOUND':
      return 'Room not found, check the code.';
    case 'ROOM_FULL':
      return 'Room is full.';
    case 'NICKNAME_TAKEN':
      return 'That nickname is already taken in this room.';
    case 'NOT_HOST':
      return 'Only the host can do that.';
    case 'RATE_LIMITED':
      return 'Too many requests, try again in a moment.';
    case 'GAME_NOT_FOUND':
      return 'That game is not available.';
    case 'GAME_NOT_PLAYABLE_YET':
      return "This game's playable rounds arrive in a later milestone, Skribbl Arena is live today!";
    case 'NOT_ENOUGH_PLAYERS':
      return 'Not enough players, invite a friend or open a second window.';
    case 'INVALID_PAYLOAD':
      return 'Check your input and try again.';
    case 'TIMEOUT':
      return 'No response from the server, try again.';
    default:
      return error ?? 'Something went wrong.';
  }
}

export function useRoom(gameSlug?: string): UseRoom {
  const [status, setStatus] = useState<RoomStatus>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [rejoining, setRejoining] = useState(false);

  // The socket is a client-only singleton; created in the effect below.
  const socketRef = useRef<Socket | null>(null);
  const roomRef = useRef<RoomState | null>(null);
  const nameRef = useRef<string | null>(null);

  const appendSystem = useCallback((message: string) => {
    const entry: ChatMessage = { kind: 'system', playerName: 'System', message, at: Date.now() };
    setMessages((prev) => [...prev, entry].slice(-MAX_MESSAGES));
  }, []);

  const emitAck = useCallback(
    (event: string, payload: unknown): Promise<AckResponse> =>
      new Promise((resolve) => {
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
      }),
    []
  );

  const joinRoom = useCallback(
    async (roomCode: string, playerName: string): Promise<{ ok: boolean; error?: string }> => {
      const response = await emitAck(ClientEvents.joinRoom, { roomCode, playerName });
      if (!response.ok) {
        setError(ackErrorText(response.error));
        return { ok: false, error: response.error };
      }
      setError(null);
      setRoom(response.state ?? null);
      roomRef.current = response.state ?? null;
      nameRef.current = playerName;
      // Persistent membership: remember the seat so refresh/navigation can
      // rejoin it (only when the hook knows which game it is).
      if (gameSlug) {
        saveActiveRoom({ roomCode, playerName, gameSlug });
      }
      appendSystem(response.rejoined ? 'You rejoined the room.' : `${playerName} joined the room.`);
      return { ok: true };
    },
    [appendSystem, emitAck, gameSlug]
  );

  const createRoom = useCallback(
    async (gameId: string, playerName: string): Promise<{ ok: boolean; error?: string }> => {
      const response = await emitAck(ClientEvents.createRoom, { gameId });
      if (!response.ok || !response.roomCode) {
        setError(ackErrorText(response.error));
        return { ok: false, error: response.error };
      }
      return joinRoom(response.roomCode, playerName);
    },
    [emitAck, joinRoom]
  );

  const leaveRoom = useCallback(() => {
    if (roomRef.current) {
      void emitAck(ClientEvents.leaveRoom, { roomCode: roomRef.current.code });
    }
    // Explicit leave: the seat is gone, forget the stored room.
    clearActiveRoom();
    setRoom(null);
    roomRef.current = null;
    nameRef.current = null;
    setMessages([]);
    setError(null);
  }, [emitAck]);

  const sendMessage = useCallback(
    async (message: string): Promise<{ ok: boolean; error?: string }> => {
      const trimmed = message.trim();
      if (!trimmed) {
        return { ok: false };
      }
      const response = await emitAck(ClientEvents.chatMessage, { message: trimmed });
      if (!response.ok) {
        setError(ackErrorText(response.error));
      }
      return { ok: response.ok, error: response.error };
    },
    [emitAck]
  );

  const startGame = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    const current = roomRef.current;
    if (!current) {
      return { ok: false, error: 'NOT_IN_ROOM' };
    }
    const response = await emitAck(ClientEvents.startGame, { roomCode: current.code });
    if (!response.ok) {
      setError(ackErrorText(response.error));
    }
    return { ok: response.ok, error: response.error };
  }, [emitAck]);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    const onConnect = () => {
      setStatus('connected');
      // Rejoin the room after a reconnect (seat is kept server-side).
      if (roomRef.current && nameRef.current) {
        void joinRoom(roomRef.current.code, nameRef.current);
      }
    };
    const onDisconnect = () => setStatus('disconnected');
    const onConnectError = () => setStatus('disconnected');

    const onState = (state: RoomState) => {
      setRoom(state);
      roomRef.current = state;
    };
    const onChat = (message: ChatMessage) => {
      setMessages((prev) => [...prev, message].slice(-MAX_MESSAGES));
    };
    const onPlayerLeft = (payload: { playerName: string }) => {
      appendSystem(`${payload.playerName} left the room.`);
    };
    const onPlayerDisconnected = (payload: { playerName: string }) => {
      appendSystem(`${payload.playerName} disconnected.`);
    };
    const onPlayerReconnected = (payload: { playerName: string }) => {
      appendSystem(`${payload.playerName} rejoined.`);
    };
    const onHostChanged = (payload: { hostName: string }) => {
      appendSystem(`${payload.hostName} is now the host.`);
    };
    const onGameError = (payload: { code?: string; message?: string }) => {
      setError(payload.message ?? payload.code ?? 'Game error');
    };
    // BFCache: navigating away can freeze this page with its socket still
    // "connected" server-side, which would make a rejoin on return fail with
    // NICKNAME_TAKEN. Free the seat on pagehide (the server keeps it, just
    // disconnected) and reconnect on a BFCache restore — the existing
    // onConnect handler then rejoins and resyncs.
    const onPageHide = () => {
      socket.disconnect();
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        socket.connect();
      }
    };
    const onRoomClosed = () => {
      // Defensive: if the server ever reports the room closing while we are
      // inside, forget the seat (the room no longer exists to rejoin).
      clearActiveRoom();
      setRoom(null);
      roomRef.current = null;
      nameRef.current = null;
      setMessages([]);
      setError(null);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on(ServerEvents.gameStateUpdate, onState);
    socket.on(ServerEvents.chatMessage, onChat);
    socket.on(ServerEvents.playerLeft, onPlayerLeft);
    socket.on(ServerEvents.playerDisconnected, onPlayerDisconnected);
    socket.on(ServerEvents.playerReconnected, onPlayerReconnected);
    socket.on(ServerEvents.hostChanged, onHostChanged);
    socket.on(ServerEvents.gameError, onGameError);
    socket.on(ServerEvents.roomClosed, onRoomClosed);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);

    if (socket.connected) {
      setStatus('connected');
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off(ServerEvents.gameStateUpdate, onState);
      socket.off(ServerEvents.chatMessage, onChat);
      socket.off(ServerEvents.playerLeft, onPlayerLeft);
      socket.off(ServerEvents.playerDisconnected, onPlayerDisconnected);
      socket.off(ServerEvents.playerReconnected, onPlayerReconnected);
      socket.off(ServerEvents.hostChanged, onHostChanged);
      socket.off(ServerEvents.gameError, onGameError);
      socket.off(ServerEvents.roomClosed, onRoomClosed);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [appendSystem, joinRoom]);

  // Automatic rejoin (persistent room membership): on mount, BEFORE the
  // lobby renders, reclaim the stored seat when the game matches. The
  // socket.io emit is buffered while connecting, so this works even when
  // the socket is still handshaking. Eviction (room deleted / name taken
  // by a connected player) clears the stored room and shows the lobby.
  useEffect(() => {
    const stored = getActiveRoom();
    if (!stored || !isRejoinCandidate(stored, gameSlug) || roomRef.current) {
      return;
    }
    let cancelled = false;
    setRejoining(true);
    void joinRoom(stored.roomCode, stored.playerName).then((result) => {
      if (cancelled) {
        return;
      }
      setRejoining(false);
      if (!result.ok && isRejoinEviction(result.error)) {
        clearActiveRoom();
        // The stale error text describes the old room; the lobby starts fresh.
        setError(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [gameSlug, joinRoom]);

  return {
    status,
    error,
    room,
    messages,
    myName: nameRef.current,
    rejoining,
    actions: { createRoom, joinRoom, leaveRoom, sendMessage, startGame },
  };
}
