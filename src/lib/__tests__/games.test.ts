import { describe, expect, it } from 'vitest';
import {
  games,
  getGame,
  getInstantPlayGames,
  getRelatedGames,
  type GameFamily,
  type GameType,
  type InstantPlayMode,
} from '../games';
import { PLAYABLE_ROOM_GAMES } from '../../../server/src/lib/game-registry';

const PRD_SLUGS = [
  'skribbl-arena',
  'rhyme-or-crime',
  'emoji-plot',
  'copycat-challenge',
  'draw-the-lyric',
  'one-line-one-shape',
  'timeline-tussle',
  'price-is-right',
  'genre-swap',
  'genre-bender',
  'shadow-sketch',
  'charades',
  'would-you-rather',
  'most-likely-to',
  'trivia',
  'never-have-i-ever',
  'guess-who',
  'this-or-that',
];

const VALID_TYPES: GameType[] = ['solo', 'multiplayer-realtime', 'multiplayer-voting'];
const VALID_FAMILIES: GameFamily[] = ['drawing', 'voting', 'solo', 'special', 'quiz'];

describe('game catalog (src/data/games.json)', () => {
  it('contains exactly the 18 games from PRD §5, with slugs verbatim', () => {
    const slugs = games.map((game) => game.slug);
    expect(slugs.sort()).toEqual([...PRD_SLUGS].sort());
  });

  it('has unique slugs', () => {
    const slugs = games.map((game) => game.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('has valid type and family values on every game', () => {
    for (const game of games) {
      expect(VALID_TYPES).toContain(game.type);
      expect(VALID_FAMILIES).toContain(game.family);
    }
  });

  it('has non-empty name, tagline, and description for every game', () => {
    for (const game of games) {
      expect(game.name.trim().length).toBeGreaterThan(0);
      expect(game.tagline.trim().length).toBeGreaterThan(0);
      expect(game.description.trim().length).toBeGreaterThan(10);
    }
  });

  it('covers every family grouping with the expected game counts', () => {
    const counts = Object.groupBy(games, (game) => game.family) as Record<string, GameFamily[]>;
    expect(counts.drawing).toHaveLength(5);
    expect(counts.voting).toHaveLength(4);
    expect(counts.solo).toHaveLength(6);
    expect(counts.special).toHaveLength(2);
    expect(counts.quiz).toHaveLength(1);
  });

  it('marks instant-play games where a no-room mode makes sense', () => {
    const instant = games.filter((game) => game.instantPlay !== undefined);
    const modes: InstantPlayMode[] = ['solo', 'one-screen'];
    for (const game of instant) {
      expect(modes).toContain(game.instantPlay);
    }
    // Owner-approved scope (2026-08-04): Trivia (solo) + Would You Rather (one-screen).
    expect(getGame('trivia')?.instantPlay).toBe('solo');
    expect(getGame('would-you-rather')?.instantPlay).toBe('one-screen');
    // Room-only games stay room-only.
    expect(getGame('skribbl-arena')?.instantPlay).toBeUndefined();
  });

  it('playable flag mirrors the server start-game registry (lockstep)', () => {
    const playableSlugs = new Set(
      games.filter((game) => game.playable === true).map((game) => game.slug)
    );
    expect(playableSlugs).toEqual(new Set([...PLAYABLE_ROOM_GAMES]));
    // Skribbl Arena (M4) and Trivia room mode (M8) are live.
    expect(getGame('skribbl-arena')?.playable).toBe(true);
    expect(getGame('trivia')?.playable).toBe(true);
    // Room games without a round adapter yet stay unplayable.
    expect(getGame('charades')?.playable).toBeUndefined();
  });
});

describe('registry helpers', () => {
  it('getGame returns a game by slug and undefined for unknown slugs', () => {
    expect(getGame('skribbl-arena')?.name).toBe('Skribbl Arena');
    expect(getGame('not-a-game')).toBeUndefined();
  });

  it('getRelatedGames returns same-family games, excluding the given game', () => {
    const skribbl = getGame('skribbl-arena')!;
    const related = getRelatedGames(skribbl);
    expect(related).toHaveLength(3);
    expect(related.every((game) => game.family === 'drawing')).toBe(true);
    expect(related.some((game) => game.slug === 'skribbl-arena')).toBe(false);
  });

  it('getRelatedGames fills from other families when the family is small (PRD §3)', () => {
    const trivia = getGame('trivia')!;
    const related = getRelatedGames(trivia);
    expect(related).toHaveLength(3);
    expect(related.some((game) => game.slug === 'trivia')).toBe(false);
  });

  it('getInstantPlayGames returns exactly the instant-play games', () => {
    const instant = getInstantPlayGames();
    expect(instant.map((game) => game.slug).sort()).toEqual(['trivia', 'would-you-rather']);
  });
});
