/**
 * Client-side mirror of the server's public room state
 * (server/src/engine/room-engine.ts → toPublicState).
 */

export type RoomPhase = 'lobby' | 'game-setup' | 'in-progress' | 'results';

export interface RoomPlayer {
  name: string;
  isHost: boolean;
  connected: boolean;
}

export interface RoomState {
  code: string;
  gameId: string;
  phase: RoomPhase;
  players: RoomPlayer[];
  hostName: string | null;
}

export interface ChatMessage {
  kind: 'message' | 'system';
  playerName: string;
  message: string;
  at: number;
}
