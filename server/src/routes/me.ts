import { Router, type NextFunction, type Request, type Response } from 'express';
import { getPrisma } from '../lib/prisma.js';
import { isMemberKey, validateClaimInput } from '../lib/validation.js';
import { RateLimiter, ipKey } from '../lib/rate-limit.js';
import { dateKeyOf } from '../lib/streak-engine.js';

/**
 * Phase 1.5 (D047): account-lite member identity.
 *
 * POST /api/me/claim   { memberKey, nickname? }  one-tap guest -> member
 * GET  /api/me?memberKey=...                     profile + streaks + bests
 *
 * A member is a browser with a device-generated opaque memberKey. There are
 * no passwords and no email collection; membership is the retention layer,
 * not an auth wall. The claim endpoint is idempotent (upsert by memberKey).
 */

export interface MemberProfileDto {
  nickname: string;
  xp: number;
  level: number;
  streakFreezes: number;
  restoreUsedSeason: string | null;
  createdAt: string;
}

export interface MemberStreakDto {
  scope: string;
  current: number;
  longest: number;
  lastDate: string;
}

export interface MemberRunDto {
  gameId: string;
  dateKey: string;
  score: number;
}

export interface MemberPersonalBestDto {
  gameId: string;
  bestScore: number;
  plays: number;
}

export interface MemberMeDto {
  profile: MemberProfileDto;
  streaks: MemberStreakDto[];
  personalBests: MemberPersonalBestDto[];
  recentRuns: MemberRunDto[];
}

function toProfileDto(profile: {
  nickname: string;
  xp: number;
  level: number;
  streakFreezes: number;
  restoreUsedSeason: string | null;
  createdAt: Date;
}): MemberProfileDto {
  return {
    nickname: profile.nickname,
    xp: profile.xp,
    level: profile.level,
    streakFreezes: profile.streakFreezes,
    restoreUsedSeason: profile.restoreUsedSeason,
    createdAt: profile.createdAt.toISOString(),
  };
}

/** GET /api/me: full member read-model for the daily hub and archive. */
async function loadMemberMe(memberKey: string): Promise<MemberMeDto | null> {
  const prisma = getPrisma();
  const profile = await prisma.userProfile.findUnique({ where: { memberKey } });
  if (!profile) {
    return null;
  }
  const [streaks, recentRuns, bestRows] = await Promise.all([
    prisma.dailyStreak.findMany({ where: { userId: profile.id } }),
    prisma.dailyRun.findMany({
      where: {
        userId: profile.id,
        dateKey: { gte: dateKeyOf(new Date(Date.now() - 90 * 86_400_000)) },
      },
      orderBy: { dateKey: 'desc' },
      take: 200,
      select: { gameId: true, dateKey: true, score: true },
    }),
    prisma.dailyRun.groupBy({
      by: ['gameId'],
      where: { userId: profile.id },
      _max: { score: true },
      _count: { _all: true },
    }),
  ]);
  return {
    profile: toProfileDto(profile),
    streaks: streaks.map((streak) => ({
      scope: streak.scope,
      current: streak.current,
      longest: streak.longest,
      lastDate: streak.lastDate,
    })),
    recentRuns: recentRuns.map((run) => ({
      gameId: run.gameId,
      dateKey: run.dateKey,
      score: run.score,
    })),
    personalBests: bestRows.map((row) => ({
      gameId: row.gameId,
      bestScore: row._max.score ?? 0,
      plays: row._count._all,
    })),
  };
}

export function createMeRouter(claimLimiter: RateLimiter): Router {
  const router = Router();

  router.post('/me/claim', async (req: Request, res: Response, next: NextFunction) => {
    if (!claimLimiter.consume(ipKey(req.ip, 'memberClaim'))) {
      res
        .status(429)
        .json({ error: { code: 'RATE_LIMITED', message: 'Too many requests, try again shortly' } });
      return;
    }
    try {
      const input = validateClaimInput(req.body);
      if (!input.ok) {
        res.status(400).json({ error: { code: 'INVALID_BODY', message: input.error } });
        return;
      }
      const profile = await getPrisma().userProfile.upsert({
        where: { memberKey: input.value.memberKey },
        update: {
          nickname: input.value.nickname,
          lastSeenAt: new Date(),
        },
        create: {
          memberKey: input.value.memberKey,
          nickname: input.value.nickname ?? 'Player',
        },
      });
      res.status(200).json({ profile: toProfileDto(profile) });
    } catch (error) {
      next(error);
    }
  });

  router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const memberKey = req.query.memberKey;
      if (!isMemberKey(memberKey)) {
        res.status(400).json({ error: { code: 'INVALID_BODY', message: 'invalid memberKey' } });
        return;
      }
      const me = await loadMemberMe(memberKey);
      if (!me) {
        res.status(404).json({ error: { code: 'MEMBER_NOT_FOUND', message: 'member not found' } });
        return;
      }
      res.json(me);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
