import type { DrawingGalleryResponse } from './daily-drawing';

/**
 * Typed API client for the Trivia in Games backend (PRD §8.1 endpoints).
 * Islands use these helpers; errors surface as ApiError with a stable code.
 */

export const SERVER_URL: string =
  (import.meta.env?.PUBLIC_SERVER_URL as string | undefined) ?? 'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${SERVER_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const body = (await response.json().catch(() => null)) as {
    error?: { code?: string; message?: string };
  } | null;
  if (!response.ok) {
    throw new ApiError(
      response.status,
      body?.error?.code ?? 'UNKNOWN',
      body?.error?.message ?? `HTTP ${response.status}`
    );
  }
  return body as T;
}

export interface ScoreRow {
  id: string;
  gameId: string;
  playerName: string;
  score: number;
  playedAt: string;
}

export interface SubmitScoreInput {
  gameId: string;
  playerName: string;
  score: number;
  /** Idempotency key: generate once per completed game, reuse on retries. */
  clientKey: string;
}

export interface SubmitScoreResult {
  score: ScoreRow;
  duplicate: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  playerName: string;
  score: number;
  playedAt: string;
}

export interface LeaderboardResponse {
  gameId: string;
  period: 'daily' | 'weekly' | 'all-time';
  entries: LeaderboardEntry[];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Submit a score with idempotent retries: the same clientKey returns the
 * original row, so retries after network failures never create duplicates.
 * Retries only on network errors / 5xx, never on 4xx.
 */
export async function submitScore(
  input: SubmitScoreInput,
  retries = 2
): Promise<SubmitScoreResult> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await apiFetch<SubmitScoreResult>('/api/scores', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    } catch (error) {
      lastError = error;
      if (error instanceof ApiError && error.status < 500) {
        throw error;
      }
      if (attempt < retries) {
        await sleep(250 * 2 ** attempt);
      }
    }
  }
  throw lastError;
}

export async function fetchLeaderboard(
  gameId: string,
  period: 'daily' | 'weekly' | 'all-time' = 'all-time',
  limit = 10
): Promise<LeaderboardResponse> {
  return apiFetch<LeaderboardResponse>(
    `/api/leaderboard/${encodeURIComponent(gameId)}?period=${period}&limit=${limit}`
  );
}

// --- Daily Drawing gallery (DAILY-DESIGN §4.2, contract table §5.1) ---

export interface DrawingSubmissionInput {
  memberKey: string;
  playerName: string;
  dateKey: string;
  promptIndex: number;
  image: string; // PNG data URL
}

/** Upload response: 201 created, or 200 when the day's entry already exists. */
export interface DrawingUploadResult {
  submission: {
    id: string;
    dateKey: string;
    promptIndex: number;
    playerName: string;
    votes: number;
  };
}

/**
 * Upload a drawing. Retries are safe because the endpoint is idempotent
 * per (dateKey, memberKey) — same policy as submitScore: retry 5xx and
 * network errors only, never 4xx.
 */
export async function uploadDrawingSubmission(
  input: DrawingSubmissionInput,
  retries = 2
): Promise<DrawingUploadResult> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await apiFetch<DrawingUploadResult>('/api/drawing/submissions', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    } catch (error) {
      lastError = error;
      if (error instanceof ApiError && error.status < 500) {
        throw error;
      }
      if (attempt < retries) {
        await sleep(250 * 2 ** attempt);
      }
    }
  }
  throw lastError;
}

/** Gallery read: visible submissions votes-desc, `mine`/`voted` for the member. */
export async function fetchDrawingGallery(opts: {
  dateKey: string;
  promptIndex: number;
  memberKey?: string;
}): Promise<DrawingGalleryResponse> {
  const params = new URLSearchParams({
    dateKey: opts.dateKey,
    promptIndex: String(opts.promptIndex),
  });
  if (opts.memberKey) {
    params.set('memberKey', opts.memberKey);
  }
  return apiFetch<DrawingGalleryResponse>(`/api/drawing/submissions?${params.toString()}`);
}

/** Vote: 201 first vote, 200 duplicate (no double count, server derives it). */
export async function voteDrawingSubmission(
  id: string,
  memberKey: string
): Promise<{ votes: number; duplicate: boolean }> {
  return apiFetch(`/api/drawing/submissions/${encodeURIComponent(id)}/vote`, {
    method: 'POST',
    body: JSON.stringify({ memberKey }),
  });
}

/** Flag: idempotent per submission+member; 3 distinct flags auto-hide. */
export async function flagDrawingSubmission(
  id: string,
  memberKey: string,
  reason?: string
): Promise<{ flagged: boolean; duplicate: boolean; hidden: boolean }> {
  return apiFetch(`/api/drawing/submissions/${encodeURIComponent(id)}/flag`, {
    method: 'POST',
    body: JSON.stringify({ memberKey, ...(reason ? { reason } : {}) }),
  });
}
