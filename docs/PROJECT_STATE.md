# Project State — PartyBrain

> **This file is the project's memory.** Updated after **every** implementation
> step, PR, decision, or milestone. If you read only one file, read this one.
>
> **Product:** PartyBrain — 18 free online party games (see `docs/PRD.md`).
> Architecture source of truth: `docs/ARCHITECTURE.md` + `docs/DECISIONS.md`
> (owner-approved 2026-08-04; no redesign during implementation).

---

## Current Milestone

**M10 — SEO Content + AdSense Compliance + Performance ✅ complete** — the
final build milestone. **M11 (deployment) stays deprioritized** until the
owner asks; no active milestone is in flight.

All roadmapped milestones M1–M10 are ✅ complete — **all 18 games playable**
and AdSense-ready.

---

## Completed Work

### Milestone 9 — Charades + Guess Who ✅ (verified 2026-08-04)

- [x] **Charades (D033):** `CharadesSession` engine + `CharadesArena`
      island — 300 movies (Hollywood/Bollywood/Mixed, host toggle),
      actor-only title reveal (`.except(actorId)` broadcast), 60s timer,
      any-player "Got it!" (+1 team score), pass-the-phone rotation, host
      skip, team-score game end; datasets via
      `scripts/generate-special-datasets.mjs` + validator
- [x] **Guess Who (D033):** `GuessWhoSession` engine + `GuessWhoArena`
      island — 205 celebrities with trait objects, answerer-only secret,
      yes/no question log (20-cap → reveal), guess input (full/last-name
      match), answerer-judged answers, solo affordance (D026); events:
      `ask-question`, `set-charades-category`, `mark-correct`;
      `answer-question` extended for guess-who, `send-guess` extended for
      guesses
- [x] games.json: charades + guess-who playable; registry lockstep green
      (all 12 room games); page wires both arenas
- [x] **Verification:** `pnpm verify` green — **120 client + 129 server
      tests** (engine suites + reducer tests + 2-journey socket
      integration)

### Milestone 10 — SEO Content + AdSense Compliance + Performance ✅ (verified 2026-08-04)

- [x] **Per-game SEO content** (`src/data/game-content.ts`): all 18 games get
      400–600-word long-form bodies, unique 150–160-char meta descriptions,
      and game-specific FAQ entries (D035)
- [x] **Homepage** (`src/pages/index.astro`): ~600-word SEO section with the
      required PRD §6.1 keywords (free online party games, browser party
      games, play pictionary online, virtual party games, multiplayer
      drawing games, online trivia games, would you rather online, skribbl
      alternative) + internal links to all 18 games; global FAQ section +
      FAQPage/WebApplication JSON-LD; `ogImage=/og/home.png`
- [x] **Global FAQ** (`src/data/faqs.ts`): 9 questions; `/faq` refactored to
      consume the data file + FAQPage JSON-LD
- [x] **Game pages** (`src/pages/game/[slug].astro`): per-game meta +
      WebApplication + BreadcrumbList + FAQPage JSON-LD; long-form content
      sections + FAQ accordion; canonical URLs
- [x] **OG images**: `scripts/generate-og.mjs` adds home.png — 20 OG PNGs
      (18 games + home + default); sitemap complete (all 18 + legal + FAQ)
- [x] **Smoke gates** (`scripts/smoke.mjs`): SEO checks on all 18 game pages
      (150–160-char meta + JSON-LD), page weight < 100 KB, per-island bundle
      budget 300 KB
- [x] **Content validation** (`src/lib/__tests__/seo-content.test.ts`):
      validates every content entry (7 tests)
- [x] **Content-licensing audit**: paraphrased lyrics only, CC-licensed
      product photos with credits (D034), Wikimedia Commons images for
      Copycat (PRD §13)
- [x] **AdSense prep audit**: privacy/terms/about/contact in footer, original
      content, GA4 + ad placeholders only, no pop-ups/redirects
- [x] **Mobile + a11y**: touch targets ≥ 44–48 px (min-h-11/12), responsive
      320–1440 px by construction, aria-labels/pressed/live regions +
      keyboard-operable controls on all game islands (browser-level
      axe/Lighthouse audit deferred to M11 per TESTING_STRATEGY)
- [x] **Verification:** `pnpm verify` green — **127 client + 129 server tests**, 26-page
      build, smoke gates (SEO + weight + bundle budgets)

### Feature — Price Is Right product photos (owner request 2026-08-04) ✅

- [x] 536 products, **523 with real CC-licensed photos** via Openverse
      (`commercial` license only); `credit` attribution (creator + license)
      stored per product and shown in the UI; emoji fallback for the 13
      without a licensed photo (D034 — supersedes the emoji-only stance of
      D031)
- [x] `scripts/enrich-price-products.mjs` (offline, low concurrency) +
      regenerated `src/data/price-products.json` (6,065 lines);
      `scripts/check-datasets.mjs` extended; `PriceIsRight.tsx` renders
      product image (descriptive alt + lazy load) or emoji; `image`/`credit`
      fields added to `PriceProduct`
- [x] **Verification:** `pnpm verify` green — datasets check passes
      ("ALL DATASETS OK"), 3 price-is-right tests

### Milestone 8 — Solo Batch 2 + Trivia + Daily Challenge ✅ (verified 2026-08-04)

- [x] **Daily challenge seeding (D032):** `server/src/lib/daily-seed.ts` +
      on-demand upsert in `GET /api/daily-challenge` — 10 deterministic
      questions per UTC date (FNV-1a + seeded shuffle), idempotent, no cron;
      TriviaSolo fetches it with a local fallback
- [x] **Trivia room mode (D032):** `TriviaSession` engine (10 questions × 10s,
      race scoring 100 + 10·s, all-in reveal, Wrong Answers Only scoring),
      gateway adapter (`answer-question` + `set-trivia-mode` events,
      round-reveal, break timer, host skip, podium + score persistence),
      `TriviaArena` island + `useTriviaGame` + pure `trivia-room.ts` reducer
      — the answer index never leaves the server before reveal
- [x] **Genre Swap:** 150 entries, 20s × 10, 4-option MC (correct + 3
      distractors via shared `buildOptions`), +10 (+5 < 10s)
- [x] **Genre-Bender:** 70 paraphrased/original benders, 20s × 10, MC
      (title — artist), free year clue
- [x] games.json: trivia `playable` (lockstep green); game page renders
      TriviaArena (room) + the two solo islands
- [x] **Verification:** `pnpm verify` green — **114 client + 117 server tests**
      (new: daily-seed, trivia-engine, trivia-room reducer, genre logic,
      2-journey trivia socket integration)

### Milestone 7 — Solo Template + Solo Games Batch 1 ✅ (verified 2026-08-04)

- [x] `SoloShell` island (`src/islands/solo/SoloShell.tsx`) + shared solo
      lib (`src/lib/solo.ts`): round/score/streak header, done view with
      nickname → idempotent `submitScore` (clientKey per game+day) → daily
      top-5 fetch → canvas share-score image (download PNG) → play again;
      per-game localStorage daily streak (D030)
- [x] **Rhyme or Crime** (`RhymeOrCrime.tsx`): 160 CMU-derived prompts,
      60s × 5 rounds, +10 (+5 speed < 10s), streak multiplier ×2/×3,
      timeouts reveal a valid rhyme
- [x] **Emoji Plot** (`EmojiPlot.tsx`): 210 entries, 30s × 10, hints (year
      15s / first letter 25s), 100/50/25 scoring, fuzzy acceptance
      (ignore "The", Levenshtein ≤ 2, partial titles), create-your-own
      share link with base64-obfuscated answer
- [x] **Timeline Tussle** (`TimelineTussle.tsx`): 210 events (BCE-aware),
      5 rounds, tap-to-order cards, instant feedback with years, 100/50/0
- [x] **Price Is Right** (`PriceIsRight.tsx`): 110 emoji products (D031),
      slider + numeric input ($1–$1000), over/under reveal, 100 − Δ·2
      (min 0), exact = 200
- [x] Game page: solo games render their islands (coming-soon slot only
      for the not-yet-shipped genre games); multi- and voting families
      unchanged
- [x] **Verification:** `pnpm verify` green — **102 client + 105 server tests**
      (new suites: solo, rhyme-or-crime, emoji-plot, timeline-tussle,
      price-is-right)

### Milestone 6 — Voting Component + Voting Games ✅ (verified 2026-08-04)

- [x] `VotingSession` engine (`server/src/engine/voting-engine.ts`): one
      config-driven session for all four voting games (D029) — rounds,
      timers, options-from-dataset/players, self-vote rules, wildness/crown/
      herd scoring; mid-game joiners can vote (D027 pattern)
- [x] Gateway voting adapter: `startVoting` + per-phase timers (statement /
      vote / reveal-break), `emitVotingRoundStart` (kind + phase + options +
      deadline), all-in early reveal (TOT keeps its fixed 6s beat),
      `vote-update` live tallies, `vote-reveal`, kind-specific `game-end`;
      `submit-prompt` handler (WYR dilemma queue + NHIE statements), host
      `next-round` skip, resync snapshot with deadline
- [x] `VotingArena` island (`src/islands/VotingArena.tsx`) + `useVotingGame` + pure `src/lib/voting.ts` reducer: WYR blue/red cards + live bars +
      total-votes counter + submit-own-dilemma form; MLT player chips +
      ranked reveal with crown; NHIE statement view (input + server
      suggestions) + I HAVE / I HAVE NOT + wildness scoreboard; TOT two
      cards + herd streak + herd-alignment podium; shared chat panel
- [x] Datasets (server-side): 190 WYR dilemmas, 210 MLT prompts, 210 NHIE
      statements, 320 TOT pairs — validated by `scripts/check-datasets.mjs`
- [x] games.json marks all 4 voting games playable; registry lockstep test
      green; game page renders VotingArena for the voting family
- [x] **Verification:** `pnpm verify` green — **81 client + 105 server tests**
      (engine + reducer + 3 socket journeys: full WYR flow with the custom
      dilemma queue, NHIE rotation + wildness, TOT 6s rounds)

### Milestone 5 — Remaining Drawing Games ✅ (verified 2026-08-04)

- [x] **Engine refactor (D028):** one config-driven `DrawingGameSession`
      (`server/src/engine/drawing-game.ts`) replaces the Skribbl-only engine —
      wordMode (`choices`/`direct`/`lyric`), per-game round duration, hint
      rules (first/last letter, artist at 45s, silhouette reveal at 60s),
      lift penalty (−10s, floor 5s), fixed lyric scoring (100/50), custom
      words (Skribbl only); `DRAWING_CONFIGS` table in the gateway
- [x] **One Line, One Shape:** 220 objects (`server/src/data/one-line-objects.json`),
      continuous-line enforcement — every pen lift emits `stroke-lift`,
      server deducts 10s (floor 5s) and broadcasts `round-timer`; drawer sees
      the object, guessers see the warning
- [x] **Draw the Lyric:** 120 paraphrased/original lyrics (`server/src/data/lyrics.json`),
      lyric banner drawer-only, guess the song TITLE (normalizeTitle strips
      leading "The" + trailing punctuation), artist hint at 45s, fixed
      scoring (guesser 100 / drawer 50)
- [x] **Shadow Sketch:** 110 SVG silhouettes (`server/src/data/silhouettes.json`),
      faint background layer via `Path2D` + `pathBBox` aspect-preserving
      render (`src/lib/canvas.ts`), drawer-only until the 60s reveal
      (additive `round-hint.silhouette`)
- [x] **Copycat Challenge (D028):** `CopycatSession` engine (image-reveal 5s →
      private drawing 90s → gallery → voting 30s → awards) + `CopycatArena`
      island: private canvas (local-only strokes, PNG data-URL submit, 400k
      cap), gallery grid with enlarge, three award votes (Most
      Recognizable/Funniest/Most Abstract, no self-votes), live tallies,
      awards ceremony; 104 PD images (Wikimedia FilePath); solo rooms reach
      voting (single drawing allowed) so the full flow is testable alone
- [x] `DrawingCanvas` gains `onLift` (One Line penalty) + `background`
      (silhouette layer) props + `DrawingCanvasHandle.toDataURL` (copycat
      submit)
- [x] Game page wires `DrawingGameArena` (4 games) + `CopycatArena`;
      `games.json` marks all 5 drawing games `playable` (lockstep test green)
- [x] **Datasets validated:** `scripts/check-datasets.mjs` green (~2,550
      entries across 15 files)
- [x] **Verification:** `pnpm verify` green — **70 client + 87 server tests**,
      server tsc, 26-page Astro build, smoke 8/8

- [x] `DrawingCanvas` component (`src/components/DrawingCanvas.tsx`): pen
      (variable brush), eraser, 12-color palette, undo, clear; pointer events
      (mouse/touch/pen unified, `touch-action: none`); responsive via CSS;
      logical 800×500 coordinate space; rAF-coalesced repaint from the
      authoritative stroke log (D025)
- [x] Stroke broadcast: `draw-stroke` / `clear-canvas` / `undo-stroke`
      (PRD §8.2; drawer-only; sender excluded, `strokeId` groups segments)
- [x] Mid-game resync: `game-resync` returns the full snapshot (phase, round,
      drawer, word length, hints, deadline, scores, strokes, summary/podium)
- [x] Word bank `server/src/data/skribbl-words.json`: 5,686 unique words,
      5 difficulties — server-side on purpose (D022) + integrity tests
- [x] `SkribblSession` engine (`server/src/engine/skribbl-engine.ts`,
      transport-agnostic, injectable clock/RNG): shuffled drawer rotation,
      rounds = players × 3, word select (3 choices, drawer-only), hints at
      30s/45s, guess matching (case-insensitive/trimmed), scoring
      (`guesser = max(0, 100 − t·2)`, `drawer = floor(Σ/2)`), early round end
      when everyone guessed, 5,000-stroke/round cap, custom word lists
      (3–200 words, safe charset)
- [x] Gateway: word-select 15s auto-pick, hint + round timers, 10s round
      break, additive events `choose-word`/`next-round`/`restart-game`/
      `set-custom-words`/`round-hint`; `NOT_ENOUGH_PLAYERS` preflight;
      game-end score persistence (idempotent `skribbl:<code>:<ts>:<player>`)
- [x] `SkribblArena` island (`src/islands/SkribblArena.tsx`): lobby → word
      select → canvas + toolbar + chat/guess → round results → podium;
      lobby UI extracted to shared `RoomLobbyPanel`; `useRoom` exposes
      `myName`; `useSkribblGame` hook (reducer + listeners + resync on
      mount/reconnect)
- [x] Custom word list UI (host, lobby): paste 3–200 words, applied at start
- [x] **Verification:** `pnpm verify` green — **50 client + 77 server tests**
      (incl. the full 2-client, 6-round DB-backed socket journey: strokes,
      undo, guesses, early round end, resync, persistence, restart), server
      tsc, 26-page Astro build, smoke 8/8; live dev-server check of all three
      touched game pages (trivia/would-you-rather instant play + skribbl
      arena) on :4321

### Feature — Instant Play (owner request 2026-08-04) ✅ (landed with M4)

- [x] `Game.instantPlay?: 'solo' | 'one-screen'` catalog field +
      `getInstantPlayGames()`; games.json updated (trivia = solo,
      would-you-rather = one-screen)
- [x] **Trivia solo** (`src/islands/TriviaSolo.tsx`): seeded daily challenge —
      same 10 questions per UTC day for every player (PRD §5.15), 15s timer,
      speed-bonus scoring (100 + 10·s), answer reveal, category stats,
      idempotent leaderboard submission (`trivia:<date>:<hash>:<nonce>`)
- [x] **Would You Rather one-screen** (`src/islands/WouldYouRatherOneScreen.tsx`):
      co-located scorekeeper — A/B vote buttons, live tally bar, per-dilemma
      advance, end summary + verdict (D022)
- [x] Game page layout: "Instant play" section + "Play in a room" section;
      skribbl-arena renders the SkribblArena island, other multiplayer games
      keep RoomLobby, pure-solo games keep the coming-soon slot (M7)
- [x] Datasets: 100 trivia questions (5 categories), 60 WYR dilemmas +
      pure logic in `src/lib/trivia.ts` / `src/lib/would-you-rather.ts` +
      tests (12 trivia, 5 WYR, 10 catalog)

### M4.1 — Solo testing + playable-game gate (owner report, 2026-08-04) ✅

- [x] `start-game` gate: only games with a shipped round adapter may leave
      the lobby (`GAME_NOT_PLAYABLE_YET` + friendly message + disabled Start
      button with explanation) — fixes the "Game in progress…" dead end on
      unimplemented room games (D026)
- [x] Solo Skribbl rooms: 1 player can start (3 rounds, always the drawer);
      fixed `allGuessed()` vacuous-truth bug (round no longer ends instantly
      with no guessers)
- [x] Host `end-round-now` control (additive event) — fast solo testing and
      stalled-round escapes
- [x] Registry `server/src/lib/game-registry.ts` + `Game.playable` catalog
      flag with a client↔server lockstep test
- [x] Verified: `pnpm verify` green (51 client + 80 server tests); live solo
      flow checked against the dev backend (start → choose → draw → end
      round → next round; trivia start rejected)

### M4.2 — Guess/undo/fill fixes (owner report, 2026-08-04) ✅

- [x] Mid-game joiners can guess: `SkribblSession.addPlayer` on join (was
      `NOT_PLAYER` — "not letting me win"; D027)
- [x] Drawer-local log: strokes append optimistically client-side; undo/clear
      now broadcast to the whole room including the drawer (undo actually
      works for the drawer now)
- [x] Guess errors surface as visible feedback instead of failing silently
- [x] Fill tool: `Stroke.type: 'pen' | 'fill'` + `floodFill` (dpr-aware,
      replay-safe) + toolbar Fill button (white when eraser armed)
- [x] Verified: `pnpm verify` green (56 client + 83 server tests); Git
      initial commit `4e7ea75` (M0–M4) ready to push

### Milestone 3 — Backend Core + Room Engine Foundation ✅ (verified 2026-08-04)

- [x] REST per PRD §8.1: scores (idempotent via `clientKey`), leaderboard
      (daily/weekly/all-time, UTC period math), daily-challenge, room
      create/info; JSON error contract + API 404; `readyz` DB ping
- [x] Socket gateway: `create-room`/`join-room`/`leave-room`/`start-game`/
      `game-state-update`/`chat-message` (acks + broadcasts, PRD §8.2)
- [x] Room Engine (`server/src/engine/room-engine.ts`): transport-agnostic
      state machine (lobby → game-setup → in-progress → results → lobby),
      rejoin seat-reclaim, host migration, safe 6-char codes, 24-player cap,
      empty-room eviction; nickname uniqueness is case-insensitive
- [x] Rate limiting (per-IP buckets: room create/join/chat/guess/strokes/
      score)
- [x] Client: `useRoom` hook + RoomLobby island on all 12 multiplayer game
      pages (create/join, invite link, players, chat, start, phase,
      leaderboard panel, `?code=` prefill, auto-rejoin)
- [x] `src/lib/api.ts` (submitScore idempotent retry, fetchLeaderboard);
      client socket singleton (browser-only); event-contract lockstep test
- [x] Migration `20260804013000_m3_room_engine` (additive: clientKey unique,
      RoomPlayer unique seat)
- [x] **Verification:** `pnpm verify` green; live end-to-end check against
      the running dev backend passed

### Milestone 2 — Design System + Global Shell ✅ (verified 2026-08-04)

- [x] Full BounceBox token system (PRD §11): palette, Titan One/Poppins type
      scale (h1 48px → xs 14px), radii, glow shadows; accessible coral scale
      added (DECISIONS D019)
- [x] UI primitives in `src/components/ui/`: Button (4 variants, 3 sizes,
      pill, ≥44px), Card (default/elevated), Input (label/helper/error),
      Chip (filter/status), List, Checkbox, Radio, Tooltip (CSS-only)
- [x] FAQ accordion via `<details>` (CSS-only, keyboard/screen-reader native)
- [x] Global shell: dashed BounceBox dividers, sticky header, footer legal
      links, styled 404/500, hero + value cards + game grid on homepage
- [x] Per-game template completed: family chip, island slot, how-to-play
      card, related-game cards, OG image
- [x] OG pipeline: `scripts/generate-og.mjs` (satori → resvg) generates 19
      PNGs at build time (`prebuild`); `public/og/` gitignored
- [x] **Lighthouse baseline measured (local production build):**
      home **99/100/100/100**, game page **98/100/100/100** — PRD §10
      budgets met (home ≥95 + 100/100/100, games ≥90)
- [x] Page-weight gate in smoke: 47–57 KB per page (budget < 100 KB, PRD §10)
- [x] **Verification:** `pnpm verify` green

### Milestone 1 — Astro MPA Scaffold ✅ (verified 2026-08-04)

- [x] Repo `partybrain`: Astro 7.1.6 static MPA + React islands + Tailwind v4;
      TypeScript strict; ESLint 10 + Prettier + husky hooks
- [x] Base layout, `SEOHead.astro` (title/meta/OG/Twitter/canonical/JSON-LD),
      static pages (/, /faq, privacy, terms, about, contact, /404, /500)
- [x] Homepage hero + 18-game grid from `src/data/games.json` +
      `src/lib/games.ts` registry; `/game/[slug]` stub pages
- [x] `public/`: robots.txt, sitemap.xml (24 URLs), `_headers`, favicon.svg
- [x] `/server`: Express 5 + Socket.io 4, healthz/readyz, CORS, pino,
      hand-rolled validation; Prisma 6.19.3 (PRD §8.3 verbatim + additive
      indexes), migration `20260803193748_init`, seed = 18 games
- [x] CI (`.github/workflows/ci.yml`): format → lint → typecheck → unit →
      migrate deploy → server tests → server build → astro build → smoke
- [x] `scripts/smoke.mjs` post-build verification of `dist/`
- [x] **Verification:** `pnpm verify` green

### Milestone 0 — Engineering Foundation ✅

- [x] Full doc set regenerated against `PRD.md` (v2); architecture approved.

---

## In Progress

None — M10 is complete and committed. Awaiting owner direction (M11
remains deprioritized).

---

## Remaining Work

Full roadmap: [TODO.md](TODO.md). Highlights:

- **M11** Deployment (Cloudflare Pages + Railway/Render) + launch QA
  (owner: currently deprioritized — do not start without an ask)
- **Backlog** (not milestone-blocking): word-bank curation, trivia dataset
  expansion to 500+, Playwright E2E, CSP hardening, Lighthouse CI budgets

---

## Known Bugs

- None known. All suites green (127 client + 129 server).

---

## Technical Debt

- **Word bank curation:** 5,686 words exceeds the PRD's 500+ target with
  loose difficulty labels and some non-drawable entries (hand-generated
  lists). A curation pass is still queued (backlog); gameplay is unaffected
  (3 random choices per round).
- **Trivia dataset:** 100 questions vs PRD's 500+ target — expansion lands
  with M8 (room mode + daily challenge).
- **Canvas repaint:** full-log repaint per segment (rAF-coalesced) — fine for
  one drawer; revisit if a drawing game needs livelier multi-drawer strokes.
- **Drawer disconnect mid-round:** the round runs to the 60s timeout with no
  new strokes (no auto-skip yet) — backlog.
- **Browser-level E2E** (Playwright) deferred to M11; the two-client socket
  integration test covers the M4 journey today.
- **Prisma 7 migration:** `package.json#prisma` seed config is deprecated in
  Prisma 6 and removed in 7 — pinned 6.19.3 deliberately (D018); track a
  `chore` upgrade.
- **`Score.clientKey` idempotency** is opt-in per client; solo islands
  generate + reuse a key per completed game (Trivia does; WYR has no scores).
- **CSP hardening** deferred to M11 (launch QA); `_headers` comment updated
  to match; `_headers` noindex for preview domain verify at M11.
- **Integration tests require a reachable PostgreSQL** (local Docker
  container or CI service); serial execution configured (TESTING_STRATEGY).

---

## Blocked Tasks

| Task                  | Blocked by                                             |
| --------------------- | ------------------------------------------------------ |
| AdSense application   | ~10 daily users (PRD §1)                               |
| GA4 real ID           | Google Analytics account (placeholder stays commented) |
| Live domain + deploy  | M11 (owner: deprioritized for now)                     |
| Draw the Lyric lyrics | Open question #2 (licensing — paraphrased/PD only)     |

---

## Open Product Questions (still pending owner answers)

1. ⚠ **Design system contradiction (PRD §2 vs §11):** Vercel-minimal vs
   BounceBox (kids 3–8) vs audience 16–35; `@DESIGN.md` missing. Architecture
   defaults to BounceBox (M2 tokens already scaffolded that way).
2. ⚠ **Song lyrics licensing:** Draw the Lyric + Genre-Bender need lyrics;
   PRD forbids copyrighted material. Default: paraphrased/original/PD only
   (M5 dataset follows this).
3. ⚠ **Remote Charades:** no video in the stack; default: co-located mode only.
4. ⚠ **Two Truths & a Lie** listed in §4.3 but absent from the 18 games.
5. ⚠ **"6 voting games" (§4.3) vs 4 in the game list.**
6. **Guess Who celebrity names** (text only) — default: OK.
7. **"Price Is Right" trademarked name** — default: keep (flag at M10/legal).
8. **Backend host:** Railway vs Render — pick at M11.
9. **Leaderboard periods:** daily/weekly/all-time for all games — default: yes.
10. **Nickname rules:** 20 chars, sanitized — implemented as default (M1).
11. **Instant play scope:** Trivia (solo) + WYR (one-screen) landed; other
    candidates (e.g., This or That one-screen tally) can be added on request.

---

## Upcoming Milestone

**M11 — Deployment + launch QA** (deferred by the owner — do not start
unless asked): Cloudflare Pages + Railway/Render, live domain, Lighthouse
CI budgets, browser-level axe/Lighthouse audits, Google Rich Results
validation, AdSense application, GA4 real ID, CSP hardening, runbook.

Until then, backlog items are fair game on request (word-bank curation,
trivia dataset expansion, Playwright E2E).

---

## Next Recommended Prompt

> **Next recommended prompt:** M11 deployment is deferred by the owner.
> Suggested: _"Continue with the backlog"_ (word-bank curation, trivia
> dataset expansion to 500+, Playwright E2E) — or ask to start M11.
