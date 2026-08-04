# UI/UX Overhaul, The Interface Should Feel Alive

**Task 5 of the Vision 2.0 brief.** Screen-by-screen review of every surface, with a
motion/sound system, loading/empty/error states, mobile behavior, dark mode, and
accessibility. The bar: a first-time visitor should _feel_ the party before the first
round starts.

---

## 1. Design principles

1. **Ten-second rule:** from page load to a room or a daily game in under 10 seconds.
2. **One primary action per screen**, everything else is secondary.
3. **States are designed, not discovered:** loading, empty, error, offline, and
   reconnecting states exist for every surface (the CrowdParty `Loading` hang is the
   cautionary tale).
4. **Motion with meaning:** motion is for _feedback and delight_, never decoration.
   Everything respects `prefers-reduced-motion` (already in global.css).
5. **Sound is optional, tasteful, and off by default** (WebAudio, no assets).

## 2. Motion system

| Moment                                   | Motion                                                | Implementation                                    |
| ---------------------------------------- | ----------------------------------------------------- | ------------------------------------------------- |
| Correct answer                           | Micro-pop + teal flash                                | CSS transform, 120ms                              |
| Wrong answer                             | Gentle shake (not red flash alone, color+shape, a11y) | CSS keyframes                                     |
| Score change                             | Number roll-up + floating "+10"                       | 300ms ease-out                                    |
| Confetti (win, streak, daily completion) | Canvas confetti (existing share-canvas infra)         | ~2s, capped particles, disabled on reduced-motion |
| Round reveal                             | Card flip / scale-in with stagger                     | 200ms, 40ms stagger                               |
| Reconnect                                | Pulsing amber banner (not modal)                      | persistent until restored                         |
| Streak flame                             | Subtle glow pulse on the hub                          | CSS, 2s loop, reduced-motion: static              |

## 3. Sound design (WebAudio synth, zero assets, licensing-safe)

- **Buzzer** (game start), **tick** (last 5 seconds), **correct chime**, **wrong
  thud**, **confetti fanfare**, **victory sting**.
- Global toggle in the header + per-room host control; **default off**, remembers
  choice. Sound never carries information that isn't also visual (a11y).
- Streamers get a "streamer mode" preset (quieter, no music).

## 4. Screen-by-screen

### Landing page

- **Hero:** one sentence + "Choose for me" wizard entry + "Today at TriviaHub" strip
  (live daily status: "Trivia: 12,431 played today · Sudoku: 9,872", social proof via
  real numbers, refreshed daily).
- Replace the static value-prop cards with a **live room ticker** (rotating "someone
  just played X in a room", anonymized, privacy-safe), the party feel starts here.
- **Secondary CTA:** "Host a room in 10 seconds", a visible, honest promise.

### Navigation

- Consolidate to 5 items: **Play** (catalog + choose-for-me), **Daily**, **Games**,
  **Friends**, **Profile**. Game pages keep the compact header.
- Persistent "Now playing" pill when in a room (return-to-room from any page).

### Cards (catalog)

- Add metadata row: players · duration · energy (⚡/🕯) · content level · a11y icon.
- Hover: lift + "Play" overlay (already have lift removal, reintroduce as _gentle_
  2px lift with shadow, no height change).
- Skeleton loading states; favorite (♥) and "played ✓" states; completion ring
  (progression, 04).

### Game pages

- "Best for" block (group size, time, energy) above the fold, the CrowdParty gap.
- 3-step animated mini-demo (host view → player view → reveal), static steps with
  animated transitions.
- "Try solo rehearsal" (no room created), reuses SoloShell engines.

### Lobby

- **Host checklist:** invite link copied ✓, players connected (green dots), min-player
  recommendation, "Start when ready".
- Room status bar: phase, last-sync time, participant connection indicators, expiry
  countdown + "keep alive" (CrowdParty's opacity problem, solved).
- Presenter mode: fullscreen toggle, large-type projection layout, keyboard shortcuts
  (Space = start/next, P = pause).

### Gameplay

- Player view: big timer ring, submission confirmation checkmark (the
  `submissionAccepted` echo, exists server-side, surface it in UI), private/public
  answer labeling.
- Host view: reveal control with "everyone answered" progress (count only, never leak
  answers), pause/extend timer, skip, report prompt.
- Scoreboard: delta animations, "You" highlighting, non-competitive classroom mode
  (rank hidden, scores shown as private).

### Results

- Podium with confetti (existing GameEnd views get the motion pass).
- "Play again" (same room, re-deal), "Remix" (new content, same settings), "Share
  results" (existing share image → richer card).
- Room transcript export for hosts (V2.0) + "delete participant data" (privacy).

### Daily hub

- Grid of 12 games, each with: today's status (played ✓ / streak flame / "new"),
  personal best, friend-best ("you're 20 pts behind Aditi"), and the Drawing Challenge
  winner announcement slot.

### Empty / error / offline states

- Empty catalog filter → illustration + "clear filters" + "surprise me".
- Room errors: differentiated invalid/expired/full/locked/host-offline/network (the
  join-PIN error taxonomy from research) with recovery actions.
- Offline banner + reconnect state on every live screen (amber pulsing bar, no modal).

## 5. Mobile

- Player-first mobile layout: thumb-zone primary actions, bottom-sheet prompts,
  44px+ targets (already enforced; audit again after motion pass).
- Host mode on mobile: portrait presenter fallback (PIN + controls top, no sidebars).
- Test matrix in CI: 320/375/390/768/1440 widths, iPhone 14 + Pixel 7 presets
  (M11 backlog item, move to V1.5).

## 6. Dark mode & theming

- Dark mode exists (M12). Extend: **per-game theme tokens** (gradient accents via CSS
  variables, PRD §11 BounceBox) that respect the active theme, contrast-tested per
  token pair.
- Seasonal skins reuse the token system (no hardcoded colors, the M12 rule stands).

## 7. Accessibility (WCAG 2.2 AA)

- Everything above is built on the existing token + focus-visible foundation; add:
  - Timer announcements via `aria-live` (existing) + optional **speech** toggle
    (WebSpeech) for classrooms and low-vision players.
  - Keyboard path for every game (drawing games get a "tap-to-place" fallback for the
    drawer; sketch games already have button-based tools).
  - Non-visual answer options: text labels for image/emoji questions.
  - Reduced-motion + high-contrast modes as first-class toggles in the profile.

## 8. Success metrics

- Lighthouse mobile ≥ 90 perf/a11y on landing, catalog, one game, one daily.
- Time-to-first-round p50 < 30s from page load.
- Confetti/sound toggle adoption: >40% of daily completions share or replay.
- 0 unhandled loading states (every async path has a timeout + recovery, audited).
