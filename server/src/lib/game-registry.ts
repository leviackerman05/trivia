/**
 * Room games with a shipped round adapter (M4: only Skribbl Arena).
 * Single source of truth for the start-game gate — a room whose game has no
 * adapter must not advance into game-setup (that stranded rooms in
 * "Game in progress" with nothing taking over).
 *
 * The client catalog mirrors this via `Game.playable` in games.json; the
 * lockstep is asserted in src/lib/__tests__/games.test.ts (client side).
 * M5 extends this set as drawing-game adapters ship.
 */
export const PLAYABLE_ROOM_GAMES: ReadonlySet<string> = new Set(['skribbl-arena']);
