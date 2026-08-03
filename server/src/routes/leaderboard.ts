import { Router, type NextFunction, type Request, type Response } from 'express';
import { getPrisma } from '../lib/prisma.js';
import { isGameId } from '../lib/validation.js';

/** PRD §8.1: GET /api/leaderboard/:gameId?period=daily|weekly|all-time. */

export const LEADERBOARD_PERIODS = ['daily', 'weekly', 'all-time'] as const;
export type LeaderboardPeriod = (typeof LEADERBOARD_PERIODS)[number];

export const DEFAULT_LEADERBOARD_LIMIT = 10;
export const MAX_LEADERBOARD_LIMIT = 100;

/** Period boundaries in UTC. Daily = UTC day; weekly = UTC week starting Monday. */
export function periodStart(period: LeaderboardPeriod, now = new Date()): Date {
  if (period === 'all-time') {
    return new Date(0);
  }
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (period === 'daily') {
    return start;
  }
  const daysSinceMonday = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);
  return start;
}

export function createLeaderboardRouter(): Router {
  const router = Router();

  router.get('/leaderboard/:gameId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { gameId } = req.params;
      if (!isGameId(gameId)) {
        res.status(400).json({ error: { code: 'INVALID_GAME_ID', message: 'invalid gameId' } });
        return;
      }

      const periodParam = typeof req.query.period === 'string' ? req.query.period : 'all-time';
      const period: LeaderboardPeriod = LEADERBOARD_PERIODS.includes(
        periodParam as LeaderboardPeriod
      )
        ? (periodParam as LeaderboardPeriod)
        : 'all-time';

      const parsedLimit = Number.parseInt(
        String(req.query.limit ?? String(DEFAULT_LEADERBOARD_LIMIT)),
        10
      );
      const limit = Number.isFinite(parsedLimit)
        ? Math.min(Math.max(parsedLimit, 1), MAX_LEADERBOARD_LIMIT)
        : DEFAULT_LEADERBOARD_LIMIT;

      const game = await getPrisma().game.findUnique({ where: { slug: gameId } });
      if (!game) {
        res.status(404).json({ error: { code: 'GAME_NOT_FOUND', message: 'unknown game' } });
        return;
      }

      const since = periodStart(period);
      const rows = await getPrisma().score.findMany({
        where: { gameId, playedAt: { gte: since } },
        orderBy: [{ score: 'desc' }, { playedAt: 'asc' }],
        take: limit,
      });

      res.json({
        gameId,
        period,
        entries: rows.map((row, index) => ({
          rank: index + 1,
          playerName: row.playerName,
          score: row.score,
          playedAt: row.playedAt,
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
