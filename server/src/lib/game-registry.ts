/**
 * Room games with a shipped round adapter. Single source of truth for the
 * start-game gate — a room whose game has no adapter must not advance into
 * game-setup (that stranded rooms in "Game in progress" with nothing taking
 * over). M5 ships all five drawing games.
 *
 * The client catalog mirrors this via `Game.playable` in games.json; the
 * lockstep is asserted in src/lib/__tests__/games.test.ts (client side).
 */
export const PLAYABLE_ROOM_GAMES: ReadonlySet<string> = new Set([
  'skribbl-arena',
  'copycat-challenge',
  'draw-the-lyric',
  'one-line-one-shape',
  'shadow-sketch',
  'would-you-rather',
  'most-likely-to',
  'never-have-i-ever',
  'this-or-that',
  'trivia',
]);
