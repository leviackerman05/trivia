/**
 * [AIRBNB v3] In-repo SVG line icon set — hand-rolled 32×32 stroke glyphs,
 * no icon font, no dependencies. The single source of truth for chrome
 * icons; `Icon.astro` wraps it for Astro pages and `Icon.tsx` for React
 * islands. Content emojis (puzzle data) are exempt and stay in the data.
 */

export type IconName =
  | 'home'
  | 'target'
  | 'gamepad'
  | 'grid'
  | 'users'
  | 'user'
  | 'sun'
  | 'moon'
  | 'brain'
  | 'film'
  | 'clock'
  | 'tag'
  | 'music-note'
  | 'masks'
  | 'book'
  | 'globe'
  | 'popcorn'
  | 'pencil'
  | 'ballot'
  | 'confetti'
  | 'question'
  | 'flame'
  | 'calendar'
  | 'text'
  | 'lightbulb'
  | 'cash'
  | 'box'
  | 'trophy'
  | 'crown'
  | 'flag'
  | 'mask'
  | 'check'
  | 'ban'
  | 'sparkles'
  | 'bolt'
  | 'snowflake'
  | 'tools';

/** Inner SVG markup per icon (stroke currentColor, 32×32 viewBox). */
export const ICON_PATHS: Record<IconName, string> = {
  home: '<path d="M5 14 16 5l11 9"/><path d="M8 13v13h16V13"/><path d="M13 26v-7h6v7"/>',
  target:
    '<circle cx="16" cy="16" r="10"/><circle cx="16" cy="16" r="5"/><circle cx="16" cy="16" r="1.5" fill="currentColor" stroke="none"/>',
  gamepad:
    '<rect x="4" y="10" width="24" height="13" rx="6.5"/><path d="M10.5 14v5M8 16.5h5"/><circle cx="21" cy="14.5" r="1.4" fill="currentColor" stroke="none"/><circle cx="24.5" cy="18" r="1.4" fill="currentColor" stroke="none"/>',
  grid: '<rect x="4" y="4" width="24" height="24" rx="3"/><path d="M11 4v24M21 4v24M4 11h24M4 21h24"/>',
  users:
    '<circle cx="10.5" cy="11" r="4.5"/><path d="M4 27c0-4.2 2.9-7 6.5-7s6.5 2.8 6.5 7"/><circle cx="22.5" cy="12" r="3.5"/><path d="M20.5 20.2c3.8.4 7.5 2.7 7.5 6.8"/>',
  user: '<circle cx="16" cy="11" r="5"/><path d="M6 27c0-5.1 4.5-8.5 10-8.5s10 3.4 10 8.5"/>',
  sun: '<circle cx="16" cy="16" r="5.5"/><path d="M16 3.5v3M16 25.5v3M3.5 16h3M25.5 16h3M7 7l2.1 2.1M22.9 22.9 25 25M25 7l-2.1 2.1M9.1 22.9 7 25"/>',
  moon: '<path d="M20.5 5.5a10.5 10.5 0 1 0 6 20A8.5 8.5 0 0 1 20.5 5.5Z"/>',
  brain:
    '<path d="M16 5.5c-3.6 0-6 2.2-6 5.2-2.6.3-4.3 2.6-3.2 5-1.7 2.4-.4 5.6 2.8 6-.1 2.9 3 4.9 6.4 4.4 3.4.5 6.5-1.5 6.4-4.4 3.2-.4 4.5-3.6 2.8-6 1.1-2.4-.6-4.7-3.2-5 0-3-2.4-5.2-6-5.2Z"/>',
  film: '<rect x="5" y="6" width="22" height="20" rx="2.5"/><path d="M9.5 6v20M22.5 6v20M5 11.5h4.5M5 20.5h4.5M22.5 11.5H27M22.5 20.5H27"/>',
  clock: '<circle cx="16" cy="16" r="10"/><path d="M16 10v6.5l4.5 3"/>',
  tag: '<path d="M5 5h9l13 13-9 9L5 14Z"/><circle cx="10" cy="10" r="1.8"/>',
  'music-note':
    '<path d="M10 5.5v16"/><circle cx="6.5" cy="21.5" r="3.5"/><path d="M10 5.5 24 3v15.5"/><circle cx="20.5" cy="18.5" r="3.5"/>',
  masks:
    '<circle cx="11" cy="16" r="7.5"/><circle cx="21" cy="16" r="7.5"/><circle cx="8.8" cy="14.5" r="1.3" fill="currentColor" stroke="none"/><circle cx="13.2" cy="14.5" r="1.3" fill="currentColor" stroke="none"/><path d="M9.5 19c1 1.6 3 1.6 4 0"/><circle cx="18.8" cy="14.5" r="1.3" fill="currentColor" stroke="none"/><circle cx="23.2" cy="14.5" r="1.3" fill="currentColor" stroke="none"/><path d="M19.5 19c1 1.6 3 1.6 4 0"/>',
  book: '<path d="M5 5.5h8.5c2 0 3.5 1.2 3.5 3v19c0-1.8-1.5-3-3.5-3H5Z"/><path d="M27 5.5h-8.5c-2 0-3.5 1.2-3.5 3v19c0-1.8 1.5-3 3.5-3H27Z"/>',
  globe:
    '<circle cx="16" cy="16" r="10"/><path d="M6 16h20M16 6c-4.5 4.5-4.5 19.5 0 24M16 6c4.5 4.5 4.5 19.5 0 24"/>',
  popcorn:
    '<path d="M9 14 7.5 24.5h17L23 14Z"/><circle cx="11" cy="11.5" r="2.4"/><circle cx="16" cy="9" r="2.8"/><circle cx="21" cy="11.5" r="2.4"/>',
  pencil: '<path d="M5.5 22.5 4 28l5.5-1.5L26 10 22 6Z"/><path d="M18.5 9.5 22.5 13.5"/>',
  ballot: '<rect x="4" y="4" width="24" height="24" rx="3"/><path d="M10 16.5l4 4 8-9"/>',
  confetti:
    '<path d="M14 5l1.8 4.6L20.5 11l-4.7 1.4L14 17l-1.8-4.6L7.5 11l4.7-1.4ZM24.5 18l1.1 2.8 2.9 1.1-2.9 1.1-1.1 2.8-1.1-2.8-2.9-1.1 2.9-1.1ZM9 20l.9 2.3 2.3.9-2.3.9L9 26.4 8.1 24.1 5.8 23.2l2.3-.9Z"/>',
  question:
    '<circle cx="16" cy="16" r="10"/><path d="M12.5 12.2a3.6 3.6 0 1 1 5 3.3c-1 .6-1.5 1.2-1.5 2.3"/><circle cx="16" cy="21.6" r="1.3" fill="currentColor" stroke="none"/>',
  flame:
    '<path d="M16 4.5c3.6 4.6 6.5 6.7 6.5 10.4a6.5 6.5 0 0 1-13 0c0-1.8 1-3.4 1.9-4.6 1 1.4 2.2 1.9 3.1 1.3.2-2.4 1-4.6 1.5-7.1Z"/>',
  calendar:
    '<rect x="5" y="7" width="22" height="20" rx="3"/><path d="M5 12.5h22M10.5 4v5M21.5 4v5M10 17h4M18 17h4M10 21.5h4M18 21.5h4"/>',
  text: '<path d="M6 9.5h20M6 16h14M6 22.5h9"/>',
  lightbulb:
    '<path d="M12.5 23h7M13.5 26.5h5"/><path d="M16 5a7 7 0 0 1 4.6 12.3c-.9.9-1.4 1.9-1.4 3.2h-6.4c0-1.3-.5-2.3-1.4-3.2A7 7 0 0 1 16 5Z"/>',
  cash: '<path d="M14.5 11.5c0-1 1-1.6 2.7-1.6s3 1 3 2.2c0 2.4-5.7 2.6-5.7 5.4 0 1.5 1.4 2.3 3 2.3s2.7-.6 2.7-1.6"/><path d="M16 9.5V8M16 22.5V24"/><circle cx="16" cy="16" r="11"/>',
  box: '<path d="M5 10 16 4.5 27 10v12L16 27.5 5 22Z"/><path d="M5 10 16 15.5 27 10M16 15.5V27.5"/>',
  trophy:
    '<path d="M9 5h14v6.5a7 7 0 0 1-14 0Z"/><path d="M9 8H5.5a3.5 3.5 0 0 0 3.5 3.5M23 8h3.5a3.5 3.5 0 0 1-3.5 3.5M13 19.5h6M16 19.5V23M12.5 27h7M11.5 23.5h9"/>',
  crown: '<path d="M6 21.5 7 9.5l6 5 3-6 3 6 6-5 1 12Z"/><path d="M6 25h20"/>',
  flag: '<path d="M7 4.5v23M7 6.5h16l-3.5 5 3.5 5H7"/>',
  mask: '<circle cx="16" cy="16" r="9.5"/><path d="M12 18.5c1.2 1.6 3 1.6 4 0"/><path d="M17 18.5c1.2 1.6 3 1.6 4 0"/><circle cx="12.5" cy="12.5" r="1.3" fill="currentColor" stroke="none"/><circle cx="19.5" cy="12.5" r="1.3" fill="currentColor" stroke="none"/>',
  check: '<path d="M6.5 17 13 23.5 25.5 9"/>',
  ban: '<circle cx="16" cy="16" r="10"/><path d="M8.8 8.8 23.2 23.2"/>',
  sparkles:
    '<path d="M15.5 5.5 17.3 10l4.5 1.8-4.5 1.8-1.8 4.5-1.8-4.5-4.5-1.8 4.5-1.8ZM25 18l1.2 3 3 1.2-3 1.2-1.2 3-1.2-3-3-1.2 3-1.2ZM8 22l1 2.4 2.4 1-2.4 1L8 28.8 7 26.4 4.6 25.4l2.4-1Z"/>',
  bolt: '<path d="M17.5 4.5 8.5 18h6l-1.5 9.5 9-13.5h-6Z"/>',
  snowflake:
    '<path d="M16 4v24M5.5 10.5l21 11M26.5 10.5l-21 11M16 4l-2.2 2.2M16 4l2.2 2.2M16 28l-2.2-2.2M16 28l2.2-2.2M5.5 10.5l3.1.4M26.5 10.5l-3.1.4M26.5 21.5l-3.1-.4M5.5 21.5l3.1-.4"/>',
  tools:
    '<path d="M13.5 5.5a7 7 0 0 0 9.7 9.7l3.3 3.3-3 3-3.3-3.3a7 7 0 0 0-9.7-9.7l3.2 3.2 3-3Z"/>',
};

/** [R3] Game-family chrome icons: drawing, party (voting+special merged), solo, quiz. */
export const FAMILY_ICONS: Record<string, IconName> = {
  drawing: 'pencil',
  party: 'confetti',
  solo: 'user',
  quiz: 'question',
};
