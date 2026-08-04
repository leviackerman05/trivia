/**
 * Would You Rather, one-screen instant play (owner request 2026-08-04).
 * Co-located scorekeeper mode: pass the phone around the room, tap A or B
 * for every vote, watch the live tally. Pure functions only; the island
 * holds the per-dilemma vote state.
 */

import dilemmasJson from '../data/would-you-rather.json';

export interface Dilemma {
  a: string;
  b: string;
}

export const dilemmas = dilemmasJson as Dilemma[];

export const WYR_DILEMMAS_PER_SESSION = 10;

/** Random pick (no leaderboard here, so Math.random is fine). */
export function pickDilemmas(count = WYR_DILEMMAS_PER_SESSION): Dilemma[] {
  const pool = [...dilemmas];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = swap;
  }
  return pool.slice(0, Math.min(count, pool.length));
}

export interface WyRSessionSummary {
  dilemmas: number;
  votes: number;
  pickA: number;
  pickB: number;
  /** Lighthearted label based on the A/B ratio. */
  verdict: string;
}

export function summarizeSession(
  pickA: number,
  pickB: number,
  dilemmas: number
): WyRSessionSummary {
  const votes = pickA + pickB;
  const ratioA = votes === 0 ? 0 : pickA / votes;
  const verdict =
    votes === 0
      ? 'Balanced brain'
      : ratioA >= 0.7
        ? 'A-lister'
        : ratioA <= 0.3
          ? 'B-sider'
          : 'Balanced brain';
  return { dilemmas, votes, pickA, pickB, verdict };
}
