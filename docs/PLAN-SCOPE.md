# Plan Scope: "Trivia" Program (M21–M22)

> Program plan (2026-08-05; amended by CEO follow-ups #1 and #2 — all
> follow-up requirements are **launch-blocking** unless marked otherwise).
> Source of truth for the owner-approved slate: rebrand to **"Trivia"**,
> real card images, family restructure, World Peek, hub restructure to 7
> owner-curated dailies, Daily Chess, Daily Wordle, topic trivia, true
> answer randomization, year-range filters, mobile sweep, streak-box
> simplification, LinkedIn-style puzzles, research legs, content-quality
> program.
>
> **Authority:** this program brief wins where it disagrees with an in-repo
> doc; where silent, in-repo docs apply. Supersessions: `DESIGN-MERGE.md` →
> `DESIGN-AIRBNB.md`; the earlier program-brief name ("Trivia and Games")
> → R1 **"Trivia"** (CEO's latest instruction, 2026-08-05); R20's
> "Verdal" → **"Wordle"** (owner instruction 2026-08-05); BIG-PLAN's
> daily math (16) and this brief's earlier math (15) → **7** (R18).
> `docs/BIG-PLAN.md`, `docs/DAILY-DESIGN.md`, `docs/DAILY-SCOPE.md`,
> `docs/CONTENT-SOURCING.md`, `docs/PRD.md`, `docs/ARCHITECTURE.md`,
> `docs/TESTING_STRATEGY.md`, `docs/BRANDING.md` remain authoritative for
> everything not restated here.
>
> **Deliverable contract:** a Tech Lead can produce designs from this doc
> without asking anything; content authors can start Lot #1 (§4) now.

---

## 0. Program at a glance

| Axis         | Value                                                                                                                                                                                                                               |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name         | **Trivia** (user-facing; never "TriviaHub"); domain `playtriviahub.com`, storage keys `triviahub:*`, package names `@triviahub/*` unchanged (D1)                                                                                    |
| Daily count  | 12 live today → **11** (D6 deletion, in flight — Backend PR-1) → **7 at launch** (R18 hub restructure + R19 chess + R20 wordle + R16 puzzles): trivia, sudoku, chess, wordle, crown-logic, clue-trail, word-ladder                  |
| Catalog      | 19 games → **26 normal games** (+World Peek, Name That Song, Real or Fake, Prompt of the Day, Crown Logic, Clue Trail, Word Ladder) + **2 daily-only entries** (chess, wordle) = 28 rows                                            |
| Branch lanes | Phase A → `design-airbnb`; Phase 0.5 / B / C / D → `main`; `main` merged into `design-airbnb` **before** its final merge (long-lived branch, risk 6)                                                                                |
| Verify gate  | `pnpm verify` green at every phase boundary (currently **187 client + 190 server** tests, builds, smoke, homepage HTML < 100 KB, bundle budgets)                                                                                    |
| Milestones   | **M21 in flight** (Backend PR-1 = D6 geography deletion; design branch v4 iterations). **M22 = this program's launch package** (everything marked launch-blocking must ship before public adoption; the site is live but pre-scale) |

**Binding gates (all phases).** No new npm dependencies · fonts: self-hosted
Inter only · focus: 2px ink ring (light) / inverted (dark) · touch targets
≥ 48px · contrast: Rausch `#ff385c` CTAs ≥ 4.5:1 — darken fill to `#e00b41`
where flagged (design branch already does this at the component layer) ·
images: lazy-loaded, compact (webp/avif or ≤ ~1200px), runtime assets NOT
bundled into HTML (homepage gate) · drawing canvas stays white (D036).

---

## 1. Requirements (R1–R22)

**CEO-label mapping** (the CEO's follow-up numbering vs this plan's):
CEO R5 (World Peek) = plan R4+R5 · CEO R6 (trivia topics) = plan R10 ·
CEO R7 (competitor research) = plan R21 · CEO R8 (hub restructure) = plan
R18 · CEO R9 (chess) = plan R19 · CEO R10 (Wordle) = plan R20 · CEO R11
(GeoGuessr research) = plan R22.

### R1 — Rebrand: TriviaHub → "Trivia"

- **Intent:** the brand is simply "Trivia" (owner decision 2026-08-05;
  supersedes "Trivia and Games"); never "TriviaHub" in user-facing copy.
- **Confirmed constraints (D1):** keep domain `playtriviahub.com`, storage
  keys `triviahub:*`, package names (`@triviahub/server`, etc.) for SEO
  equity and storage continuity — a domain change is a separate owner
  decision.
- **Acceptance:** zero user-facing "TriviaHub" in logo, nav/footer, page
  titles/meta descriptions, JSON-LD, OG image text, 404/500 pages,
  contact/legal copy, README/PRD/BRANDING docs; code identifiers, routes,
  keys, packages unchanged. Enforce with a smoke-check absence gate
  ("TriviaHub" must not appear in any rendered page, §8 R1).
- **Surfaces:** `src/layouts/BaseLayout.astro` (logo, nav, footer),
  `src/components/SEOHead.astro` + per-page `title`/`description` props,
  JSON-LD blocks (`index.astro`, `game/[slug].astro`, `daily/index.astro`,
  `daily/[slug].astro`, `categories/index.astro`),
  `scripts/generate-og.mjs` + `public/og/*` text overlays,
  `public/site.webmanifest`, `404.astro`/`500.astro`, `README.md`,
  `docs/PRD.md`, `docs/BRANDING.md`. "Your day at TriviaHub" in
  `DailyHubStatus.tsx` dies with R15.

### R2 — Real images at the center of cards (D3)

- **Intent:** game/category/daily cards must show photos or illustrations —
  NOT emojis, NOT monogram letter tiles.
- **Scope:** 1 image per game (**28** catalog rows at launch), 1 per family
  (**4** after R3), 1 per daily game (**7** after R18 — the count follows
  the live registry, not a frozen slate number).
- **Sources:** Wikimedia Commons PD/CC0/CC-BY with credit line
  (price-products precedent) or self-created SVG illustrations. CC-BY-NC/ND
  banned. Hosting per §6.4 (recommend self-hosted `public/` copies — kills
  the Wikimedia rename risk).
- **Acceptance:** every card surface (homepage, `/games`, `/categories`,
  daily hub, game pages, related) shows an image; credits appear on reveal
  (results surfaces) and in a machine-readable credit field; images
  lazy-loaded; homepage HTML stays < 100 KB; runtime assets not bundled.
- **Surfaces:** `src/data/games.json` (+`image`/`imageCredit` additive
  fields), `src/components/GameCard.astro`, `DailyCard.astro`,
  `CategoryStrip.astro`, daily hub (`src/pages/daily/index.astro`), game
  pages (`game/[slug].astro`), results surfaces (SoloShell done view),
  `docs/CONTENT-SOURCING.md` (license table + hosting decision).

### R3 — Delete the "Voting" family; merge into "Party"

- **Intent:** "Voting" is mechanic jargon; the product category is party
  games.
- **Scope:** Would You Rather, Most Likely To, Never Have I Ever, This or
  That move to a renamed **Party** family (from `special`); Charades +
  Guess Who already live there. `type: multiplayer-voting` stays internal.
- **Acceptance:** `GameFamily` union becomes `drawing | solo | party |
quiz`; `games.json` family values updated; homepage family sections,
  `/categories`, category strips, game-page chips, and related-games all
  render Party correctly with zero "Voting" user-facing copy; catalog
  tests updated in the same PR (`special.test.ts`, `games.test.ts` family
  counts, categories, related-games expectations). Server impact: none
  (`Game` model stores slug/name/type only).
- **Surfaces:** `src/lib/games.ts`, `src/data/games.json`,
  `src/pages/index.astro`, `src/pages/categories/index.astro` (hardcoded
  `families` array + "Voting Games"/"Party Classics" copy),
  `src/components/CategoryStrip.astro`, game pages,
  `src/lib/__tests__/games.test.ts`, `src/lib/__tests__/special.test.ts`.

### R4 — Scrap Daily Geography COMPLETELY (D6; **in flight — Backend PR-1**)

- **Intent:** the photo 1-of-4 quiz the owner hates is gone for good;
  World Peek (R5) replaces it with a different mechanic and fresh data.
- **Acceptance:** delete `src/data/daily-geography.json`,
  `src/lib/geography.ts`, `src/lib/__tests__/geography.test.ts`,
  `src/islands/daily/GeographyDaily.tsx`, the `daily.ts` registry entry
  AND `'geography'` from `DailyCategory`, the `[slug].astro` branch, the
  `LIVE_DAILY_GAMES` entry (12 → 11), sitemap URL, smoke checks, and
  lockstep/daily test counts — **one PR, `pnpm verify` green**. Do not
  reuse geography data in World Peek. Include a repo-wide grep for
  `geography`/`GeographyDaily` and a smoke check asserting
  `/daily/geography` 404s (risk 12).
- **Surfaces:** as listed; plus `src/lib/__tests__/daily.test.ts`
  (12 → 11 live) and `src/lib/__tests__/games.test.ts` (lockstep
  auto-updates).

### R5 — World Peek (GeoGuessr-style; **launch-blocking**; CEO R5)

- **Intent:** photo → guess location. **Confirmed name: World Peek** —
  "GeoGuessr" is trademarked; never reference it on-page (R22 research
  confirms the safety case).
- **Mechanics:** photo → pin on a self-made simplified SVG world map →
  distance-based scoring; 10 seeded rounds; fresh `lat`/`lon`/`region`
  dataset, **2,000–3,000 photos per D12** (up from the earlier 200+
  floor). Map renders without external assets; no map tiles, no external
  APIs (R22).
- **Daily-registry implication (reconciled):** the CEO follow-up's "11 →
  12" predates the R18 hub restructure. The final launch hub is **7
  curated dailies and World Peek is NOT in it** — World Peek ships
  **solo (random seed) at launch**; a daily mode can be added post-launch
  (needs the `'geo'` `DailyCategory` token, added then — confirm at Phase
  0, §6.1). This removes all registry/lockstep surface for R5 at launch.
- **Acceptance:** solo mode playable (10 rounds, seeded pick per game,
  random seed per play); pin → distance scoring with round results
  (per §8.1 reveal pattern: full-bleed photo, tap-to-pin mini-map,
  animated distance reveal, share card via SoloShell); dataset quotas +
  coordinate sanity + licensing tests; catalog entry, game page, sitemap,
  smoke, unit tests (engine + seed determinism).
- **Sequencing vs M21:** data authoring (L7) starts immediately (no
  registry dependency); engine implementation after Backend PR-1 merges
  (avoids `daily.ts`/`daily-games.ts` conflicts with the deletion PR).
- **Surfaces:** new `src/data/world-peek.json`, `src/lib/world-peek.ts` +
  tests, `src/islands/solo/WorldPeek.tsx`, `src/data/games.json` (catalog
  entry), `src/pages/game/[slug].astro` (auto via catalog),
  `public/sitemap.xml`, `scripts/smoke.mjs`, share card (name flows via
  registry).

### R6 — "Daily Games" → "Daily Challenges" (D7)

- **Intent:** user-facing clarity.
- **Acceptance:** every user-facing occurrence renamed — nav label
  (`BaseLayout.astro` `navLinks`), meta titles/descriptions, daily hub copy
  (`/daily` + `/daily/archive`), footer links, "Your day" copy. Code
  identifiers (`dailyGames`, `DailyGame`, `/daily` routes) and storage keys
  stay. Smoke/sitemap string checks updated.
- **Surfaces:** `src/layouts/BaseLayout.astro`, `src/pages/daily/index.astro`,
  `src/pages/daily/archive.astro`, `src/pages/daily/[slug].astro` (meta),
  `src/components/SEOHead.astro` (defaults), `scripts/smoke.mjs`,
  `public/sitemap.xml` (labels unchanged — URLs stay `/daily/*`).

### R7 — True answer randomization

- **Intent (owner bug):** the correct answer is always "A".
- **Scope:** every option-based engine — trivia (solo + daily + room),
  music, movies, would-you-rather (dilemma order), genre games (audit ALL
  option arrays, incl. `trivia-questions.json` answer indexes).
- **Mechanics:** seeded shuffle per round — deterministic per day for
  dailies (seed = `dailyGameSeed(dateKey, slug)`), random seed for solo
  non-daily. Answer index derived after shuffle; datasets keep their
  `answer` field untouched (shuffle at render, not in data).
- **Acceptance:** golden tests asserting correct-answer position varies
  across seeds/days (never fixed at index 0); existing lockstep/daily
  tests stay green; no engine returns predictable positions.
- **Surfaces:** `src/lib/pick.ts` (add shared `shuffleOptions`/
  `shuffleQuestion` helpers — the DAILY-DESIGN shared-engine home),
  `src/lib/trivia.ts`, music + movies engines (`src/lib/music.ts`,
  `src/lib/movies.ts`), `src/lib/would-you-rather.ts`, genre engines +
  tests. Client-side shuffle at render keeps the server daily-challenge
  data (D032) untouched.

### R8 — Year-range filter

- **Intent:** "play what I grew up with."
- **Scope:** music, movies, charades, genre-swap, genre-bender,
  emoji-plot (all six per BIG-PLAN). After R18 these are normal games
  (Name That Song, Real or Fake, charades, genre games, emoji plot) —
  filters live on their game pages.
- **Mechanics:** `year`/`decade` metadata added to datasets (fill gaps:
  charades and genre-swaps lack years today); decade preset UI (60s–20s +
  All) on game pages; filter content client-side **before** seeding;
  datasets carry decade quotas so every filter serves content.
- **Acceptance:** filter present on the 6 game pages, dataset quotas
  enforced by tests, no empty decade states.
- **Surfaces:** dataset JSONs (`daily-music.json`, `daily-movies.json`,
  `server/src/data/charades-movies.json`, `genre-swaps.json`,
  `genre-benders.json`, `emoji-plots.json`), 6 game islands, dataset
  tests.

### R9 — Sudoku native keyboard input (D8)

- **Intent:** type numbers, don't tap a fake pad.
- **Scope:** cells become real `<input>`s — `inputMode="numeric"`,
  digit-only, arrow-key navigation, Backspace/Delete erase; **remove** the
  on-screen number pad and Erase button; works on desktop physical
  keyboards AND mobile/tablet native virtual keyboards.
- **Acceptance:** full keyboard play-through on PC + mobile; sudoku
  generation/solving lib untouched; tests updated.
- **Surfaces:** `src/islands/solo/Sudoku.tsx`,
  `src/lib/__tests__/sudoku.test.ts`.

### R10 — Topic trivia (launch-blocking v1; CEO R6)

- **Intent:** category is too coarse; "play what I know."
- **Mechanics:** category → clickable topic list → 10-question set;
  dataset gains `topic` field; quality pass on the existing 525 questions;
  **v1 (pre-launch) target: 1,000+ questions / 40+ topics**. Topic order
  per owner: **TV series first, then Movies & Film, Sports, Music,
  History, Indian topics** (Cricket, Bollywood, Indian History per D13).
  The post-launch content-scale program (D12) continues growth beyond v1.
- **Picker UX (two-step):** category chips → topic cards with
  **difficulty + question-count badges**; "play again with new topic"
  affordance (orchestrator input; Designer owns final styling, §8.1).
  R21 research (botanica/kahoot) feeds the picker design.
- **Scope boundary (per CEO):** the **Daily Trivia stays an
  owner-picked curated set** (existing D032 server-seeded challenge) —
  the picker applies to the **normal game only** (TriviaSolo normal mode;
  room mode deferred, out of v1).
- **Acceptance:** two-step picker on the normal trivia game page;
  topic-filtered rounds of exactly 10; quality pass documented
  (accuracy/difficulty/dedup); 1,000+ questions / 40+ topics with per-
  topic ≥ 10 questions, quotas test-enforced; daily trivia unchanged.
- **Surfaces:** `src/data/trivia-questions.json` **and its server mirror
  `server/src/data/trivia-questions.json`** (both must stay in sync — the
  mirror feeds `server/src/lib/daily-seed.ts` and room trivia),
  `scripts/generate-trivia.mjs`, `src/lib/trivia.ts`,
  `src/islands/TriviaSolo.tsx` (picker renders only in normal mode),
  dataset tests. Content lots L1 + L2 (§4).

### R11 — Emoji Plot + Music clue quality (D9)

- **FACT:** no licensed third-party emoji source exists; both datasets are
  hand-authored in-repo — the fix is a **rewrite program**, not a source
  swap. After R18 the datasets feed normal games (Emoji Plot, Name That
  Song) — unchanged intent.
- **Scope:** standardized 4–6 emoji per entry, hint tiers, difficulty
  calibration, volume growth.
- **Acceptance:** every entry conforms to the standard (schema-validated),
  difficulty curve calibrated, volume quotas met, golden seed tests green.
- **Surfaces:** `src/data/emoji-plots.json`, `src/data/daily-music.json`,
  `src/lib/emoji-plot.ts`, `src/lib/music.ts`, tests. (Lots L5/L6 —
  post-launch program; island-level fixes only in Phase B.)

### R12 — Price Is Right images (D9)

- **FACT:** Amazon product images are copyrighted and hotlink-blocked —
  legally infeasible; current Flickr/rawpixel CC photos are "random".
- **Fix:** curated, recognizable branded-product photography (CC/Wikimedia)
  - product name + description + specs + a richer reveal page.
- **Acceptance:** every product has a recognizable image + credit; reveal
  page shows name/description/specs; licensing table updated.
- **Surfaces:** `src/data/price-products.json` (+`image`/`credit`/`specs`
  fields), `src/islands/solo/PriceIsRight.tsx` (reveal),
  `docs/CONTENT-SOURCING.md`.

### R13 — Game-page UI standard (D10)

- **Intent:** all game pages + daily pages share one template.
- **Scope:** header (title/tagline/players·duration·energy chips),
  consistent control surface, consistent results/summary area, consistent
  rhythm + (orchestrator input) **sticky mobile action bar + next-game
  row** — retrofitted in the design branch.
- **Acceptance:** template implemented once, all pages render through it;
  no per-game chrome divergence.
- **Surfaces:** `src/pages/game/[slug].astro`, `src/pages/daily/[slug].astro`,
  shared chrome in islands, `src/layouts/BaseLayout.astro`.

### R14 — Mobile friendliness sweep (whole site)

- **Acceptance:** touch targets ≥ 48px, no overflow/wrapping, tables and
  room screens usable, hero correct, tab bar labels one line — across
  home, `/games`, `/categories`, `/daily`, game pages, legal, 404/500.
  **Deliverable: a fixed-items list** (checked off per page, shipped with
  the branch).
- **Surfaces:** all surfaces above; no new architecture.

### R15 — Simplify the "Your day at TriviaHub" streak box (DailyHubStatus)

- **Intent:** one-line summary, e.g. "🔥 12-day streak · 3 of 7 played
  today" (counts follow the 7-game hub).
- **Constraint:** member pipeline untouched (DailyRun/streaks API is not
  to be changed — UI only).
- **Acceptance:** the box renders a single summary line for members and
  guests (exact copy per §6.5), keeps the one-tap member conversion for
  guests; no API/schema change.
- **Surfaces:** `src/islands/daily/DailyHubStatus.tsx`, daily hub page
  (`src/pages/daily/index.astro`).

### R16 — LinkedIn-style puzzle games (D4; launch-blocking — they land in the curated hub)

- **Confirmed names:** **Crown Logic** (queens-style algorithmic, n×n grid
  generator + solver, seeded, difficulty tiers 5–9 — defaults per §6.7),
  **Clue Trail** (4–5 clue cards → guess the category, cost per clue,
  150+ curated clue sets), **Word Ladder** (seeded start/end words + steps
  from the existing 5,686-word bank — `server/src/data/skribbl-words.json`).
- **Scope:** catalog entries, game pages, engines + unit tests, **daily
  registry entries (they are 3 of the 7 curated dailies)**, server
  lockstep (registry-driven, no route changes), sitemap + smoke, share
  cards. Names are trademark-safe; never say "like LinkedIn/Queens/
  Pinpoint/Zip" on-page (banned-string smoke gate, risk 1).
- **Surfaces:** `src/data/games.json` (+3), `src/lib/crown-logic.ts`,
  `src/lib/clue-trail.ts`, `src/lib/word-ladder.ts` (+ tests),
  `src/islands/solo/CrownLogic.tsx` / `ClueTrail.tsx` / `WordLadder.tsx`
  (+ daily wrappers), `src/lib/daily.ts` (+3), `server/src/lib/daily-games.ts`,
  `src/pages/game/[slug].astro` (auto), `daily/[slug].astro` branches,
  `public/sitemap.xml`, `scripts/smoke.mjs`. Content lot L8.

### R17 — Design branch absorbs accumulated UI feedback

- The design-airbnb work absorbs: hero = exactly 2 CTAs ("Play" → `/games`;
  "Create room" → `/games?mode=room`) + the `/games` page + room-mode
  wiring (`/game/[slug]?room=1` auto-triggers the existing create-room
  action — no room-API changes) — **all three shipped in v3, verify still
  correct after R2/R3**; one-line nav at every breakpoint (shipped);
  de-emoji → **images** (R2 supersedes the v3 SVG-icon card plates; small
  chrome icons like sun/moon may remain inline SVGs); family restructure
  (R3) reflected in nav/homepage/categories/related; game-page standard
  (R13). Orchestrator UI direction in §8.1 is "consider in scope" —
  Designer owns final styling.
- **Acceptance:** owner-approved preview of the branch, then merge to
  main (main merged in first, risk 6).
- **Surfaces:** `src/pages/index.astro`, `src/pages/games.astro`,
  `src/layouts/BaseLayout.astro`, `src/components/GameCard.astro`,
  `DailyCard.astro`, `CategoryStrip.astro`, `src/lib/games.ts`,
  `src/lib/daily.ts`, game/daily page templates (R13).

### R18 — Daily hub restructure (launch-blocking, high priority; CEO R8)

- **Intent:** the daily hub shrinks to **owner-curated dailies only**.
- **Final hub (7):** Daily Trivia (owner-picked set — **NOT** the
  user-pickable genre trivia; topic trivia is a normal game per R10) ·
  Daily Sudoku (existing) · Daily Chess (R19) · Daily Wordle (R20) ·
  Crown Logic · Clue Trail · Word Ladder (R16).
- **Demotions (9):** daily music, daily movies, daily emoji plot, daily
  timeline, daily price guess, daily rhyme, daily genre swap, daily
  genre-bender, daily drawing. Per-game decision:
  - **Merge into the existing normal game (6):** emoji plot, timeline,
    price, rhyme, genre swap, genre-bender — drop the daily mode +
    registry entry; normal pages already exist.
  - **Become a NEW normal game (3):** music → **"Name That Song"**,
    movies → **"Real or Fake"**, drawing prompt → **standalone game**
    (canvas + per-prompt gallery, reusing the DrawingDaily island in
    non-daily mode; submissions table stays).
- **Scope per game:** registry removal (client `daily.ts` + server
  `LIVE_DAILY_GAMES` lockstep, 11 → 2 → **7** as R19/R20/R16 land),
  daily-mode removal from islands, hub copy ("Twelve challenges" →
  **"7 daily challenges"**), sitemap (remove 9 `/daily/*` URLs, add new),
  smoke checks, share cards (daily share cards die for demoted games; new
  normal games get SoloShell share cards free).
- **Streak implications (note in scope):** the **grand-scope streak now
  spans the 7 live dailies**; **per-game streak scopes of the 9 demoted
  games die** — `DailyStreak` rows for those slugs remain in the DB but
  are never updated again (harmless; no migration). `DailyRun` history and
  personal bests for demoted games remain visible in `/api/me` and the
  archive. No member-pipeline changes.
- **Acceptance:** 7 live dailies (lockstep test), 9 demoted games render
  their normal-mode pages with zero daily references, `/daily/[slug]` for
  demoted slugs 404s (getStaticPaths drops them automatically), hub copy +
  sitemap + smoke updated, `pnpm verify` green.
- **Surfaces:** `src/lib/daily.ts`, `server/src/lib/daily-games.ts`,
  `src/pages/daily/index.astro`, `daily/[slug].astro`, `daily/archive.astro`,
  all 9 demoted islands, `src/data/games.json` (+3 new normal entries),
  new game pages (auto via catalog), `src/lib/__tests__/daily.test.ts`
  (7 live), `games.test.ts` (lockstep), `public/sitemap.xml`,
  `scripts/smoke.mjs`, `src/islands/daily/DailyHubStatus.tsx` (7 tiles,
  R15).

### R19 — Daily Chess (launch-blocking; CEO R9)

- **Intent:** one daily chess puzzle (mate-in-N or tactic), data-driven.
- **Mechanics:** FEN + solution moves, sourced from the **Lichess puzzle
  database (CC0) with attribution** (source recorded per puzzle; credits
  line on the reveal), validated by a **pure FEN validator — no runtime
  engine**.
- **Architect gate (mandatory):** chess.js or any engine dependency is a
  **PRD §2 stack question for the Software Architect**. The Architect's
  ruling must be recorded in the decision log **before implementation
  starts**. PM recommendation: pure validator + static puzzle data (no new
  dependencies — consistent with the binding gate).
- **Puzzle pipeline (recommended):** server-seeded daily (D032 pattern —
  dataset lives server-side, the day's FEN + solution served via the
  existing daily-challenge path; avoids a 1 MB client bundle). TL may
  choose a client-side seeded pool instead **only if** the embedded set
  fits the island bundle budget. PM recommends D032 server-seeded.
- **Scoring (default):** flat 100 on solve / 0 on fail (drawing flat-100
  precedent); tier affects daily rotation, not score. Submit via the
  standard daily pipeline (streak + PB).
- **Acceptance:** one seeded puzzle per day, same for everyone; FEN
  validated (pure validator tests); solution-move checking without an
  engine; solve → run recorded, streak + share card; dataset quotas +
  attribution tests; registry + lockstep + sitemap + smoke.
- **Surfaces:** new `server/src/data/chess-puzzles.json` (FEN + moves +
  themes + source), `server/src/lib/daily-seed.ts` (chess seeding), FEN
  validator in `src/lib/chess.ts` (+ tests), `src/islands/daily/ChessDaily.tsx`
  (board render + move input), `src/lib/daily.ts` + `server/src/lib/daily-games.ts`
  (registry), catalog entry (daily-only), `daily/[slug].astro` branch,
  `public/sitemap.xml`, `scripts/smoke.mjs`. Content lot L11.

### R20 — Daily Wordle (launch-blocking; CEO R10; name owner-mandated 2026-08-05, was "Verdal")

- **Intent:** a daily 5-letter word game named **Wordle** (owner-mandated
  name, 2026-08-05). The classic letter-state mechanic; NYT's Wordle art
  and word lists are not used.
- **Mechanics:** deterministic per day (D050 client-side seeded pool —
  the word list is static, the day seed picks the word); **6 guesses**;
  **letter-state feedback** (correct/wrong-position/absent — our own
  visual treatment, no NYT art); streak + share card.
- **Word list:** derived from the **existing 5,686-word bank** filtered to
  common 5-letter words — NOT the NYT list. Target 1,000+ words
  (test-enforced; review pass for obscenity/obscurity, lot L12).
- **Scoring (default):** solve in 1–6 guesses = 100/85/70/55/40/25; fail
  = 0 (owner can override, §6.11).
- **Acceptance:** same word for everyone per UTC day (seed determinism
  test), 6-guess flow with letter states, solve → run recorded (streak +
  PB + share card), the name "Wordle" renders in all UI copy (hub, page,
  share card), registry + lockstep + sitemap + smoke.
- **Surfaces:** new `src/data/wordle-words.json` (word list), `src/lib/wordle.ts`
  (+ tests: seed determinism, guess feedback logic, word-list validity),
  `src/islands/daily/WordleDaily.tsx`, `src/lib/daily.ts` +
  `server/src/lib/daily-games.ts` (registry), catalog entry (daily-only),
  `daily/[slug].astro` branch, `public/sitemap.xml`, `scripts/smoke.mjs`.

### R21 — Competitor research leg (CEO R7; feeds Phase A design)

- **Intent:** borrow proven UX patterns deliberately; reject the rest.
- **Scope (research deliverable `docs/RESEARCH-COMPETITORS.md`):** study
  **botanica.com** (trivia format/UX), **gartic phone** (social drawing
  party UI), **crazygames** (game discovery/IA for the `/games` page),
  **jackbox.tv**, **kahoot** (quiz flow), **skribbl.io** (room UX).
- **Output (acceptance):** 3–5 concrete patterns per site, each mapped to
  a borrow area — (a) trivia topic picker, (b) `/games` discovery,
  (c) party-room flows, (d) results/share moments — each with a
  **fit-or-reject call for the Trivia site** + rationale. **Cite sources**
  (URLs, capture dates). Fit patterns land in Phase A; rejects are logged
  with the reason.
- **Surfaces:** `docs/RESEARCH-COMPETITORS.md` (deliverable); consumed by
  `src/pages/games.astro`, trivia picker (R10), room flows, results/share.

### R22 — GeoGuessr research + safety leg (CEO R11; feeds R5)

- **Intent:** CEO safety check on GeoGuessr ToS. Facts to confirm:
  mechanics (photo → guess location) are not protected; GeoGuessr's
  **name, art, and API** are — World Peek (own photos, own SVG map,
  original name) is safe.
- **Scope (research deliverable `docs/RESEARCH-WORLDPEEK.md`):** study
  **worldguessr.com, geotastic.net** + similar lookalikes — what mechanics
  they implement, what they avoid (naming, map tiles, API usage), and
  **3–5 fit-or-reject patterns for World Peek** (photo choice, pin UX,
  scoring, reveal, share). **Cite sources.**
- **Acceptance:** deliverable with the pattern matrix + fit-or-reject
  calls, confirming the safety case; consumed by R5 implementation.
- **Surfaces:** `docs/RESEARCH-WORLDPEEK.md` (deliverable); consumed by
  `src/islands/solo/WorldPeek.tsx`.

---

## 2. Decisions table (confirmed defaults unless the owner picks otherwise)

| #   | Decision                           | Confirmed default                                                                                                                                              | Infeasibility / note                                                                                                                                                                                 |
| --- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Rebrand                            | **"Trivia"** (owner decision 2026-08-05, supersedes "Trivia and Games"); domain/storage/packages kept                                                          | Domain change = separate owner decision                                                                                                                                                              |
| D2  | Families                           | Delete `voting`; rename `special` → `party`; type `multiplayer-voting` stays                                                                                   | Catalog tests update in same PR (risk 10)                                                                                                                                                            |
| D3  | Card images                        | 28 game + 4 family + 7 daily images (counts track registry/catalog); Wikimedia PD/CC0/CC-BY or self-made SVG; credits on reveal + machine field; lazy; <100 KB | CC-BY-NC/ND banned; hosting per §6.4 (self-hosted `public/` copies)                                                                                                                                  |
| D4  | Trademark-safe names               | World Peek, Crown Logic, Clue Trail, Word Ladder                                                                                                               | GeoGuessr/Queens/Crossclimb/Pinpoint/Zip are owned; banned on-page. **"Wordle" name is owner-mandated (2026-08-05) — NYT mark collision is owner-accepted; original word list/art required (§6.11)** |
| D5  | Topic trivia                       | Category → topic → 10-question set; `topic` field; **v1: 1,000+ / 40+ topics at launch**                                                                       | Launch-blocking; D12 program continues post-launch                                                                                                                                                   |
| D6  | Scrap Daily Geography              | Full deletion, one PR (in flight — Backend PR-1); World Peek replaces (fresh data)                                                                             | Not a source swap; 12 → 11 dailies                                                                                                                                                                   |
| D7  | "Daily Games" → "Daily Challenges" | User-facing copy only; identifiers stay                                                                                                                        | Hub copy = "7 daily challenges" after R18                                                                                                                                                            |
| D8  | Sudoku keyboard                    | Real inputs, numpad + Erase removed                                                                                                                            | Sudoku lib untouched                                                                                                                                                                                 |
| D9  | Content quality                    | Emoji Plot/Music = rewrite program; Price = curated branded CC photos                                                                                          | **Amazon images: copyrighted + hotlink-blocked — infeasible**; **emoji source: no licensed source exists — rewrite, not swap**                                                                       |
| D10 | Game-page UI standard              | One template, design-branch retrofit                                                                                                                           | + sticky mobile action bar + next-game row (§8.1)                                                                                                                                                    |
| D11 | **Daily hub restructure**          | Owner-curated 7 dailies; 9 demoted (6 merge, 3 become new games)                                                                                               | Grand streak spans 7; per-game streaks of demoted games die (§6.12)                                                                                                                                  |
| D12 | **Content scale**                  | World Peek dataset **2,000–3,000** (launch); post-launch content program (L3–L6, L9, L10) continues beyond v1                                                  | Long pole; lots run in parallel, quotas test-enforced                                                                                                                                                |
| D13 | **Trivia topics incl. Indian**     | TV Series first, then Movies & Film, Sports, Music, History, + Indian topics (Cricket, Bollywood, Indian History)                                              | v1 = 40+ topics; per-topic ≥ 10 questions                                                                                                                                                            |

---

## 3. Phase plan (with acceptance + dependencies)

### Phase 0 — Decisions (gates everything)

Owner signs the §2 table (incl. **D11–D13**), the daily count (**7**,
§6.1), the chess dependency ruling (Architect, §6.9), the chess puzzle
pipeline (§6.10), Wordle scoring (§6.11), and the demoted-game decisions
(§6.12).
**Exit:** every default confirmed or overridden in this doc.

### Phase 0.5 — Geography removal (**in flight** — Backend PR-1, `main`)

**R4 alone.** One PR, `pnpm verify` green.
**Exit:** 11 live dailies; lockstep/daily tests updated.
**Depends:** nothing. **Sequence:** must merge before R18 registry work
(same files).

### Phase A — Design v4 (`design-airbnb`, Frontend Engineer)

R1 (name in UI), R6, R13, R14, R15, R17, card images (R2) on branch
surfaces, family restructure UI (R3). Consumes R21 (competitor research —
land before the trivia picker + `/games` design freeze) and §8.1 UI
direction (Designer owns styling).
**Depends:** Phase 0; research legs (R21/R22) land early; parallel to
B/C/D.
**Exit:** owner-approved preview → merge to main (after main merged in).

### Phase B — Gameplay fixes (`main`; ships before design if ready)

R7 (randomization), R8 (year filters), R9 (sudoku keyboard), R11/R12
island-level fixes.
**Depends:** Phase 0 only.
**Exit:** `pnpm verify` green; golden tests present.

### Phase C — New games + hub restructure (`main`; **launch-blocking**)

R5 (World Peek, solo), R16 (Crown Logic, Clue Trail, Word Ladder), R18
(hub restructure + 9 demotions + 3 new normal games), R19 (Daily Chess),
R20 (Daily Wordle). Registry 11 → 2 (demotions) → **7** (as chess/wordle/
puzzles land); lockstep 7; hub copy "7 daily challenges"; sitemap + smoke

- tests updated in the same PRs as the registry changes.
  **Depends:** Phase 0 (D2/D4/D11); PR-1 (R4) merged first.
  **Exit:** 7 live dailies (lockstep), 26 normal games playable (incl. the
  3 demoted-as-new and World Peek), demoted daily pages 404, `pnpm verify`
  green.

### Phase D — Topic trivia + content (`main`; **launch-blocking v1**)

R10 (1,000+ / 40+ topics at launch) + launch lots L1, L2, L7, L8, L11,
L12. **L1 starts immediately** (§4). Post-launch: D12 program continues
with L3–L6, L9, L10.
**Depends:** D5/D13 confirmed.
**Exit:** all v1 quotas met (1,000+ questions / 40+ topics), QA gates
passed, `pnpm verify` green.

### Phase E — QA + ship

Full `pnpm verify` · mobile audit (real devices/emulation) · axe contrast
(`#e00b41` fix where flagged) · perf budgets (home < 100 KB, LCP with new
images, bundle gates) · preview comparisons · design merge · deploy.
Docs sweep: PRD amendment (name, families, hub, chess/wordle), BRANDING,
ARCHITECTURE, DECISIONS (D054+), TODO, PROJECT_STATE, sitemap/smoke.

### Sequencing

```
Phase 0 decisions ──► Phase 0.5 (R4 PR-1, main, in flight) ──► Phase C (hub restructure + new games, main)
        │                       │                                  │
        │                       ├──► Phase A (design-airbnb) ──────┼──► merge ──► Phase E QA/ship
        │                       ├──► Phase B (fixes, main) ────────┤
        │                       └──► Phase D (topic trivia v1, main; L1 starts NOW)
Research legs (R21/R22) land in Phase 0 / early Phase A.
```

---

## 4. Content program (authoring lots)

**Rules.** Every lot is a **self-contained per-chat brief** (dataset +
schema + quotas + QA gate), sized for one authoring session; LLM-assisted
drafting allowed with **mandatory human rewrite** (movies precedent); all
lots pass the CONTENT-SOURCING QA gates (volume, quotas, uniqueness,
licensing) + golden seed tests; every dataset change ships with its
schema/seed test update in the same PR (`pnpm verify` green).

**Launch lots (M22, launch-blocking):**

| Lot | Deliverable                        | Quota                                                                                          | Gate                                       |
| --- | ---------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------ |
| L1  | Trivia quality pass (existing 525) | accuracy/difficulty/dedup review, `topic` field added                                          | full review + tests (brief below)          |
| L2  | Trivia expansion                   | → 1,000+ questions / 40+ topics (TV Series first, then Movies, Sports, Music, History, Indian) | volume + topic quotas + dedup              |
| L7  | World Peek photo pool              | **2,000–3,000** with `lat`/`lon` + `region` (D12)                                              | licensing + 200 checks + coordinate sanity |
| L8  | Clue Trail clue sets               | 150+                                                                                           | uniqueness + difficulty                    |
| L11 | Chess puzzles                      | 1,000+ from Lichess DB (CC0), mate-in-1/2/3 tiers + tactics                                    | FEN validity + attribution + tier quotas   |
| L12 | Wordle word list                   | 1,000+ common 5-letter words from the 5,686-word bank                                          | filter tests + review pass                 |

**Post-launch program (D12 continues):**

| Lot | Deliverable                               | Quota                                             | Gate                         |
| --- | ----------------------------------------- | ------------------------------------------------- | ---------------------------- |
| L3  | Music expansion (Name That Song)          | 120 → 250+, decade quotas                         | decade + uniqueness          |
| L4  | Movies expansion (Real or Fake)           | 300 → 500+                                        | volume + dedup               |
| L5  | Emoji Plot rewrite program                | standardized 4–6 emoji, hint tiers, volume target | schema + calibration + seeds |
| L6  | Daily Music clue rewrite (Name That Song) | same standard                                     | schema + seeds               |
| L9  | Price Is Right products                   | curated branded set with images + specs           | licensing + recognizability  |
| L10 | Year/decade metadata backfill             | charades, genre-swap/bender, emoji-plot           | quota tests                  |

**Order:** L1 → L2 (unblocks topics) → L7 (World Peek) → L8 + L11 + L12
(parallel, unblock R16/R19/R20) → post-launch: L3/L4 → L5/L6 → L9 → L10.
**Lot #1 must be startable immediately** — full brief below.

---

### Lot #1 brief (startable now) — Trivia quality pass

**Goal.** Every one of the 525 questions in `src/data/trivia-questions.json`
is reviewed for accuracy, difficulty, and duplication, and gains a `topic`
value. This unblocks R10/L2 (topic mode + expansion) — nothing else in the
program depends on it, so it starts immediately.

**Dataset + schema.** Edit `src/data/trivia-questions.json` **and its
server mirror `server/src/data/trivia-questions.json`** (same file, two
copies — they feed the client solo play, the server daily-challenge
seeding + room trivia; keep them identical). Current schema per entry:

```json
{ "category": "Pop Culture", "question": "…", "options": ["A", "B", "C", "D"], "answer": 0 }
```

Additive fields (no existing field changes; `answer` stays the dataset
index — R7 shuffles at render, never in data):

```json
{
  "category": "Pop Culture",
  "topic": "TV Series",
  "question": "In Breaking Bad, what is Walter White's alias?",
  "options": ["Heisenberg", "Saul", "Gus", "Jesse"],
  "answer": 0,
  "difficulty": 2
}
```

- `topic`: required, non-empty, drawn from the topic registry (below).
- `difficulty`: required in this pass — `1` easy, `2` medium, `3` hard;
  calibration target ≈ 35–40% / 40–45% / 15–20% (loose bounds,
  test-enforced).

**Topic registry (initial).** Every question maps to exactly one topic;
topics belong to their existing category. Start set (one per existing
category minimum; TV Series first; Indian topics per D13):

| Category               | Topics (start set)                                 |
| ---------------------- | -------------------------------------------------- |
| Pop Culture            | TV Series, Movies & Film, Music, Celebrities       |
| General                | Everyday Knowledge, Geography Basics, Food & Drink |
| Science                | Nature & Animals, Space, Human Body                |
| History                | World History, US History, Indian History          |
| Sports                 | Sports General, Cricket                            |
| Entertainment (Indian) | Bollywood                                          |

The registry grows to 40+ in L2 — L1 introduces it and must not create
topics outside it (schema test enforces).

**Sample rows (house style reference).**

```json
{
  "category": "Pop Culture",
  "topic": "TV Series",
  "question": "Which TV series is set in the fictional town of Hawkins, Indiana?",
  "options": ["Stranger Things", "Supernatural", "Twin Peaks", "Riverdale"],
  "answer": 0,
  "difficulty": 1
},
{
  "category": "Pop Culture",
  "topic": "Music",
  "question": "Which band released the album 'OK Computer' in 1997?",
  "options": ["Radiohead", "Oasis", "Blur", "The Smashing Pumpkins"],
  "answer": 0,
  "difficulty": 2
},
{
  "category": "Sports",
  "topic": "Cricket",
  "question": "Which nation won the first Cricket World Cup in 1975?",
  "options": ["Australia", "West Indies", "England", "India"],
  "answer": 1,
  "difficulty": 2
}
```

**Review checklist (each of the 525, logged in the PR description).**

1. **Accuracy:** re-verify facts that are date-sensitive or sourced from
   memory; changed questions get a two-source check (music BPM
   `bpmSource` discipline). 2. **Difficulty:** assign 1–3; flag questions
   whose options make the answer trivially deducible. 3. **Dedup:** remove
   or rewrite near-duplicates (normalized-text comparison; the
   `generate-trivia.mjs` `seen` set is the precedent). 4. **Style:**
   options parallel in form, no "all of the above", no negative phrasing
   unless unavoidable, question ends with "?".

**QA gate (tests, same PR).**

- Schema test (`src/lib/__tests__/trivia.test.ts`): every entry has
  `category` + `topic` (non-empty, in registry), 4 options, `answer`
  0–3, `difficulty` 1–3, unique normalized `question` strings; count ≥ 525.
- Calibration test: difficulty distribution within the loose bounds.
- Registry test: topic set == registry; every category has ≥1 topic.
- Golden seed tests stay green: `selectDailyQuestions` determinism,
  daily-challenge seeding (`server/src/lib/daily-seed.ts` reads the
  mirror — server integration tests re-run).
- Mirror sync check: client and server copies byte-identical (lockstep
  test or CI check).
- `pnpm verify` green (client + server suites).

---

## 5. Out of scope (explicit)

Accounts/auth/identity (parked; local history only) · audio features ·
XP/retention mechanics (Phase B of the member pipeline) · ad units ·
domain change · server submit-route changes (registry-driven only) ·
any licensed emoji source purchase · Amazon images · "like
GeoGuessr/LinkedIn" on-page references · dark-theme removal · OG
image regeneration (parked — `scripts/generate-og.mjs` text overlays DO
update for R1; a visual OG redesign does not) · **daily modes for the 9
demoted games (they are deleted, not kept alongside normal modes)** ·
**World Peek daily mode at launch (deferred; 'geo' token added if it
returns)** · **chess engine/runtime analysis (pure validator only —
Architect's ruling gates any deviation)** · **topic picker in trivia
room mode (v1 = solo normal only)**.

---

## 6. Escalations (each with a recommendation)

1. **Daily count: 7 + World Peek registry.** Final hub = 7 (trivia,
   sudoku, chess, wordle, crown logic, clue trail, word ladder). The CEO
   follow-up's R5 "11 → 12" registry implication predates the R18
   restructure. **Recommend: confirm 7; World Peek ships solo at launch
   (no registry entry); 'geo' token deferred until a World Peek daily is
   added post-launch.**
2. **Party family label.** "Party" vs "Party Classics" in nav/homepage
   copy. **Recommend "Party"** — one word, matches the one-line nav
   constraint and the R3 intent.
3. **Logo mark.** Type-only wordmark vs a new self-made SVG mark.
   **Recommend type-only for now**; a mark can follow later without
   touching this program's acceptance.
4. **Image hosting.** Hotlinked Wikimedia URLs vs self-hosted `public/`
   webp copies. **Recommend self-hosted copies + credit lines** (kills
   the silent-rename risk, enables lazy-load + dimensions; reuse
   `scripts/` tooling — webp preferred, ≤1200px JPEG/PNG acceptable,
   no new dependencies).
5. **Streak-box one-liner copy** (counts follow the 7-game hub):
   - Member with streak: **"🔥 12-day streak · 3 of 7 challenges played
     today"** (grand streak · X of live count).
   - Member, no streak: **"Play 1 of 7 challenges today to start a
     streak."**
   - Guest: **"3 of 7 challenges played today"** + the existing one-tap
     "Keep my progress (free)" CTA on the same line.
     Counts from `fetchMemberMe`/`playedToday` — UI-only (R15 constraint).
6. **Trivia topic priority beyond TV series.** **Recommend: Movies &
   Film, Sports, Music, History, then Indian topics (Cricket, Bollywood,
   Indian History)** — highest recognition, cleanest fact-bases, mirror
   catalog strengths. v1 = 40+ topics across 6 category groups with
   per-topic ≥ 10 questions (test-enforced).
7. **Crown Logic difficulty tiers.** Grid sizes 5–9 as the tier ladder
   (5 easy → 9 expert), day's tier via `dailyGameSeed` sub-seed
   (DAILY-DESIGN §2.2). **Solver-test coverage: generator output must
   have exactly one solution** (backtracking solver in tests). Solo mode:
   player picks the tier.
8. **Card-image credit placement.** **Recommend: machine-readable
   `imageCredit` field in `games.json` + a visible credit line on
   results/reveal surfaces** (SoloShell done view, `<figcaption>` under
   the game-page hero image — the `price-products.json` precedent).
   Cards stay clean (title + image).
9. **Chess engine dependency (Architect ruling required).** chess.js or
   any engine = PRD §2 stack question for the Software Architect; ruling
   recorded in the decision log **before implementation**. **PM
   recommends: pure FEN validator + static puzzle data — no new
   dependencies** (binding gate).
10. **Chess puzzle pipeline.** **Recommend D032 server-seeded daily**
    (dataset server-side; the day's FEN + solution via the existing
    daily-challenge path — a 1,000+ puzzle client bundle would blow the
    island budget). TL may choose a client-side pool only if it fits the
    budget gate.
11. **Wordle naming + scoring + word list.** The name **"Wordle" is
    owner-mandated (2026-08-05) over the PM's recommendation of an
    original mark** — NYT holds the WORDLE trademark; mitigations:
    original word list + art (non-negotiable), distinct presentation, and
    a trademark/legal review before launch; a post-launch rename, if ever
    required, is contained (copy + registry + filenames only). **Scoring:
    propose 100/85/70/55/40/25 for guesses 1–6, 0 on fail**; word list =
    filtered 5,686-word bank → 1,000+ common 5-letter words (review pass;
    obscenity/obscurity gates). No NYT art, no NYT lists.
12. **Demoted-game decisions (9).** **Confirm: 6 merges** (emoji plot,
    timeline, price, rhyme, genre swap, genre-bender → existing normal
    pages; daily mode + registry entry dropped) **and 3 new games**
    (music → "Name That Song", movies → "Real or Fake", drawing →
    standalone Prompt of the Day game). Any deviation changes the
    catalog count (26) and R2 image scope.

---

## 7. File/surface impact index (per requirement → files)

| Req     | Primary files / surfaces                                                                                                                                                                                                                                      |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1      | `BaseLayout.astro`, `SEOHead.astro`, all page `title`/`description` + JSON-LD, `scripts/generate-og.mjs` + `public/og/*`, `site.webmanifest`, `404/500.astro`, `README.md`, `docs/PRD.md`, `docs/BRANDING.md`, smoke absence gate                             |
| R2      | `games.json` (+`image`/`imageCredit`), `GameCard.astro`, `DailyCard.astro`, `CategoryStrip.astro`, `daily/index.astro`, `game/[slug].astro`, SoloShell results, `CONTENT-SOURCING.md`, `public/` assets                                                       |
| R3      | `lib/games.ts`, `games.json`, `index.astro`, `categories/index.astro`, `CategoryStrip.astro`, game pages, `games.test.ts`, `special.test.ts`                                                                                                                  |
| R4      | `daily-geography.json`, `lib/geography.ts`, `geography.test.ts`, `islands/daily/GeographyDaily.tsx`, `lib/daily.ts`, `[slug].astro`, `server/src/lib/daily-games.ts`, `sitemap.xml`, `smoke.mjs`, `daily.test.ts` — one PR (in flight)                        |
| R5      | `data/world-peek.json`, `lib/world-peek.ts` + tests, `islands/solo/WorldPeek.tsx`, `games.json`, `sitemap.xml`, `smoke.mjs` (no daily/registry surface at launch)                                                                                             |
| R6      | `BaseLayout.astro` (nav/footer), `daily/index.astro`, `daily/archive.astro`, `[slug].astro` meta, `smoke.mjs`, `sitemap.xml`                                                                                                                                  |
| R7      | `lib/pick.ts` (+shuffle helpers), `lib/trivia.ts`, music/movies/WYR/genre engines + tests                                                                                                                                                                     |
| R8      | `daily-music.json`, `daily-movies.json`, `charades-movies.json`, `genre-swaps.json`, `genre-benders.json`, `emoji-plots.json`, 6 islands                                                                                                                      |
| R9      | `islands/solo/Sudoku.tsx`, `sudoku.test.ts`                                                                                                                                                                                                                   |
| R10     | `trivia-questions.json` (client + `server/src/data/` mirror), `generate-trivia.mjs`, `lib/trivia.ts`, `TriviaSolo.tsx` (picker, normal mode only), tests                                                                                                      |
| R11     | `emoji-plots.json`, `daily-music.json`, `lib/emoji-plot.ts`, `lib/music.ts`, tests                                                                                                                                                                            |
| R12     | `price-products.json`, `islands/solo/PriceIsRight.tsx`, `CONTENT-SOURCING.md`                                                                                                                                                                                 |
| R13     | `game/[slug].astro`, `daily/[slug].astro`, island shared chrome, `BaseLayout.astro`                                                                                                                                                                           |
| R14     | all surfaces (fixed-items list deliverable)                                                                                                                                                                                                                   |
| R15     | `islands/daily/DailyHubStatus.tsx`, `daily/index.astro`                                                                                                                                                                                                       |
| R16     | `games.json` (+3), `lib/crown-logic.ts`/`clue-trail.ts`/`word-ladder.ts` + tests, 3 islands, `lib/daily.ts`, `server/src/lib/daily-games.ts`, `sitemap.xml`, `smoke.mjs`                                                                                      |
| R17     | `index.astro`, `games.astro`, `BaseLayout.astro`, card components, `lib/games.ts`, `lib/daily.ts`                                                                                                                                                             |
| R18     | `lib/daily.ts`, `server/src/lib/daily-games.ts`, `daily/index.astro`, `daily/[slug].astro`, `daily/archive.astro`, 9 demoted islands, `games.json` (+3 normal entries), `daily.test.ts`, `games.test.ts`, `sitemap.xml`, `smoke.mjs`, `DailyHubStatus.tsx`    |
| R19     | `server/src/data/chess-puzzles.json`, `server/src/lib/daily-seed.ts`, `lib/chess.ts` (FEN validator) + tests, `islands/daily/ChessDaily.tsx`, `lib/daily.ts`, `server/src/lib/daily-games.ts`, `games.json`, `daily/[slug].astro`, `sitemap.xml`, `smoke.mjs` |
| R20     | `data/wordle-words.json`, `lib/wordle.ts` + tests, `islands/daily/WordleDaily.tsx`, `lib/daily.ts`, `server/src/lib/daily-games.ts`, `games.json`, `daily/[slug].astro`, `sitemap.xml`, `smoke.mjs`                                                           |
| R21     | `docs/RESEARCH-COMPETITORS.md` (deliverable) → trivia picker, `/games`, room flows, results/share                                                                                                                                                             |
| R22     | `docs/RESEARCH-WORLDPEEK.md` (deliverable) → `islands/solo/WorldPeek.tsx`                                                                                                                                                                                     |
| Program | `docs/` sweep (Phase E): PRD, BRANDING, ARCHITECTURE, DECISIONS (D054+), TODO, PROJECT_STATE                                                                                                                                                                  |

---

## 8. Risk register (BIG-PLAN's 10, restated with mitigations)

1. **Trademarks** — GeoGuessr/Queens/Crossclimb/Pinpoint/Zip are
   owned; D4 names are the mitigation; never say "like GeoGuessr/
   LinkedIn" on-page → banned-string smoke/golden gate over rendered
   pages and copy files. **"Wordle" as our game's name is
   owner-mandated and collides with NYT's mark (owner-accepted risk,
   §6.11)** — mitigations: original word list/art/presentation, legal
   review pre-launch; rename, if ever required, is contained to copy +
   registry + filenames.
2. **Deterministic-vs-random tension** — dailies must stay seeded (same
   for everyone, D050); "truly random" applies to solo non-daily rounds
   only. R7 golden tests assert both modes; never replace the day seed
   with `Math.random` in daily paths.
3. **Image licensing/hotlinks** — CONTENT-SOURCING table applies
   (PD/CC0/CC-BY + credits on reveal; CC-BY-NC/ND banned) → §6.4
   self-hosting removes the hotlink risk; authoring-time 200 checks for
   dataset photos.
4. **Name-change SEO** — keep domain + storage keys; meta/JSON-LD update
   is a ranking-neutral restatement, not a URL migration. Search Console
   check post-deploy (Phase E).
5. **Content volume** — 1,000+ trivia / 2,000–3,000 photos / 1,000+
   chess / 1,000+ words / 150+ clue sets is the long pole → parallel
   authoring lots with mandatory human review; L1 starts immediately;
   quotas test-enforced per lot.
6. **Branch divergence** — design-airbnb is long-lived → merge `main`
   into it continuously and **before** the final merge; B/C/D land on
   `main` while A iterates.
7. **Perf** — new images lazy-loaded, compact (webp/avif or ≤ ~1200px),
   self-hosted (not bundled); homepage HTML gate stays < 100 KB; new
   surfaces added to `smoke.mjs` weight checks. **Chess dataset size is
   the sharp edge** — D032 server-seeded pipeline keeps it out of the
   client bundle (§6.10).
8. **Puzzle difficulty** — generators need solvability + difficulty
   tiers tested → Crown Logic solver with exactly-one-solution assertion;
   Word Ladder steps verified against the bank; Clue Trail sets
   difficulty-gated by authoring QA; chess mate-in tiers validated by
   the pure validator + FEN tests.
9. **Streak box** — simplification is UI-only; the member pipeline
   (DailyRun/streaks) is the API, not to be touched → acceptance states
   "no API/schema change"; verify via unchanged server tests. **R18's
   per-game streak deaths are data-inert** (rows remain, never updated)
   — no migration.
10. **Family restructure breaks tests** — `special.test.ts`, categories
    page, related-games expectations → update in the same PR as the
    catalog change (one-PR rule, same as D6).

**Program additions (PM):** 11. **Rebrand sweep completeness** — "TriviaHub" hides in per-page
`title` props, JSON-LD, archive copy, FAQ data → the smoke absence
gate (R1 acceptance) is mandatory; grep the docs too. 12. **D6 deletion regression** — geography references can survive in
daily-history keys, archive views, share-card caches → the one-PR
rule includes a repo-wide grep for `geography`/`GeographyDaily` and
a smoke check asserting `/daily/geography` 404s. 13. **Hub-restructure regression** — daily-mode removal touches 9
islands that also serve normal modes → demotion PRs must verify the
normal-mode path of each island (R18 acceptance) and the
`DailyHubStatus`/archive views; per-game PRs grouped (merge group,
new-game group) to keep reviews tractable. 14. **Launch-scope pressure** — everything added is launch-blocking →
research legs (R21/R22) land first and feed design, L1/L2 start
immediately, and the sequencing diagram's parallel lanes are the
plan, not a suggestion; the Phase 0 sign-off (§6) is the scope
freeze.

---

## 8.1 UI direction (orchestrator input — "consider in scope"; Designer owns final styling)

Encoded as design input for Phase A, not acceptance criteria; where an
item overlaps a requirement (noted), the requirement's acceptance wins.

- **Game cards** (R2): image plate + hover play-orb + Free + players ·
  duration · energy chips.
- **Homepage** (R17): 2-CTA hero (shipped in v3 — verify) + one strip per
  family (Party/Drawing/Solo/Quiz, dense 4-up) + daily strip + one-line
  streak box (R15).
- **Trivia picker** (R10): category chips → topic cards with
  difficulty/count badges + "play again with new topic".
- **World Peek** (R5): full-bleed photo + tap-to-pin mini-map + animated
  distance reveal + share card.
- **Game pages** (R13): one template + sticky mobile action bar +
  next-game row.
- **Daily hub** (R18): **7 tiles** with done-checkmarks (orchestrator's
  "12 tiles" predates the restructure).
- **Mobile** (R14): bottom tab bar (Home/Games/Daily/Categories/More),
  48px targets, no horizontal scroll.
