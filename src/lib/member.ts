/**
 * Account-lite member identity (Phase 1.5, D047).
 *
 * A member is a browser with a device-generated opaque memberKey. There is
 * no password and no email; membership is the retention layer (server
 * streaks, history, personal bests) on top of the no-account wedge.
 * Guests keep the device-bound streak from src/lib/solo.ts untouched.
 */

import { apiFetch, type ApiError } from './api';

const MEMBER_KEY_STORAGE = 'triviahub:member-key';

export function readMemberKey(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return localStorage.getItem(MEMBER_KEY_STORAGE);
  } catch {
    return null;
  }
}

/** Create and persist a memberKey on first use (one-tap conversion). */
export function ensureMemberKey(): string {
  const existing = readMemberKey();
  if (existing) {
    return existing;
  }
  const key = crypto.randomUUID();
  try {
    localStorage.setItem(MEMBER_KEY_STORAGE, key);
  } catch {
    // Storage blocked: the session still works, membership is best-effort.
  }
  return key;
}

export interface MemberProfile {
  nickname: string;
  xp: number;
  level: number;
  streakFreezes: number;
  restoreUsedSeason: string | null;
  createdAt: string;
}

export interface MemberStreak {
  scope: string;
  current: number;
  longest: number;
  lastDate: string;
}

export interface MemberRun {
  gameId: string;
  dateKey: string;
  score: number;
}

export interface MemberPersonalBest {
  gameId: string;
  bestScore: number;
  plays: number;
}

export interface MemberMe {
  profile: MemberProfile;
  streaks: MemberStreak[];
  personalBests: MemberPersonalBest[];
  recentRuns: MemberRun[];
}

export interface DailySubmitResult {
  accepted: boolean;
  duplicate: boolean;
  member: boolean;
  streaks: MemberStreak[] | null;
  streakFreezes: number | null;
  restoreUsedSeason: string | null;
}

/** One-tap guest to member conversion: idempotent upsert by memberKey. */
export async function claimMember(memberKey: string, nickname: string): Promise<MemberProfile> {
  const body = await apiFetch<{ profile: MemberProfile }>('/api/me/claim', {
    method: 'POST',
    body: JSON.stringify({ memberKey, nickname }),
  });
  return body.profile;
}

/** Full member read model for the daily hub and archive. */
export async function fetchMemberMe(memberKey: string): Promise<MemberMe> {
  return apiFetch<MemberMe>(`/api/me?memberKey=${encodeURIComponent(memberKey)}`);
}

export interface SubmitDailyRunInput {
  gameId: string;
  memberKey: string;
  playerName: string;
  score: number;
  clientKey: string;
  tier?: string;
  durationMs?: number;
  correctCount?: number;
  totalCount?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Record a member daily run (idempotent by clientKey + one per game per
 * day). Called only for live daily games and only when a memberKey exists;
 * guests keep the device streak and the /api/scores leaderboard path.
 */
export async function submitDailyRun(
  input: SubmitDailyRunInput,
  retries = 2
): Promise<DailySubmitResult> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await apiFetch<DailySubmitResult>(
        `/api/daily/${encodeURIComponent(input.gameId)}/submit`,
        { method: 'POST', body: JSON.stringify(input) }
      );
    } catch (error) {
      lastError = error;
      if ((error as ApiError).status < 500) {
        throw error;
      }
      if (attempt < retries) {
        await sleep(250 * 2 ** attempt);
      }
    }
  }
  throw lastError;
}
