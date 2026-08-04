import { Router, type NextFunction, type Request, type Response } from 'express';
import { getPrisma } from '../lib/prisma.js';
import { validateScoreInput } from '../lib/validation.js';
import { RateLimiter, ipKey } from '../lib/rate-limit.js';

/** PRD §8.1: POST /api/scores, submit score {gameId, playerName, score}. */
export function createScoresRouter(scoreLimiter: RateLimiter): Router {
  const router = Router();

  router.post('/scores', async (req: Request, res: Response, next: NextFunction) => {
    if (!scoreLimiter.consume(ipKey(req.ip, 'scoreSubmit'))) {
      res
        .status(429)
        .json({ error: { code: 'RATE_LIMITED', message: 'Too many requests, try again shortly' } });
      return;
    }
    try {
      const input = validateScoreInput(req.body);
      if (!input.ok) {
        res.status(400).json({ error: { code: 'INVALID_BODY', message: input.error } });
        return;
      }

      const game = await getPrisma().game.findUnique({ where: { slug: input.value.gameId } });
      if (!game) {
        res.status(404).json({ error: { code: 'GAME_NOT_FOUND', message: 'unknown game' } });
        return;
      }

      // Idempotent retries: the same clientKey returns the original row.
      if (input.value.clientKey) {
        const existing = await getPrisma().score.findUnique({
          where: { clientKey: input.value.clientKey },
        });
        if (existing) {
          res.status(200).json({ score: existing, duplicate: true });
          return;
        }
      }

      const score = await getPrisma().score.create({
        data: {
          gameId: input.value.gameId,
          playerName: input.value.playerName,
          score: input.value.score,
          clientKey: input.value.clientKey,
        },
      });
      res.status(201).json({ score, duplicate: false });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
