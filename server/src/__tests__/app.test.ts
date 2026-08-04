import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

const app = createApp();

describe('HTTP app (M1 scaffold)', () => {
  it('GET /healthz returns 200 ok', async () => {
    const response = await request(app).get('/healthz');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  // /readyz needs a live database, covered in the DB-backed integration suite.

  it('unknown routes return 404 JSON', async () => {
    const response = await request(app).get('/api/not-yet-implemented');
    expect(response.status).toBe(404);
  });

  it('hides the x-powered-by header', async () => {
    const response = await request(app).get('/healthz');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
});
