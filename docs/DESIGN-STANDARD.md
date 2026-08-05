# Design Standard — Trivia (merged system)

> Owned by the Design Lead. This doc is the **merged, binding design system**
> for the `design-airbnb` branch: the owner-approved Airbnb capture
> (`docs/DESIGN-AIRBNB.md`) + confirmed decisions (`docs/PLAN-SCOPE.md`
> D1–D10, R1–R17, escalations 3–6/9). Engineers implement from THIS doc;
> the Design Lead reviews against it. Anything here that conflicts with the
> capture resolves to the capture unless a decision overrides it (noted).
>
> Status: **v3 state reviewed 2026-08-05 — RETURN FOR CHANGES** (see
> §1). Specs (a)–(d) below are the change set the FE implements next.

---

## 1. Review record — design-airbnb branch, 2026-08-05

**Verdict: RETURN FOR CHANGES** (list at §7). The v3 pass as it stands is
sound — build green (43 pages), homepage HTML **48.8 KB** (< 100 KB gate),
de-emoji complete, documented axe 0 violations — but the branch's Phase A
assignment (R1/R3/R6/R13/R15/R2 per PLAN-SCOPE §3 Phase A) is **not yet
implemented**, and several chrome details diverge from the standard below.

- **Evidence base:** full branch read (`src/styles/global.css`,
  `src/components/**`, `src/layouts/BaseLayout.astro`,
  `src/pages/{index,games,daily/*,game/*}.astro`, `src/lib/{icons,daily,games}.ts`,
  solo/room/daily islands) + local `pnpm build` (green, 43 pages) +
  built-HTML checks.
- **Preview URL:** none exists yet — the branch is uncommitted and not
  deployed (no Cloudflare Pages preview). Reviewed via local build. The FE
  should push the branch so a preview URL exists for the next review gate.

---

## 2. The standard (merged token layer) — summary

Full token provenance lives in `src/styles/global.css` (per-token `[AIRBNB]`
/ `[OWNER]` / `[CARRY]` comments) and the capture. This section states the
**binding rules**, not a token re-derivation.

| Axis           | Rule                                                                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Canvas         | Light-first `#ffffff`. Ink `#222222` text. One Rausch `#ff385c` moment per view max; text-on-CTAs fill `#e00b41` (axe gate).             |
| Radii          | Controls 8px · cards 14px · plates 14px · pills 9999px (badge/pill variants only) · no other radii in chrome.                            |
| Elevation      | One tier: hairline + `shadow-sm` at rest; `shadow-md` hover-float. No translate on hover (reduced-motion + single-tier).                 |
| Focus          | Global 2px ink ring + 2px offset (white on dark). Inputs: 2px ink ring. No glow, no emerald.                                             |
| Touch          | Every interactive control ≥ 48×48px.                                                                                                     |
| Motion         | 120–150ms transitions; global reduced-motion kill switch. No auto-play, no parallax, no translate.                                       |
| Type           | Inter self-hosted. h1 28/700 · h2 22/500 · h3 21/700 · h4 20/600 · body 16/400 · small 14/400 · xs 13/400 · badge 11/600 · score 64/700. |
| Dark theme     | Full parity: every surface uses tokens; no light-only hexes (`bg-amber-100` etc.) inside islands.                                        |
| Chrome vs game | Chrome = tokens + in-repo SVG icons. Game content (puzzle data emojis) exempt. Behavior never changes as a side effect.                  |

---

## 3. Spec (a) — Game-page standard (D10)

One template for all **19 game pages** + all **live daily pages**. No
per-game chrome divergence. Rendered by `src/pages/game/[slug].astro` and
`src/pages/daily/[slug].astro` from catalog data — never hand-written per
page.

### 3.1 Page anatomy

```
BaseLayout (80px nav + footer + mobile tab bar)
└── article (max-w-7xl, flex flex-col gap-8)          ← rhythm unit = 32px (gap-8)
    ├── header                                          ← Spec 3.2
    ├── hero image band (game pages only)               ← Spec (c) §5.4, figcaption credit
    ├── section[aria-label="Play {name}"]               ← control surface, one Card frame
    │   └── Card (14px, hairline, shadow-sm) ← island hydrates here
    ├── How to play / SEO content / FAQ                 ← existing Cards, unchanged rhythm
    └── Related games rail                              ← Spec (c) §5.4, 4:3 thumb rows
```

### 3.2 Header (title / tagline / chips)

**Game pages** (`game/[slug].astro`):

| Slot        | Content                                                                        | Style                                     |
| ----------- | ------------------------------------------------------------------------------ | ----------------------------------------- |
| Family chip | `{family} game` (filter variant, Rausch tint)                                  | `<Chip>` — exists                         |
| Title       | `game.name`                                                                    | `text-h1` (28/700), ink, left-aligned     |
| Tagline     | `game.tagline`                                                                 | body 16/400 `text-ink-muted`, `max-w-2xl` |
| Chip row    | `players` · `durationMinutes min` · `energyLabel` (+ New/Popular when flagged) | neutral pills (below)                     |

**Daily pages** (`daily/[slug].astro`):

| Slot          | Content                                                  | Style                                                             |
| ------------- | -------------------------------------------------------- | ----------------------------------------------------------------- |
| Category chip | `{category} · daily game` (filter variant)               | `<Chip>` — exists                                                 |
| Title         | `game.name`                                              | `text-h1`, ink, left-aligned (drop the centered + icon treatment) |
| Tagline       | `game.description`                                       | body 16/400 muted, `max-w-2xl`                                    |
| Chip row      | `{estimatedMinutes} min` · `Live`/`Coming soon` · `Free` | neutral pills                                                     |

**Chip row definition** (shared, `.pb-chip`):
`inline-flex items-center gap-1.5 rounded-pill bg-surface-muted px-3.5 py-1.5 text-xs font-semibold text-ink`.
Rausch stays on the ONE CTA moment, never the chip row. The daily header
icon (`<Icon name={game.emoji} size={28}>` today) is removed — the title
carries the name; the icon belongs on the card plate (Spec (c)).

### 3.3 Control surface

Every playable island renders inside **one Card frame**. Inside the frame
the shared state chrome is standardized:

- **Solo / daily games** → `SoloShell` is the frame (exists). Pin its header
  pills: `[name]` neutral pill · `Round x of y` `bg-success-soft` ·
  `Score: n` neutral pill · streak `bg-warning-soft` + `flame` icon. Replace
  `bg-amber-100` with `bg-warning-soft` (dark parity, §7 P2-17).
- **Room games** → `RoomLobbyPanel` is the frame (exists): create/join cards,
  leaderboard, chat, sticky bottom action bar on mobile (above tab bar).
- **One-screen games** → `WouldYouRatherOneScreen` follows the same Card
  frame; its action buttons use the shared `.pb-btn` classes (§3.5).

**Buttons and inputs inside islands use the shared CSS classes, not
hand-rolled utility strings.** This is the single biggest divergence fix.

### 3.4 Results / summary area

The results anatomy (from `SoloShell` done view — the standard):

1. Heading `Game over!` — `text-h2` (22/500).
2. Score moment — `text-score` (64/700) — **the one loud type moment**.
3. Game-specific summary slot.
4. Nickname `Input` + `Save my score` primary `.pb-btn` (48px, 8px radius).
5. Today's top 5 (`divide-hairline` rows).
6. `Share my score` (outline) + `Play again` (secondary).
7. Member one-tap conversion card.

Room-game results keep the existing results view in `RoomLobbyPanel`; the
score/leaderboard treatment mirrors items 5–6. No per-game result layouts.

### 3.5 Shared chrome classes (extract now)

Buttons and inputs are currently styled twice — once in
`src/components/ui/Button.astro`/`Input.astro` (Astro) and again as raw
utility strings inside every React island. Extract plain-CSS classes so both
sides share one definition (same pattern as the `pb-*` shape classes,
cheap per the budget gate):

- `.pb-btn` + variants `.pb-btn-primary` (bg `--color-primary-hover`, 8px,
  48px) · `.pb-btn-secondary` (ink outline, white) · `.pb-btn-tertiary` ·
  `.pb-btn-pill` · `.pb-btn-ghost` · `.pb-btn-destructive`, sizes
  small/medium/large. **Primary CTAs are 8px radius; pill is reserved for
  the pill variant and small secondary actions** (kills the room-lobby
  8px-vs-pill mix).
- `.pb-input` (56px, 8px, hairline, stacked muted label, 2px ink focus).

The `.astro` kit components then just wrap these classes; islands use them
directly. One definition, zero divergence.

### 3.6 Rhythm & responsive

- Page band rhythm: `gap-8` (32px) between sections; major bands `mb-16`
  (64px) — matches the capture's whitespace philosophy.
- Header chips `flex-wrap`; h1 never below 28px (no shrink).
- Control surface full-width, max readable width inside the card for
  question text (`max-w-2xl` where it exists today).
- Room action bar: sticky bottom on mobile above the tab bar (exists),
  static in-flow on `lg+` (exists).
- Touch targets in the frame: all `.pb-btn` ≥ 48px (small = 44px is NOT
  acceptable in the frame — small size stays ≥ 48px tall).

### 3.7 Retrofit plan (checklist)

1. Extract `.pb-btn`/`.pb-input` (§3.5) in `global.css`.
2. Refactor `game/[slug].astro` header → §3.2 template from `games.json`.
3. Refactor `daily/[slug].astro` header → §3.2 template from the registry.
4. Sweep islands to `.pb-btn`/`.pb-input` (SoloShell, RoomLobbyPanel,
   TriviaSolo, TriviaArena, VotingArena, CharadesArena, GuessWhoArena,
   CopycatArena, WouldYouRatherOneScreen, DailyHubStatus, DailyArchive, all
   solo islands).
5. Verify per page: `/game/{19 slugs}` + `/daily/{11 slugs}` render the
   template with zero per-game chrome.
6. `pnpm verify` green; behavior unchanged (guardrail).

---

## 4. Spec (b) — Icon system

### 4.1 Contract (exists, keep)

- `src/lib/icons.ts` — single source of truth: `IconName` union +
  `ICON_PATHS` (raw SVG inner markup). `Icon.astro` (pages) + `Icon.tsx`
  (islands) wrap it. Stroke defaults in `.pb-icon` CSS (cheap repeats).
- 32×32 viewBox, `currentColor`, stroke-width 1.75 default (1.25–1.5 for
  decorative moments ≥ 40px; 2.0 for 14px micro), round caps/joins, content
  inside the 4–28 optical box. Filled dots for detail (target center, mask
  eyes) allowed. No icon font, no dependencies, no per-card inline SVG
  (CSS shapes like the play-orb triangle are the cheaper alternative).

### 4.2 Rules

| Rule       | Binding detail                                                                                                                                                                                                         |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Naming     | kebab-case, semantic object names (`user`, `globe`), not contexts (`settings-menu`). New glyphs append to the union + table.                                                                                           |
| Sizes      | 14–18 inline chrome in islands · 18–22 nav/tabs/buttons · 22–28 section headers · 28–44 illustrated moments (empty states, coming-soon) · never > 48 in chrome.                                                        |
| A11y       | Icons are decorative: `aria-hidden="true"` always; labels live on the control (`aria-label`), never in the glyph.                                                                                                      |
| Emoji line | **Chrome emojis are banned** (replaced by this set). **Exempt:** puzzle-data content emojis (`emoji-plots.json`, daily drawing/music clues, copycat images).                                                           |
| Family map | `FAMILY_ICONS` must track the R3 union: `drawing→pencil`, `solo→user`, `party→confetti`, `quiz→question`. `voting/special` keys deleted. (`ballot` glyph itself stays in the set — cheap, may serve archive surfaces.) |
| Budget     | Glyph additions must keep the homepage HTML < 100 KB (stroke defaults in CSS are the lever).                                                                                                                           |

### 4.3 Known gaps

- No `party` glyph needed: reuse `confetti` (already the special icon).
- `globe` becomes unused after D6 (geography removal) — keep in the set.
- The daily registry field is still named `emoji` but stores icon keys —
  functionally fine (components render via `Icon`); rename to `icon` is a
  P2 cleanup (touches tests; not required for the standard).

---

## 5. Spec (c) — Card-image direction (R2, D3, escalation 6.5/6.9)

Art direction only — sourcing/authoring is the content lots' work. This
spec sets the look, the plate, the licensing envelope, and the fields.

### 5.1 Art direction (the look)

- **Photography-led, warm, generous** — Airbnb property-card energy, not a
  stock-photo catalog. One hero image per game that _evokes the game's
  vibe_: people mid-laugh around a screen (party games), paint/canvas
  (drawing), popcorn/film reel (movies), music studio objects (music),
  maps/landmarks (World Peek), a library/bookshelf (trivia).
- **Constraints:** bright and warm (no dark/moody); no recognizable people
  (no model-release exposure); no text-in-image, no logos, no brand marks;
  no copyrighted artwork dominating the frame (freedom-of-panorama rule,
  CONTENT-SOURCING precedent).
- When no PD/CC0 photo fits a game, a **self-created SVG illustration** is
  sanctioned (R2 + escalation 6.5) — same palette, same 4:3 plate.
- **No monogram tiles, no emojis on cards** (R2 acceptance; supersedes the
  v3 monogram plate).

### 5.2 Sourcing & hosting (escalation 6.5 — binding)

- **Self-hosted** `public/images/games/{slug}.webp` — no Wikimedia hotlinks
  (rename risk kills images silently).
- Licenses: PD / CC0 / CC-BY / CC-BY-SA only. **CC-BY-NC/ND banned.**
- CC-BY/SA requires the credit: visible on results/reveal surfaces
  (SoloShell done view) and a `<figcaption>` under the game-page hero image
  (escalation 6.9) + machine-readable `imageCredit` field.
- Format: webp preferred, ≤ 1200px wide (JPEG/PNG ≤ 1200px acceptable).
  No new dependencies (reuse `scripts/` resize tooling).
- Authoring-time 200 check per image (CONTENT-SOURCING QA gate).

### 5.3 The plate (GameCard / DailyCard)

| Property     | Value                                                                                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aspect ratio | **4:3** plate (keeps the existing grid density; deviation from the capture's 1:1 property cards, documented — 4:3 reads better in a 3-col game grid) |
| Object fit   | `cover`, centered                                                                                                                                    |
| Radius       | 14px (plate) — existing `.pb-card-plate`                                                                                                             |
| Overlay      | Keep: floating white pill badge top-left, Rausch play orb top-right                                                                                  |
| Alt          | `alt=""` — decorative; the card title carries the name                                                                                               |
| Loading      | `loading="lazy"` `decoding="async"` + explicit `width`/`height` (reserve ratio, no CLS) — every card image below the fold                            |
| Dark theme   | Same image; plate fill falls back to `--color-surface-muted` while loading                                                                           |

New `.pb-card-img` class (plain CSS, token-resolved): `width:100%; aspect-ratio:4/3; object-fit:cover; border-radius:14px; background:var(--color-surface-muted);` — replaces `.pb-card-emoji`/`.pb-card-monogram` usage.

### 5.4 Surfaces

- **GameCard** (homepage, `/games`): 4:3 image plate. **DailyCard** (daily
  hub): same plate; daily assets **reuse the parent game's image** by
  default (registry `image` field points at the same asset — no new assets,
  satisfies "every live surface has an image").
- **Related-games rail** (game pages): row cards with a 4:3 thumb
  (≈ 64×48px, rounded, lazy) + title + tagline — replaces the current
  text-only `Card` rows.
- **Homepage rails** (Trending now, Multiplayer rooms): row cards gain the
  same 4:3 thumb (they are list rows, not full cards). The "New games"
  pill rail stays pills (a quick-access rail, documented as out of card
  scope).
- **CategoryStrip circles:** keep icon glyphs — at 64px circles, photos are
  noise; the strip is a filter, not a card surface (documented).
- **Game pages:** add a 16:9 hero image band (rounded-lg, cover) between
  header and play section, `<figcaption>` credit (escalation 6.9). Hero
  image is eager (above the fold); card images stay lazy.

### 5.5 Fields (additive, no existing-field changes)

```jsonc
// src/data/games.json per game:
{ "image": "/images/games/skribbl-arena.webp", "imageCredit": { "creator": "…", "license": "by" } }
// src/lib/daily.ts per registry entry:
image: "/images/games/{slug}.webp"   // reuse parent game asset
```

### 5.6 World Peek map styling

Self-made simplified SVG world map, zero external assets (R4 acceptance):

- Light theme: ocean `--color-surface-soft` (#f7f7f7), land white with
  hairline stroke (`--color-border`), 1.5px stroke, rounded coastlines.
  Guess pin = Rausch circle with white center; actual pin = ink circle;
  guess→actual connector = dashed hairline. Distance rings = hairline
  circles around the guess.
- Dark theme: invert — land `#2b2b2b`, ocean ink, pins unchanged (Rausch
  reads on both).
- No labels, no tiles, no external map tiles. One simplified path set in
  `src/lib/world-peek.ts` (or the island).

### 5.7 OG assets

**Parked, do not redesign** (PLAN-SCOPE §5): OG images keep the dark
canvas (DESIGN-MERGE owner decision 5 — dark cards pop in light social
feeds). `scripts/generate-og.mjs` text overlays update for R1 only
("TriviaHub" → "Trivia"); no regen, no light pass.

---

## 6. Standards enforcement (review gate checklist)

Re-checked on every FE review: contrast (WCAG AA; Rausch text-on-tint uses
`--color-primary-strong`; white text on CTA fill `#e00b41`), 2px ink focus,
touch ≥ 48px, motion (no translate; reduced-motion kill switch intact),
dark-theme parity (no light-only hexes in islands), responsive (no
overflow/wrap), homepage HTML < 100 KB, no new dependencies, no chrome
emojis, no monogram cards, behavior unchanged.

---

## 7. Fix list — design-airbnb branch (binding, evidence-cited)

Order: P0 (branch acceptance blockers) → P1 (standard compliance) → P2
(polish). Files cite the exact evidence.

### P0 — Acceptance blockers (Phase A requirements not yet on the branch)

1. **R1 rebrand — "TriviaHub" in user-facing copy everywhere.** Evidence:
   `BaseLayout.astro` L120 logo `Trivia<span>Hub</span>`, L192 `© 2026
TriviaHub`; `index.astro` L42 title, L77 "Today at TriviaHub", body copy
   L203–207/287; `games.astro` L31 title; `game/[slug].astro` L51/96
   JSON-LD + title; `daily/[slug].astro` L41/62; `daily/index.astro`
   L27/34; `categories/index.astro` L56/57/65; `404/500.astro` titles +
   "Back to TriviaHub"; `scripts/generate-og.mjs` text overlays. Fix: sweep
   to "Trivia" (wordmark ink, legal line "© 2026 Trivia"), meta, JSON-LD
   `name`, OG text; add the smoke absence gate (R1 acceptance).
2. **R6 — "Daily Games" → "Daily Challenges" not renamed.** Evidence: nav
   `BaseLayout.astro` L23, footer L45, `daily/index.astro` L27 JSON-LD +
   copy, `daily/[slug].astro` L54 breadcrumb; 10 occurrences in built HTML.
   Fix: copy sweep + smoke/sitemap strings (URLs stay `/daily/*`).
3. **R3 — families still `voting`/`special`.** Evidence: `src/lib/games.ts`
   L10 union; `games.json` (4 `voting`, 2 `special`); `index.astro` L16–22;
   `games.astro` L17–23; `CategoryStrip.astro` L12–18;
   `categories/index.astro` L15/27; `FAMILY_ICONS` keys; `game/[slug].astro`
   L160 `family === 'voting'` branch. Fix in ONE PR (risk 10): union →
   `drawing|solo|party|quiz`, catalog values, UI copy, related-games logic,
   `games.test.ts`/`special.test.ts` updated in the same change.

### P1 — Standard compliance (specs (a)–(d))

4. **D10 template not implemented** (§3). Game pages lack the
   players·duration·energy chip row; daily header is centered-with-icon
   instead of the §3.2 template; no shared frame classes. Implement §3.
5. **Island buttons/inputs duplicated instead of kit-defined** (§3.5).
   Evidence: `RoomLobbyPanel.tsx` L162/L208/L321 (pill vs 8px mix),
   `SoloShell.tsx` L218/L290 (pill), `DailyHubStatus.tsx` L222, hand-rolled
   `focus:ring-2` inputs L152–157 etc. Extract `.pb-btn`/`.pb-input`; sweep.
6. **Touch targets < 48px.** Evidence: theme toggle 40×40 (`BaseLayout.astro`
   L143 `h-10 w-10`); `DailyHubStatus.tsx` claim button L222 `min-h-11`;
   `SoloShell.tsx` share L283 + keep-progress L243 `min-h-11`;
   `EmptyState.astro` L31 action `min-h-11`; `index.astro` FAQ L307
   `min-h-11`. Bump all to 48px.
7. **R15 — `DailyHubStatus` is still the full box**, not the one-liner.
   Evidence: guest heading "Your day at TriviaHub" L164 (also R1), grand
   streak `text-score`, 7-day strip, per-game pills. Collapse to one
   summary line + guest one-tap CTA. **Design call:** render the streak
   flame as the in-repo `flame` icon, not the raw 🔥 emoji (R15 copy intent
   kept; no-emoji-in-chrome guardrail holds; copy words remain content
   lots' property, I set the typography: `text-small` ink, flame in
   `--color-primary-strong`).
8. **R2 — cards still show monogram tiles, no images.** Evidence:
   `GameCard.astro` L23, `DailyCard.astro` L20 (`pb-card-monogram`);
   `games.json` has no `image` field. Implement §5 (fields, `.pb-card-img`,
   lazy, credits).
9. **Game pages / related rail / homepage rails have no image surfaces** —
   `game/[slug].astro` L231–241 text-only related cards; `index.astro`
   L101–143 rows. Implement §5.4 (hero band + figcaption, thumbs).
10. **R14 sweep items:** `hover:-translate-y-0.5` on rails (`index.astro`
    L103/L134) violates the single-elevation/no-translate rule — remove.

### P2 — Polish & consistency

11. **Dark parity:** `SoloShell.tsx` L173 `bg-amber-100` is a light-only
    hex — replace with `bg-warning-soft text-warning-strong`.
12. **`index.astro` FAQ "Visit the FAQ" button** (L305–309) hand-rolls
    `bg-primary-hover` — use the Button kit / `.pb-btn`.
13. **`game/[slug].astro` "Play today's daily" link** (L109–117) is a
    hand-rolled pill — use `.pb-btn-pill` (ghost tint) for consistency.
14. **`SoloShell` score pill** `bg-tertiary/40` + ink is fine on light but
    check dark (amber 40% over `#2b2b2b`) — use `bg-warning-soft
text-warning-strong` if it fails; verified at next review.
15. **Optional:** rename daily registry `emoji` → `icon` (accurate; touches
    tests — P2 only, not required).
16. **`games.json` `players` field** is a free string ("2-24 players") —
    keep; chips render it verbatim.

---

## 8. Report to the Orchestrator (2026-08-05)

- **Specs delivered:** (a) game-page standard §3 · (b) icon-system spec §4 ·
  (c) card-image direction §5 · (d) fix list §7 (3 P0 + 6 P1 + 7 P2).
- **Verdict:** RETURN FOR CHANGES on the branch's Phase A scope; v3 state
  itself APPROVED AS FAR AS IT GOES (build green, budget ok, axe 0).
- **Defaults chosen (conservative, note if the CEO objects):** 4:3 card
  plate (vs capture 1:1); R15 streak flame as SVG icon; daily cards reuse
  parent game images; CategoryStrip stays icon glyphs; OG stays dark.
- **Needs the CEO's eye:** nothing blocking. The R15 one-liner copy is
  content-lots' call once the icon/typography decision above is accepted.
- **Needs DevOps:** push the branch so a preview URL exists for the next
  review gate.
