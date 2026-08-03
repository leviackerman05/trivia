import { io, type Socket } from 'socket.io-client';
import { SERVER_URL } from './api';

/**
 * Shared Socket.io client singleton for the islands. One connection per page;
 * the useRoom hook attaches/removes its listeners without reconnecting.
 */
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
    });
  }
  return socket;
}
