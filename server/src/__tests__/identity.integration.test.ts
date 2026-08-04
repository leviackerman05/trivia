import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { getPrisma } from '../lib/prisma.js';
import { resetTestData, setupTestDb, teardownTestDb } from './helpers/db.js';

const app = createApp();

const MEMBER_KEY = 'test-member-0001';
const CLIENT_KEY = 'test-daily-trivia-0001';

describe('Phase 1.5 identity + server streaks (D047/D048), DB-backed integration', () => {
  beforeAll(async () => {
    await setupTestDb();
  }, 30_000);

  beforeEach(async () => {
    await resetTestData();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe('POST /api/me/claim', () => {
    it('creates a member profile on first claim (one-tap conversion)', async () => {
      const response = await request(app)
        .post('/api/me/claim')
        .send({ memberKey: MEMBER_KEY, nickname: 'Aditi' });
      expect(response.status).toBe(200);
      expect(response.body.profile).toMatchObject({ nickname: 'Aditi', streakFreezes: 0 });
      expect(response.body.profile.level).toBe(1);
    });

    it('is idempotent and updates the nickname on re-claim', async () => {
      await request(app).post('/api/me/claim').send({ memberKey: MEMBER_KEY, nickname: 'Aditi' });
      const second = await request(app)
        .post('/api/me/claim')
        .send({ memberKey: MEMBER_KEY, nickname: 'QuizQueen' });
      expect(second.status).toBe(200);
      expect(second.body.profile.nickname).toBe('QuizQueen');
      const count = await getPrisma().userProfile.count();
      expect(count).toBe(1);
    });

    it('rejects an invalid memberKey', async () => {
      const response = await request(app)
        .post('/api/me/claim')
        .send({ memberKey: 'x', nickname: 'Aditi' });
      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/me', () => {
    it('returns 404 for an unknown memberKey', async () => {
      const response = await request(app).get(`/api/me?memberKey=${MEMBER_KEY}`);
      expect(response.status).toBe(404);
    });

    it('returns profile, streaks, personal bests, and recent runs', async () => {
      await request(app).post('/api/me/claim').send({ memberKey: MEMBER_KEY, nickname: 'Aditi' });
      await request(app).post('/api/daily/trivia/submit').send({
        gameId: 'trivia',
        memberKey: MEMBER_KEY,
        playerName: 'Aditi',
        score: 90,
        clientKey: CLIENT_KEY,
      });

      const response = await request(app).get(`/api/me?memberKey=${MEMBER_KEY}`);
      expect(response.status).toBe(200);
      expect(response.body.profile.nickname).toBe('Aditi');
      expect(response.body.streaks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ scope: 'trivia', current: 1 }),
          expect.objectContaining({ scope: 'grand', current: 1 }),
        ])
      );
      expect(response.body.personalBests).toEqual([
        expect.objectContaining({ gameId: 'trivia', bestScore: 90, plays: 1 }),
      ]);
      expect(response.body.recentRuns).toHaveLength(1);
    });
  });

  describe('POST /api/daily/:gameId/submit', () => {
    it('records a daily run and updates both streak scopes', async () => {
      const response = await request(app).post('/api/daily/trivia/submit').send({
        gameId: 'trivia',
        memberKey: MEMBER_KEY,
        playerName: 'Aditi',
        score: 120,
        clientKey: CLIENT_KEY,
        correctCount: 8,
        totalCount: 10,
      });
      expect(response.status).toBe(201);
      expect(response.body.accepted).toBe(true);
      expect(response.body.duplicate).toBe(false);
      expect(response.body.streaks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ scope: 'trivia', current: 1, longest: 1 }),
          expect.objectContaining({ scope: 'grand', current: 1, longest: 1 }),
        ])
      );
      const runs = await getPrisma().dailyRun.findMany();
      expect(runs).toHaveLength(1);
      expect(runs[0]).toMatchObject({ gameId: 'trivia', score: 120, correctCount: 8 });
    });

    it('is idempotent: the same clientKey returns the original run', async () => {
      const first = await request(app).post('/api/daily/trivia/submit').send({
        gameId: 'trivia',
        memberKey: MEMBER_KEY,
        playerName: 'Aditi',
        score: 100,
        clientKey: CLIENT_KEY,
      });
      const second = await request(app).post('/api/daily/trivia/submit').send({
        gameId: 'trivia',
        memberKey: MEMBER_KEY,
        playerName: 'Aditi',
        score: 100,
        clientKey: CLIENT_KEY,
      });
      expect(first.status).toBe(201);
      expect(second.status).toBe(200);
      expect(second.body.duplicate).toBe(true);
      expect(await getPrisma().dailyRun.count()).toBe(1);
    });

    it('only counts the first play of the day (replay acknowledged, not re-scored)', async () => {
      await request(app).post('/api/daily/trivia/submit').send({
        gameId: 'trivia',
        memberKey: MEMBER_KEY,
        playerName: 'Aditi',
        score: 100,
        clientKey: 'test-daily-trivia-0002',
      });
      const replay = await request(app).post('/api/daily/trivia/submit').send({
        gameId: 'trivia',
        memberKey: MEMBER_KEY,
        playerName: 'Aditi',
        score: 999,
        clientKey: 'test-daily-trivia-0003',
      });
      expect(replay.status).toBe(200);
      expect(replay.body.duplicate).toBe(true);
      expect(await getPrisma().dailyRun.count()).toBe(1);
      const best = await getPrisma().dailyRun.findFirst();
      expect(best?.score).toBe(100);
    });

    it('rejects unknown daily games and mismatched gameIds', async () => {
      const unknown = await request(app).post('/api/daily/skribbl-arena/submit').send({
        gameId: 'skribbl-arena',
        memberKey: MEMBER_KEY,
        playerName: 'Aditi',
        score: 10,
        clientKey: 'test-daily-skribbl-001',
      });
      expect(unknown.status).toBe(404);

      const mismatch = await request(app).post('/api/daily/sudoku/submit').send({
        gameId: 'trivia',
        memberKey: MEMBER_KEY,
        playerName: 'Aditi',
        score: 10,
        clientKey: 'test-daily-mismatch-01',
      });
      expect(mismatch.status).toBe(400);
    });

    it('rejects invalid bodies (missing memberKey, bad score)', async () => {
      const noKey = await request(app).post('/api/daily/trivia/submit').send({
        gameId: 'trivia',
        playerName: 'Aditi',
        score: 10,
        clientKey: 'test-daily-nokey-0001',
      });
      expect(noKey.status).toBe(400);

      const badScore = await request(app).post('/api/daily/trivia/submit').send({
        gameId: 'trivia',
        memberKey: MEMBER_KEY,
        playerName: 'Aditi',
        score: -5,
        clientKey: 'test-daily-badscore1',
      });
      expect(badScore.status).toBe(400);
    });
  });
});
