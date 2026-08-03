/**
 * Typed API client for the PartyBrain backend (PRD §8.1 endpoints).
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

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
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
 * Retries only on network errors / 5xx — never on 4xx.
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
