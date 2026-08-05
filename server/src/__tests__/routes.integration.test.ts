import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { RoomEngine } from '../engine/room-engine.js';
import { createDefaultLimiters, RateLimiter } from '../lib/rate-limit.js';
import { getPrisma } from '../lib/prisma.js';
import { LEADERBOARD_PERIODS, periodStart } from '../routes/leaderboard.js';
import { resetTestData, setupTestDb, teardownTestDb } from './helpers/db.js';

const app = createApp();

describe('REST API (PRD §8.1), DB-backed integration', () => {
  beforeAll(async () => {
    await setupTestDb();
  }, 30_000);

  beforeEach(async () => {
    await resetTestData();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe('POST /api/scores', () => {
    it('accepts a valid score and returns 201', async () => {
      const response = await request(app)
        .post('/api/scores')
        .send({ gameId: 'skribbl-arena', playerName: 'Alice', score: 120, clientKey: 'k-alice-1' });
      expect(response.status).toBe(201);
      expect(response.body.score).toMatchObject({
        gameId: 'skribbl-arena',
        playerName: 'Alice',
        score: 120,
      });
      expect(response.body.duplicate).toBe(false);
    });

    it('is idempotent for the same clientKey (returns the original row)', async () => {
      const first = await request(app)
        .post('/api/scores')
        .send({ gameId: 'trivia', playerName: 'Bob', score: 90, clientKey: 'k-bob-0001' });
      const second = await request(app)
        .post('/api/scores')
        .send({ gameId: 'trivia', playerName: 'Bob', score: 90, clientKey: 'k-bob-0001' });
      expect(first.status).toBe(201);
      expect(second.status).toBe(200);
      expect(second.body.duplicate).toBe(true);
      expect(second.body.score.id).toBe(first.body.score.id);
      const count = await getPrisma().score.count();
      expect(count).toBe(1);
    });

    it('does not dedupe submissions without a clientKey', async () => {
      await request(app)
        .post('/api/scores')
        .send({ gameId: 'trivia', playerName: 'Carol', score: 10 });
      await request(app)
        .post('/api/scores')
        .send({ gameId: 'trivia', playerName: 'Carol', score: 10 });
      const count = await getPrisma().score.count();
      expect(count).toBe(2);
    });

    it('rejects invalid bodies, unknown games, and bad scores', async () => {
      expect((await request(app).post('/api/scores').send('nope')).status).toBe(400);
      expect(
        (
          await request(app)
            .post('/api/scores')
            .send({ gameId: 'not-a-game', playerName: 'Alice', score: 1 })
        ).status
      ).toBe(404);
      expect(
        (
          await request(app)
            .post('/api/scores')
            .send({ gameId: 'trivia', playerName: 'Alice', score: -5 })
        ).status
      ).toBe(400);
      expect(
        (
          await request(app)
            .post('/api/scores')
            .send({ gameId: 'trivia', playerName: '  ', score: 5 })
        ).status
      ).toBe(400);
    });

    it('rate-limits submissions', async () => {
      const limited = createApp({
        limiters: { ...createDefaultLimiters(), scoreSubmit: new RateLimiter(60_000, 3) },
      });
      for (let i = 0; i < 3; i += 1) {
        expect(
          (
            await request(limited)
              .post('/api/scores')
              .send({ gameId: 'trivia', playerName: 'D', score: i })
          ).status
        ).toBe(201);
      }
      const blocked = await request(limited)
        .post('/api/scores')
        .send({ gameId: 'trivia', playerName: 'D', score: 99 });
      expect(blocked.status).toBe(429);
    });
  });

  describe('GET /api/leaderboard/:gameId', () => {
    it('returns entries ordered by score desc, earliest first on ties', async () => {
      const payload = [
        { gameId: 'trivia', playerName: 'Alice', score: 50 },
        { gameId: 'trivia', playerName: 'Bob', score: 90 },
        { gameId: 'trivia', playerName: 'Carol', score: 90 },
        { gameId: 'trivia', playerName: 'Dave', score: 10 },
        { gameId: 'rhyme-or-crime', playerName: 'Eve', score: 999 },
      ];
      for (const body of payload) {
        await request(app).post('/api/scores').send(body);
      }
      const response = await request(app).get('/api/leaderboard/trivia');
      expect(response.status).toBe(200);
      expect(response.body.period).toBe('all-time');
      expect(
        response.body.entries.map((entry: { playerName: string }) => entry.playerName)
      ).toEqual(['Bob', 'Carol', 'Alice', 'Dave']);
      expect(response.body.entries[0]).toMatchObject({ rank: 1, score: 90 });
    });

    it('filters by daily/weekly/all-time periods', async () => {
      const old = new Date(Date.now() - 10 * 86_400_000);
      await getPrisma().score.create({
        data: { gameId: 'trivia', playerName: 'Oldie', score: 500, playedAt: old },
      });
      await request(app)
        .post('/api/scores')
        .send({ gameId: 'trivia', playerName: 'Fresh', score: 100 });

      const daily = await request(app).get('/api/leaderboard/trivia?period=daily');
      expect(daily.body.entries.map((entry: { playerName: string }) => entry.playerName)).toEqual([
        'Fresh',
      ]);

      const weekly = await request(app).get('/api/leaderboard/trivia?period=weekly');
      expect(weekly.body.entries.map((entry: { playerName: string }) => entry.playerName)).toEqual([
        'Fresh',
      ]);

      const allTime = await request(app).get('/api/leaderboard/trivia?period=all-time');
      expect(allTime.body.entries.map((entry: { playerName: string }) => entry.playerName)).toEqual(
        ['Oldie', 'Fresh']
      );
    });

    it('honors limit and caps it at 100; rejects unknown games and bad ids', async () => {
      for (let i = 0; i < 5; i += 1) {
        await request(app)
          .post('/api/scores')
          .send({ gameId: 'trivia', playerName: `P${i}`, score: i });
      }
      const two = await request(app).get('/api/leaderboard/trivia?limit=2');
      expect(two.body.entries).toHaveLength(2);
      const huge = await request(app).get('/api/leaderboard/trivia?limit=9999');
      expect(huge.body.entries).toHaveLength(5);

      expect((await request(app).get('/api/leaderboard/not-a-game')).status).toBe(404);
      expect((await request(app).get('/api/leaderboard/')).status).toBe(404);
    });
  });

  describe('GET /api/daily-challenge', () => {
    it('returns the seeded trivia challenge for any date (M8 on-demand seeding)', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const response = await request(app).get('/api/daily-challenge');
      expect(response.status).toBe(200);
      expect(response.body.date).toBe(today);
      const trivia = response.body.challenges.find(
        (challenge: { gameId: string }) => challenge.gameId === 'trivia'
      );
      expect(trivia).toBeDefined();
      expect(trivia.data.questions).toHaveLength(10);

      // The same date returns the identical set (idempotent upsert), and a
      // past date is seeded deterministically on first read.
      const again = await request(app).get('/api/daily-challenge');
      expect(again.body.challenges).toEqual(response.body.challenges);
      const other = await request(app).get('/api/daily-challenge?date=2026-01-01');
      expect(other.body.challenges).toHaveLength(1);
      expect(other.body.challenges[0].data.questions).toHaveLength(10);
    });
  });

  describe('POST /api/room/create + GET /api/room/:roomCode', () => {
    it('creates a room with a 6-char code and reports it', async () => {
      const created = await request(app).post('/api/room/create').send({ gameId: 'skribbl-arena' });
      expect(created.status).toBe(201);
      expect(created.body.roomCode).toMatch(/^[A-Z2-9]{6}$/);
      expect(created.body.status).toBe('lobby');

      const info = await request(app).get(`/api/room/${created.body.roomCode}`);
      expect(info.status).toBe(200);
      expect(info.body).toMatchObject({ code: created.body.roomCode, gameId: 'skribbl-arena' });
      expect(info.body.players).toEqual([]);
    });

    it('rejects unknown games and bad codes; 404 for unknown rooms', async () => {
      expect((await request(app).post('/api/room/create').send({ gameId: 'nope' })).status).toBe(
        404
      );
      expect((await request(app).post('/api/room/create').send({ gameId: '' })).status).toBe(400);
      expect((await request(app).get('/api/room/ZZZZZZ')).status).toBe(404);
      expect((await request(app).get('/api/room/abc')).status).toBe(400);
    });

    it('rate-limits room creation', async () => {
      const limited = createApp({
        engine: new RoomEngine(),
        limiters: { ...createDefaultLimiters(), roomCreate: new RateLimiter(60_000, 2) },
      });
      expect(
        (await request(limited).post('/api/room/create').send({ gameId: 'trivia' })).status
      ).toBe(201);
      expect(
        (await request(limited).post('/api/room/create').send({ gameId: 'trivia' })).status
      ).toBe(201);
      expect(
        (await request(limited).post('/api/room/create').send({ gameId: 'trivia' })).status
      ).toBe(429);
    });
  });

  describe('POST /api/daily/:gameId/submit — new M19 live games', () => {
    it('accepts a geography run and surfaces streak + personal best via /api/me', async () => {
      const memberKey = 'test-member-geo-0001';
      const submit = await request(app).post('/api/daily/geography/submit').send({
        gameId: 'geography',
        memberKey,
        playerName: 'Aditi',
        score: 100,
        clientKey: 'test-daily-geo-0001',
      });
      expect(submit.status).toBe(201);
      expect(submit.body.accepted).toBe(true);
      expect(submit.body.streaks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ scope: 'geography', current: 1, longest: 1 }),
          expect.objectContaining({ scope: 'grand', current: 1, longest: 1 }),
        ])
      );

      const me = await request(app).get(`/api/me?memberKey=${memberKey}`);
      expect(me.status).toBe(200);
      expect(me.body.personalBests).toEqual([
        expect.objectContaining({ gameId: 'geography', bestScore: 100, plays: 1 }),
      ]);
      expect(me.body.recentRuns).toEqual([
        expect.objectContaining({ gameId: 'geography', score: 100 }),
      ]);
    });
  });

  describe('/readyz', () => {
    it('reports ready when the database answers', async () => {
      const response = await request(app).get('/readyz');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ready' });
    });
  });

  describe('period math (leaderboard)', () => {
    it('computes UTC daily and Monday-weekly boundaries', () => {
      const now = new Date('2026-08-04T15:00:00Z'); // Tuesday
      const daily = periodStart('daily', now);
      expect(daily.toISOString()).toBe('2026-08-04T00:00:00.000Z');
      const weekly = periodStart('weekly', now);
      expect(weekly.toISOString()).toBe('2026-08-03T00:00:00.000Z'); // Monday
      expect(periodStart('all-time', now).getTime()).toBe(0);
      expect(LEADERBOARD_PERIODS).toEqual(['daily', 'weekly', 'all-time']);
    });
  });
});
