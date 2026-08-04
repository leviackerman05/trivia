import { getPrisma } from './prisma.js';
import { logger } from './logger.js';
import type { RoomEngine, RoomState } from '../engine/room-engine.js';

/**
 * Best-effort room persistence (Room/RoomPlayer rows, PRD §8.3).
 * The in-memory engine is the source of truth for live gameplay; DB writes
 * must never block or break a game, failures are logged, not thrown.
 */

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002'
  );
}

async function findRoomRow(roomCode: string) {
  return getPrisma().room.findUnique({ where: { code: roomCode } });
}

/**
 * Create a room in the engine and persist its metadata row. Retries with a
 * fresh code if the generated code collides with an existing DB row (e.g.,
 * after a server restart cleared the engine map).
 */
export async function createPersistedRoom(
  engine: RoomEngine,
  gameId: string
): Promise<{ ok: true; room: RoomState } | { ok: false; error: string }> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const created = await engine.createRoom(gameId);
    if (!created.ok) {
      return { ok: false, error: created.error };
    }
    try {
      await getPrisma().room.create({
        data: { code: created.value.code, gameId: created.value.gameId },
      });
      return { ok: true, room: created.value };
    } catch (error) {
      if (isUniqueViolation(error)) {
        engine.removeRoom(created.value.code);
        continue;
      }
      throw error;
    }
  }
  return { ok: false, error: 'ROOM_CREATE_FAILED' };
}

export async function upsertRoomPlayer(roomCode: string, playerName: string): Promise<void> {
  const room = await findRoomRow(roomCode);
  if (!room) {
    return;
  }
  await getPrisma().roomPlayer.upsert({
    where: { roomId_playerName: { roomId: room.id, playerName } },
    create: { roomId: room.id, playerName },
    update: {},
  });
}

export async function deleteRoomPlayer(roomCode: string, playerName: string): Promise<void> {
  const room = await findRoomRow(roomCode);
  if (!room) {
    return;
  }
  await getPrisma().roomPlayer.deleteMany({ where: { roomId: room.id, playerName } });
}

export async function setRoomStatus(roomCode: string, status: string): Promise<void> {
  await getPrisma().room.updateMany({ where: { code: roomCode }, data: { status } });
}

/** Best-effort wrapper: run a persistence call without breaking gameplay. */
export function persistBestEffort<T>(operation: Promise<T>, context: string): void {
  operation.catch((error: unknown) => {
    logger.warn({ context, error }, 'persistence failed (best-effort)');
  });
}
