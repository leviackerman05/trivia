import { Router } from 'express';
import { createScoresRouter } from './scores.js';
import { createLeaderboardRouter } from './leaderboard.js';
import { createDailyChallengeRouter } from './daily-challenge.js';
import { createRoomRouter } from './room.js';
import { createMeRouter } from './me.js';
import { createDailyRouter } from './daily.js';
import type { Limiters } from '../lib/rate-limit.js';
import type { RoomEngine } from '../engine/room-engine.js';

export interface ApiDeps {
  engine: RoomEngine;
  limiters: Limiters;
}

export function createApiRouter(deps: ApiDeps): Router {
  const router = Router();
  router.use(createScoresRouter(deps.limiters.scoreSubmit));
  router.use(createLeaderboardRouter());
  router.use(createDailyChallengeRouter());
  router.use(createRoomRouter(deps.engine, deps.limiters.roomCreate));
  // Phase 1.5: account-lite identity + server streaks (D047/D048).
  router.use(createMeRouter(deps.limiters.memberClaim));
  router.use(createDailyRouter(deps.limiters.dailySubmit));

  // JSON 404 for unknown API endpoints.
  router.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'endpoint not found' } });
  });

  return router;
}
