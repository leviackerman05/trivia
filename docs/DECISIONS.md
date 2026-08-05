# Decision Log, TriviaHub

> **Append-only.** Never edit or delete an existing entry; append new decisions
> at the bottom (D018+). Record every architecture-affecting choice here.
>
> **v2 note (2026-08-04):** `PRD.md` now exists and fixed the stack
> ("DO NOT DEVIATE", PRD §2). The original bootstrap decisions (D001-D012,
> made before the PRD) conflicted with the PRD in several places. Per project
> instruction, **conflicting decisions are superseded, not deleted**, the
> original entries are preserved verbatim in the
> [Archive](#archive-superseded-bootstrap-decisions-d001d012) at the end of
> this file, each marked with its supersession. Active decisions are D001-D017
> below, all aligned with the PRD.

---

## Active Decisions (PRD-aligned)

## D001, Single repo: Astro app at root + `/server` backend

- **Decision:** One repository. The Astro application lives at the repo root
  (single root `package.json` with `astro build` and the PRD §12 `deploy`
  script); the Node backend lives in `/server` (own `package.json`).
- **Reason:** PRD §8 mandates "Create this in /server folder" and §12 defines
  `"deploy": "astro build && wrangler pages deploy dist"` at the root, the PRD
  prescribes this exact layout. One repo keeps frontend + backend + datasets +
  docs in sync.
- **Alternatives considered:** pnpm workspace monorepo with `apps/` (v1 choice
  , conflicts with PRD layout); separate repos (drift risk).
- **Tradeoffs:** Root package.json is Astro-specific; server has isolated deps.
  CI runs both. Package manager: pnpm preferred, npm acceptable (PRD §2).
- **Date:** 2026-08-04 (supersedes v1 D001)
- **Future impact:** Adding a mobile client later doesn't disturb the layout.

## D002, TypeScript strict everywhere

- **Decision:** TypeScript with strict mode across Astro islands, server, and
  scripts. No `any` without justification.
- **Reason:** End-to-end type safety is the primary correctness tool; the
  Socket.io event map and REST payloads are the riskiest surfaces.
- **Alternatives considered:** JavaScript; mixed-typed codebase.
- **Tradeoffs:** Slight setup overhead; net win for a contract-heavy real-time
  app.
- **Date:** 2026-08-04 (unchanged from v1, still valid)
- **Future impact:** Shared event constants keep client/server names in lockstep.

## D003, Astro v5 MPA with React islands (not a SPA)

- **Decision:** Astro v5 static site generation; every route is static HTML;
  interactive games are React islands hydrated with `client:load` per page.
  **No SPA, no client-side routing shell.**
- **Reason:** PRD §2 (Astro v5 + SSG), §3 (MPA with a static route per game),
  and §13 ("Do NOT make the site a single-page application"). SEO ranking and
  AdSense compliance depend on static, fast, crawler-friendly pages.
- **Alternatives considered:** Vite SPA (v1 choice, conflicts with PRD §13);
  Next.js SSR (heavier, not in PRD stack).
- **Tradeoffs:** Each game page ships its own island bundle; shared code must be
  code-split. No full-app client state store (islands are self-contained).
- **Date:** 2026-08-04 (supersedes v1 D003)
- **Future impact:** PWA wrapping works from static output.

## D004, Tailwind CSS v4 + BounceBox design tokens

- **Decision:** Tailwind CSS v4 for styling. Design system: BounceBox per PRD
  §11 (coral/teal/sunshine palette, Titan One + Poppins, pill buttons, 24px
  card radii, ≥44px touch targets, glow shadows).
- **Reason:** PRD §2 (Tailwind v4) and §11 (BounceBox spec is the detailed,
  implementable system in the PRD).
- **Alternatives considered:** Vercel minimal aesthetic (PRD §2 references it,
  but the referenced `@DESIGN.md` does not exist and §2's text conflicts with
  §11, see Open Question #1 in PROJECT_STATE.md).
- **Tradeoffs:** BounceBox targets kids 3-8 while PRD §1 targets 16-35.
  flagged; if the owner chooses Vercel-style instead, only tokens/components
  change, not architecture.
- **Date:** 2026-08-04 (supersedes v1 D004's styling framing)
- **Future impact:** Design tokens are isolated in Tailwind config; restyling is
  cheap.

## D005, Node.js + Express backend in `/server`

- **Decision:** Express for REST + Socket.io on the same Node process.
- **Reason:** PRD §2 ("Node.js + Express.js (separate server in /server
  folder)") and §8, the stack is fixed.
- **Alternatives considered:** Fastify (v1 choice, conflicts with PRD §2);
  NestJS (not in PRD).
- **Tradeoffs:** Express is not schema-first; we add small hand-rolled
  validation helpers (or zod) at boundaries. Fine for this API surface.
- **Date:** 2026-08-04 (supersedes v1 D004)
- **Future impact:** Engine logic stays transport-free for testability.

## D006, PostgreSQL + Prisma (PRD §8.3 schema, verbatim)

- **Decision:** PostgreSQL with Prisma; exactly the five models from PRD §8.3:
  `Game`, `Room`, `RoomPlayer`, `Score`, `DailyChallenge`. Additive notes only:
  indexes (`Score(gameId, playedAt)`, `Score(gameId, score)`,
  `@@unique([gameId, date])` on DailyChallenge).
- **Reason:** PRD §2 + §8.3. Scores, room metadata, and daily challenges are
  the durable state; live rooms are not.
- **Alternatives considered:** The 9-table schema designed pre-PRD (conflicts
  with PRD §8.3); SQLite; raw SQL.
- **Tradeoffs:** Player identity is a free-text name (no users table), aligned
  with PRD §13 (no auth). Leaderboard periods derive from `playedAt`.
- **Date:** 2026-08-04 (supersedes v1 D005 in part)
- **Future impact:** Adding accounts later would add a `User` model + FK on
  `Score`, a schema change, deliberately out of scope now.

## D007, No authentication, nickname-only identity

- **Decision:** No accounts, no passwords, no OAuth, no sessions. Identity is a
  sanitized nickname (length-capped, filtered). Everything works without an
  account (PRD §1, §13).
- **Reason:** PRD §13: "Do NOT require user authentication, everything works
  with just a nickname." Maximizes the "play instantly" promise and minimizes
  PII/attack surface.
- **Alternatives considered:** Guest accounts + upgrade (v1 D009 JWT/auth
  design, conflicts with PRD §13).
- **Tradeoffs:** No cross-device identity, no persistent profiles, weaker abuse
  attribution → mitigated by rate limits + server-authoritative logic.
- **Date:** 2026-08-04 (supersedes v1 D009)
- **Future impact:** If accounts are ever added, it is an additive feature
  behind the existing nickname flow.

## D008, Server-authoritative room engine (non-negotiable)

- **Decision:** All room state, round timers, guess correctness, vote tallies,
  and scores are computed server-side. Clients send intents and render
  broadcasts. Late guesses/votes are rejected.
- **Reason:** Correctness and fairness of leaderboards and scoring depend on it;
  PRD §8.2 implies server-side checking ("server checks if correct", "server
  tallies").
- **Alternatives considered:** Client-authoritative (rejected, trivially
  cheatable, unverifiable leaderboards).
- **Tradeoffs:** Server cost per room; latency floor, negligible for party
  game cadence.
- **Date:** 2026-08-04 (extends v1 D008, still valid)
- **Future impact:** Enables fair leaderboards and future anti-cheat analytics.

## D009, Shared systems built once (PRD §4)

- **Decision:** Four shared systems are first-class deliverables: Room Engine
  (12 real-time games), Drawing Canvas (5 drawing games), Voting/Poll (voting
  games), Solo Game Template (6 solo games). Games are thin configs over these.
- **Reason:** PRD §4: "BUILD ONCE, REUSE EVERYWHERE… must reuse the same
  component, not duplicate code."
- **Alternatives considered:** Per-game bespoke implementations (conflicts with
  PRD §4).
- **Tradeoffs:** Shared abstractions need careful interfaces up front; the
  milestone order (M3-M6) front-loads this investment.
- **Date:** 2026-08-04
- **Future impact:** New games = new config + dataset, not new infrastructure.

## D010, Static JSON datasets in-repo, licensing-constrained

- **Decision:** Game datasets live as static JSON in `src/data/` (PRD §5 sizes,
  e.g., 500+ Skribbl words, 500+ trivia questions) and are validated by a
  dataset-integrity test. Content is restricted to public-domain/CC0/
  self-created material (PRD §7, §13), no scraped or copyrighted assets.
- **Reason:** PRD §4.4 (solo games load static JSON), §5 dataset sizes, §13
  prohibitions (no scraping, no paid/copyrighted images).
- **Alternatives considered:** External API for content (cost, reliability,
  against "static JSON" wording); scraping (explicitly forbidden).
- **Tradeoffs:** Datasets are manual/curated, flagged risks: song lyrics
  (Draw the Lyric, Genre-Bender), celebrity names (Guess Who), "Price Is
  Right" name (Open Questions #2, #6, #7).
- **Date:** 2026-08-04
- **Future impact:** Datasets can move to CDN or DB later without changing
  game code.

## D011, Shared event/contract module (client ↔ server)

- **Decision:** A single source of truth for Socket.io event names and payload
  shapes: `src/lib/events.ts` (client) mirrored by `server/src/lib/events.ts`,
  kept identical by a contract test that compares both files' exported
  constants. PRD §8.2 event names are used **verbatim**.
- **Reason:** Event-name drift between islands and server is the classic
  real-time bug; the PRD defines the names, encode them once.
- **Alternatives considered:** A separate `packages/shared` workspace (heavier
  than needed for one repo; revisit if a second client appears).
- **Tradeoffs:** Two files to keep in sync, enforced by the contract test.
- **Date:** 2026-08-04 (revises v1 D010 for the single-repo layout)
- **Future impact:** A future mobile client can import a real shared package.

## D012, SEO & AdSense-first engineering

- **Decision:** SEO and AdSense compliance are build-time requirements, not
  launch-day tasks: per-route meta/OG/canonical, JSON-LD (WebApplication, FAQ,
  breadcrumbs), sitemap/robots, `_headers` (noindex preview, CSP), legal pages
  in the footer, original 400-600-word content per game, GA4 + ad unit
  **placeholders only** (commented), no pop-ups/auto-redirects.
- **Reason:** PRD §6 and §7. Google ranking and AdSense approval are primary
  success metrics; §7: "must be met from day one".
- **Alternatives considered:** Retrofit SEO at launch (conflicts with PRD §7).
- **Tradeoffs:** Writing 18 game pages of original SEO copy is real content
  work (M10); placeholder ads keep pages clean until approval.
- **Date:** 2026-08-04
- **Future impact:** hreflang (PRD §6.4) is additive when i18n lands.

## D013, Deployment: Cloudflare Pages + Railway/Render (PRD §12)

- **Decision:** Frontend: static export deployed to Cloudflare Pages from
  GitHub (`astro build && wrangler pages deploy dist`), custom domain,
  `_headers` for preview-domain `noindex`. Backend: `/server` containerized
  (Dockerfile) on Railway or Render with managed PostgreSQL; env: `DATABASE_URL`,
  `CORS_ORIGIN`, `PORT`.
- **Reason:** PRD §2 + §12 fix the platforms.
- **Alternatives considered:** Vercel, Fly.io (v1 choice, conflicts with PRD §2).
- **Tradeoffs:** Backend host choice (Railway vs Render) deferred to M11.
  Open Question #8; images are portable either way.
- **Date:** 2026-08-04 (supersedes v1 D012)
- **Future impact:** Platform migration only changes deploy manifests.

## D014, Documentation-first repo layout (unchanged)

- **Decision:** `README.md` + `CONTRIBUTING.md` at root; `ARCHITECTURE.md`,
  `PROJECT_STATE.md`, `TODO.md`, `DECISIONS.md`, `TESTING_STRATEGY.md`,
  `DEVELOPMENT_GUIDE.md`, `PRD.md` under `docs/`.
- **Reason:** Clean root; GitHub auto-surfaces README/CONTRIBUTING; `docs/`
  groups the corpus with PROJECT_STATE as the canonical memory.
- **Alternatives considered:** All docs at root; separate docs repo.
- **Tradeoffs:** Minimal, convention documented in CONTRIBUTING.
- **Date:** 2026-08-04 (unchanged from v1, still valid)

## D015, Leaderboards in PostgreSQL (Redis deferred)

- **Decision:** Leaderboard reads/writes go directly to PostgreSQL using the
  PRD `Score` model with supporting indexes. No Redis in the core stack.
- **Reason:** PRD §2 lists no cache store; §8.3 defines the `Score` model as
  the leaderboard source. Simpler to operate; correct at expected volume.
- **Alternatives considered:** Redis ZSETs (v1 D006, conflicts with PRD
  stack; revisit at scale); in-memory caches.
- **Tradeoffs:** Higher read cost than ZSETs at very large scale, indexed
  queries mitigate; the Redis path is documented for the first scale step.
- **Date:** 2026-08-04 (supersedes v1 D006)
- **Future impact:** Adding Redis for leaderboards later is additive and
  invisible to clients.

## D016, Single-instance backend initially; Redis adapter is the scale path

- **Decision:** Ship one backend instance with in-memory Socket.io rooms
  (matching PRD stack). When multi-instance is needed: add Redis +
  `@socket.io/redis-adapter`, move room state to Redis, add Redis-backed rate
  limiting.
- **Reason:** PRD stack has no Redis; single instance is the simplest correct
  system for launch and for room games of this size.
- **Alternatives considered:** Redis from day one (v1 D006/D007, conflicts
  with PRD §2 simplicity; extra operational surface).
- **Tradeoffs:** A single instance bounds socket capacity; monitored at launch
  (M11), scaled by D017 when needed.
- **Date:** 2026-08-04 (supersedes v1 D007 in part)
- **Future impact:** The engine is already transport-abstracted; the adapter
  swap is contained.

## D017, Milestone & docs discipline (unchanged)

- **Decision:** One milestone at a time; each ships a working app; docs updated
  with every PR; `PROJECT_STATE.md` is the memory; `DECISIONS.md` append-only.
- **Reason:** Keeps a large 18-game build reviewable and shippable.
- **Alternatives considered:** Big-bang delivery (PRD §14's "generate the
  complete codebase" wording, rejected for engineering reviewability).
- **Tradeoffs:** Slower to "everything at once"; much faster to working,
  tested increments.
- **Date:** 2026-08-04 (unchanged from v1, still valid)

---

## Archive: Superseded Bootstrap Decisions (D001-D012, pre-PRD)

> These entries were written before `PRD.md` existed. They are preserved
> verbatim for history and **must not be treated as current**. Each is marked
> with its superseding decision.

### v1 D001, Monorepo with pnpm workspaces → **SUPERSEDED by D001**

Original: "Single repository using pnpm workspaces with `apps/` and
`packages/` layout…", replaced by the PRD-mandated root-Astro + `/server`
layout.

### v1 D002, TypeScript (strict) everywhere → **still valid (D002)**

### v1 D003, React + Vite + Tailwind for the frontend → **SUPERSEDED by D003**

Original proposed a Vite SPA; PRD §2/§3/§13 mandate Astro MPA + islands.

### v1 D004, Node.js + Fastify backend (TypeScript) → **SUPERSEDED by D005**

PRD §2 mandates Express.

### v1 D005, PostgreSQL as source of truth (Prisma ORM) → **still valid (D006)**

Schema revised to PRD §8.3's five models.

### v1 D006, Redis for ephemeral state → **SUPERSEDED by D015/D016**

PRD stack has no Redis; deferred to the first scale step.

### v1 D007, Socket.IO with Redis adapter for real-time → **SUPERSEDED by D016**

Redis adapter now the documented scale path, not the initial configuration.

### v1 D008, Server-authoritative game engine (non-negotiable) → **still valid (D008)**

### v1 D009, JWT access + rotating refresh tokens → **SUPERSEDED by D007**

PRD §13: no authentication.

### v1 D010, Shared contract package (`packages/shared`) → **REVISED by D011**

Single-repo event-constants module with a contract test, instead of a
workspace package.

### v1 D011, Documentation-first repo layout → **still valid (D014)**

### v1 D012, Deployment: Docker + managed PG/Redis, platform provisional

→ **SUPERSEDED by D013** (Cloudflare Pages + Railway/Render per PRD §2/§12).

---

## D018, M1 implementation baseline (versions, workspace mechanics, verification)

- **Decision:** Implementation baseline recorded at M1 completion:
  - **Astro 7.1.6** (satisfies PRD "v5+") with `@astrojs/react` 6, React 19.2,
    Tailwind v4.3 via `@tailwindcss/vite`, TypeScript **~6.0.2** (not 7):
    `@astrojs/check` supports TS ≤6 and `typescript-eslint` requires <6.1.
  - **Prisma 6.19.3** (not 7): Prisma 7 changes the client generator and
    config surface; 6 keeps the PRD §8.3 schema workflow stable. Upgrade
    tracked as a chore (PROJECT_STATE → Technical Debt).
  - **pnpm 11 workspace mechanics:** pnpm 11 requires `pnpm-workspace.yaml`
    for settings (`allowBuilds` for esbuild/prisma postinstall scripts) and
    auto-created one; `server` is declared as a workspace member so one
    `pnpm install` covers both packages. Repo layout per D001 is unchanged
    (Astro at root, `/server`).
  - **Page-render verification:** Astro 7 removed the programmatic
    `createServer` export used for in-process render tests; M1 uses
    structural route tests (unit) + `scripts/smoke.mjs` post-build checks
    over `dist/`. Playwright E2E remains the plan for M3+.
  - **Local Postgres:** Docker `postgres:16` container (`triviahub-pg`);
    migrations via `prisma migrate dev`; CI applies `prisma migrate deploy`
    against a `postgres:16` service container.
- **Reason:** Pin a coherent, mutually compatible toolchain at the scaffold
  stage; record the pnpm 11 workspace nuance and the verification approach so
  later milestones don't rediscover them.
- **Alternatives considered:** TypeScript 7 (unsupported by check/lint
  tooling); Prisma 7 (breaking generator change, premature); npm instead of
  pnpm (PRD allows; pnpm preferred and working).
- **Tradeoffs:** Two majors (Astro 7, React 19) are newer than the PRD's
  original framing; all core APIs used (pages, islands, `client:load`,
  `getStaticPaths`) are stable across 5→7. Prisma 6 means a planned upgrade
  chore later.
- **Date:** 2026-08-04
- **Future impact:** Toolchain majors are documented; upgrades follow the
  same verify pipeline (`pnpm verify`).

---

## D019, M2 design-system decisions (accessible coral, OG pipeline, CSS-only)

- **Decision:** At M2, the BounceBox system (PRD §11) was implemented with
  three additions:
  1. **Accessible coral scale:** PRD §11's `#FF6B6B` fails WCAG AA contrast
     on white (2.77:1; needs 3:1 large / 4.5:1 normal). Added tokens
     `primary-strong #D93636` (text on white, 4.6:1), `primary-deep #B83232`
     (text on light coral fills, 4.7:1), `primary-hover #C93D3D` (button
     hover). Brand coral remains for fills, glows, and decoration.
  2. **OG image pipeline:** `scripts/generate-og.mjs` renders 1200×630 PNGs
     (satori → `@resvg/resvg-js`, devDeps) for all 18 games + default at
     build time (`prebuild`), because social platforms don't support SVG
     `og:image`. Output to `public/og/` (gitignored; regenerated on build).
  3. **CSS-only interactions** per PRD §13: FAQ accordion via
     `<details>/<summary>`, tooltips via hover/focus opacity transitions.
     no JS, keyboard + screen-reader native.
- **Reason:** PRD §10 requires Lighthouse 100 Accessibility; the contrast
  measurement was taken on a real production build (99/100/100/100 home,
  98/100/100/100 game page, budgets met).
- **Alternatives considered:** Keeping `#FF6B6B` as text (fails Lighthouse
  a11y 100); SVG OG images (unsupported by major platforms); JS accordions
  (violates PRD §13).
- **Tradeoffs:** The coral family now has four shades (documented in
  `src/styles/global.css`); OG images add ~35 KB each to dist and ~2-3 s to
  build time.
- **Date:** 2026-08-04
- **Future impact:** The accessible scale is the reference for all future
  components; new UI must pass the Lighthouse gate before merge.

## D020, Astro template formatting constraint (prettier-plugin-astro)

- **Decision:** Astro template expressions must avoid parenthesized
  conditional JSX (`{cond ? (<A/>) : (<B/>)}`): `prettier-plugin-astro`
  appends a semicolon after the closing paren, which Astro 7's parser
  rejects at build. Use non-parenthesized guards (`{cond && <A/>}{!cond &&
<B/>}`) instead.
- **Reason:** Discovered at M2 build time (Button component); documented so
  future components don't rediscover it.
- **Alternatives considered:** `prettier-ignore` comments (kept as last
  resort); upgrading formatter config (no stable option exists).
- **Tradeoffs:** Slightly less conventional JSX layout for conditional
  renders, negligible.
- **Date:** 2026-08-04
- **Future impact:** Applies to all `.astro` files; React islands are
  unaffected (they use standard TSX).

---

## D021, M3 backend decisions (idempotency, persistence, testing, SSR-safety)

- **Decision:** M3 recorded the following implementation choices:
  1. **Score idempotency:** additive `Score.clientKey String? @unique`
     (client-generated key per completed game; same key → same row, 200
     with `duplicate: true`). Without a key, submissions are not deduped.
  2. **Rejoin persistence:** additive `@@unique([roomId, playerName])` on
     `RoomPlayer` so seat upserts are idempotent.
  3. **First joiner is host:** `create-room` only issues the code; the first
     `join-room` claims host. (Matches PRD §8.2 event split.)
  4. **Best-effort persistence:** room/player writes from the socket gateway
     are fire-and-forget with logging, live gameplay never depends on the
     DB; the engine is the source of truth. REST writes (scores) are awaited.
  5. **Lazy Prisma accessor** (`getPrisma()`, test-resettable) so integration
     tests can set `DATABASE_URL` before the first query.
  6. **Integration testing:** DB-backed suites use the configured
     `DATABASE_URL` (local Docker container / CI service container) rather
     than testcontainers; files run serially (`fileParallelism: false`) to
     avoid cross-worker races on the shared dev DB; vitest loads `server/.env`
     and silences request logs. TESTING_STRATEGY updated to match.
  7. **SSR-safe islands:** the socket client is created inside `useEffect`
     (client-only), Astro prerenders islands server-side, and `window`/
     socket creation must not run in Node during `astro build`.
- **Reason:** Correctness (idempotent retries), resilience (gameplay over
  history writes), and testability of a real-time system.
- **Alternatives considered:** testcontainers per suite (extra dep + image
  pulls; CI already provides a Postgres service); awaited persistence in the
  socket path (makes gameplay depend on DB latency/uptime); global eager
  Prisma client (breaks test env switching).
- **Tradeoffs:** Idempotency is opt-in per client (islands must send a key);
  DB-backed tests need a reachable Postgres; best-effort writes can lag
  briefly (tests poll).
- **Date:** 2026-08-04
- **Future impact:** The engine/gateway split means M4+ game adapters plug
  into the same state machine; the idempotency contract becomes the standard
  for solo-game score submission (M7).

---

## D022, Instant play scope + server-side word bank (owner request 2026-08-04)

- **Decision:** Two things landed together:
  1. **Instant play** (play without a room) is offered only where a no-room
     mode genuinely fits: **Trivia** gets `instantPlay: "solo"` (PRD §5.15
     daily challenge, 10 seeded questions per UTC day, idempotent
     leaderboard submission) and **Would You Rather** gets
     `instantPlay: "one-screen"` (co-located scorekeeper: pass the phone,
     tap A/B per vote, live tally). All other games stay room-only (Skribbl
     and Guess Who are inherently room games; the pure-solo games get their
     template at M7). Catalog field: `Game.instantPlay?: 'solo' | 'one-screen'`.
  2. **Skribbl word bank** lives in `server/src/data/skribbl-words.json`
     (5,686 unique words, 5 difficulties), NOT in the Astro app.
- **Reason:** Words must be server-authoritative (D008), shipping the bank
  to the browser would let guessers preload answers. The instant-play gate
  keeps the surface honest: one-screen play only where the game reads well
  on a shared screen.
- **Alternatives considered:** word bank in `src/data` + fs-read (tsc does
  not copy JSON to `dist`; `resolveJsonModule` embeds it, chosen); instant
  play for every game (room games lose their point); random solo questions
  (daily challenge requires a shared, comparable set → date-seeded selection).
- **Tradeoffs:** The bank is far larger than the PRD's 500+ and difficulty
  labels are loose, a curation pass is backlogged (M5); the trivia dataset
  is 100 questions vs PRD's 500+ (expansion backlogged with M8).
- **Date:** 2026-08-04
- **Future impact:** M5 drawing games reuse the bank and the DrawingCanvas;
  the `instantPlay` field drives the per-game page layout.

## D023, Skribbl round protocol: additive events and drawer-only payloads

- **Decision:** M4 added `choose-word`, `next-round`, `restart-game`,
  `set-custom-words` (client→server) and `round-hint` (server→client);
  `draw-stroke`/`undo-stroke`/`clear-canvas` now also broadcast
  server→client. Word-select `round-start` carries the 3 choices **only** to
  the drawer (private emit; the drawer is excluded from the public emit so
  every client receives exactly one event per phase). The drawing
  `round-start` carries `endsAt` (server clock); clients distinguish
  word-select from drawing by the presence of `endsAt`, never by `choices`.
- **Reason:** PRD §8.2 names events but not payloads; word choices must
  never leak to guessers; a duplicate choice-less round-start would race the
  drawer's private one.
- **Alternatives considered:** hints piggybacked on re-emitted round-start
  (duplicate events); broadcasting choices to the room (cheating); client
  discriminator on `choices` (breaks for non-drawers).
- **Tradeoffs:** Three more additive event names to keep in lockstep, the
  contract test covers them (D011).
- **Date:** 2026-08-04
- **Future impact:** M5+ game adapters follow the same additive pattern;
  payload shapes are the de-facto contract for the drawing family.

## D024, Skribbl session engine + gateway-owned timers

- **Decision:** `server/src/engine/skribbl-engine.ts` is a transport-
  agnostic session (like the RoomEngine): drawer rotation (shuffled),
  rounds = players × 3, word select/choose, guesses (case-insensitive,
  trimmed), scoring verbatim PRD §5.1 (`guesser = max(0, 100 − 2·s)`,
  `drawer = floor(Σ/2)`), hints at 30s/45s, early round end when every
  guesser is correct, stroke log (5,000/round cap), custom word lists
  (3-200 words, safe charset). The socket gateway owns all `setTimeout`s
  (word-select 15s auto-pick, hints, 60s round, 10s break) and clears them
  on restart/eviction. Rounds run inside the RoomEngine's `in-progress`
  phase; only the first round transitions `game-setup → in-progress` (later
  rounds are already in-progress, the phase machine has no per-round
  states). Game-end persists final scores best-effort with the idempotent
  clientKey `skribbl:<code>:<startedAt>:<player>` (D021).
- **Reason:** Server-authoritative timing and scoring (D008); the session
  stays unit-testable with injected clock/RNG; timers stay where Socket.io
  lives so broadcasts are trivial.
- **Alternatives considered:** timers inside the session (couples the engine
  to the event loop); Redis timers (D016, single instance); a separate
  phase per round in the RoomEngine (over-engineers the shared machine).
- **Tradeoffs:** Drawer disconnect mid-round stalls strokes until the 60s
  timeout (known limitation, backlog); timers are in-memory (ephemeral
  rooms, acceptable).
- **Date:** 2026-08-04
- **Future impact:** M5 refactors per-game adapters on this pattern;
  `NOT_ENOUGH_PLAYERS` preflight prevents stranded `game-setup` rooms.

## D025, Drawing canvas architecture (log replay, logical coordinates)

- **Decision:** `DrawingCanvas` paints pointer segments immediately (zero
  lag) and commits each segment to the authoritative stroke log; the canvas
  repaints from the log, coalesced to one repaint per animation frame.
  Fixed logical 800×500 space scaled via CSS (pointer coords mapped through
  `getBoundingClientRect`); pointer events unify mouse/touch/pen
  (`touch-action: none`); eraser uses `destination-out`; 12-color palette;
  `strokeId` groups segments so undo removes whole strokes.
- **Reason:** Replays must be identical across devices (resolution-
  independent coords); undo/clear/late-join resync all fall out of the log;
  pointer events cover touch without extra libraries (PRD §13 CSS/JS-lite).
- **Alternatives considered:** remote-only rendering (perceptible lag);
  device-pixel coordinates (replays break across screens); SVG strokes
  (DOM churn at 60 segments/s).
- **Tradeoffs:** Full-log repaint per segment (fine for one drawer at a
  time; rAF coalescing keeps it to one repaint/frame, perf follow-up in
  backlog if drawing games get livelier).
- **Date:** 2026-08-04
- **Future impact:** Reused verbatim by all five drawing games (M5); the
  stroke payload shape is the drawing-family contract.

---

## D026, Solo testing + playable-game gate (M4.1 fix, owner report 2026-08-04)

- **Decision:** Three changes after the owner reported being unable to test
  the arena solo and hitting a dead-end "Game in progress" state:
  1. **Playable-game gate:** `start-game` now rejects any room game without a
     shipped round adapter (`GAME_NOT_PLAYABLE_YET`). Registry:
     `server/src/lib/game-registry.ts` (`PLAYABLE_ROOM_GAMES`, M4:
     skribbl-arena only), mirrored by `Game.playable` in `games.json` with a
     lockstep test. Previously, starting an unimplemented game advanced the
     room to `game-setup` with nothing taking over, a permanent dead end.
  2. **Solo rooms allowed:** Skribbl now starts with 1 player (3 rounds,
     all as drawer), a testing affordance; friends can still join
     mid-game. The engine's `allGuessed()` was also fixed: with zero
     guessers it must return false, or a solo round would end the instant
     it started (vacuous truth bug).
  3. **Host `end-round-now`:** additive event; the host can cut the drawing
     phase short (fast solo loops, stalled rounds). Lobby UI explains
     non-playable games and disables their Start button.
- **Reason:** The owner's two reports were real defects: an unreachable game
  state and an unexplained block for solo testers.
- **Alternatives considered:** bots in the lobby (heavy, game-specific); a
  solo practice island for Skribbl (bigger feature, noted as a candidate
  for a future milestone); reverting `game-setup` on a timeout (masked the
  root cause).
- **Tradeoffs:** 1-player rooms are a bit lonely by design (scores are 0);
  the playable flag is client/server duplicated, the lockstep test keeps
  them honest.
- **Date:** 2026-08-04
- **Future impact:** M5 extends `PLAYABLE_ROOM_GAMES` as adapters ship; the
  gate pattern prevents stranded rooms forever.

---

## D027, Skribbl correctness fixes: late-joiner guessing, drawer-local log, fill tool (owner report 2026-08-04)

- **Decision:** Four fixes after owner testing reported "can't win by
  guessing", broken undo, and a missing fill tool:
  1. **Late joiners can guess:** `SkribblSession.addPlayer(name)` adds
     mid-game joins to the live session (idempotent for rejoins, rejected at
     game-end), previously their guesses failed with `NOT_PLAYER` (the
     "not letting me win" report). They never draw (the drawer rotation is
     fixed at start) and total rounds are unchanged.
  2. **Drawer-local log:** the drawer's own strokes now join their local log
     optimistically (`sendStroke` dispatches `stroke-added`), and
     `undo-stroke`/`clear-canvas` broadcast to the WHOLE room including the
     drawer. Previously the drawer's log never contained their strokes
     (repaints could erase them, undo silently did nothing for the drawer).
  3. **Visible guess errors:** `DRAWER_CANNOT_GUESS`, `ROUND_OVER`,
     `NOT_PLAYER`, `WRONG_PHASE`, `RATE_LIMITED` map to feedback text shown
     under the word-length display instead of failing silently.
  4. **Fill tool:** additive `Stroke.type: 'pen' | 'fill'`; flood fill rides
     the existing `draw-stroke` payload (no new event); replay applies fills
     in log order (`floodFill` on the dpr-aware physical bitmap at logical
     coordinates). Fill button fills with the selected color, or white when
     the eraser is armed (patching holes); one tap returns to the pen.
- **Reason:** All four were real defects surfaced by the owner's manual
  testing of the live dev build.
- **Alternatives considered:** separate `fill` socket event (unnecessary.
  `draw-stroke` carries the additive type); server-side rasterization (over-
  engineered for one drawer); excluding the drawer from undo (kept the bug).
- **Tradeoffs:** flood fill is O(pixels) per application and every replay
  recomputes it, fine at 800×500, revisit if canvases grow; optimistic
  local strokes can briefly diverge from the server on rejection (self-
  heals at round start).
- **Date:** 2026-08-04
- **Future impact:** The optimistic-log pattern is the reference for all
  canvas actions; M5 drawing games inherit the fill tool.

---

## D028, M5 drawing games: config-driven engine, Copycat island, silhouette canvas (2026-08-04)

- **Decision:** The Skribbl adapter generalizes into one config-driven drawing
  engine (`DrawingGameSession` + `DRAWING_CONFIGS`) covering Skribbl Arena,
  One Line One Shape, Draw the Lyric, and Shadow Sketch; Copycat Challenge
  gets its own session (`CopycatSession`) and client island
  (`CopycatArena`) because it has no shared canvas. Concrete additions:
  1. **Config table** per game: wordMode (`choices`/`direct`/`lyric`),
     roundDurationMs, firstHintMs/secondHintMs (letters), artistHintMs
     (lyric artist at 45s), silhouetteRevealMs (shadow reveal at 60s),
     liftPenaltyMs (One Line −10s per pen lift, floor 5s), fixed points
     (lyric: guesser 100 / drawer 50), allowCustomWords (Skribbl only).
  2. **Silhouette background:** SVG paths (dataset normalized to 0-100)
     rendered behind the stroke log via `Path2D` + `pathBBox` aspect-
     preserving fit; the drawer sees it during drawing, everyone sees it
     after the 60s reveal (additive `round-hint.silhouette`).
  3. **Copycat phases:** image-reveal (5s) → private drawing (90s) →
     gallery → voting (30s) → awards. Private canvases are local only;
     submit flattens the canvas to a PNG data URL (400k-char cap). Votes
     are per award (Most Recognizable / Funniest / Most Abstract), no
     self-votes, live tallies via `vote-update`.
  4. **Solo rooms reach voting:** `beginVoting` accepts a single drawing
     (the self-vote guard keeps a solo player from casting) so the whole
     copycat flow is testable alone, same solo-testing affordance as D026.
- **Reason:** One engine instead of four near-duplicate adapters (D009);
  drawer-only secrets stay server-side (D023); the owner's solo-testing
  requirement (D026) extends to every room game.
- **Alternatives considered:** separate engine per game (rejected, the four
  shared-canvas games differ only in config); broadcasting strokes for
  copycat (rejected, the whole point is private drawings); server-side
  image uploads (rejected, data URLs are self-contained and stateless).
- **Tradeoffs:** `Path2D` is browser-only (rendering is guarded in Node
  tests/SSR); data-URL submissions can hit the size cap on dense drawings
  (surfaced as feedback, not a crash); fixed lyric scoring ignores speed
  (PRD §5.5 specifies flat 100/50).
- **Date:** 2026-08-04
- **Future impact:** M6 voting games reuse the `vote-update`/`vote-reveal`
  pattern and the private-canvas export via `DrawingCanvasHandle`; the
  config table is the template for future drawing variants.

---

## D029, M6 voting games: one config-driven session, aggregate NHIE reveals (2026-08-04)

- **Decision:** All four voting games share one `VotingSession` engine and
  one `VotingArena` island; the D028 vote pattern (`cast-vote` →
  `vote-update` → `vote-reveal`) extends to them. Kind-specific mechanics
  live in the config: rounds (WYR/MLT 10, TOT 20, NHIE min(10, max(4,
  players×2))), timers (WYR/MLT 30s vote + 8s reveal, NHIE 30s statement +
  20s vote + 8s reveal, TOT 6s fixed with no revealed phase), and scoring
  (MLT crowns, NHIE wildness, TOT herd-alignment persisted as a score).
  Concrete calls:
  1. **MLT self-votes allowed** (voting for yourself is a legit opinion);
     every other voting game blocks self-votes; NHIE blocks the confession
     author entirely (they "never have", so they can't vote).
  2. **NHIE reveals are aggregate-only** ("2 of 5 have done this"), the
     PRD's "anonymous toggle" is therefore unnecessary: anonymity is
     inherent. Documented, not built.
  3. **TOT herd streak is cosmetic client-side** (derived from the previous
     round's majority tallies); the final herd-alignment score is
     server-authoritative and persists to the leaderboard like drawing
     scores.
  4. **WYR player-submitted dilemmas** go to a per-room gateway queue and
     are used before dataset prompts (PRD §5.13 submit-own-question).
  5. **NHIE statement suggestions** come from the server dataset
     (server-authoritative, D022-style); an idle statement phase auto-picks
     a suggestion after 30s.
- **Reason:** One engine + one island for four near-identical games (D009);
  server-authoritative tallies and reveals (D008); solo rooms must be
  playable end-to-end (D026), all four games work with one player.
- **Alternatives considered:** separate sessions per game (rejected, they
  differ only in config); named NHIE reveals (rejected, PRD's reveal is
  aggregate); client-side scoring (rejected, final scores must be
  server-owned).
- **Tradeoffs:** TOT rounds are fixed 6s even when everyone voted instantly
  (PRD: 20 rounds in 2 minutes, the beat matters); mid-game joiners can
  vote but are not MLT options for the current round (options are fixed at
  round start).
- **Date:** 2026-08-04
- **Future impact:** Charades/Guess Who (M9) reuse the turn-rotation and
  phase-timer patterns; the WYR queue is the template for player-generated
  content moderation later.

---

## D030, M7 solo games: SoloTemplate shell, CMU-derived rhyme dataset (2026-08-04)

- **Decision:** The four solo games (Rhyme or Crime, Emoji Plot, Timeline
  Tussle, Price Is Right) share one `SoloShell` island frame (header with
  round/score/streak, game body, done view with nickname → idempotent
  leaderboard submit → daily top-5 → canvas share-image → play again) and
  pure logic modules (`src/lib/solo.ts` + one module per game).
  1. **Rhyme validation:** instead of shipping the full CMU Pronouncing
     Dictionary (~130k entries / multi-MB), the dataset generation encoded
     the CMU rhyme work: `rhymes.json` holds {prompt, category, answers}
     and validation is a dataset lookup. A player's guess must be one of
     the recorded rhyming answers for that prompt+category.
  2. **Streaks:** per-game daily streak in localStorage (consecutive UTC
     days; same-day replays don't double-count; gaps reset).
  3. **Share-result image:** pure canvas 2D score card (no image assets),
     downloaded as PNG; no social APIs.
  4. **Emoji Plot challenge links:** the answer is base64-obfuscated in the
     URL (not plaintext) so a casual glance doesn't spoil it; the game is
     a trust-based party toy, not a security boundary.
- **Reason:** One shell for four games (D009); the full CMU dict is too
  heavy for a static bundle and its licensing is noisy (D022-style
  pragmatism); server-free solo play keeps the static-site promise (no
  backend round-trips for gameplay; only the score submit needs the API).
- **Alternatives considered:** shipping the full CMU dictionary (rejected.
  bundle weight); server-side rhyme validation (rejected, solo games must
  work offline/static); per-game result screens (rejected, one shell).
- **Tradeoffs:** the rhyme dataset limits valid answers to the recorded
  list (a correct-but-unlisted rhyme is rejected, acceptable for a party
  game); streaks are per-device (no accounts by design, PRD §13).
- **Date:** 2026-08-04
- **Future impact:** Genre Swap / Genre-Bender (M8) reuse SoloTemplate and
  the type-in + reveal patterns; the challenge-link pattern is the
  template for shareable game content.

---

## D032, M8 Trivia room + server-seeded daily challenge (2026-08-04)

- **Decision:**
  1. **Daily challenges are server-seeded:** `GET /api/daily-challenge`
     upserts 10 deterministic questions (FNV-1a + seeded shuffle per UTC
     date) into `DailyChallenge` on first read, no cron, idempotent, and
     the same set for every player. TriviaSolo fetches it and falls back
     to the identical local selection when the API is unreachable
     (static-site resilience).
  2. **Trivia room mode** is a new `TriviaSession` engine + `TriviaArena`
     island: 10 questions × 10s, everyone answers the same question, race
     scoring (100 + 10·seconds remaining), all-in early reveal, host skip,
     podium with score persistence. The correct answer index NEVER leaves
     the server in the question payload, clients only get it in the
     round-reveal (D008 + D022).
  3. **Wrong Answers Only mode:** a room-level host toggle (`set-trivia-mode`)
     flips scoring, any wrong pick scores 50 + 10·seconds remaining, the
     correct answer scores 0. Comedy mode, per PRD §5.15.
  4. **Genre Swap / Genre-Bender ship as MC-only** (4 options, no type-in):
     PRD §5.9/5.10 say "Multiple choice (4 options) or type-in", one of
     the two is compliant; MC keeps the input surface uniform with the
     room quiz and avoids fuzzy-acceptance edge cases for song titles.
- **Reason:** the daily leaderboard is only meaningful if everyone played
  the same questions (PRD §5.15); the server already owns score idempotency,
  so it should own the challenge set too. MC-only keeps M8 focused.
- **Alternatives considered:** client-only daily selection (rejected, two
  independent shuffles could diverge, breaking leaderboard comparability);
  cron seeding (rejected, on-demand upsert is simpler and zero-ops);
  type-in answers (deferred, see above).
- **Tradeoffs:** on-demand seeding adds one upsert to the first daily
  challenge read per day (negligible); the answer index is absent from
  resync, so a mid-game joiner can't see the current correct answer, they
  can still answer (their pick is judged server-side).
- **Date:** 2026-08-04
- **Future impact:** Charades/Guess Who (M9) reuse the turn-rotation and
  phase-timer patterns; the seeded-challenge pattern extends to any solo game
  that wants a comparable daily leaderboard.

---

## D033, M9 Charades + Guess Who: co-located trust-based play (2026-08-04)

- **Decision:**
  1. **Charades is co-located and self-policed:** the actor's device shows
     the secret movie title (actor-only payloads, D023); ANY player can tap
     "Got it!" (+1 team score), in real play the team shouts and someone
     taps, so no server-side correctness check is possible or wanted. The
     host picks Hollywood / Bollywood / Mixed in the lobby; rounds rotate
     pass-the-phone style; the host can skip a word.
  2. **Guess Who is answerer-judged:** the host (answerer) holds the secret
     celebrity plus trait objects; questioners type yes/no questions and
     the ANSWERER clicks Yes/No (the traits help them answer accurately).
     the server never judges question semantics, it just enforces the
     20-question cap, the log, and guess matching. Guesses match the full
     name or the last name (accents/"the" ignored).
  3. **Secrets never leak:** the movie/celebrity fields are omitted from
     non-holder payloads entirely (`.except(holderId)` broadcast pattern,
     same as D023), and resync snapshots only include them for the holder.
  4. **Solo rooms** let the answerer ask and guess (the only player must
     be able to exercise the whole flow, D026).
  5. **Datasets are text-only:** 300 movie titles + 205 celebrity trait
     objects generated by `scripts/generate-special-datasets.mjs`
     (licensing-safe, PRD §13) and validated by `check-datasets.mjs`.
- **Reason:** both games are physical/co-located party games where the
  "server" is a timer + scorekeeper, not a referee (PRD §5.12/§5.17);
  answerer-judging keeps the celebrity trait logic trivial while staying
  faithful to the PRD.
- **Alternatives considered:** trait-based automatic yes/no answering
  (rejected, the PRD says the answerer clicks Yes/No); server-side
  correctness for charades (rejected, impossible for acted words); remote
  video mode (out of scope, open question #3).
- **Tradeoffs:** "Got it!" is trust-based (a troll can farm points, fine
  for friends; revisit with accounts); question semantics are only as good
  as the answerer; last-name matching can over-accept ("Smith" for any
  Smith celebrity, the room self-polices).
- **Date:** 2026-08-04
- **Future impact:** the actor-only / answerer-only payload pattern is the
  reference for any future secret-holder role; all 18 games now ship.

---

## D031, M7 Price Is Right: emoji product cards instead of product photos (2026-08-04)

- **Decision:** The Price Is Right product dataset uses emoji + description
  cards, not scraped product photos (PRD §5.8 says "image URL").
- **Reason:** PRD §13 forbids copyrighted material; hotlinked retailer
  photos invite hotlink breakage, tracking, and legal risk, and scraping
  violates retailer ToS. Emoji cards are fun, zero-cost, and always load.
- **Alternatives considered:** Wikimedia/PD product photos (rejected.
  product photography rarely exists in PD); Amazon affiliate API (rejected.
  account + approval required).
- **Tradeoffs:** less visual realism; the emoji style is consistent with
  the BounceBox design system.
- **Date:** 2026-08-04
- **Future impact:** any future product-content needs follow the same
  PD-or-original rule.

---

## D034, Price Is Right: real CC-licensed product photos via Openverse (2026-08-04)

- **Decision:** Price Is Right ships 536 products, 523 with **real product
  photos** sourced from the Openverse API (CC-licensed, `commercial` license
  type only), enriched offline by `scripts/enrich-price-products.mjs`. Each
  product stores `image` + `credit` (creator + license); emoji remains the
  fallback when no licensed photo exists (13 products). This **supersedes the
  emoji-only photo stance of D031** (owner request 2026-08-04).
- **Reason:** the owner asked for real product images instead of emojis;
  Openverse only returns CC/PD works, so PRD §13 stays satisfied; attribution
  is embedded in the data and shown in the UI.
- **Alternatives considered:** Wikimedia Commons (rejected, aggressive 429
  rate limiting and product photos are scarce there); retailer/Amazon scraping
  (rejected, ToS violation + hotlink/tracking risk, already ruled out in
  D031); emoji-only (kept as the fallback path, not the primary).
- **Tradeoffs:** photos are CC-BY/CC-BY-SA so the UI shows a small credit
  line; image quality depends on Openverse search relevance; enrichment is
  a one-time offline script, not a runtime fetch (dataset is static JSON).
- **Date:** 2026-08-04
- **Future impact:** any future imagery must follow the same CC/PD-or-original
  rule; the `image`/`credit` shape is the reference for other visual datasets;
  a licensed product-image API could replace the dataset if one ever appears.

---

## D035, M10 SEO: static content + JSON-LD + smoke-gated budgets (2026-08-04)

- **Decision:** M10 ships SEO as **static content + structured data**, no
  runtime SEO work: per-game 400-600-word bodies + unique 150-160-char meta
  descriptions + game-specific FAQs (`src/data/game-content.ts`), global FAQ
  (`src/data/faqs.ts`), FAQPage/WebApplication/BreadcrumbList JSON-LD on game
  pages, FAQPage on `/faq`, WebApplication + FAQPage on the homepage, OG
  images for all pages (20 PNGs incl. home), canonical URLs, and a complete
  sitemap. `scripts/smoke.mjs` gates SEO checks (all 18 game pages),
  page weight < 100 KB, and a 300 KB per-island bundle budget;
  `seo-content.test.ts` validates every content entry.
- **Reason:** PRD §6.1/§6.3/§7 is SEO/AdSense-first; the static MPA already
  serves full HTML so content costs nothing at runtime; smoke gates keep the
  budgets from regressing on every commit.
- **Alternatives considered:** a CMS for content (rejected, no non-engineer
  authors yet; revisit when one exists); Lighthouse CI budgets (deferred to
  M11, no CI runner yet; smoke gates substitute locally); prerender/SSR
  (unnecessary, Astro output is already static).
- **Tradeoffs:** content lives in TS data files and needs code review to
  change; browser-level axe/Lighthouse audits stay deferred to M11 per
  TESTING_STRATEGY; Google Rich Results validation is a manual launch step.
- **Date:** 2026-08-04
- **Future impact:** game pages are AdSense-ready; adding a future game
  requires adding its `game-content.ts` entry (enforced by tests + smoke);
  structured data gets final validation in Google Rich Results at M11.

---

## D036, M12 dark mode: semantic token swap under `:root.dark` (2026-08-04)

- **Decision:** Dark mode is a semantic-token swap: `global.css` defines
  surface/border/status tokens (light values in `@theme`, dark values under
  `:root.dark`), a no-FOUC inline script in `BaseLayout` applies the class
  before paint, and a header toggle flips it (localStorage + system
  preference). Every hardcoded color in components/islands was swept to
  tokens (23 files); the shared drawing canvas stays white by design.
- **Reason:** the owner asked for site-wide dark mode; Tailwind v4 utilities
  reference the theme CSS variables, so one class on `<html>` flips
  everything without a class per component.
- **Alternatives considered:** per-component dark: variants (rejected.
  hundreds of call sites); a second stylesheet (rejected, token swap is
  simpler and composable).
- **Tradeoffs:** components must keep using tokens (lint-friendly but
  convention-enforced); status colors were re-paired (soft/strong) for WCAG
  contrast on dark surfaces.
- **Date:** 2026-08-04
- **Future impact:** any new UI must use tokens or it will be unreadable in
  dark mode; the `.dark` class is the theme contract.

---

## D037, M14 solo timers: setup phases + per-game presets (2026-08-04)

- **Decision:** Timed solo games (Rhyme, Emoji Plot, Genre Swap,
  Genre-Bender) now open with a setup phase: the player picks the round
  timer (30/40/50/60/70s presets, persisted per game in localStorage) and
  the clock starts only when they press Start. Round deadlines moved from
  refs into state (`useCountdown`), the old ref pattern computed
  `remaining = 0` on a round's first render and fired "Time's up!"
  instantly (the owner's report).
- **Reason:** two bugs from one pattern: the false timeout, and the clock
  starting before the player was ready.
- **Alternatives considered:** gating timers on visibility/scroll (rejected
  , setup phases are simpler and give the player explicit control).
- **Tradeoffs:** one extra tap before playing; solo scores are comparable
  only within the same timer setting (leaderboards are per game, not per
  timer, accepted).
- **Date:** 2026-08-04
- **Future impact:** the `useCountdown` + `TimerPicker` pair is the template
  for any future timed solo game.

---

## D038, M18 trivia: flat 10-point scoring + 525-question dataset (2026-08-04)

- **Decision:** Trivia scoring is flat in both modes: 10 points for a
  correct answer, 0 for wrong/timeout (Wrong Answers Only inverts: wrong =
  10, correct = 0). The speed bonus is gone. The dataset grew 210 → 525
  questions across 10 categories (Geography, Movies, Music, Food,
  Technology added), mirrored to client + server.
- **Reason:** the owner asked for "10 points for correct answer no point
  for wrong" and a much larger dataset with genres.
- **Alternatives considered:** keeping the speed bonus (rejected, the
  owner explicitly wanted simple); per-category daily packs (deferred).
- **Tradeoffs:** the daily leaderboard is now a right-answer race; existing
  scores on the old scale were never migrated (the site is pre-launch).
- **Date:** 2026-08-04
- **Future impact:** scoring changes are cheap now and expensive after
  launch, locked in.

---

## D039, M18 Daily Sudoku: pre-generated unique-solution puzzles (2026-08-04)

- **Decision:** Sudoku is the 19th game (owner: "add a daily sudoku and what
  not"). `scripts/generate-sudoku.mjs` pre-generates 400 medium puzzles
  (28-32 clues) with a backtracking solver that VERIFIES uniqueness;
  `pickDailySudoku` seeds the daily pick by UTC date; completion scores a
  flat 200. Puzzles ship as a compact 65 KB dataset (prettier-ignored).
- **Reason:** runtime generation needs a solver + uniqueness check per
  request; offline generation keeps the client tiny and deterministic.
- **Alternatives considered:** runtime generation (rejected, complexity +
  non-determinism); a hand-written puzzle pack (rejected, 400 is too many).
- **Tradeoffs:** the 400-puzzle pool repeats roughly yearly (fine for a
  daily game); difficulty is single-band (medium).
- **Date:** 2026-08-04
- **Future impact:** the generator can re-run with new seeds/difficulties;
  daily-games branding is now a pattern (Daily Trivia + Daily Sudoku).

---

## D040, M15 NHIE tiers incl. NSFW, default-safe, host opt-in (2026-08-04)

- **Decision:** Never Have I Ever statements are tagged
  boring/moderate/dirty/super-dirty (250 statements; ~14 super-dirty,
  NSFW). The host picks the tier and the statement source (provided / own /
  both) in the lobby; the DEFAULT tier is moderate. Engine suggestion pools
  fall back to safer tiers, never dirtier ones.
- **Reason:** the owner asked for a boring→super-dirty scale and a
  provided-vs-own choice.
- **Alternatives considered:** leaving NSFW out (rejected, explicit ask);
  filtering by room age (no accounts exist to filter on).
- **Tradeoffs:** ⚠ **NSFW content is an AdSense-policy risk**, defaulting
  to moderate and requiring host opt-in is the mitigation; if AdSense
  approval becomes an issue, the super-dirty tier can be dropped from the
  dataset without code changes.
- **Date:** 2026-08-04
- **Future impact:** flagged in Blocked Tasks; revisit at M11/AdSense.

---

## D041, M17 Guess Who: 5-round rotation with celebrity facts (2026-08-04)

- **Decision:** Guess Who is now a 5-round game: the answerer rotates each
  round (pass-the-phone), a correct guess scores +1 and reveals the
  celebrity with 1-2 curated facts (all 205 celebrities), the host advances
  via a new `guess-who-next` event, and the game ends with a podium. The
  actor-only/answerer-only secret pattern (D023) is unchanged.
- **Reason:** the owner asked how to get to the next celebrity and wanted
  richer celebrity info (movies, scandals, news).
- **Alternatives considered:** auto-advance after a fixed reveal timer
  (rejected, hosts drive the pace at the table); one fact per celebrity
  (rejected, two is the floor for a reveal card).
- **Tradeoffs:** facts are curated common knowledge (a few may age); the
  answerer rotating means the host isn't always the answerer.
- **Date:** 2026-08-04
- **Future impact:** the reveal/advance event pattern is the template for
  any future round-based party game.

---

## D042, Vision 2.0 strategy brief: planning-only docs (2026-08-04)

- **Decision:** `docs/vision/00`-`11` (executive summary, product vision, 32
  new games, daily games, progression, UX overhaul, social, content engine,
  SEO, retention, competitive analysis, roadmap) are **planning-only**
  deliverables, no production code, no schema changes, no roadmap
  commitment. They challenge the current implementation deliberately and
  supersede nothing in `PRD.md`, `ARCHITECTURE.md`, or this log.
- **Reason:** the owner's brief asks for product strategy (features, specs,
  game concepts, architecture, roadmap), not implementation; the codebase
  remains at PRD parity (19 games, `pnpm verify` green).
- **Alternatives considered:** implementing items immediately (rejected, the
  brief is explicitly specification-only); merging the docs into PRD.md
  (rejected, the PRD is the implemented contract; vision docs are forward
  proposals).
- **Tradeoffs:** vision docs may become stale as the product evolves; any
  future implementation should be re-derived from the then-current codebase,
  not copied from the docs.
- **Date:** 2026-08-04
- **Future impact:** if the owner approves items from the roadmap (11), each
  item becomes a PRD amendment + milestone with its own decision entries.

---

## D043, Rebrand: TriviaHub (playtriviahub.com) (2026-08-04)

- **Decision:** the product is rebranded to **TriviaHub**, hosted at
  `https://playtriviahub.com`. All UI strings, page titles, metadata, OG tags,
  JSON-LD, sitemap, robots, manifest, favicon, README, docs, and package
  metadata use the new name (`triviahub`, `@triviahub/server`). Client
  localStorage keys move to the `triviahub:` prefix with read-only fallback to
  the legacy `partybrain:` keys so existing streaks and nicknames survive
  (D044 keeps the same principle).
- **Reason:** the owner approved the rebrand; the domain is fixed.
- **Alternatives considered:** keeping the old name (rejected, explicit ask);
  hard-migrating storage keys (rejected, would wipe player streaks).
- **Tradeoffs:** the old name remains in legacy keys and PRD historical text;
  `scripts/purge-dashes.mjs` is added to enforce the no-em/en-dash writing
  standard repo-wide.
- **Date:** 2026-08-04
- **Future impact:** GA4 property, AdSense site, and social handles must use
  the new domain when the launch milestone (M11) resumes.

---

## D044, Daily games framework: registry + client-side streaks/history first (2026-08-04)

- **Decision:** the daily platform ships as a registry (`src/lib/daily.ts`) +
  `/daily` hub + `/daily/[slug]` pages + `/daily/archive`, reusing the existing
  solo engine (server-seeded content, leaderboards, share images, streaks via
  `src/lib/solo.ts`). Streaks, play history, and the 7-day strip are
  client-side (localStorage) for now; server-side identity and streaks are the
  next milestone (vision M1.5.1) and slot into the same registry without UI
  changes.
- **Reason:** the phase brief requires the reusable daily platform now, and
  the existing no-account architecture already has a working client-side
  streak model. Adding a User model before the platform existed would couple
  two large changes.
- **Alternatives considered:** full server-side identity in this phase
  (rejected, too large for the foundation phase and depends on decisions in
  vision 12); building per-game daily pages without a registry (rejected,
  duplicates logic).
- **Tradeoffs:** history is device-bound until identity lands; documented in
  the archive page UI.
- **Date:** 2026-08-04
- **Future impact:** M1.5.1 replaces the client-side layer with server
  tables; `DailyRun`, `Streak`, and `UserProfile` models are specified in
  vision 03/12.

---

## D045, Design system: token-based UI kit in `src/components/ui/` (2026-08-04)

- **Decision:** all new reusable UI lives in `src/components/ui/` as Astro
  components (Badge, Skeleton, EmptyState, Dialog, Tabs, StatCard,
  LeaderboardTable, PlayerCard, CategoryCard; GameCard upgraded with discovery
  metadata). Interactive components use the native `<dialog>` element and
  small inline scripts instead of React islands, keeping zero-hydration pages
  light. All components use BounceBox tokens, AA contrast pairs, keyboard
  paths, and reduced-motion support.
- **Reason:** the phase brief requires a world-class design system; native
  dialog/tabs beat custom React equivalents for accessibility and bundle size.
- **Alternatives considered:** React islands for every interactive component
  (rejected, hydration cost); a third-party UI library (rejected, PRD §2
  forbids new dependencies without amendment).
- **Tradeoffs:** inline scripts are page-scoped; they must be re-verified when
  components are reused on new pages (covered by the smoke tests).
- **Date:** 2026-08-04
- **Future impact:** new games and pages consume this kit; no new UI pattern
  should be hand-rolled.

---

## D046, Discovery metadata in games.json (2026-08-04)

- **Decision:** `src/data/games.json` gains optional per-game fields: `players`,
  `durationMinutes`, `energy`, `featured`, `isNew`, `popularity`. The `Game`
  type in `src/lib/games.ts` reflects them; helpers `getTrendingGames`,
  `getNewGames`, `getFeaturedGames`, `getMultiplayerGames` derive rails from
  this single source. The server seed and lockstep tests only read existing
  fields, so the shape change is additive.
- **Reason:** cards, trending/new rails, categories, and the future "choose
  for me" wizard all need the same metadata; one schema instead of per-surface
  ad hoc fields.
- **Alternatives considered:** a separate metadata JSON (rejected, two sources
  of truth); hardcoding rails in pages (rejected, duplicates logic).
- **Tradeoffs:** popularity is editorial for now; play-data ranking replaces
  it when analytics exist.
- **Date:** 2026-08-04
- **Future impact:** the "choose for me" wizard (vision 01 §5) consumes the
  same fields.

---

## D047, Account-lite identity: device memberKey (2026-08-04)

- **Decision:** Phase 1.5 membership is a device-generated opaque memberKey
  (crypto.randomUUID, stored under `triviahub:member-key`) plus an optional
  nickname. `POST /api/me/claim` upserts `UserProfile` (one-tap conversion);
  `GET /api/me` returns the member read model. There are no passwords and no
  email collection (the `email` column is reserved for future recovery/recap).
  Guests keep the existing device-bound streak and leaderboard path untouched.
- **Reason:** the vision (01 §4, 12 M1.5.1) requires server streaks and
  history without breaking the no-account wedge. A memberKey is not a
  credential, so no auth stack is needed and zero PII is stored.
- **Alternatives considered:** full email/password auth (rejected, kills the
  wedge and needs a whole auth milestone); cookies-only identity (rejected,
  fragile across devices and browsers).
- **Tradeoffs:** a memberKey can be lost when the browser is cleared; the
  email recovery path is the documented future fix. Nothing user-facing
  requires membership, so loss is not data loss for guests.
- **Date:** 2026-08-04
- **Future impact:** progression (XP/levels), friends, and notifications build
  on `UserProfile.id`; the claim endpoint is the conversion funnel.

---

## D048, Server streak engine: freeze tokens + season restore (2026-08-04)

- **Decision:** streaks live server-side in `DailyStreak` (scopes: `grand`
  and per-game) driven by a pure engine (`server/src/lib/streak-engine.ts`).
  Rules: consecutive UTC days grow the streak; playing twice in one day is a
  no-op; missed days are covered first by freeze tokens (earned one per
  7-day milestone, capped at 3), then by a single one-day restore per
  calendar quarter (`YYYY-Qn`); an uncovered gap resets to 1 and preserves
  the longest-streak history. Protection is consumed automatically.
- **Reason:** the vision (03 §4) specifies freezes and a season restore; the
  milestone-based freeze is server-computable, farm-resistant, and rewards
  exactly the consistency the daily loop wants.
- **Alternatives considered:** calendar-weekly freeze grants (rejected,
  rewards presence not streaks); paid protection (rejected, no payments);
  Duolingo-style rolling windows (rejected, complex and opaque to players).
- **Tradeoffs:** the season restore only covers exactly one missed day; a
  two-day gap with no freezes resets. That is the intended mercy rule, not a
  forgiveness machine.
- **Date:** 2026-08-04
- **Future impact:** the same engine drives weekly/seasonal event streaks
  (vision 09) with new scope strings.

---

## D049, DailyRun as the identity layer; Score stays the leaderboard (2026-08-04)

- **Decision:** member daily plays are recorded in `DailyRun` (idempotent via
  unique clientKey + one run per member per game per UTC day) inside a
  transaction with streak updates. The existing `Score` table and
  `POST /api/scores` remain the leaderboard source for guests and members
  alike; `DailyRun` feeds history, personal bests, and streaks. The friends
  leaderboard scope from the phase brief is deferred to the social phase
  (there is no friend graph yet); the scope parameter is designed to accept
  it later.
- **Reason:** additive changes keep every existing game and endpoint
  backwards compatible (rule 7); two writes per member play is a small cost
  for zero migration risk.
- **Alternatives considered:** switching leaderboards to DailyRun (rejected,
  would change guest semantics and break the leaderboard contract); writing
  only DailyRun for members (rejected, splits leaderboard sources).
- **Tradeoffs:** members' plays write two rows; cleanup and export must
  handle both (documented in PROJECT_STATE).
- **Date:** 2026-08-04
- **Future impact:** leaderboards can be re-pointed at DailyRun when guests
  gain server identity; until then the two tables stay in sync by contract
  test.

---

## D050, Daily content: client-side deterministic seeding (2026-08-04)

- **Decision:** Phase A daily games (Emoji Plot, Timeline Tussle, Price Is
  Right, Rhyme or Crime, Genre Swap, Genre-Bender) select their daily content
  client-side with `dailyGameSeed(dateKey, slug)` (FNV-1a hash of the UTC
  date + game slug), passed to the existing `pick*` functions. Trivia keeps
  its server-seeded challenge unchanged; sudoku already worked this way
  (M18). The server records runs, streaks, and personal bests for all live
  daily games via the Phase 1.5 endpoint.
- **Reason:** the six solo engines share one pick pattern (integer seed), so
  a deterministic seed is a one-line change per game and zero new server
  content pipelines. This is the sudoku precedent, owner-approved.
- **Alternatives considered:** server-seeding every new daily (rejected,
  needs server copies of six datasets or a shared data package; no gameplay
  benefit for party games where answers are already client-visible);
  per-game bespoke seeding (rejected, duplicates logic).
- **Tradeoffs:** a determined player could precompute tomorrow's content from
  the bundled datasets. Acceptable for a casual party site; trivia, the
  flagship fair-race game, remains server-seeded.
- **Date:** 2026-08-04
- **Future impact:** games that need real anti-cheat (ranked modes) must use
  server-seeded content; the registry `live` flag is the switch.

---

## D051, Revised sequencing: outcomes over workstreams (2026-08-04)

- **Decision:** the pasted phase list (design system, UI review, SEO,
  daily platform, game engine, multiplayer, content engine, production
  review) is frozen. The TODO.md backlog now sequences phases by user value
  and dependency: A daily expansion (done), B retention loop, C social,
  D content engine, E game engine contract (incremental standard), F launch
  and deploy. SEO, a11y, docs, and design-system compliance are standing
  requirements enforced by CI gates, not phases.
- **Reason:** CTO review found the pasted phases duplicated workstreams,
  ignored existing systems (RoomEngine, multiplayer, SoloShell already
  ship), and were not tied to outcomes or metrics. The approved vision
  (12_FINAL_PLAN) already contained the deduplicated plan.
- **Alternatives considered:** continuing with the pasted phases (rejected,
  would rebuild working systems); pausing all work for a rewrite (rejected,
  nothing needed rewriting).
- **Tradeoffs:** the game engine contract (E) is deferred as a standalone
  phase and instead formalized incrementally as games are touched.
- **Date:** 2026-08-04
- **Future impact:** every phase now has exit criteria and a success metric
  in TODO.md; Phase F (deploy to playtriviahub.com) is the highest-value
  backlog item and is teed up after Phase B.

---

## D052, M11 deployment targets: Cloudflare Pages + Railway (2026-08-04)

- **Decision:** production hosts are Cloudflare Pages (frontend, git
  integration, $0) and Railway (backend Docker service + managed Postgres,
  ~$5/mo at launch scale). Render is the documented fallback (same
  Dockerfile, paid tier only, its free tier sleeps and kills rooms). Deploy
  artifacts: `server/Dockerfile` (multi-stage, non-root, /readyz
  healthcheck), `wrangler.toml` (project triviahub, output dist), wrangler
  devDependency for direct uploads, and `docs/DEPLOYMENT.md` runbook.
- **Reason:** the owner approved M11 (owner ask 2026-08-04) after the CTO
  cost review; Railway's $5 credit covers backend + Postgres in one place
  and never sleeps. This resolves open question #8 (Railway vs Render).
- **Alternatives considered:** Render primary (rejected, sleep behavior and
  separate Postgres pricing); Fly.io (rejected, more ops for no benefit at
  this scale); Neon free Postgres (rejected, keep DB next to the backend).
- **Tradeoffs:** Railway is usage-based and could exceed $5/mo under heavy
  traffic; the single-node backend (D015/D017) remains the documented
  scale-up path before cost becomes material.
- **Date:** 2026-08-04
- **Future impact:** migration of the DB stays additive (D006); the domain
  is fixed at playtriviahub.com everywhere (D043).

---

## D053, M19 four daily games: engines + drawing gallery subsystem (2026-08-05)

- **Decision:** the four `live:false` dailies (geography, movies, music,
  drawing) ship as design-scoped in `docs/DAILY-DESIGN.md`: three pure
  client engines on the Phase A seeded-pick pattern (D050) + a
  server-persisted drawing gallery. Drawing is the first user-content
  subsystem: `DrawingSubmission` / `DrawingVote` / `DrawingFlag` tables
  (additive), four REST endpoints, flag-and-remove moderation (owner pick,
  §0 of DAILY-SCOPE), flat 100 completion scoring with votes excluded from
  the leaderboard. Three resolutions ratified: flag idempotency via
  `@@unique([submissionId, memberKey])` (a `flagCount` int alone is
  flag-spammable); a route-scoped `express.json({ limit: '1.5mb' })` parser
  registered **before** the global 32 KB parser in `app.ts` (verified: the
  global default was 32 KB, not 100 KB, and would reject uploads before the
  router); gallery reads capped at `take 50` + `total`, votes desc, with
  additive `mine`/`voted` flags per row (the scope's minimal shape cannot
  express the "yours" marker acceptance criterion). The error middleware
  gains status preservation so parser 413s surface as `PAYLOAD_TOO_LARGE`,
  not 500.
- **Reason:** the owner confirmed the defaults slate and resolved §9
  (flat 100 drawing score, region cap P1, defaults slate) on 2026-08-05;
  the four games are the last `live:false` entries in `src/lib/daily.ts`
  and complete the 12-daily hub. Drawing's gallery is the AdSense-sensitive
  surface (user-generated content), so moderation-by-flag is the cheapest
  compliant model (scope §3.2).
- **Alternatives considered:** flagCount-only moderation (rejected, spam
  door); pre-approval gallery (rejected, heavy, owner picked flag-and-remove);
  raising the global body limit to 1.5 MB (rejected, weakens every route's
  early reject); R2 object storage for images (deferred by scope §6,
  Postgres text is the MVP, revisit at gallery scale).
- **Tradeoffs:** a bad drawing is visible until 3 distinct member flags
  (bounded by per-day rotation); vote/flag identity is a device memberKey
  (D047), so single-key spam is impossible but key regeneration is not
  stopped — accepted at v1, same trust model as the leaderboard; gallery
  JSON payloads can reach several MB at 50 images (bounded by the 1024 px
  client cap + lazy rendering, flagged for R2 thumbnails).
- **Date:** 2026-08-05
- **Future impact:** the drawing gallery is the first server-persisted
  user content — the moderation pattern (rows + unique constraints +
  status flags) is the template for Phase C social content (profiles,
  friend posts); `pickDistinct` (`src/lib/pick.ts`) becomes the shared pick
  primitive for every future daily (Phase E `GameDefinition`); the
  body-parser ordering pattern in `app.ts` is the precedent for any future
  large-payload route.

## D055, M20 Phase 0.5 + Phase B: geography removal + answer randomization (2026-08-05)

- **Decision:** Phase 0.5 removes Daily Geography completely (superseding
  DAILY-DESIGN §3.1, its F2 brief, and the geography test delta): the
  island, engine, dataset (15-entry sample), `[slug].astro` branch, client
  - server registry entries (12 → 11 live), sitemap URL, and smoke check
    (now a 404 assertion) all go in PR-1; `/daily/geography` 404s and the
    lockstep test stays green at 11 = 11. `DailyCategory` drops `'geography'`
    **now**; World Peek re-adds it as `'geo'` in Phase C (do not add `'geo'`
    early). Docs get superseded markers only (no prose deletions). Phase B
    (PR-2) ships the room-side answer-randomization scope (R7/R8/R9/R11/R12;
    escalations 2/5): seeded per-question trivia deck shuffle
    (`shuffleTriviaDeck`, roomCode-seeded, answer index remapped server-side
    and never emitted) and the WYR presentation shuffle (~50% id↔label swap
    at the round-start emit point; vote ids keep `winnerId` semantics
    unchanged). Phase B is server-only; datasets' `answer` fields are never
    modified, dailies never use `Math.random`.
- **Reason:** geography's Wikimedia hotlink surface is the flakiest of the
  four M19 dailies and its region-balance engine is superseded by World
  Peek's fresh data model in Phase C; the removal is the cheapest path to
  a stable 11-game hub. Room answer randomization addresses the
  repetition exploit (same room code ⇒ same correct-option position across
  sessions) and the WYR left/right bias; both are render/build-time
  concerns with zero engine changes and zero dataset edits.
- **Alternatives considered:** keeping geography with the region-cap
  engine (rejected — redundant with World Peek); shuffling answers
  client-side in room payloads (rejected — the correct index would
  momentarily exist in client memory; server-side remap keeps it out of
  every payload); deterministic (non-random) WYR orderings (rejected — the
  bias is exactly the bug being fixed); per-round random reseeding of the
  trivia deck (rejected — session-stable per-code seeding is the agreed
  contract).
- **Tradeoffs:** rooms with the same code shuffle identically across
  sessions (accepted — the seed is the room code by design); WYR ordering
  is not deterministic for room games (correct — rooms are not dailies);
  the PR-1 grep gate scopes out trivia-content `"Geography"` categories
  and the skribbl word-bank entry, which legitimately keep the word.
- **Date:** 2026-08-05
- **Future impact:** PR ordering is fixed — PR-1 (geography removal)
  lands first, then PR-2 (server Phase B), then PR-3 (price pipeline
  skeleton, D056/D059); the price pipeline's mock-first design unblocks
  the merged client loader without keys; World Peek re-uses the
  `'geo'` category slot and the removal's grep gate as its own QA
  template.

## D060, World Peek map: Leaflet + OpenStreetMap replaces the self-made SVG (2026-08-05)

- **Decision:** World Peek's map becomes an interactive Leaflet map with
  OpenStreetMap raster tiles (drag/zoom, tap-to-pin), replacing the
  hand-drawn 360×180 SVG polygons (owner feedback: "the map does not
  look real; India and many places are missing"). Gameplay unchanged:
  photo round → pin guess → haversine distance scoring (the lat-negation
  bug fixed in 5e7e1e2 stays covered by the round-trip test).
- **PRD §2 amendment (stack):** `leaflet` (MIT, ~42 KB gz, no runtime
  keys) is added as the first client map dependency. Google Maps
  Platform was considered and rejected for now: API key + billing +
  branding/ToS obligations + runtime key management (the CEO has not
  yet provisioned the Amazon PA-API keys; a third keyed service is
  premature). GeoGuessr's Street View experience is Google-licensed and
  out of scope; photos remain the round content (L7 pool).
- **Attribution/licensing:** OSM requires "© OpenStreetMap contributors"
  — visible attribution on the map surface; tile usage policy respected
  (browser-cached, modest traffic; a tile CDN like CartoDB can be
  swapped in without code change if volume demands).
- **Implementation contract:** `pnpm add leaflet` (types included); map
  component in the WorldPeek island (init once, no per-render reinit),
  marker on tap (fractional → lon/lat via `map.unproject` or
  containerPoint math), dark-theme tile option via a tile-layer swap
  (CartoDB dark free tier, no key) while light keeps OSM standard;
  Leaflet CSS imported; island bundle stays under the 300 KB gate;
  attribution control on; touch (tap) and drag on mobile verified.
- **Date:** 2026-08-05
- **Future impact:** the SVG map module (`mapPoint`/`pointToLonLat`)
  stays as the pure math contract for tests; the Leaflet layer is a
  rendering detail behind it. Google Maps remains a documented upgrade
  path if the CEO later accepts billing + keys.

## D061, World Peek reveal: satellite tiles + great-circle line + distance (2026-08-05)

- **Decision:** the reveal adds GeoGuessr-style feedback on the Leaflet
  map: the player's pin and the actual location marked, a **dotted
  great-circle line** between them, and the **distance in km** labeled
  on the map. Default layer = **satellite imagery** (Esri World Imagery
  tile service, no key, attribution required: "Tiles © Esri — Source:
  Esri, Maxar, Earthstar Geographics, GIS User Community") with an OSM
  streets layer toggle. Owner ask: "very close to GeoGuessr — zoom,
  move, dotted line, kilometers, satellite".
- **Implementation contract:** pure `greatCirclePoints(lat1, lon1,
lat2, lon2, n)` helper in `src/lib/world-peek.ts` (equirectangular-
  spaced great-circle interpolation, ~100 points) + unit tests
  (endpoints exact, midpoint ≈ halfway, antimeridian case);
  `L.polyline` with `dashArray` + the distance label via `divIcon` at
  the midpoint; `fitBounds([guess, actual])` on reveal; Esri tile
  attribution control on; satellite default, streets toggle;
  `maxBounds`/minZoom so the world can't be panned into the void;
  mobile pinch-zoom + drag verified.
- **Licensing note:** Esri World Imagery is free to use with
  attribution; re-review the terms when AdSense/commercial traffic
  begins (documented, not blocking).
- **Date:** 2026-08-05
- **Future impact:** supersedes the plain-tile part of D060's contract
  (D060's Leaflet + attribution + bundle gates stand); Google satellite
  remains the paid alternative if Esri terms ever bind.

## D062, World Peek imagery: 360° panoramas (Mapillary default, Google Street View upgrade path) (2026-08-05)

- **Decision:** World Peek rounds become **360° panoramas the player can
  drag/pan/zoom**, replacing static photos (owner: "like GeoGuessr,
  people move around in the image; random places on Earth; no
  monuments"). Primary source: **Mapillary** (free API token, no
  billing; open-source mapillary-js viewer, MIT; CC-BY-SA attribution
  "© Mapillary contributors"). Google Street View (API key + billing +
  ToS) is the documented paid upgrade — same architecture, swappable
  source.
- **PRD §2 amendment (stack):** mapillary-js (or the official embed
  URL) added as the panorama viewer dependency behind the existing
  Leaflet map layer (D060).
- **Content model change:** the L7 lot becomes a **curated coordinate
  pool** (2,000+ entries: lat/lon + region + difficulty, NO imagery
  URLs) resolved at BUILD time via the Mapillary API to pano IDs
  (deterministic, quality-gated, rate-limit-friendly); unresolved
  coordinates are flagged at authoring (the price-pipeline pattern,
  D056). No runtime random API calls.
- **Attribution:** "© Mapillary contributors" visible in the viewer;
  Google swap later keeps the same attribution slot.
- **Date:** 2026-08-05
- **Future impact:** scoring/pin UX unchanged (D061 line + km stay);
  the pano viewer sits where the photo sat; Street View becomes a
  one-source swap once billing + keys exist.

## D063, World Peek GeoGuessr composition: full-bleed pano + inset map; random everyday-place content pool (2026-08-05)

- **Decision:** (1) Layout mirrors GeoGuessr: **full-bleed 360° viewer**
  with a **small inset map** (bottom corner, drag/zoom Leaflet) for the
  pin; reveal zooms the inset to fit guess + actual with the D061
  dotted line + km. (2) Content: the pool becomes **random everyday
  places** — sample the OSM road network within city boundaries
  worldwide, **exclude landmarks** (tourism/attraction tags + a
  maintained landmark blocklist), resolve to Mapillary panos at build
  time (2,000+ entries). Owner: "I basically want GeoGuessr on my
  website" — no monuments, real random places.
- **Implementation contract:** L7 lot script (`scripts/sample-world-
peeks.mjs`): OSM Overpass query → random road nodes → landmark
  exclusion → Mapillary resolve (the D056 pipeline pattern: flags +
  review list, no unresolved entries ship). Sample dataset: replace the
  landmark entries (Eiffel Tower, Pisa, etc.) with 50+ random everyday
  coordinates immediately; full 2,000+ per D057 quotas.
- **Layout contract:** viewer full-bleed (aspect ~16:9, touch drag to
  pan, pinch zoom); inset map ~200px corner card (mobile: bottom
  sheet-style panel); pin before submit; reveal = fitBounds + line +
  km label (D061).
- **Date:** 2026-08-05
- **Future impact:** Google Street View swap replaces only the viewer
  source; the inset-map + content pipeline are source-agnostic.
