import { Router, type NextFunction, type Request, type Response } from 'express';
import { getPrisma } from '../lib/prisma.js';
import { isRoomCode, validateRoomCreateInput } from '../lib/validation.js';
import { RateLimiter, ipKey } from '../lib/rate-limit.js';
import { createPersistedRoom } from '../lib/room-persistence.js';
import { normalizeRoomCode, type RoomEngine } from '../engine/room-engine.js';

/** PRD §8.1: POST /api/room/create + GET /api/room/:roomCode. */
export function createRoomRouter(engine: RoomEngine, roomCreateLimiter: RateLimiter): Router {
  const router = Router();

  router.post('/room/create', async (req: Request, res: Response, next: NextFunction) => {
    if (!roomCreateLimiter.consume(ipKey(req.ip, 'roomCreate'))) {
      res
        .status(429)
        .json({ error: { code: 'RATE_LIMITED', message: 'Too many requests, try again shortly' } });
      return;
    }
    try {
      const input = validateRoomCreateInput(req.body);
      if (!input.ok) {
        res.status(400).json({ error: { code: 'INVALID_BODY', message: input.error } });
        return;
      }
      const game = await getPrisma().game.findUnique({ where: { slug: input.value.gameId } });
      if (!game) {
        res.status(404).json({ error: { code: 'GAME_NOT_FOUND', message: 'unknown game' } });
        return;
      }
      const created = await createPersistedRoom(engine, input.value.gameId);
      if (!created.ok) {
        res.status(400).json({ error: { code: created.error, message: created.error } });
        return;
      }
      res.status(201).json({
        roomCode: created.room.code,
        gameId: created.room.gameId,
        status: created.room.phase,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/room/:roomCode', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { roomCode } = req.params;
      if (!isRoomCode(roomCode)) {
        res
          .status(400)
          .json({ error: { code: 'INVALID_ROOM_CODE', message: 'invalid room code' } });
        return;
      }
      const live = engine.getRoom(roomCode);
      if (live) {
        res.json({
          code: live.code,
          gameId: live.gameId,
          status: live.phase,
          players: [...live.players.values()].map((player) => player.name),
        });
        return;
      }
      const stored = await getPrisma().room.findUnique({
        where: { code: normalizeRoomCode(roomCode) },
        include: { players: true },
      });
      if (!stored) {
        res.status(404).json({ error: { code: 'ROOM_NOT_FOUND', message: 'room not found' } });
        return;
      }
      res.json({
        code: stored.code,
        gameId: stored.gameId,
        status: stored.status,
        players: stored.players.map((player) => player.playerName),
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
