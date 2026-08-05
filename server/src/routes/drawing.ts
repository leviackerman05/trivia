import { Router, type NextFunction, type Request, type Response } from 'express';
import { Prisma } from '@prisma/client';
import { getPrisma } from '../lib/prisma.js';
import { config } from '../lib/config.js';
import {
  isDateKey,
  isMemberKey,
  isSubmissionId,
  validateDrawingFlagInput,
  validateDrawingSubmissionInput,
  validateDrawingVoteInput,
} from '../lib/validation.js';
import { RateLimiter, ipKey } from '../lib/rate-limit.js';
import { dateKeyOf, daysBetween } from '../lib/streak-engine.js';

/**
 * M19 drawing gallery (DAILY-DESIGN §5.1): the first server-persisted user
 * content — daily drawing uploads, a top-50 gallery, votes, and flag-based
 * moderation. Uploads are idempotent (one submission per member per UTC
 * day), votes and flags are one per member per submission (DB unique
 * constraints, R1), and the admin delete is gated by ADMIN_TOKEN.
 *
 * All responses use the house error shape { error: { code, message } }.
 * Bodies > 32 KB are handled by the path-scoped 1.5 MB parser registered
 * before the global parser in app.ts (R2).
 */

export interface DrawingSubmissionDto {
  id: string;
  dateKey: string;
  promptIndex: number;
  playerName: string;
  votes: number;
}

function toSubmissionDto(row: {
  id: string;
  dateKey: string;
  promptIndex: number;
  playerName: string;
  votes: number;
}): DrawingSubmissionDto {
  return {
    id: row.id,
    dateKey: row.dateKey,
    promptIndex: row.promptIndex,
    playerName: row.playerName,
    votes: row.votes,
  };
}

/** True when the error is a Prisma unique-constraint violation (P2002). */
function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/** dateKey within server-UTC-today ±1 day (midnight clock-skew tolerance). */
function isWithinDateWindow(dateKey: string, now = new Date()): boolean {
  return Math.abs(daysBetween(dateKey, dateKeyOf(now))) <= 1;
}

/**
 * Cast a vote or flag: insert the row (idempotent via the unique
 * constraint), then re-derive the counter from the rows and sync the
 * denormalized columns on the submission. Returns { inserted, votes,
 * flags, status } where status is the submission status after the write.
 */
async function castVoteOrFlag(
  submissionId: string,
  memberKey: string,
  kind: 'vote' | 'flag',
  reason?: string
): Promise<{ inserted: boolean; votes: number; flagCount: number; status: string }> {
  const prisma = getPrisma();

  let inserted = true;
  try {
    if (kind === 'vote') {
      await prisma.drawingVote.create({ data: { submissionId, memberKey } });
    } else {
      await prisma.drawingFlag.create({ data: { submissionId, memberKey, reason } });
    }
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }
    inserted = false; // one per member per submission; acknowledge idempotently
  }

  const counts = await prisma.$transaction(async (tx) => {
    const [votes, flagCount] = await Promise.all([
      tx.drawingVote.count({ where: { submissionId } }),
      tx.drawingFlag.count({ where: { submissionId } }),
    ]);
    await tx.drawingSubmission.update({
      where: { id: submissionId },
      data: {
        votes,
        flagCount,
        // 3 distinct flags auto-hide (idempotent outcome for concurrent writers).
        ...(kind === 'flag' && flagCount >= 3 ? { status: 'flagged' } : {}),
      },
    });
    return { votes, flagCount };
  });
  const row = await prisma.drawingSubmission.findUnique({
    where: { id: submissionId },
    select: { status: true },
  });
  return { inserted, ...counts, status: row?.status ?? 'removed' };
}

export function createDrawingRouter(limiters: {
  upload: RateLimiter;
  read: RateLimiter;
  vote: RateLimiter;
  flag: RateLimiter;
}): Router {
  const router = Router();

  /**
   * POST /api/drawing/submissions — upload a drawing.
   * 201 created / 200 idempotent replay (same memberKey + dateKey).
   */
  router.post('/submissions', async (req: Request, res: Response, next: NextFunction) => {
    if (!limiters.upload.consume(ipKey(req.ip, 'drawingUpload'))) {
      res
        .status(429)
        .json({ error: { code: 'RATE_LIMITED', message: 'Too many requests, try again shortly' } });
      return;
    }
    try {
      const input = validateDrawingSubmissionInput(req.body);
      if (!input.ok) {
        res.status(400).json({ error: { code: 'INVALID_BODY', message: input.error } });
        return;
      }
      if (!isWithinDateWindow(input.value.dateKey)) {
        res.status(400).json({ error: { code: 'INVALID_DATE', message: 'dateKey out of range' } });
        return;
      }

      const prisma = getPrisma();
      // A fresh device key becomes a member profile on first upload (same
      // upsert shape as routes/daily.ts).
      await prisma.userProfile.upsert({
        where: { memberKey: input.value.memberKey },
        update: { nickname: input.value.playerName, lastSeenAt: new Date() },
        create: { memberKey: input.value.memberKey, nickname: input.value.playerName },
      });

      try {
        const submission = await prisma.drawingSubmission.create({
          data: {
            dateKey: input.value.dateKey,
            promptIndex: input.value.promptIndex,
            memberKey: input.value.memberKey,
            playerName: input.value.playerName,
            image: input.value.image,
          },
        });
        res.status(201).json({ submission: toSubmissionDto(submission) });
      } catch (error) {
        // Idempotent upload: one submission per member per day (D049 pattern).
        if (!isUniqueViolation(error)) {
          throw error;
        }
        const existing = await prisma.drawingSubmission.findUnique({
          where: {
            dateKey_memberKey: { dateKey: input.value.dateKey, memberKey: input.value.memberKey },
          },
        });
        res.status(200).json({ submission: toSubmissionDto(existing!) });
      }
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/drawing/submissions?dateKey=&promptIndex=&memberKey?=
   * Top 50 visible submissions by votes desc, createdAt asc; `mine` and
   * `voted` markers when a memberKey is supplied (one batched EXISTS check).
   */
  router.get('/submissions', async (req: Request, res: Response, next: NextFunction) => {
    if (!limiters.read.consume(ipKey(req.ip, 'drawingRead'))) {
      res
        .status(429)
        .json({ error: { code: 'RATE_LIMITED', message: 'Too many requests, try again shortly' } });
      return;
    }
    try {
      const { dateKey, promptIndex, memberKey } = req.query as Record<string, unknown>;
      if (
        !isDateKey(dateKey) ||
        typeof promptIndex !== 'string' ||
        !/^\d+$/.test(promptIndex) ||
        Number(promptIndex) > 10_000 ||
        (memberKey !== undefined && !isMemberKey(memberKey))
      ) {
        res.status(400).json({ error: { code: 'INVALID_BODY', message: 'invalid query' } });
        return;
      }
      const index = Number(promptIndex);
      const mine = typeof memberKey === 'string' ? memberKey : undefined;

      const prisma = getPrisma();
      const where = { dateKey, promptIndex: index, status: 'visible' as const };
      const [rows, total] = await Promise.all([
        prisma.drawingSubmission.findMany({
          where,
          orderBy: [{ votes: 'desc' }, { createdAt: 'asc' }],
          take: 50,
          select: {
            id: true,
            dateKey: true,
            promptIndex: true,
            playerName: true,
            image: true,
            votes: true,
            memberKey: true,
          },
        }),
        prisma.drawingSubmission.count({ where }),
      ]);

      let votedIds = new Set<string>();
      if (mine) {
        const votes = await prisma.drawingVote.findMany({
          where: { memberKey: mine, submissionId: { in: rows.map((row) => row.id) } },
          select: { submissionId: true },
        });
        votedIds = new Set(votes.map((vote) => vote.submissionId));
      }

      res.json({
        submissions: rows.map((row) => ({
          id: row.id,
          playerName: row.playerName,
          image: row.image,
          votes: row.votes,
          mine: mine !== undefined && row.memberKey === mine,
          voted: mine !== undefined && votedIds.has(row.id),
        })),
        total,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/drawing/submissions/:id/vote — { memberKey }.
   * 201 first vote / 200 duplicate; 409 on own submission.
   */
  router.post('/submissions/:id/vote', async (req: Request, res: Response, next: NextFunction) => {
    if (!limiters.vote.consume(ipKey(req.ip, 'drawingVote'))) {
      res.status(429).json({
        error: { code: 'RATE_LIMITED', message: 'Too many requests, try again shortly' },
      });
      return;
    }
    try {
      const { id } = req.params as { id: string };
      if (!isSubmissionId(id)) {
        res.status(400).json({ error: { code: 'INVALID_BODY', message: 'invalid submission id' } });
        return;
      }
      const input = validateDrawingVoteInput(req.body);
      if (!input.ok) {
        res.status(400).json({ error: { code: 'INVALID_BODY', message: input.error } });
        return;
      }
      const submission = await getPrisma().drawingSubmission.findUnique({
        where: { id },
        select: { memberKey: true, status: true },
      });
      if (!submission || submission.status !== 'visible') {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'submission not found' } });
        return;
      }
      if (submission.memberKey === input.value.memberKey) {
        res
          .status(409)
          .json({ error: { code: 'CONFLICT', message: 'cannot vote on your own submission' } });
        return;
      }
      const result = await castVoteOrFlag(id, input.value.memberKey, 'vote');
      res.status(result.inserted ? 201 : 200).json({
        votes: result.votes,
        duplicate: !result.inserted,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/drawing/submissions/:id/flag — { memberKey, reason? }.
   * 3 distinct flags auto-hide (status: flagged); duplicates idempotent.
   */
  router.post('/submissions/:id/flag', async (req: Request, res: Response, next: NextFunction) => {
    if (!limiters.flag.consume(ipKey(req.ip, 'drawingFlag'))) {
      res.status(429).json({
        error: { code: 'RATE_LIMITED', message: 'Too many requests, try again shortly' },
      });
      return;
    }
    try {
      const { id } = req.params as { id: string };
      if (!isSubmissionId(id)) {
        res.status(400).json({ error: { code: 'INVALID_BODY', message: 'invalid submission id' } });
        return;
      }
      const input = validateDrawingFlagInput(req.body);
      if (!input.ok) {
        res.status(400).json({ error: { code: 'INVALID_BODY', message: input.error } });
        return;
      }
      const submission = await getPrisma().drawingSubmission.findUnique({
        where: { id },
        select: { memberKey: true, status: true },
      });
      if (!submission || submission.status !== 'visible') {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'submission not found' } });
        return;
      }
      if (submission.memberKey === input.value.memberKey) {
        res
          .status(409)
          .json({ error: { code: 'CONFLICT', message: 'cannot flag your own submission' } });
        return;
      }
      const result = await castVoteOrFlag(id, input.value.memberKey, 'flag', input.value.reason);
      res.status(200).json({
        flagged: result.inserted,
        duplicate: !result.inserted,
        hidden: result.flagCount >= 3,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * DELETE /api/drawing/submissions/:id — admin moderation (ADMIN_TOKEN).
   * Sets status: removed; the row (and its votes/flags) stay for audit.
   */
  router.delete('/submissions/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!config.adminToken || req.get('ADMIN_TOKEN') !== config.adminToken) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'admin token required' } });
        return;
      }
      const { id } = req.params as { id: string };
      if (!isSubmissionId(id)) {
        res.status(400).json({ error: { code: 'INVALID_BODY', message: 'invalid submission id' } });
        return;
      }
      const result = await getPrisma().drawingSubmission.updateMany({
        where: { id, status: { not: 'removed' } },
        data: { status: 'removed' },
      });
      if (result.count === 0) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'submission not found' } });
        return;
      }
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
