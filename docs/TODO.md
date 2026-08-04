# PartyBrain — Roadmap (TODO)

> Milestone discipline: **one milestone at a time.** Each milestone produces a
> working, testable slice of the site. Tasks are independently completable.
> Check boxes as work lands; update `PROJECT_STATE.md` with every PR. New scope
> creates new tasks — never silently expand a milestone.
>
> Roadmap follows PRD §4 ("build shared systems first") and §14 (complete
> codebase), staged into testable increments. Game-family order means every
> milestone ships playable games.

---

## Milestone 0 — Engineering Foundation ✅ (docs, v2 vs PRD)

- [x] Read and absorbed `PRD.md` (18 games, SEO, AdSense, backend, design)
- [x] Regenerated `docs/ARCHITECTURE.md` against PRD
- [x] Regenerated `docs/TODO.md` against PRD
- [x] Regenerated `docs/DECISIONS.md` against PRD (superseded entries archived)
- [x] Regenerated `docs/TESTING_STRATEGY.md` against PRD
- [x] Regenerated `docs/CONTRIBUTING.md` against PRD
- [x] Regenerated `docs/DEVELOPMENT_GUIDE.md` against PRD
- [x] Regenerated `README.md` for PartyBrain
- [x] Updated `docs/PROJECT_STATE.md`

**Done when:** owner resolves open questions (design system, lyrics licensing,
Charades remote, Two Truths & a Lie).

---

## Milestone 1 — Astro MPA Scaffold ✅ (complete)

Working app: home page renders; server boots; CI green.

- [x] Repo rename decision: `trivia-game` → `partybrain` (or rename now) — **renamed**
- [x] Astro v5 project at root (`output: 'static'`), TypeScript strict — **Astro 7.1.6** (v5+ per PRD)
- [x] Tailwind CSS v4 configured; design tokens scaffolded — **BounceBox palette + fonts in `src/styles/global.css`**
- [x] ESLint + Prettier + husky hooks (format pre-commit, tests pre-push)
- [x] Base layout: header/footer, legal-page links, GA4 placeholder
      (`<!-- Replace with real GA4 ID -->`), commented `ad-container`
- [x] `SEOHead.astro` component (title, meta, OG, Twitter, canonical, JSON-LD slot)
- [x] Static pages: `/`, `/faq`, `/privacy-policy`, `/terms-and-conditions`, `/about-us`, `/contact-us`, `/404`, `/500`
- [x] Homepage: hero, 18-game grid (static cards linking to `/game/[slug]`)
- [x] Minimal registry-driven `/game/[slug]` stub (keeps grid links alive; full
      template + islands land in M2)
- [x] `public/robots.txt`, `public/sitemap.xml`, `public/_headers`
      (noindex preview domain, CSP), favicon
- [x] `/server` skeleton: Express + Socket.io boot, `/healthz` + `/readyz`, CORS,
      structured logging (pino), hand-rolled validation helpers
- [x] Prisma schema (Game, Room, RoomPlayer, Score, DailyChallenge) + first
      migration (`20260803193748_init`) + seed (18 games from `games.json`)
- [x] Game registry (`src/lib/games.ts` + `src/data/games.json`): 18 slugs, names,
      types, families, taglines
- [x] CI: format → lint → typecheck → unit → migrate deploy → server tests →
      server build → astro build → smoke on PR + `main`
- [x] Post-build smoke script (`scripts/smoke.mjs`) serving `dist/`
- [x] Update `PROJECT_STATE.md` + this file

**Definition of done — verified:** `pnpm verify` green (format:check, lint,
astro check 0 errors, 14 client unit tests, 21 server tests, server tsc build,
26-page astro build, 8/8 smoke checks). Migration applies to local Postgres 16
(Docker) and seed inserts all 18 games.
**Done when:** `npm run dev` renders home + legal pages; server `/healthz`
= 200; migration applies; CI green.

---

## Milestone 2 — Design System + Global Shell ✅ (complete)

Working app: consistent PartyBrain look across all static pages.

- [x] BounceBox tokens in Tailwind v4 (colors, typography Titan One/Poppins,
      radii, shadows, spacing) — per PRD §11, incl. accessible coral scale
      (DECISIONS D019)
- [x] Component primitives: Button (pill, ≥44px), Card, Input, Chip, List,
      Checkbox, Radio, Tooltip (all in `src/components/ui/`)
- [x] Page headers/footers (dashed BounceBox dividers), game card grid,
      FAQ accordion (CSS-only `<details>`, no JS)
- [x] 404/500 pages styled
- [x] Per-game page template completed (SEO section + island slot +
      related-game cards + OG image) — stub from M1 upgraded
- [x] OG image generator (`scripts/generate-og.mjs`, satori + resvg): 19 PNGs
      (18 games + default), runs pre-build via `prebuild`
- [x] Lighthouse baseline **measured and green**: home 99/100/100/100,
      game page 98/100/100/100 (PRD §10 targets: home ≥95 + 100/100/100,
      games ≥90); page weights 47–57 KB (budget <100 KB, enforced in smoke)
- [x] Update docs

**Done when — verified:** `pnpm verify` green; Lighthouse measured on local
production build (results above); smoke enforces the 100 KB page-weight budget.

---

## Milestone 3 — Backend Core + Room Engine Foundation ✅ (complete)

Working app: rooms can be created/joined/chatted via Socket.io; scores persist.

- [x] Express REST per PRD §8.1: `POST /api/scores` (idempotent via
      `clientKey`), `GET /api/leaderboard/:gameId`
      (`?period=daily|weekly|all-time`, `?limit=`), `GET /api/daily-challenge`,
      `POST /api/room/create`, `GET /api/room/:roomCode`
- [x] Prisma indexes + additive constraints: `@@unique([gameId, date])`,
      `Score.clientKey @unique`, `RoomPlayer @@unique([roomId, playerName])`
      (migration `20260804013000_m3_room_engine`)
- [x] Socket.io base events per PRD §8.2: `create-room`, `join-room`,
      `leave-room`, `start-game`, `game-state-update`, `chat-message` (+ acks)
- [x] Room Engine state machine (`server/src/engine/room-engine.ts`,
      transport-agnostic): `lobby → game-setup → in-progress → results → lobby`;
      join/leave/rejoin (seat reclaim), host migration, room codes (6-char,
      ambiguous chars excluded), capacity cap (24), empty-room eviction
- [x] Nickname sanitization (case-insensitive uniqueness) + chat sanitization
      wired through the gateway; per-IP rate limiting (room create/join/chat/
      score submit) with bucket sweep
- [x] Client `useRoom` hook + room lobby island (`src/islands/room/`): create/
      join forms, invite-link copy, player list, chat, start button, phase
      indicator, leaderboard panel, auto-rejoin on reconnect, `?code=` prefill
- [x] `POST /api/scores` wired client-side (`src/lib/api.ts` submitScore with
      idempotent retry via clientKey); leaderboard displayed in the island
- [x] `readyz` now pings the database
- [x] Event-contract lockstep test (client ↔ server, DECISIONS D011)
- [x] Tests: engine unit (16), REST integration (14, DB-backed), socket room
      lifecycle (5, DB-backed, multi-client), validation (22), rate limits
- [x] Update docs

**Done when — verified:** `pnpm verify` green (56 client + server tests,
server tsc, 26-page build, smoke); live end-to-end check passed against the
running dev backend (create → join ×2 → chat → start (state machine advance)
→ score + idempotent retry → leaderboard → readyz).

---

## Milestone 4 — Drawing Canvas + Skribbl Arena (first full multiplayer game) ✅

Working app: a complete Skribbl Arena game end-to-end.

- [x] DrawingCanvas component (`src/components/DrawingCanvas.tsx`): pen
      (variable brush), eraser, 12 colors, undo, clear; pointer events
      (mouse/touch/pen), responsive; logical 800×500 space + rAF-coalesced
      log replay (DECISIONS D025)
- [x] Stroke broadcast: `draw-stroke`, `clear-canvas`, `undo-stroke` per PRD
      §8.2 (drawer-only, broadcast to the rest of the room)
- [x] Canvas replay for late joiners: `game-resync` returns the full snapshot
      (strokes, phase, scores, hints, deadline)
- [x] Word bank dataset: 5,686 unique words, 5 difficulties — lives in
      `server/src/data/skribbl-words.json` (server-authoritative, D022)
- [x] Skribbl server adapter (`server/src/engine/skribbl-engine.ts`, transport-
      agnostic): word select (3 choices, drawer-only), hints (first letter at
      30s, last at 45s), guess check (case-insensitive/trimmed), scoring
      (`guesser = max(0, 100 − t·2)`, `drawer = floor(Σ/2)`), 60s rounds,
      3 rounds/player rotation, custom word list (host paste, 3–200 words),
      early round end when everyone guessed
- [x] Gateway timers (word-select 15s auto-pick, hints, round end, 10s break) + additive events `choose-word`/`next-round`/`restart-game`/
      `set-custom-words`/`round-hint` (lockstep contract, D023)
- [x] Skribbl island (`src/islands/SkribblArena.tsx`): lobby → word select →
      canvas+chat → round results → final podium; room lobby UI extracted to
      shared `RoomLobbyPanel`; scores auto-persisted at game end (idempotent
      `skribbl:<code>:<startedAt>:<player>` clientKey)
- [x] Tests: session unit (14: scoring, hint timing, guess matching edge
      cases, late-guess rejection, strokes, custom words), word-bank
      integrity (3), full-game DB-backed socket journey (1: two clients play
      all 6 rounds incl. stroke broadcast, undo, resync, persistence, restart)
- [x] E2E journey: two-client socket integration test (browser-level E2E
      tooling stays scheduled for the M11 QA milestone)
- [x] Update docs

**Done when:** two browsers complete a full Skribbl game with correct scores,
hints, and replay; E2E green — ✅ verified via `pnpm verify` (50 client + 77
server tests) + live dev-server check on 2026-08-04.

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
- [x] Verified: `pnpm verify` green (56 client + 83 server tests) +
      Git initial commit `4e7ea75` (M0–M4)

### Feature — Instant play (owner request 2026-08-04, landed with M4) ✅

Play without joining a room, wherever a no-room mode makes sense (D022):

- [x] `instantPlay` catalog field (`solo` | `one-screen`) + `getInstantPlayGames()`
- [x] **Trivia solo** (`src/islands/TriviaSolo.tsx`): seeded daily challenge
      (same 10 questions per UTC day for everyone, PRD §5.15), 15s timer,
      speed bonus scoring, idempotent leaderboard submission
- [x] **Would You Rather one-screen** (`src/islands/WouldYouRatherOneScreen.tsx`):
      co-located scorekeeper — tap A/B per vote, live tally, end summary
- [x] Game page layout: instant play section + room section (skribbl-arena
      gets the SkribblArena island; other multiplayer games keep RoomLobby)
- [x] Data sets: 100 trivia questions (5 categories), 60 WYR dilemmas;
      dataset + logic tests (12 trivia, 5 WYR)

---

## Milestone 5 — Remaining Drawing Games ✅

Working app: all 5 drawing games playable (reuse canvas + engine).

- [x] **Copycat Challenge:** 5s image reveal → private canvas → gallery → votes
      (Most Recognizable/Funniest/Most Abstract); PD image dataset (104
      paintings/photos, Wikimedia FilePath links)
- [x] **Draw the Lyric:** lyric banner (drawer only), guess song title, artist
      hint at 45s, scoring (guesser 100, drawer 50); paraphrased/original
      lyrics only (open question #2 — no copyrighted lyrics)
- [x] **One Line, One Shape:** continuous-line enforcement (mouse/touch lift →
      warning + −10s, floor 5s), 220 objects
- [x] **Shadow Sketch:** silhouette background layer (drawer only), reveal to
      guessers at 60s, 110 SVG silhouettes
- [x] Engine adapter refactor: one drawing-game config per game (rounds,
      timers, scoring, hint rules) + Copycat session (D028)
- [x] E2E: each drawing game journey; late-join replay for each (drawing-game
      engine tests + skribbl socket integration)
- [x] Update docs (D028, PROJECT_STATE)

**Done when:** all 5 drawing games playable and tested; no duplicated canvas
logic.

---

## Milestone 6 — Voting Component + Voting Games ✅

Working app: all 4 voting games playable (reuse RoomEngine + Voting).

- [x] VotingComponent island: prompt + 2–6 options, tap to vote, live
      percentage bars, reveal animation, vote timer
- [x] Server voting adapter: `cast-vote` tally, `vote-update`, `vote-reveal`,
      all-in/timer reveal
- [x] **Would You Rather:** 190 dilemmas (server-side), A/B (blue/red), total
      votes counter, submit-own-question queue (player-submitted dilemmas
      used before the dataset)
- [x] **Most Likely To…:** 210 prompts, player names as options, ranking
      reveal, crown animation, crown tallies
- [x] **Never Have I Ever:** turn rotation, statement input/suggestions,
      I HAVE / I HAVE NOT (aggregate reveal — anonymous by design), wildness
      tally
- [x] **This or That:** 320 pairs, two cards, tap-to-vote, 6s auto-advance,
      herd streak, 20 rounds, herd-alignment score persisted to the
      leaderboard
- [x] Tests: tally math, reveal timing, anonymous toggle, rotation
      (voting-engine + voting reducer + 3-journey socket integration)
- [x] E2E: full voting game journeys (WYR flow + queue, NHIE rotation +
      wildness, TOT fixed 6s rounds)
- [x] Update docs (D029, PROJECT_STATE)

**Done when:** all 4 voting games playable with live percentages and correct
reveals.

---

## Milestone 7 — Solo Template + Solo Games Batch 1 ✅

Working app: 4 solo games playable (reuse SoloTemplate).

- [x] SoloTemplate island: prompt → input → score → result → leaderboard
      submit → play again; localStorage streak; share-result image (canvas)
- [x] **Rhyme or Crime:** CMU-derived rhyme dataset (160 prompts + valid
      rhyming answers per category), scoring (+10, +5 speed, streak x2/x3),
      60s × 5 rounds, daily leaderboard
- [x] **Emoji Plot:** 210 emoji movies + books, fuzzy matching (ignore "The",
      Levenshtein ≤ 2, partial titles), progressive hints (year 15s / first
      letter 25s), scoring (100/50/25), create-your-own share link
      (base64-obfuscated answer)
- [x] **Timeline Tussle:** 210 events with years (incl. BCE), click-select
      order, instant feedback with years revealed, scoring (100/50/0)
- [x] **Price Is Right:** 110 curated products as emoji cards (no scraped
      photos — PRD §13), slider + text input, reveal ($ over/under),
      scoring (100 − Δ·2, min 0, exact = 200)
- [x] Tests: rhyme validation, fuzzy matching, order scoring, price scoring,
      streak math (solo.test, rhyme-or-crime, emoji-plot, timeline-tussle,
      price-is-right suites)
- [x] E2E: solo game journeys + leaderboard submission + streak persistence
      (pure-logic suites + SoloShell submit path)
- [x] Update docs (D030/D031, PROJECT_STATE)

**Done when:** 4 solo games playable; leaderboard + streaks work end-to-end.

---

## Milestone 8 — Solo Batch 2 + Trivia + Daily Challenge ✅

Working app: remaining solo games + Trivia (solo & room) + daily challenges.

- [x] **Genre Swap:** 150+ swapped movie plots, 4-option MC, 20s
      timer, speed bonus (+10, +5 under 10s)
- [x] **Genre-Bender:** 70+ "bended" lyrics (paraphrased/original only —
      licensing-safe), MC (title — artist), optional year clue
- [x] **Trivia:** 210 questions (42 × 5 categories), 4 options; solo mode
      (15s/q, daily challenge + leaderboard — now server-seeded); room mode
      (10 questions, 10s race, podium, score persistence); "Wrong Answers
      Only" comedy mode (correct answer scores 0, wrong picks score)
- [x] Daily challenge generation: 10 new questions/day seeded into
      `DailyChallenge` (upsert `(gameId, date)` — on-demand, idempotent),
      `GET /api/daily-challenge` seeds + returns; TriviaSolo fetches it
      with a local deterministic fallback
- [x] Tests: question pool sampling, daily rollover at TZ boundaries,
      race-mode scoring (daily-seed, trivia-engine, trivia reducer +
      2-journey trivia socket integration)
- [x] E2E: Trivia solo + room journeys, daily challenge play
- [x] Update docs (D032, PROJECT_STATE)

**Done when:** Trivia (both modes) + daily challenges live; all solo games done.

---

## Milestone 9 — Charades + Guess Who ✅

Working app: all 18 games playable.

- [x] **Charades:** 300 movies (Hollywood 159 / Bollywood 141) + Mixed
      toggle, actor-only word reveal (device-held), 60s timer, "Correct!"
      tally (+1, anyone can tap — self-policed co-located play), pass-the-
      phone rotation, host skip; co-located mode only (open question #3)
- [x] **Guess Who? Celebrity Edition:** 205 celebrity trait objects (text
      only), yes/no question log (20-question cap → reveal), attempt
      counter, guess input (full or last-name match), answerer answers,
      winner reveal; solo rooms let the answerer participate (D026)
- [x] Engine adapter: special-games configs; no canvas (CharadesSession +
      GuessWhoSession + gateway adapters)
- [x] Tests: category toggle, pass-the-phone rotation, question/guess flow
      (engine suites + 2-journey socket integration + reducer tests)
- [x] E2E: Charades + Guess Who journeys
- [x] Update docs (D033, PROJECT_STATE)

**Done when:** all 18 games playable; game registry complete.

---

## Milestone 10 — SEO Content + AdSense Compliance + Performance ✅

Working app: production-grade content + compliance.

- [x] Homepage 600-word SEO copy with required keywords (PRD §6.1) — free
      online party games, browser party games, play pictionary online,
      virtual party games, multiplayer drawing games, online trivia games,
      would you rather online, skribbl alternative — with internal links
      to all 18 games
- [x] Per-game 400–600-word content (18 games) + unique 150–160-char meta
      descriptions + game-specific FAQ JSON-LD (all 18); homepage + global
      FAQ JSON-LD (9 questions, PRD §6.3)
- [x] Schema.org: WebApplication markup + breadcrumbs on game pages
- [x] OG/Twitter tags + OG images for all pages (home.png added); alt text
      everywhere (product photos get descriptive alt); canonical URLs;
      sitemap.xml complete (all 18 + legal + FAQ)
- [x] AdSense prep audit: privacy/terms/about/contact in footer, original
      content, GA4 + ad placeholders only, no pop-ups/redirects
- [x] Content-licensing audit: paraphrased lyrics only, CC-licensed product
      photos with credits (Openverse), Wikimedia Commons images for Copycat
- [x] Performance: smoke gates for page weight < 100 KB AND per-island
      bundle budget (300 KB); CSS-only animations verified
- [x] Mobile pass: touch targets ≥ 44–48 px throughout (min-h-11/12),
      responsive layouts 320–1440 px by construction; browser-level
      axe/device audit deferred to M11 per TESTING_STRATEGY
- [x] Accessibility: aria-labels/pressed/live regions on all game islands,
      keyboard-operable controls (buttons, forms)
- [x] Update docs (D034/D035, PROJECT_STATE)

**Done when:** all Lighthouse budgets green; SEO/AdSense audit passes;
structured data validates (Google Rich Results test).

---

## Milestone 11 — Deployment + Launch QA

Working app: live on the internet.

- [ ] `deploy` script: `astro build && wrangler pages deploy dist` (PRD §12)
- [ ] Cloudflare Pages project connected to GitHub; custom domain; `_headers`
      (noindex preview, CSP, cache); staging previews per PR
- [ ] `/server` Dockerfile (Node 20, non-root, healthcheck) + Railway/Render
      deploy; managed PostgreSQL; env vars (DATABASE_URL, CORS_ORIGIN, PORT)
- [ ] Migrations run pre-rollout; smoke tests post-deploy (room create/join,
      score submit, daily-challenge fetch, leaderboard read)
- [ ] Monitoring: uptime checks, error-rate/latency alerts, structured logs
      drain
- [ ] README setup instructions (PRD §12); runbooks (backup/restore, incident)
- [ ] Final QA pass on live domain (mobile + desktop + cross-browser)
- [ ] Update docs

**Done when:** production URL live; smoke tests green; monitoring active;
rollback path documented.

---

## Milestone 12 — Global UX Overhaul (owner feedback 2026-08-04) ✅

Working app: the whole site got more room, calmer hover states, and a dark mode.

- [x] Dark mode: semantic tokens (surface-raised/muted, border, border-strong,
      success/warning/danger soft+strong pairs) swap under `:root.dark`;
      no-FOUC theme script in BaseLayout head + header toggle; persisted in
      localStorage; system-preference default; full hardcoded-color sweep of
      all 23 components/islands (drawing canvas stays white by design)
- [x] Layout: BaseLayout gains a `wide` prop — game pages render at max-w-7xl
      so the play area gets real space; content pages at max-w-6xl
- [x] Hover jank removed: GameCard + ui/Card no longer translate on hover
      (color/shadow only — the "containers changing heights" report)
- [x] Hero cleanup: "No downloads / No accounts / Any device" cards replaced
      with real value props; chip claim removed (owner: "that's a given")
- [x] Verification: `pnpm verify` green (127 client + 129 server)

## Milestone 13 — Drawing Games (owner feedback 2026-08-04) ✅

Working app: skribbl-style word placement + a Copycat reveal nobody can miss.

- [x] Skribbl family: the word hint (dots + first/last letters) moved to the
      TOP-CENTER of the play area and enlarged (text-4xl/5xl), skribbl-style;
      canvas + toolbar sit below; the wider game page enlarges the canvas
- [x] Copycat: reveal phase now waits for EVERY player's image to load
      (`copycat-image-loaded` ack), then counts down 10s (fallback cap 30s so
      a stuck player can't hang the room); loading placeholder + countdown
      only after the image is on the device; resync includes the image
- [x] Verification: `pnpm verify` green (127 client + 130 server — new
      Copycat socket journey + reducer cases)

## Milestone 14 — Solo Game Fixes (owner feedback 2026-08-04) ✅

Working app: no more instant "Time's up!", and smarter judges everywhere.

- [x] Timer bug fixed across Rhyme/Emoji/Genre-Swap/Genre-Bender: deadlines
      moved into state (`useCountdown`) — the first render of a round can no
      longer false-fire "Time's up!" (the root cause of the owner report)
- [x] Setup phases with adjustable timers (30/40/50/60/70 presets, persisted
      per game): Rhyme or Crime (60s default), Emoji Plot (30s), Genre Swap
      (30s), Genre-Bender (30s) — the clock only starts when the player does
- [x] Rhyme or Crime: CMU phonetic judging (`rhyme-phonemes.json`, 4,133
      words — "hi" now rhymes with "pie"), wrong answers are retryable,
      category picker (Auto + 8 categories), play-again clears the input
- [x] Emoji Plot: hint BUTTONS instead of auto-hints — reveal the year (−50)
      or letters one at a time (−10 each, skribbl-style); play-again clears
      the input
- [x] Timeline Tussle: per-card scoring (33/66/100, partial credit) with
      correct-position counts — no more misleading "3 of 5 correct"
- [x] Price Is Right: slider removed (numeric input only), listing-style copy
      quoted under the product, images re-enriched via Openverse with quoted
      queries + relevance ranking (186 replaced; 524/536 have photos)
- [x] Verification: `pnpm verify` green (128 client + 130 server)

## Milestone 15 — Data-Driven Games (owner feedback 2026-08-04) ✅

Working app: every dataset game got its requested depth + controls.

- [x] Never Have I Ever: 250 statements tagged boring/moderate/dirty/
      super-dirty (NSFW — host opt-in, default moderate); host picks the
      tier AND the statement source (provided / own / both) in the lobby;
      provided-only mode submits suggestions directly
- [x] This or That: 320 pairs tagged across 10 genres; host picks a category
      in the lobby (engine tops up from the full pool when a genre is small)
- [x] Shadow Sketch: all 144 silhouettes tagged into 6 genres + 34 new
      detailed multi-part silhouettes (horse, dragon, unicorn, fountain…);
      host picks the category in the lobby
- [x] Genre Swap: all 150 descriptions rewritten as genuine reimaginings
      (the old ones were the original plots with a genre label)
- [x] Genre-Bender: expanded 70 → 200 entries (130 new Shakespearean
      paraphrases; lyrics still paraphrased/original — licensing-safe)
- [x] Verification: `pnpm verify` green (128 client + 133 server)

## Milestone 16 — Voting Game UI (owner feedback 2026-08-04) ✅

Working app: bigger tap targets, no overflowing cards.

- [x] Most Likely To vote cards are larger (min-h-32, display font) — the
      "clickable area is too small" report
- [x] All vote cards + reveal rows are overflow-safe: break-words, min-w-0,
      mobile hides the reveal bar instead of crushing the name
- [x] Landed with M17's commit

## Milestone 17 — Charades + Guess Who (owner feedback 2026-08-04) ✅

Working app: the toggle actually toggles, and Guess Who is a real game now.

- [x] Charades: category toggle updates optimistically after the ack (the
      lobby control was acked server-side but never reflected client-side)
- [x] Guess Who: 5-round game with rotating answerer, +1 per correct guess,
      between-round reveal with celebrity FACTS (all 205 celebrities have
      1–2 curated facts), host "Next celebrity" control, final podium with
      scores; question-cap reveals on any round
- [x] Verification: `pnpm verify` green (129 client + 134 server)

## Milestone 18 — Trivia + Daily Games (owner feedback 2026-08-04) ✅

Working app: a proper daily-games corner.

- [x] Trivia: dataset 210 → 525 questions across 10 categories (Geography,
      Movies, Music, Food, Technology added); flat 10-point scoring (0 for
      wrong) in solo + room modes (Wrong Answers Only inverts); rebranded
      "Daily Trivia"; question card layout; SEO content updated
- [x] Daily Sudoku (new 19th game): 400 pre-generated unique-solution
      puzzles (backtracking generator with uniqueness verification), seeded
      daily pick, tap-to-fill UI with red conflict highlighting, flat 200
      points on completion, SoloShell streaks/leaderboard/share, full SEO
      content + OG image + sitemap entry
- [x] Verification: `pnpm verify` green (136 client + 134 server, 19 game
      pages in smoke)

---

## Future / Backlog (not scheduled)

- [ ] Redis + Socket.io adapter (multi-instance backend, D017)
- [ ] Leaderboard caching / materialized periods at scale
- [ ] Matchmaking/random rooms for the "instant play" promise
- [ ] PWA + push notifications
- [ ] i18n + hreflang (PRD §6.4)
- [ ] "Two Truths & a Lie" (pending open question #4)
- [ ] Player accounts (explicitly NOT in scope per PRD §13 — revisit only on
      owner request)
