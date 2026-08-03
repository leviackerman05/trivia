# Decision Log — PartyBrain

> **Append-only.** Never edit or delete an existing entry; append new decisions
> at the bottom (D018+). Record every architecture-affecting choice here.
>
> **v2 note (2026-08-04):** `PRD.md` now exists and fixed the stack
> ("DO NOT DEVIATE", PRD §2). The original bootstrap decisions (D001–D012,
> made before the PRD) conflicted with the PRD in several places. Per project
> instruction, **conflicting decisions are superseded, not deleted** — the
> original entries are preserved verbatim in the
> [Archive](#archive-superseded-bootstrap-decisions-d001d012) at the end of
> this file, each marked with its supersession. Active decisions are D001–D017
> below, all aligned with the PRD.

---

## Active Decisions (PRD-aligned)

## D001 — Single repo: Astro app at root + `/server` backend

- **Decision:** One repository. The Astro application lives at the repo root
  (single root `package.json` with `astro build` and the PRD §12 `deploy`
  script); the Node backend lives in `/server` (own `package.json`).
- **Reason:** PRD §8 mandates "Create this in /server folder" and §12 defines
  `"deploy": "astro build && wrangler pages deploy dist"` at the root — the PRD
  prescribes this exact layout. One repo keeps frontend + backend + datasets +
  docs in sync.
- **Alternatives considered:** pnpm workspace monorepo with `apps/` (v1 choice
  — conflicts with PRD layout); separate repos (drift risk).
- **Tradeoffs:** Root package.json is Astro-specific; server has isolated deps.
  CI runs both. Package manager: pnpm preferred, npm acceptable (PRD §2).
- **Date:** 2026-08-04 (supersedes v1 D001)
- **Future impact:** Adding a mobile client later doesn't disturb the layout.

## D002 — TypeScript strict everywhere

- **Decision:** TypeScript with strict mode across Astro islands, server, and
  scripts. No `any` without justification.
- **Reason:** End-to-end type safety is the primary correctness tool; the
  Socket.io event map and REST payloads are the riskiest surfaces.
- **Alternatives considered:** JavaScript; mixed-typed codebase.
- **Tradeoffs:** Slight setup overhead; net win for a contract-heavy real-time
  app.
- **Date:** 2026-08-04 (unchanged from v1 — still valid)
- **Future impact:** Shared event constants keep client/server names in lockstep.

## D003 — Astro v5 MPA with React islands (not a SPA)

- **Decision:** Astro v5 static site generation; every route is static HTML;
  interactive games are React islands hydrated with `client:load` per page.
  **No SPA, no client-side routing shell.**
- **Reason:** PRD §2 (Astro v5 + SSG), §3 (MPA with a static route per game),
  and §13 ("Do NOT make the site a single-page application"). SEO ranking and
  AdSense compliance depend on static, fast, crawler-friendly pages.
- **Alternatives considered:** Vite SPA (v1 choice — conflicts with PRD §13);
  Next.js SSR (heavier, not in PRD stack).
- **Tradeoffs:** Each game page ships its own island bundle; shared code must be
  code-split. No full-app client state store (islands are self-contained).
- **Date:** 2026-08-04 (supersedes v1 D003)
- **Future impact:** PWA wrapping works from static output.

## D004 — Tailwind CSS v4 + BounceBox design tokens

- **Decision:** Tailwind CSS v4 for styling. Design system: BounceBox per PRD
  §11 (coral/teal/sunshine palette, Titan One + Poppins, pill buttons, 24px
  card radii, ≥44px touch targets, glow shadows).
- **Reason:** PRD §2 (Tailwind v4) and §11 (BounceBox spec is the detailed,
  implementable system in the PRD).
- **Alternatives considered:** Vercel minimal aesthetic (PRD §2 references it,
  but the referenced `@DESIGN.md` does not exist and §2's text conflicts with
  §11 — see Open Question #1 in PROJECT_STATE.md).
- **Tradeoffs:** BounceBox targets kids 3–8 while PRD §1 targets 16–35 —
  flagged; if the owner chooses Vercel-style instead, only tokens/components
  change, not architecture.
- **Date:** 2026-08-04 (supersedes v1 D004's styling framing)
- **Future impact:** Design tokens are isolated in Tailwind config; restyling is
  cheap.

## D005 — Node.js + Express backend in `/server`

- **Decision:** Express for REST + Socket.io on the same Node process.
- **Reason:** PRD §2 ("Node.js + Express.js (separate server in /server
  folder)") and §8 — the stack is fixed.
- **Alternatives considered:** Fastify (v1 choice — conflicts with PRD §2);
  NestJS (not in PRD).
- **Tradeoffs:** Express is not schema-first; we add small hand-rolled
  validation helpers (or zod) at boundaries. Fine for this API surface.
- **Date:** 2026-08-04 (supersedes v1 D004)
- **Future impact:** Engine logic stays transport-free for testability.

## D006 — PostgreSQL + Prisma (PRD §8.3 schema, verbatim)

- **Decision:** PostgreSQL with Prisma; exactly the five models from PRD §8.3:
  `Game`, `Room`, `RoomPlayer`, `Score`, `DailyChallenge`. Additive notes only:
  indexes (`Score(gameId, playedAt)`, `Score(gameId, score)`,
  `@@unique([gameId, date])` on DailyChallenge).
- **Reason:** PRD §2 + §8.3. Scores, room metadata, and daily challenges are
  the durable state; live rooms are not.
- **Alternatives considered:** The 9-table schema designed pre-PRD (conflicts
  with PRD §8.3); SQLite; raw SQL.
- **Tradeoffs:** Player identity is a free-text name (no users table) — aligned
  with PRD §13 (no auth). Leaderboard periods derive from `playedAt`.
- **Date:** 2026-08-04 (supersedes v1 D005 in part)
- **Future impact:** Adding accounts later would add a `User` model + FK on
  `Score` — a schema change, deliberately out of scope now.

## D007 — No authentication — nickname-only identity

- **Decision:** No accounts, no passwords, no OAuth, no sessions. Identity is a
  sanitized nickname (length-capped, filtered). Everything works without an
  account (PRD §1, §13).
- **Reason:** PRD §13: "Do NOT require user authentication — everything works
  with just a nickname." Maximizes the "play instantly" promise and minimizes
  PII/attack surface.
- **Alternatives considered:** Guest accounts + upgrade (v1 D009 JWT/auth
  design — conflicts with PRD §13).
- **Tradeoffs:** No cross-device identity, no persistent profiles, weaker abuse
  attribution → mitigated by rate limits + server-authoritative logic.
- **Date:** 2026-08-04 (supersedes v1 D009)
- **Future impact:** If accounts are ever added, it is an additive feature
  behind the existing nickname flow.

## D008 — Server-authoritative room engine (non-negotiable)

- **Decision:** All room state, round timers, guess correctness, vote tallies,
  and scores are computed server-side. Clients send intents and render
  broadcasts. Late guesses/votes are rejected.
- **Reason:** Correctness and fairness of leaderboards and scoring depend on it;
  PRD §8.2 implies server-side checking ("server checks if correct", "server
  tallies").
- **Alternatives considered:** Client-authoritative (rejected — trivially
  cheatable, unverifiable leaderboards).
- **Tradeoffs:** Server cost per room; latency floor — negligible for party
  game cadence.
- **Date:** 2026-08-04 (extends v1 D008 — still valid)
- **Future impact:** Enables fair leaderboards and future anti-cheat analytics.

## D009 — Shared systems built once (PRD §4)

- **Decision:** Four shared systems are first-class deliverables: Room Engine
  (12 real-time games), Drawing Canvas (5 drawing games), Voting/Poll (voting
  games), Solo Game Template (6 solo games). Games are thin configs over these.
- **Reason:** PRD §4: "BUILD ONCE, REUSE EVERYWHERE… must reuse the same
  component, not duplicate code."
- **Alternatives considered:** Per-game bespoke implementations (conflicts with
  PRD §4).
- **Tradeoffs:** Shared abstractions need careful interfaces up front; the
  milestone order (M3–M6) front-loads this investment.
- **Date:** 2026-08-04
- **Future impact:** New games = new config + dataset, not new infrastructure.

## D010 — Static JSON datasets in-repo, licensing-constrained

- **Decision:** Game datasets live as static JSON in `src/data/` (PRD §5 sizes,
  e.g., 500+ Skribbl words, 500+ trivia questions) and are validated by a
  dataset-integrity test. Content is restricted to public-domain/CC0/
  self-created material (PRD §7, §13) — no scraped or copyrighted assets.
- **Reason:** PRD §4.4 (solo games load static JSON), §5 dataset sizes, §13
  prohibitions (no scraping, no paid/copyrighted images).
- **Alternatives considered:** External API for content (cost, reliability,
  against "static JSON" wording); scraping (explicitly forbidden).
- **Tradeoffs:** Datasets are manual/curated — flagged risks: song lyrics
  (Draw the Lyric, Genre-Bender), celebrity names (Guess Who), "Price Is
  Right" name (Open Questions #2, #6, #7).
- **Date:** 2026-08-04
- **Future impact:** Datasets can move to CDN or DB later without changing
  game code.

## D011 — Shared event/contract module (client ↔ server)

- **Decision:** A single source of truth for Socket.io event names and payload
  shapes: `src/lib/events.ts` (client) mirrored by `server/src/lib/events.ts`,
  kept identical by a contract test that compares both files' exported
  constants. PRD §8.2 event names are used **verbatim**.
- **Reason:** Event-name drift between islands and server is the classic
  real-time bug; the PRD defines the names — encode them once.
- **Alternatives considered:** A separate `packages/shared` workspace (heavier
  than needed for one repo; revisit if a second client appears).
- **Tradeoffs:** Two files to keep in sync — enforced by the contract test.
- **Date:** 2026-08-04 (revises v1 D010 for the single-repo layout)
- **Future impact:** A future mobile client can import a real shared package.

## D012 — SEO & AdSense-first engineering

- **Decision:** SEO and AdSense compliance are build-time requirements, not
  launch-day tasks: per-route meta/OG/canonical, JSON-LD (WebApplication, FAQ,
  breadcrumbs), sitemap/robots, `_headers` (noindex preview, CSP), legal pages
  in the footer, original 400–600-word content per game, GA4 + ad unit
  **placeholders only** (commented), no pop-ups/auto-redirects.
- **Reason:** PRD §6 and §7. Google ranking and AdSense approval are primary
  success metrics; §7: "must be met from day one".
- **Alternatives considered:** Retrofit SEO at launch (conflicts with PRD §7).
- **Tradeoffs:** Writing 18 game pages of original SEO copy is real content
  work (M10); placeholder ads keep pages clean until approval.
- **Date:** 2026-08-04
- **Future impact:** hreflang (PRD §6.4) is additive when i18n lands.

## D013 — Deployment: Cloudflare Pages + Railway/Render (PRD §12)

- **Decision:** Frontend: static export deployed to Cloudflare Pages from
  GitHub (`astro build && wrangler pages deploy dist`), custom domain,
  `_headers` for preview-domain `noindex`. Backend: `/server` containerized
  (Dockerfile) on Railway or Render with managed PostgreSQL; env: `DATABASE_URL`,
  `CORS_ORIGIN`, `PORT`.
- **Reason:** PRD §2 + §12 fix the platforms.
- **Alternatives considered:** Vercel, Fly.io (v1 choice — conflicts with PRD §2).
- **Tradeoffs:** Backend host choice (Railway vs Render) deferred to M11 —
  Open Question #8; images are portable either way.
- **Date:** 2026-08-04 (supersedes v1 D012)
- **Future impact:** Platform migration only changes deploy manifests.

## D014 — Documentation-first repo layout (unchanged)

- **Decision:** `README.md` + `CONTRIBUTING.md` at root; `ARCHITECTURE.md`,
  `PROJECT_STATE.md`, `TODO.md`, `DECISIONS.md`, `TESTING_STRATEGY.md`,
  `DEVELOPMENT_GUIDE.md`, `PRD.md` under `docs/`.
- **Reason:** Clean root; GitHub auto-surfaces README/CONTRIBUTING; `docs/`
  groups the corpus with PROJECT_STATE as the canonical memory.
- **Alternatives considered:** All docs at root; separate docs repo.
- **Tradeoffs:** Minimal — convention documented in CONTRIBUTING.
- **Date:** 2026-08-04 (unchanged from v1 — still valid)

## D015 — Leaderboards in PostgreSQL (Redis deferred)

- **Decision:** Leaderboard reads/writes go directly to PostgreSQL using the
  PRD `Score` model with supporting indexes. No Redis in the core stack.
- **Reason:** PRD §2 lists no cache store; §8.3 defines the `Score` model as
  the leaderboard source. Simpler to operate; correct at expected volume.
- **Alternatives considered:** Redis ZSETs (v1 D006 — conflicts with PRD
  stack; revisit at scale); in-memory caches.
- **Tradeoffs:** Higher read cost than ZSETs at very large scale — indexed
  queries mitigate; the Redis path is documented for the first scale step.
- **Date:** 2026-08-04 (supersedes v1 D006)
- **Future impact:** Adding Redis for leaderboards later is additive and
  invisible to clients.

## D016 — Single-instance backend initially; Redis adapter is the scale path

- **Decision:** Ship one backend instance with in-memory Socket.io rooms
  (matching PRD stack). When multi-instance is needed: add Redis +
  `@socket.io/redis-adapter`, move room state to Redis, add Redis-backed rate
  limiting.
- **Reason:** PRD stack has no Redis; single instance is the simplest correct
  system for launch and for room games of this size.
- **Alternatives considered:** Redis from day one (v1 D006/D007 — conflicts
  with PRD §2 simplicity; extra operational surface).
- **Tradeoffs:** A single instance bounds socket capacity; monitored at launch
  (M11), scaled by D017 when needed.
- **Date:** 2026-08-04 (supersedes v1 D007 in part)
- **Future impact:** The engine is already transport-abstracted; the adapter
  swap is contained.

## D017 — Milestone & docs discipline (unchanged)

- **Decision:** One milestone at a time; each ships a working app; docs updated
  with every PR; `PROJECT_STATE.md` is the memory; `DECISIONS.md` append-only.
- **Reason:** Keeps a large 18-game build reviewable and shippable.
- **Alternatives considered:** Big-bang delivery (PRD §14's "generate the
  complete codebase" wording — rejected for engineering reviewability).
- **Tradeoffs:** Slower to "everything at once"; much faster to working,
  tested increments.
- **Date:** 2026-08-04 (unchanged from v1 — still valid)

---

## Archive: Superseded Bootstrap Decisions (D001–D012, pre-PRD)

> These entries were written before `PRD.md` existed. They are preserved
> verbatim for history and **must not be treated as current**. Each is marked
> with its superseding decision.

### v1 D001 — Monorepo with pnpm workspaces → **SUPERSEDED by D001**

Original: "Single repository using pnpm workspaces with `apps/` and
`packages/` layout…" — replaced by the PRD-mandated root-Astro + `/server`
layout.

### v1 D002 — TypeScript (strict) everywhere → **still valid (D002)**

### v1 D003 — React + Vite + Tailwind for the frontend → **SUPERSEDED by D003**

Original proposed a Vite SPA; PRD §2/§3/§13 mandate Astro MPA + islands.

### v1 D004 — Node.js + Fastify backend (TypeScript) → **SUPERSEDED by D005**

PRD §2 mandates Express.

### v1 D005 — PostgreSQL as source of truth (Prisma ORM) → **still valid (D006)**

Schema revised to PRD §8.3's five models.

### v1 D006 — Redis for ephemeral state → **SUPERSEDED by D015/D016**

PRD stack has no Redis; deferred to the first scale step.

### v1 D007 — Socket.IO with Redis adapter for real-time → **SUPERSEDED by D016**

Redis adapter now the documented scale path, not the initial configuration.

### v1 D008 — Server-authoritative game engine (non-negotiable) → **still valid (D008)**

### v1 D009 — JWT access + rotating refresh tokens → **SUPERSEDED by D007**

PRD §13: no authentication.

### v1 D010 — Shared contract package (`packages/shared`) → **REVISED by D011**

Single-repo event-constants module with a contract test, instead of a
workspace package.

### v1 D011 — Documentation-first repo layout → **still valid (D014)**

### v1 D012 — Deployment: Docker + managed PG/Redis, platform provisional

→ **SUPERSEDED by D013** (Cloudflare Pages + Railway/Render per PRD §2/§12).

---

## D018 — M1 implementation baseline (versions, workspace mechanics, verification)

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
  - **Local Postgres:** Docker `postgres:16` container (`partybrain-pg`);
    migrations via `prisma migrate dev`; CI applies `prisma migrate deploy`
    against a `postgres:16` service container.
- **Reason:** Pin a coherent, mutually compatible toolchain at the scaffold
  stage; record the pnpm 11 workspace nuance and the verification approach so
  later milestones don't rediscover them.
- **Alternatives considered:** TypeScript 7 (unsupported by check/lint
  tooling); Prisma 7 (breaking generator change — premature); npm instead of
  pnpm (PRD allows; pnpm preferred and working).
- **Tradeoffs:** Two majors (Astro 7, React 19) are newer than the PRD's
  original framing; all core APIs used (pages, islands, `client:load`,
  `getStaticPaths`) are stable across 5→7. Prisma 6 means a planned upgrade
  chore later.
- **Date:** 2026-08-04
- **Future impact:** Toolchain majors are documented; upgrades follow the
  same verify pipeline (`pnpm verify`).

---

## D019 — M2 design-system decisions (accessible coral, OG pipeline, CSS-only)

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
     `<details>/<summary>`, tooltips via hover/focus opacity transitions —
     no JS, keyboard + screen-reader native.
- **Reason:** PRD §10 requires Lighthouse 100 Accessibility; the contrast
  measurement was taken on a real production build (99/100/100/100 home,
  98/100/100/100 game page — budgets met).
- **Alternatives considered:** Keeping `#FF6B6B` as text (fails Lighthouse
  a11y 100); SVG OG images (unsupported by major platforms); JS accordions
  (violates PRD §13).
- **Tradeoffs:** The coral family now has four shades (documented in
  `src/styles/global.css`); OG images add ~35 KB each to dist and ~2–3 s to
  build time.
- **Date:** 2026-08-04
- **Future impact:** The accessible scale is the reference for all future
  components; new UI must pass the Lighthouse gate before merge.

## D020 — Astro template formatting constraint (prettier-plugin-astro)

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
  renders — negligible.
- **Date:** 2026-08-04
- **Future impact:** Applies to all `.astro` files; React islands are
  unaffected (they use standard TSX).

---

## D021 — M3 backend decisions (idempotency, persistence, testing, SSR-safety)

- **Decision:** M3 recorded the following implementation choices:
  1. **Score idempotency:** additive `Score.clientKey String? @unique`
     (client-generated key per completed game; same key → same row, 200
     with `duplicate: true`). Without a key, submissions are not deduped.
  2. **Rejoin persistence:** additive `@@unique([roomId, playerName])` on
     `RoomPlayer` so seat upserts are idempotent.
  3. **First joiner is host:** `create-room` only issues the code; the first
     `join-room` claims host. (Matches PRD §8.2 event split.)
  4. **Best-effort persistence:** room/player writes from the socket gateway
     are fire-and-forget with logging — live gameplay never depends on the
     DB; the engine is the source of truth. REST writes (scores) are awaited.
  5. **Lazy Prisma accessor** (`getPrisma()`, test-resettable) so integration
     tests can set `DATABASE_URL` before the first query.
  6. **Integration testing:** DB-backed suites use the configured
     `DATABASE_URL` (local Docker container / CI service container) rather
     than testcontainers; files run serially (`fileParallelism: false`) to
     avoid cross-worker races on the shared dev DB; vitest loads `server/.env`
     and silences request logs. TESTING_STRATEGY updated to match.
  7. **SSR-safe islands:** the socket client is created inside `useEffect`
     (client-only) — Astro prerenders islands server-side, and `window`/
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

## D022 — Instant play scope + server-side word bank (owner request 2026-08-04)

- **Decision:** Two things landed together:
  1. **Instant play** (play without a room) is offered only where a no-room
     mode genuinely fits: **Trivia** gets `instantPlay: "solo"` (PRD §5.15
     daily challenge — 10 seeded questions per UTC day, idempotent
     leaderboard submission) and **Would You Rather** gets
     `instantPlay: "one-screen"` (co-located scorekeeper: pass the phone,
     tap A/B per vote, live tally). All other games stay room-only (Skribbl
     and Guess Who are inherently room games; the pure-solo games get their
     template at M7). Catalog field: `Game.instantPlay?: 'solo' | 'one-screen'`.
  2. **Skribbl word bank** lives in `server/src/data/skribbl-words.json`
     (5,686 unique words, 5 difficulties), NOT in the Astro app.
- **Reason:** Words must be server-authoritative (D008) — shipping the bank
  to the browser would let guessers preload answers. The instant-play gate
  keeps the surface honest: one-screen play only where the game reads well
  on a shared screen.
- **Alternatives considered:** word bank in `src/data` + fs-read (tsc does
  not copy JSON to `dist`; `resolveJsonModule` embeds it — chosen); instant
  play for every game (room games lose their point); random solo questions
  (daily challenge requires a shared, comparable set → date-seeded selection).
- **Tradeoffs:** The bank is far larger than the PRD's 500+ and difficulty
  labels are loose — a curation pass is backlogged (M5); the trivia dataset
  is 100 questions vs PRD's 500+ (expansion backlogged with M8).
- **Date:** 2026-08-04
- **Future impact:** M5 drawing games reuse the bank and the DrawingCanvas;
  the `instantPlay` field drives the per-game page layout.

## D023 — Skribbl round protocol: additive events and drawer-only payloads

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
- **Tradeoffs:** Three more additive event names to keep in lockstep — the
  contract test covers them (D011).
- **Date:** 2026-08-04
- **Future impact:** M5+ game adapters follow the same additive pattern;
  payload shapes are the de-facto contract for the drawing family.

## D024 — Skribbl session engine + gateway-owned timers

- **Decision:** `server/src/engine/skribbl-engine.ts` is a transport-
  agnostic session (like the RoomEngine): drawer rotation (shuffled),
  rounds = players × 3, word select/choose, guesses (case-insensitive,
  trimmed), scoring verbatim PRD §5.1 (`guesser = max(0, 100 − 2·s)`,
  `drawer = floor(Σ/2)`), hints at 30s/45s, early round end when every
  guesser is correct, stroke log (5,000/round cap), custom word lists
  (3–200 words, safe charset). The socket gateway owns all `setTimeout`s
  (word-select 15s auto-pick, hints, 60s round, 10s break) and clears them
  on restart/eviction. Rounds run inside the RoomEngine's `in-progress`
  phase; only the first round transitions `game-setup → in-progress` (later
  rounds are already in-progress — the phase machine has no per-round
  states). Game-end persists final scores best-effort with the idempotent
  clientKey `skribbl:<code>:<startedAt>:<player>` (D021).
- **Reason:** Server-authoritative timing and scoring (D008); the session
  stays unit-testable with injected clock/RNG; timers stay where Socket.io
  lives so broadcasts are trivial.
- **Alternatives considered:** timers inside the session (couples the engine
  to the event loop); Redis timers (D016 — single instance); a separate
  phase per round in the RoomEngine (over-engineers the shared machine).
- **Tradeoffs:** Drawer disconnect mid-round stalls strokes until the 60s
  timeout (known limitation, backlog); timers are in-memory (ephemeral
  rooms — acceptable).
- **Date:** 2026-08-04
- **Future impact:** M5 refactors per-game adapters on this pattern;
  `NOT_ENOUGH_PLAYERS` preflight prevents stranded `game-setup` rooms.

## D025 — Drawing canvas architecture (log replay, logical coordinates)

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
  time; rAF coalescing keeps it to one repaint/frame — perf follow-up in
  backlog if drawing games get livelier).
- **Date:** 2026-08-04
- **Future impact:** Reused verbatim by all five drawing games (M5); the
  stroke payload shape is the drawing-family contract.

---

## D026 — Solo testing + playable-game gate (M4.1 fix, owner report 2026-08-04)

- **Decision:** Three changes after the owner reported being unable to test
  the arena solo and hitting a dead-end "Game in progress" state:
  1. **Playable-game gate:** `start-game` now rejects any room game without a
     shipped round adapter (`GAME_NOT_PLAYABLE_YET`). Registry:
     `server/src/lib/game-registry.ts` (`PLAYABLE_ROOM_GAMES` — M4:
     skribbl-arena only), mirrored by `Game.playable` in `games.json` with a
     lockstep test. Previously, starting an unimplemented game advanced the
     room to `game-setup` with nothing taking over — a permanent dead end.
  2. **Solo rooms allowed:** Skribbl now starts with 1 player (3 rounds,
     all as drawer) — a testing affordance; friends can still join
     mid-game. The engine's `allGuessed()` was also fixed: with zero
     guessers it must return false, or a solo round would end the instant
     it started (vacuous truth bug).
  3. **Host `end-round-now`:** additive event; the host can cut the drawing
     phase short (fast solo loops, stalled rounds). Lobby UI explains
     non-playable games and disables their Start button.
- **Reason:** The owner's two reports were real defects: an unreachable game
  state and an unexplained block for solo testers.
- **Alternatives considered:** bots in the lobby (heavy, game-specific); a
  solo practice island for Skribbl (bigger feature — noted as a candidate
  for a future milestone); reverting `game-setup` on a timeout (masked the
  root cause).
- **Tradeoffs:** 1-player rooms are a bit lonely by design (scores are 0);
  the playable flag is client/server duplicated — the lockstep test keeps
  them honest.
- **Date:** 2026-08-04
- **Future impact:** M5 extends `PLAYABLE_ROOM_GAMES` as adapters ship; the
  gate pattern prevents stranded rooms forever.

---

## D027 — Skribbl correctness fixes: late-joiner guessing, drawer-local log, fill tool (owner report 2026-08-04)

- **Decision:** Four fixes after owner testing reported "can't win by
  guessing", broken undo, and a missing fill tool:
  1. **Late joiners can guess:** `SkribblSession.addPlayer(name)` adds
     mid-game joins to the live session (idempotent for rejoins, rejected at
     game-end) — previously their guesses failed with `NOT_PLAYER` (the
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
- **Alternatives considered:** separate `fill` socket event (unnecessary —
  `draw-stroke` carries the additive type); server-side rasterization (over-
  engineered for one drawer); excluding the drawer from undo (kept the bug).
- **Tradeoffs:** flood fill is O(pixels) per application and every replay
  recomputes it — fine at 800×500, revisit if canvases grow; optimistic
  local strokes can briefly diverge from the server on rejection (self-
  heals at round start).
- **Date:** 2026-08-04
- **Future impact:** The optimistic-log pattern is the reference for all
  canvas actions; M5 drawing games inherit the fill tool.

---

## D028 — M5 drawing games: config-driven engine, Copycat island, silhouette canvas (2026-08-04)

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
  2. **Silhouette background:** SVG paths (dataset normalized to 0–100)
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
     copycat flow is testable alone — same solo-testing affordance as D026.
- **Reason:** One engine instead of four near-duplicate adapters (D009);
  drawer-only secrets stay server-side (D023); the owner's solo-testing
  requirement (D026) extends to every room game.
- **Alternatives considered:** separate engine per game (rejected — the four
  shared-canvas games differ only in config); broadcasting strokes for
  copycat (rejected — the whole point is private drawings); server-side
  image uploads (rejected — data URLs are self-contained and stateless).
- **Tradeoffs:** `Path2D` is browser-only (rendering is guarded in Node
  tests/SSR); data-URL submissions can hit the size cap on dense drawings
  (surfaced as feedback, not a crash); fixed lyric scoring ignores speed
  (PRD §5.5 specifies flat 100/50).
- **Date:** 2026-08-04
- **Future impact:** M6 voting games reuse the `vote-update`/`vote-reveal`
  pattern and the private-canvas export via `DrawingCanvasHandle`; the
  config table is the template for future drawing variants.
