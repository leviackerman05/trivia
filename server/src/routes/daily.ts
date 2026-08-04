import { Router, type NextFunction, type Request, type Response } from 'express';
import { getPrisma } from '../lib/prisma.js';
import { isLiveDailyGame } from '../lib/daily-games.js';
import { validateDailySubmitInput } from '../lib/validation.js';
import { RateLimiter, ipKey } from '../lib/rate-limit.js';
import { dateKeyOf, nextStreakDay, seasonKeyOf, MAX_FREEZES } from '../lib/streak-engine.js';
import type { MemberStreakDto } from './me.js';

/**
 * Phase 1.5 (D048): daily run submission for members.
 *
 * POST /api/daily/:gameId/submit
 *   { memberKey, playerName, score, clientKey, tier?, durationMs?,
 *     correctCount?, totalCount? }
 *
 * Idempotent (clientKey unique + one run per member per game per day).
 * Guests never call this endpoint; they keep the device-bound streak from
 * the solo engine. The Score table (POST /api/scores) remains the
 * leaderboard source for everyone, this endpoint is the identity layer.
 */

export interface DailySubmitResult {
  accepted: boolean;
  duplicate: boolean;
  member: boolean;
  streaks: MemberStreakDto[] | null;
  streakFreezes: number | null;
  restoreUsedSeason: string | null;
}

export function createDailyRouter(dailyLimiter: RateLimiter): Router {
  const router = Router();

  router.post('/daily/:gameId/submit', async (req: Request, res: Response, next: NextFunction) => {
    if (!dailyLimiter.consume(ipKey(req.ip, 'dailySubmit'))) {
      res
        .status(429)
        .json({ error: { code: 'RATE_LIMITED', message: 'Too many requests, try again shortly' } });
      return;
    }
    try {
      const { gameId } = req.params as { gameId: string };
      if (!isLiveDailyGame(gameId)) {
        res.status(404).json({ error: { code: 'GAME_NOT_FOUND', message: 'unknown daily game' } });
        return;
      }
      const input = validateDailySubmitInput(req.body);
      if (!input.ok) {
        res.status(400).json({ error: { code: 'INVALID_BODY', message: input.error } });
        return;
      }
      if (input.value.gameId !== gameId) {
        res.status(400).json({ error: { code: 'INVALID_BODY', message: 'gameId mismatch' } });
        return;
      }

      const prisma = getPrisma();
      const dateKey = dateKeyOf(new Date());
      const seasonKey = seasonKeyOf(new Date());

      const result = await prisma.$transaction(
        async (
          tx
        ): Promise<{
          run: { id: string };
          duplicate: boolean;
          streaks?: MemberStreakDto[];
          streakFreezes?: number;
          restoreUsedSeason?: string | null;
        }> => {
          // Idempotent by clientKey: a retried request returns the original result.
          const byKey = await tx.dailyRun.findUnique({
            where: { clientKey: input.value.clientKey },
          });
          if (byKey) {
            return { run: byKey, duplicate: true };
          }

          const profile = await tx.userProfile.upsert({
            where: { memberKey: input.value.memberKey },
            update: { nickname: input.value.playerName, lastSeenAt: new Date() },
            create: { memberKey: input.value.memberKey, nickname: input.value.playerName },
          });

          // One run per member per game per day: replays today are acknowledged,
          // not re-scored (the leaderboard race stays first-completion).
          const byDay = await tx.dailyRun.findUnique({
            where: { userId_gameId_dateKey: { userId: profile.id, gameId, dateKey } },
          });
          if (byDay) {
            return { run: byDay, duplicate: true };
          }

          const run = await tx.dailyRun.create({
            data: {
              userId: profile.id,
              gameId,
              dateKey,
              tier: input.value.tier ?? 'normal',
              score: input.value.score,
              durationMs: input.value.durationMs ?? 0,
              correctCount: input.value.correctCount ?? 0,
              totalCount: input.value.totalCount ?? 0,
              clientKey: input.value.clientKey,
            },
          });

          // Streak transitions for the per-game scope and the grand scope, both
          // protected by the same freeze pool and season restore (D048).
          const scopes = [gameId, 'grand'];
          let freezes = profile.streakFreezes;
          let restoreUsedSeason = profile.restoreUsedSeason;
          const streaks: MemberStreakDto[] = [];
          for (const scope of scopes) {
            const row = await tx.dailyStreak.upsert({
              where: { userId_scope: { userId: profile.id, scope } },
              update: {},
              create: { userId: profile.id, scope },
            });
            const result = nextStreakDay({
              state: { current: row.current, longest: row.longest, lastDate: row.lastDate },
              today: dateKey,
              freezes,
              restoreUsed: restoreUsedSeason === seasonKey,
              seasonKey,
            });
            freezes = Math.min(MAX_FREEZES, freezes + result.freezesEarned - result.freezesUsed);
            if (result.restoreUsed) {
              restoreUsedSeason = seasonKey;
            }
            await tx.dailyStreak.update({
              where: { id: row.id },
              data: {
                current: result.state.current,
                longest: result.state.longest,
                lastDate: result.state.lastDate,
              },
            });
            streaks.push({ scope, ...result.state });
          }
          await tx.userProfile.update({
            where: { id: profile.id },
            data: { streakFreezes: freezes, restoreUsedSeason },
          });
          return { run, duplicate: false, streaks, streakFreezes: freezes, restoreUsedSeason };
        }
      );

      res.status(result.duplicate ? 200 : 201).json({
        accepted: true,
        duplicate: result.duplicate,
        member: true,
        streaks: result.streaks ?? null,
        streakFreezes: result.streakFreezes ?? null,
        restoreUsedSeason: result.restoreUsedSeason ?? null,
      } satisfies DailySubmitResult);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
