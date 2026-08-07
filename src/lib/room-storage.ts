/**
 * Persistent room membership (owner 2026-08-07): the room this player last
 * joined, kept in localStorage so a refresh, tab-switch, or navigation can
 * rejoin the SAME seat without showing the create/join lobby. The server
 * already reclaims a disconnected player's seat by name (room-engine
 * joinRoom), so the client only needs to remember code + name + game.
 *
 * Cleared on explicit leave or on eviction (ROOM_NOT_FOUND / NICKNAME_TAKEN
 * during a rejoin attempt). Keys use the triviahub:* convention (D1).
 */

export interface ActiveRoom {
  roomCode: string;
  playerName: string;
  gameSlug: string;
  joinedAt: number;
}

const ACTIVE_ROOM_KEY = 'triviahub:active-room:v1';

/** Persist the room after a successful join/create ack. */
export function saveActiveRoom(room: {
  roomCode: string;
  playerName: string;
  gameSlug: string;
}): void {
  if (typeof window === 'undefined') {
    return;
  }
  const entry: ActiveRoom = { ...room, joinedAt: Date.now() };
  try {
    localStorage.setItem(ACTIVE_ROOM_KEY, JSON.stringify(entry));
  } catch {
    // Storage blocked: membership is best-effort (the session still works).
  }
}

/** Forget the room (explicit leave or eviction). */
export function clearActiveRoom(): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    localStorage.removeItem(ACTIVE_ROOM_KEY);
  } catch {
    // Storage blocked: nothing to clear.
  }
}

/** Read the stored room, or null when absent/malformed. */
export function getActiveRoom(): ActiveRoom | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = localStorage.getItem(ACTIVE_ROOM_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<ActiveRoom>;
    if (
      typeof parsed.roomCode !== 'string' ||
      parsed.roomCode.length === 0 ||
      typeof parsed.playerName !== 'string' ||
      parsed.playerName.length === 0 ||
      typeof parsed.gameSlug !== 'string' ||
      parsed.gameSlug.length === 0
    ) {
      return null;
    }
    return {
      roomCode: parsed.roomCode,
      playerName: parsed.playerName,
      gameSlug: parsed.gameSlug,
      joinedAt: typeof parsed.joinedAt === 'number' ? parsed.joinedAt : 0,
    };
  } catch {
    return null;
  }
}

/* ── Pure rejoin decisions (unit-tested; the hook wires them to the socket) ── */

/**
 * Should the hook attempt an automatic rejoin? Only when a stored room
 * exists AND the current game page matches it. A stored room from another
 * game is ignored (never auto-join the wrong game's room).
 */
export function isRejoinCandidate(
  stored: ActiveRoom | null,
  gameSlug: string | undefined
): boolean {
  return stored !== null && typeof gameSlug === 'string' && stored.gameSlug === gameSlug;
}

/**
 * Rejoin failures that mean the seat is gone for good: the room was
 * deleted (ROOM_NOT_FOUND) or a connected player holds the name
 * (NICKNAME_TAKEN). Both clear the stored room so the lobby shows fresh.
 * Transient errors (NOT_CONNECTED, TIMEOUT, RATE_LIMITED) keep the entry.
 */
export function isRejoinEviction(error: string | undefined): boolean {
  return error === 'ROOM_NOT_FOUND' || error === 'NICKNAME_TAKEN';
}
