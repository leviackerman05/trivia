import gamesJson from '../data/games.json';

/**
 * Game catalog, single source of truth for the Trivia in Games games.
 * Mirrors PRD §5 slugs verbatim; consumed by the homepage grid, per-game
 * pages, and the server seed (server/prisma/seed.ts reads the same JSON).
 */

export type GameType = 'solo' | 'multiplayer-realtime' | 'multiplayer-voting';
// [R3] voting + special merged into party.
export type GameFamily = 'drawing' | 'solo' | 'party' | 'quiz';
export type GameEnergy = 'high' | 'low';

/**
 * Instant play (owner request 2026-08-04): play without joining a room.
 * "solo", the player plays alone on their device (e.g. Trivia daily
 * challenge). "one-screen", co-located play on a single shared screen /
 * pass-the-phone (e.g. Would You Rather tallies).
 */
export type InstantPlayMode = 'solo' | 'one-screen';

export interface Game {
  slug: string;
  name: string;
  /** PRD §8.3 Game.type enum: "solo" | "multiplayer-realtime" | "multiplayer-voting" */
  type: GameType;
  /** Editorial grouping used by the homepage grid and related-games links. */
  family: GameFamily;
  tagline: string;
  description: string;
  /** Present when the game offers play without a room (instant play). */
  instantPlay?: InstantPlayMode;
  /**
   * Room round logic shipped (server gate: PLAYABLE_ROOM_GAMES in
   * server/src/lib/game-registry.ts, lockstep test in games.test.ts).
   */
  playable?: boolean;
  /** Discovery metadata (Phase 0/1): cards, filters, trending, "choose for me". */
  players?: string;
  durationMinutes?: number;
  energy?: GameEnergy;
  featured?: boolean;
  isNew?: boolean;
  /** Higher = more popular; powers the Trending rail (editorial baseline). */
  popularity?: number;
}

export const games: Game[] = gamesJson as Game[];

const bySlug = new Map(games.map((game) => [game.slug, game]));

export function getGame(slug: string): Game | undefined {
  return bySlug.get(slug);
}

export function getGamesByFamily(family: GameFamily): Game[] {
  return games.filter((game) => game.family === family);
}

/** Trending = popularity order (editorial baseline; play data later). */
export function getTrendingGames(limit = 6): Game[] {
  return [...games].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0)).slice(0, limit);
}

/** New games = flagged in the catalog (e.g. Daily Sudoku). */
export function getNewGames(): Game[] {
  return games.filter((game) => game.isNew);
}

/** Featured games = editorial picks for the hero and multiplayer rails. */
export function getFeaturedGames(): Game[] {
  return games.filter((game) => game.featured);
}

/** Multiplayer games (room-based or one-screen) for the multiplayer rail. */
export function getMultiplayerGames(): Game[] {
  return games.filter((game) => game.type !== 'solo');
}

/**
 * Related games = same family first, then other families to fill the limit
 * (PRD §3 requires 2-3 related links on every game page).
 */
export function getRelatedGames(game: Game, limit = 3): Game[] {
  const related: Game[] = [];
  for (const candidate of games) {
    if (candidate.slug !== game.slug && candidate.family === game.family) {
      related.push(candidate);
    }
  }
  for (const candidate of games) {
    if (
      candidate.slug !== game.slug &&
      candidate.family !== game.family &&
      related.length < limit
    ) {
      related.push(candidate);
    }
  }
  return related.slice(0, limit);
}

/** Games that offer instant play (no room required). */
export function getInstantPlayGames(): Game[] {
  return games.filter((game) => game.instantPlay !== undefined);
}
