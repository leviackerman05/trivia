import { randomInt } from 'node:crypto';

/**
 * Room Engine — the generic state machine powering all 12 multiplayer games
 * (PRD §4.1). Transport-agnostic: no Socket.io/Express types here, so it is
 * unit-testable in isolation. The socket gateway (socket/index.ts) is the
 * thin adapter on top.
 *
 * State machine: lobby → game-setup → in-progress → results → lobby.
 * Server-authoritative: timers, phases, and host assignment live here.
 */

export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
export const ROOM_CODE_LENGTH = 6;
export const DEFAULT_MAX_PLAYERS = 24;
export const ROOM_GRACE_MS = 10 * 60_000; // empty rooms are evicted after this

export type RoomPhase = 'lobby' | 'game-setup' | 'in-progress' | 'results';

export type RoomError =
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'NICKNAME_TAKEN'
  | 'NOT_IN_ROOM'
  | 'NOT_HOST'
  | 'INVALID_PHASE'
  | 'GAME_NOT_FOUND'
  | 'INVALID_GAME_ID';

export type RoomResult<T = RoomState> = { ok: true; value: T } | { ok: false; error: RoomError };

export interface RoomPlayer {
  socketId: string;
  name: string;
  isHost: boolean;
  connected: boolean;
  joinedAt: number;
}

export interface RoomState {
  code: string;
  gameId: string;
  phase: RoomPhase;
  createdAt: number;
  players: Map<string, RoomPlayer>; // keyed by socketId
}

export interface PublicPlayer {
  name: string;
  isHost: boolean;
  connected: boolean;
}

export interface PublicRoomState {
  code: string;
  gameId: string;
  phase: RoomPhase;
  players: PublicPlayer[];
  hostName: string | null;
}

/** lobby → game-setup → in-progress → results → lobby (PRD §4.1) */
const VALID_TRANSITIONS: Record<RoomPhase, RoomPhase[]> = {
  lobby: ['game-setup'],
  'game-setup': ['in-progress'],
  'in-progress': ['results'],
  results: ['lobby'],
};

export interface RoomEngineOptions {
  maxPlayers?: number;
  /** Injectable RNG for deterministic room-code tests. */
  randomInt?: (max: number) => number;
  /** Validates that a gameId exists in the catalog. */
  gameExists?: (gameId: string) => boolean | Promise<boolean>;
}

export function normalizeRoomCode(code: string): string {
  return code.trim().toUpperCase();
}

export class RoomEngine {
  private readonly rooms = new Map<string, RoomState>();
  private readonly maxPlayers: number;
  private readonly randomIntFn: (max: number) => number;
  private readonly gameExistsFn: (gameId: string) => boolean | Promise<boolean>;

  constructor(options: RoomEngineOptions = {}) {
    this.maxPlayers = options.maxPlayers ?? DEFAULT_MAX_PLAYERS;
    this.randomIntFn = options.randomInt ?? ((max) => randomInt(max));
    this.gameExistsFn = options.gameExists ?? (() => true);
  }

  get roomCount(): number {
    return this.rooms.size;
  }

  generateRoomCode(): string {
    let code: string;
    do {
      code = Array.from({ length: ROOM_CODE_LENGTH }, () => {
        const index = this.randomIntFn(ROOM_CODE_ALPHABET.length);
        return ROOM_CODE_ALPHABET[index]!;
      }).join('');
    } while (this.rooms.has(code));
    return code;
  }

  async createRoom(gameId: string): Promise<RoomResult<RoomState>> {
    if (typeof gameId !== 'string' || gameId.length === 0 || gameId.length > 64) {
      return { ok: false, error: 'INVALID_GAME_ID' };
    }
    if (!(await this.gameExistsFn(gameId))) {
      return { ok: false, error: 'GAME_NOT_FOUND' };
    }
    const room: RoomState = {
      code: this.generateRoomCode(),
      gameId,
      phase: 'lobby',
      createdAt: Date.now(),
      players: new Map(),
    };
    this.rooms.set(room.code, room);
    return { ok: true, value: room };
  }

  getRoom(code: string): RoomState | undefined {
    return this.rooms.get(normalizeRoomCode(code));
  }

  /** All room codes a socket is currently part of. */
  roomsOfSocket(socketId: string): RoomState[] {
    const rooms: RoomState[] = [];
    for (const room of this.rooms.values()) {
      if (room.players.has(socketId)) {
        rooms.push(room);
      }
    }
    return rooms;
  }

  /**
   * Join (or rejoin) a room. The first player becomes host. A player who
   * disconnected keeps their seat and can reclaim it by rejoining with the
   * same name (PRD §4.1: join, leave, rejoin).
   */
  joinRoom(
    code: string,
    socketId: string,
    name: string
  ): RoomResult<{ room: RoomState; player: RoomPlayer; rejoined: boolean }> {
    const room = this.getRoom(code);
    if (!room) {
      return { ok: false, error: 'ROOM_NOT_FOUND' };
    }

    const existing = [...room.players.values()].find(
      (player) => player.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) {
      if (existing.connected) {
        return { ok: false, error: 'NICKNAME_TAKEN' };
      }
      // Rejoin: reclaim the seat, keep host status.
      room.players.delete(existing.socketId);
      existing.socketId = socketId;
      existing.connected = true;
      room.players.set(socketId, existing);
      return { ok: true, value: { room, player: existing, rejoined: true } };
    }

    if (room.players.size >= this.maxPlayers) {
      return { ok: false, error: 'ROOM_FULL' };
    }

    const player: RoomPlayer = {
      socketId,
      name,
      isHost: room.players.size === 0,
      connected: true,
      joinedAt: Date.now(),
    };
    room.players.set(socketId, player);
    return { ok: true, value: { room, player, rejoined: false } };
  }

  /**
   * Explicit leave (PRD §4.1). Migrates host to the first remaining player.
   * Returns whether the room became empty (gateway schedules eviction).
   */
  leaveRoom(
    code: string,
    socketId: string
  ): RoomResult<{ room: RoomState; becameEmpty: boolean; newHostName: string | null }> {
    const room = this.getRoom(code);
    if (!room) {
      return { ok: false, error: 'ROOM_NOT_FOUND' };
    }
    const player = room.players.get(socketId);
    if (!player) {
      return { ok: false, error: 'NOT_IN_ROOM' };
    }
    room.players.delete(socketId);

    const becameEmpty = room.players.size === 0;
    const newHostName = this.migrateHostIfNeeded(room);
    return { ok: true, value: { room, becameEmpty, newHostName } };
  }

  /** Socket disconnect: mark absent but keep the seat (rejoin path). */
  markDisconnected(
    code: string,
    socketId: string
  ): RoomResult<{ room: RoomState; hostChangedTo: string | null }> {
    const room = this.getRoom(code);
    if (!room) {
      return { ok: false, error: 'ROOM_NOT_FOUND' };
    }
    const player = room.players.get(socketId);
    if (!player) {
      return { ok: false, error: 'NOT_IN_ROOM' };
    }
    player.connected = false;
    // Host keeps their seat but loses host status on disconnect.
    player.isHost = false;
    const hostChangedTo = this.migrateHostIfNeeded(room);
    return { ok: true, value: { room, hostChangedTo } };
  }

  /** Host-only: start the game (lobby → game-setup). */
  startGame(code: string, socketId: string): RoomResult<RoomState> {
    const room = this.getRoom(code);
    if (!room) {
      return { ok: false, error: 'ROOM_NOT_FOUND' };
    }
    const player = room.players.get(socketId);
    if (!player) {
      return { ok: false, error: 'NOT_IN_ROOM' };
    }
    if (!player.isHost) {
      return { ok: false, error: 'NOT_HOST' };
    }
    return this.transition(room, 'game-setup');
  }

  /** Generic transition with the PRD §4.1 guard map (used by future adapters). */
  transition(room: RoomState, to: RoomPhase): RoomResult<RoomState> {
    const allowed = VALID_TRANSITIONS[room.phase];
    if (!allowed.includes(to)) {
      return { ok: false, error: 'INVALID_PHASE' };
    }
    room.phase = to;
    return { ok: true, value: room };
  }

  /** Remove rooms that have been empty past the grace period. */
  evictExpired(now = Date.now()): RoomState[] {
    const evicted: RoomState[] = [];
    for (const room of this.rooms.values()) {
      if (room.players.size === 0 && now - room.createdAt > ROOM_GRACE_MS) {
        this.rooms.delete(room.code);
        evicted.push(room);
      }
    }
    return evicted;
  }

  /** Force-remove a room (e.g., DB code collision on create). */
  removeRoom(code: string): boolean {
    return this.rooms.delete(normalizeRoomCode(code));
  }

  /** Public, serializable view of a room for clients. */
  toPublicState(room: RoomState): PublicRoomState {
    const players = [...room.players.values()]
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((player) => ({
        name: player.name,
        isHost: player.isHost,
        connected: player.connected,
      }));
    const host = players.find((player) => player.isHost);
    return {
      code: room.code,
      gameId: room.gameId,
      phase: room.phase,
      players,
      hostName: host?.name ?? null,
    };
  }

  private migrateHostIfNeeded(room: RoomState): string | null {
    const host = [...room.players.values()].find((player) => player.isHost);
    if (host) {
      return null;
    }
    const ordered = [...room.players.values()].sort((a, b) => a.joinedAt - b.joinedAt);
    const next = ordered.find((player) => player.connected) ?? ordered[0];
    if (!next) {
      return null;
    }
    next.isHost = true;
    return next.name;
  }
}
