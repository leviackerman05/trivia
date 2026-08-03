import { Router, type NextFunction, type Request, type Response } from 'express';
import { getPrisma } from '../lib/prisma.js';

/** PRD §8.1: GET /api/daily-challenge — today's daily challenge per solo game. */

const DAY_MS = 86_400_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function createDailyChallengeRouter(): Router {
  const router = Router();

  router.get('/daily-challenge', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dateParam =
        typeof req.query.date === 'string' && DATE_RE.test(req.query.date)
          ? req.query.date
          : undefined;
      const date = dateParam ?? new Date().toISOString().slice(0, 10); // UTC day
      const start = new Date(`${date}T00:00:00.000Z`);
      const end = new Date(start.getTime() + DAY_MS);

      const rows = await getPrisma().dailyChallenge.findMany({
        where: { date: { gte: start, lt: end } },
      });

      res.json({
        date,
        challenges: rows.map((row) => ({ gameId: row.gameId, data: row.data })),
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
