import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { getSocket } from '../../lib/socket';
import { ClientEvents, ServerEvents } from '../../lib/events';
import type { ChatMessage, RoomState } from '../../lib/room-types';

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

export function useRoom(): UseRoom {
  const [status, setStatus] = useState<RoomStatus>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

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
      appendSystem(response.rejoined ? 'You rejoined the room.' : `${playerName} joined the room.`);
      return { ok: true };
    },
    [appendSystem, emitAck]
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
    };
  }, [appendSystem, joinRoom]);

  return {
    status,
    error,
    room,
    messages,
    myName: nameRef.current,
    actions: { createRoom, joinRoom, leaveRoom, sendMessage, startGame },
  };
}
