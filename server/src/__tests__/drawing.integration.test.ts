import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createDefaultLimiters, RateLimiter } from '../lib/rate-limit.js';
import { getPrisma } from '../lib/prisma.js';
import { dateKeyOf } from '../lib/streak-engine.js';
import { resetTestData, setupTestDb, teardownTestDb } from './helpers/db.js';

// config.ts reads ADMIN_TOKEN at module load; set it before the app module
// graph is evaluated so the admin-delete gate can be exercised end to end.
process.env.ADMIN_TOKEN = 'test-admin-token';
const { createApp } = await import('../app.js');

// The upload suite exercises >10 uploads on the shared app, so the shared
// app uses a raised upload cap; the 429 path is covered by small-limiter
// apps below (house pattern).
const app = createApp({
  limiters: { ...createDefaultLimiters(), drawingUpload: new RateLimiter(60_000, 100) },
});

/** 1x1 transparent PNG data URL (valid PNG signature, ~70 bytes decoded). */
const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const DAY_MS = 86_400_000;
const today = dateKeyOf(new Date());
const yesterday = dateKeyOf(new Date(Date.now() - DAY_MS));
const twoDaysAgo = dateKeyOf(new Date(Date.now() - 2 * DAY_MS));

function uploadBody(memberKey: string, overrides: Record<string, unknown> = {}) {
  return {
    memberKey,
    playerName: 'Aditi',
    dateKey: today,
    promptIndex: 1,
    image: TINY_PNG,
    ...overrides,
  };
}

describe('M19 drawing gallery (DAILY-DESIGN §5), DB-backed integration', () => {
  beforeAll(async () => {
    await setupTestDb();
  }, 30_000);

  beforeEach(async () => {
    await resetTestData();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe('POST /api/drawing/submissions', () => {
    it('creates a submission (201) and upserts a member profile on first upload', async () => {
      const response = await request(app)
        .post('/api/drawing/submissions')
        .send(uploadBody('test-draw-upload-001'));
      expect(response.status).toBe(201);
      expect(response.body.submission).toMatchObject({
        dateKey: today,
        promptIndex: 1,
        playerName: 'Aditi',
        votes: 0,
      });
      expect(response.body.submission.id).toMatch(/^[A-Za-z0-9]{8,64}$/);

      const profile = await getPrisma().userProfile.findUnique({
        where: { memberKey: 'test-draw-upload-001' },
      });
      expect(profile?.nickname).toBe('Aditi');
    });

    it('is idempotent: the same memberKey + dateKey returns the original row (200)', async () => {
      const first = await request(app)
        .post('/api/drawing/submissions')
        .send(uploadBody('test-draw-idem-0001'));
      const second = await request(app)
        .post('/api/drawing/submissions')
        .send(uploadBody('test-draw-idem-0001', { promptIndex: 7 }));
      expect(first.status).toBe(201);
      expect(second.status).toBe(200);
      expect(second.body.submission.id).toBe(first.body.submission.id);
      expect(second.body.submission.promptIndex).toBe(1); // original row wins
      expect(await getPrisma().drawingSubmission.count()).toBe(1);
    });

    it('allows the same member to upload again on a different day', async () => {
      await request(app)
        .post('/api/drawing/submissions')
        .send(uploadBody('test-draw-twoday-01', { dateKey: yesterday }));
      const next = await request(app)
        .post('/api/drawing/submissions')
        .send(uploadBody('test-draw-twoday-01', { dateKey: today }));
      expect(next.status).toBe(201);
      expect(await getPrisma().drawingSubmission.count()).toBe(2);
    });

    it('rejects invalid bodies with 400 INVALID_BODY', async () => {
      const badKey = await request(app).post('/api/drawing/submissions').send(uploadBody('x'));
      expect(badKey.status).toBe(400);
      expect(badKey.body.error.code).toBe('INVALID_BODY');

      const badDate = await request(app)
        .post('/api/drawing/submissions')
        .send(uploadBody('test-draw-badkey-01', { dateKey: '2026/08/05' }));
      expect(badDate.status).toBe(400);

      const badImage = await request(app)
        .post('/api/drawing/submissions')
        .send(uploadBody('test-draw-badimg-01', { image: 'data:image/jpeg;base64,AAAA' }));
      expect(badImage.status).toBe(400);
    });

    it('rejects an oversized image with 400 (base64 > 1.4M chars)', async () => {
      const response = await request(app)
        .post('/api/drawing/submissions')
        .send(
          uploadBody('test-draw-bigimg-01', {
            image: `data:image/png;base64,${'A'.repeat(1_400_001)}`,
          })
        );
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_BODY');
    });

    it('rejects an oversized body with 413 PAYLOAD_TOO_LARGE (1.5 MB route parser)', async () => {
      const response = await request(app)
        .post('/api/drawing/submissions')
        .send(
          uploadBody('test-draw-huge-0001', {
            image: `data:image/png;base64,${'A'.repeat(1_600_000)}`,
          })
        );
      expect(response.status).toBe(413);
      expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    });

    it('rejects dateKeys outside the server-today ±1 day window (400 INVALID_DATE)', async () => {
      const stale = await request(app)
        .post('/api/drawing/submissions')
        .send(uploadBody('test-draw-stale-01', { dateKey: twoDaysAgo }));
      expect(stale.status).toBe(400);
      expect(stale.body.error.code).toBe('INVALID_DATE');

      const tomorrow = dateKeyOf(new Date(Date.now() + DAY_MS));
      const future = await request(app)
        .post('/api/drawing/submissions')
        .send(uploadBody('test-draw-future-01', { dateKey: tomorrow }));
      expect(future.status).toBe(201);
    });

    it('rate-limits uploads (small-limiter app)', async () => {
      const limited = createApp({
        limiters: { ...createDefaultLimiters(), drawingUpload: new RateLimiter(60_000, 1) },
      });
      expect(
        (
          await request(limited)
            .post('/api/drawing/submissions')
            .send(uploadBody('test-draw-limit-001'))
        ).status
      ).toBe(201);
      const blocked = await request(limited)
        .post('/api/drawing/submissions')
        .send(uploadBody('test-draw-limit-002'));
      expect(blocked.status).toBe(429);
      expect(blocked.body.error.code).toBe('RATE_LIMITED');
    });
  });

  describe('GET /api/drawing/submissions', () => {
    async function insertSubmission(
      memberKey: string,
      overrides: Partial<{
        dateKey: string;
        promptIndex: number;
        votes: number;
        status: string;
        createdAt: Date;
      }> = {}
    ): Promise<string> {
      const row = await getPrisma().drawingSubmission.create({
        data: {
          dateKey: today,
          promptIndex: 1,
          memberKey,
          playerName: `P-${memberKey}`,
          image: TINY_PNG,
          ...overrides,
        },
      });
      return row.id;
    }

    it('returns visible submissions ordered by votes desc, createdAt asc, with total', async () => {
      const t0 = new Date('2026-08-05T00:00:00.000Z');
      const [late, early, oneVote] = [
        await insertSubmission('test-draw-g-ord-01', {
          votes: 2,
          createdAt: new Date(t0.getTime() + 10),
        }),
        await insertSubmission('test-draw-g-ord-02', { votes: 2, createdAt: t0 }),
        await insertSubmission('test-draw-g-ord-03', {
          votes: 1,
          createdAt: new Date(t0.getTime() + 20),
        }),
      ];

      const response = await request(app).get(
        `/api/drawing/submissions?dateKey=${today}&promptIndex=1`
      );
      expect(response.status).toBe(200);
      expect(response.body.total).toBe(3);
      expect(response.body.submissions.map((s: { id: string }) => s.id)).toEqual([
        early,
        late,
        oneVote,
      ]);
      expect(response.body.submissions[0]).toMatchObject({
        playerName: 'P-test-draw-g-ord-02',
        votes: 2,
      });
    });

    it('excludes flagged and removed submissions from rows and total', async () => {
      await insertSubmission('test-draw-g-vis-001', { votes: 9, status: 'flagged' });
      await insertSubmission('test-draw-g-vis-002', { votes: 9, status: 'removed' });
      const visible = await insertSubmission('test-draw-g-vis-003', { votes: 1 });

      const response = await request(app).get(
        `/api/drawing/submissions?dateKey=${today}&promptIndex=1`
      );
      expect(response.body.total).toBe(1);
      expect(response.body.submissions).toHaveLength(1);
      expect(response.body.submissions[0].id).toBe(visible);
    });

    it('caps the page at 50 submissions and reports the true total', async () => {
      for (let i = 0; i < 55; i += 1) {
        await insertSubmission(`test-draw-g-cap-${String(i).padStart(3, '0')}`);
      }
      const response = await request(app).get(
        `/api/drawing/submissions?dateKey=${today}&promptIndex=1`
      );
      expect(response.status).toBe(200);
      expect(response.body.submissions).toHaveLength(50);
      expect(response.body.total).toBe(55);
    });

    it('marks mine and voted only when a memberKey is supplied', async () => {
      const author = await insertSubmission('test-draw-g-mine-01', { votes: 1 });
      await getPrisma().drawingVote.create({
        data: { submissionId: author, memberKey: 'test-draw-g-voter1' },
      });

      const anonymous = await request(app).get(
        `/api/drawing/submissions?dateKey=${today}&promptIndex=1`
      );
      expect(anonymous.body.submissions[0]).toMatchObject({ mine: false, voted: false });

      const asVoter = await request(app).get(
        `/api/drawing/submissions?dateKey=${today}&promptIndex=1&memberKey=test-draw-g-voter1`
      );
      expect(asVoter.body.submissions[0]).toMatchObject({ mine: false, voted: true });

      const asAuthor = await request(app).get(
        `/api/drawing/submissions?dateKey=${today}&promptIndex=1&memberKey=test-draw-g-mine-01`
      );
      expect(asAuthor.body.submissions[0]).toMatchObject({ mine: true, voted: false });
    });

    it('scopes reads by promptIndex and rejects bad queries', async () => {
      await insertSubmission('test-draw-g-scope1');
      await insertSubmission('test-draw-g-scope2', { promptIndex: 2 });

      const one = await request(app).get(`/api/drawing/submissions?dateKey=${today}&promptIndex=1`);
      expect(one.body.total).toBe(1);
      const two = await request(app).get(`/api/drawing/submissions?dateKey=${today}&promptIndex=2`);
      expect(two.body.total).toBe(1);

      expect((await request(app).get('/api/drawing/submissions?promptIndex=1')).status).toBe(400);
      expect((await request(app).get(`/api/drawing/submissions?dateKey=${today}`)).status).toBe(
        400
      );
      expect(
        (await request(app).get(`/api/drawing/submissions?dateKey=${today}&promptIndex=abc`)).status
      ).toBe(400);
      expect(
        (
          await request(app).get(
            `/api/drawing/submissions?dateKey=${today}&promptIndex=1&memberKey=x`
          )
        ).status
      ).toBe(400);
    });

    it('rate-limits gallery reads (small-limiter app)', async () => {
      const limited = createApp({
        limiters: { ...createDefaultLimiters(), drawingRead: new RateLimiter(60_000, 1) },
      });
      expect(
        (await request(limited).get(`/api/drawing/submissions?dateKey=${today}&promptIndex=1`))
          .status
      ).toBe(200);
      expect(
        (await request(limited).get(`/api/drawing/submissions?dateKey=${today}&promptIndex=1`))
          .status
      ).toBe(429);
    });
  });

  describe('POST /api/drawing/submissions/:id/vote', () => {
    async function insertSubmission(memberKey: string): Promise<string> {
      const row = await getPrisma().drawingSubmission.create({
        data: {
          dateKey: today,
          promptIndex: 1,
          memberKey,
          playerName: 'Aditi',
          image: TINY_PNG,
        },
      });
      return row.id;
    }

    it('records a first vote (201) and acknowledges a duplicate (200, no double count)', async () => {
      const id = await insertSubmission('test-draw-v-owner1');
      const first = await request(app)
        .post(`/api/drawing/submissions/${id}/vote`)
        .send({ memberKey: 'test-draw-v-voter1' });
      expect(first.status).toBe(201);
      expect(first.body).toEqual({ votes: 1, duplicate: false });

      const duplicate = await request(app)
        .post(`/api/drawing/submissions/${id}/vote`)
        .send({ memberKey: 'test-draw-v-voter1' });
      expect(duplicate.status).toBe(200);
      expect(duplicate.body).toEqual({ votes: 1, duplicate: true });

      const second = await request(app)
        .post(`/api/drawing/submissions/${id}/vote`)
        .send({ memberKey: 'test-draw-v-voter2' });
      expect(second.status).toBe(201);
      expect(second.body).toEqual({ votes: 2, duplicate: false });

      // The counter always derives from rows: no drift.
      const row = await getPrisma().drawingSubmission.findUniqueOrThrow({ where: { id } });
      expect(row.votes).toBe(2);
      expect(await getPrisma().drawingVote.count({ where: { submissionId: id } })).toBe(2);
    });

    it('rejects votes on your own submission (409)', async () => {
      const id = await insertSubmission('test-draw-v-owner2');
      const response = await request(app)
        .post(`/api/drawing/submissions/${id}/vote`)
        .send({ memberKey: 'test-draw-v-owner2' });
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('CONFLICT');
    });

    it('returns 404 for unknown, flagged, and removed submissions; 400 for garbage ids', async () => {
      expect(
        (
          await request(app)
            .post('/api/drawing/submissions/cm8abcdefghijklmnopqrstuvw/vote')
            .send({ memberKey: 'test-draw-v-voter1' })
        ).status
      ).toBe(404);

      const flagged = await insertSubmission('test-draw-v-owner3');
      await getPrisma().drawingSubmission.update({
        where: { id: flagged },
        data: { status: 'flagged' },
      });
      expect(
        (
          await request(app)
            .post(`/api/drawing/submissions/${flagged}/vote`)
            .send({ memberKey: 'test-draw-v-voter1' })
        ).status
      ).toBe(404);

      expect(
        (
          await request(app)
            .post('/api/drawing/submissions/xyz/vote')
            .send({ memberKey: 'test-draw-v-voter1' })
        ).status
      ).toBe(400);
      expect(
        (await request(app).post(`/api/drawing/submissions/${flagged}/vote`).send({})).status
      ).toBe(400);
    });

    it('rate-limits votes (small-limiter app)', async () => {
      const id = await insertSubmission('test-draw-v-owner4');
      const limited = createApp({
        limiters: { ...createDefaultLimiters(), drawingVote: new RateLimiter(60_000, 1) },
      });
      expect(
        (
          await request(limited)
            .post(`/api/drawing/submissions/${id}/vote`)
            .send({ memberKey: 'test-draw-v-voter1' })
        ).status
      ).toBe(201);
      expect(
        (
          await request(limited)
            .post(`/api/drawing/submissions/${id}/vote`)
            .send({ memberKey: 'test-draw-v-voter2' })
        ).status
      ).toBe(429);
    });
  });

  describe('POST /api/drawing/submissions/:id/flag', () => {
    it('flags idempotently per member, sanitizes reasons, and auto-hides at 3 flags', async () => {
      const submission = await getPrisma().drawingSubmission.create({
        data: {
          dateKey: today,
          promptIndex: 1,
          memberKey: 'test-draw-f-owner1',
          playerName: 'Aditi',
          image: TINY_PNG,
        },
      });
      const id = submission.id;

      const first = await request(app)
        .post(`/api/drawing/submissions/${id}/flag`)
        .send({ memberKey: 'test-draw-f-f1', reason: '  spam\u0007content ' });
      expect(first.status).toBe(200);
      expect(first.body).toEqual({ flagged: true, duplicate: false, hidden: false });
      // Control characters stripped by the validator.
      const stored = await getPrisma().drawingFlag.findFirstOrThrow({
        where: { submissionId: id },
      });
      expect(stored.reason).toBe('spamcontent');

      const duplicate = await request(app)
        .post(`/api/drawing/submissions/${id}/flag`)
        .send({ memberKey: 'test-draw-f-f1' });
      expect(duplicate.status).toBe(200);
      expect(duplicate.body).toEqual({ flagged: false, duplicate: true, hidden: false });

      const second = await request(app)
        .post(`/api/drawing/submissions/${id}/flag`)
        .send({ memberKey: 'test-draw-f-f2' });
      expect(second.body).toEqual({ flagged: true, duplicate: false, hidden: false });

      const third = await request(app)
        .post(`/api/drawing/submissions/${id}/flag`)
        .send({ memberKey: 'test-draw-f-f3' });
      expect(third.status).toBe(200);
      expect(third.body).toEqual({ flagged: true, duplicate: false, hidden: true });

      const row = await getPrisma().drawingSubmission.findUniqueOrThrow({ where: { id } });
      expect(row.flagCount).toBe(3);
      expect(row.status).toBe('flagged');

      // Auto-hidden: excluded from the gallery.
      const gallery = await request(app).get(
        `/api/drawing/submissions?dateKey=${today}&promptIndex=1`
      );
      expect(gallery.body.total).toBe(0);
    });

    it('rejects flags on your own submission (409) and unknown ids (404)', async () => {
      const submission = await getPrisma().drawingSubmission.create({
        data: {
          dateKey: today,
          promptIndex: 1,
          memberKey: 'test-draw-f-owner2',
          playerName: 'Aditi',
          image: TINY_PNG,
        },
      });
      const own = await request(app)
        .post(`/api/drawing/submissions/${submission.id}/flag`)
        .send({ memberKey: 'test-draw-f-owner2' });
      expect(own.status).toBe(409);

      const unknown = await request(app)
        .post('/api/drawing/submissions/cm8abcdefghijklmnopqrstuvw/flag')
        .send({ memberKey: 'test-draw-f-f1' });
      expect(unknown.status).toBe(404);

      const badReason = await request(app)
        .post(`/api/drawing/submissions/${submission.id}/flag`)
        .send({ memberKey: 'test-draw-f-f1', reason: 'a'.repeat(201) });
      expect(badReason.status).toBe(400);
    });

    it('rate-limits flags (small-limiter app)', async () => {
      const submission = await getPrisma().drawingSubmission.create({
        data: {
          dateKey: today,
          promptIndex: 1,
          memberKey: 'test-draw-f-owner3',
          playerName: 'Aditi',
          image: TINY_PNG,
        },
      });
      const limited = createApp({
        limiters: { ...createDefaultLimiters(), drawingFlag: new RateLimiter(60_000, 1) },
      });
      expect(
        (
          await request(limited)
            .post(`/api/drawing/submissions/${submission.id}/flag`)
            .send({ memberKey: 'test-draw-f-f1' })
        ).status
      ).toBe(200);
      expect(
        (
          await request(limited)
            .post(`/api/drawing/submissions/${submission.id}/flag`)
            .send({ memberKey: 'test-draw-f-f2' })
        ).status
      ).toBe(429);
    });
  });

  describe('DELETE /api/drawing/submissions/:id (admin)', () => {
    it('removes a submission with a valid ADMIN_TOKEN (204), never visible again', async () => {
      const submission = await getPrisma().drawingSubmission.create({
        data: {
          dateKey: today,
          promptIndex: 1,
          memberKey: 'test-draw-d-owner1',
          playerName: 'Aditi',
          image: TINY_PNG,
          votes: 5,
        },
      });
      await getPrisma().drawingVote.create({
        data: { submissionId: submission.id, memberKey: 'test-draw-d-voter1' },
      });

      const response = await request(app)
        .delete(`/api/drawing/submissions/${submission.id}`)
        .set('ADMIN_TOKEN', 'test-admin-token');
      expect(response.status).toBe(204);

      const row = await getPrisma().drawingSubmission.findUniqueOrThrow({
        where: { id: submission.id },
      });
      expect(row.status).toBe('removed'); // rows kept for audit, cascade is a hygiene guard

      const gallery = await request(app).get(
        `/api/drawing/submissions?dateKey=${today}&promptIndex=1`
      );
      expect(gallery.body.total).toBe(0);
    });

    it('rejects missing or wrong tokens (401) and unknown ids (404)', async () => {
      const submission = await getPrisma().drawingSubmission.create({
        data: {
          dateKey: today,
          promptIndex: 1,
          memberKey: 'test-draw-d-owner2',
          playerName: 'Aditi',
          image: TINY_PNG,
        },
      });

      const missing = await request(app).delete(`/api/drawing/submissions/${submission.id}`);
      expect(missing.status).toBe(401);
      expect(missing.body.error.code).toBe('UNAUTHORIZED');

      const wrong = await request(app)
        .delete(`/api/drawing/submissions/${submission.id}`)
        .set('ADMIN_TOKEN', 'nope');
      expect(wrong.status).toBe(401);

      const unknown = await request(app)
        .delete('/api/drawing/submissions/cm8abcdefghijklmnopqrstuvw')
        .set('ADMIN_TOKEN', 'test-admin-token');
      expect(unknown.status).toBe(404);

      // Removed rows are a 404 for repeat deletes (idempotent-ish surface).
      await request(app)
        .delete(`/api/drawing/submissions/${submission.id}`)
        .set('ADMIN_TOKEN', 'test-admin-token');
      const again = await request(app)
        .delete(`/api/drawing/submissions/${submission.id}`)
        .set('ADMIN_TOKEN', 'test-admin-token');
      expect(again.status).toBe(404);

      const badId = await request(app)
        .delete('/api/drawing/submissions/xyz')
        .set('ADMIN_TOKEN', 'test-admin-token');
      expect(badId.status).toBe(400);
    });
  });
});
