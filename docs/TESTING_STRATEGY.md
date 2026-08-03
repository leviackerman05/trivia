# Testing Strategy — PartyBrain

> Testing is a first-class deliverable. Every milestone's "Definition of Done"
> includes its tests. This document defines layers, tooling, and gates, updated
> for the PRD (v2, 2026-08-04). Per PRD §10, performance and accessibility are
> **hard budget gates**, not aspirations.

---

## Test Pyramid

```
        ┌──────────────────────────────┐
        │     E2E (few, multi-client)  │  Playwright — game journeys,
        │                              │  multi-browser, mobile viewports
        ├──────────────────────────────┤
        │    Integration (some)        │  Supertest (REST) · socket.io-client
        │                              │  real PostgreSQL (DATABASE_URL)
        ├──────────────────────────────┤
        │     Unit (many)              │  Vitest — scoring math, validation,
        │                              │  engine state machine, datasets
        └──────────────────────────────┘
```

Guideline ratios: ~70% unit, ~20% integration, ~10% E2E. Never invert.

---

## 1. Unit Testing

- **Tool:** Vitest.
- **Must-have coverage:**
  - **Scoring functions** (pure, per PRD §5): Skribbl
    (`guesser = 100 − seconds·2`, `drawer = Σ/2`), Draw the Lyric (100/50),
    Rhyme or Crime (+10/+5 speed, ×2/×3 streaks), Emoji Plot (100/50/25 with
    hints), Timeline Tussle (100/50/0), Price Is Right
    (`100 − Δ·2`, min 0, exact = 200), Trivia race mode, This or That herd
    streaks. Edge cases: 0 ms answers, deadline-late, ties, negative deltas.
  - **Validation:** nickname sanitization/length cap, chat sanitization,
    REST body validation, socket payload validation (malformed → rejected +
    logged).
  - **Engine state machine** (`server/src/engine/`): every transition of
    `lobby → game-setup → in-progress → results → lobby`; invalid transitions;
    timer expiry; disconnect/rejoin; host migration; room full.
  - **Game logic:** guess matching (case-insensitive, trimmed, "ignore The"
    fuzzy for Emoji Plot), hint timing (Skribbl 30s/45s, Emoji Plot 15s/25s,
    Draw the Lyric 45s, Shadow Sketch 60s), one-line lift penalty (−10s),
    voting tallies + anonymous toggle, Charades pass-the-phone rotation,
    Guess Who 20-question reveal.
  - **Datasets** (`src/data/*.json`): integrity tests — required counts met
    (PRD §5 sizes), no duplicate entries, required fields present, licensing
    header present, no forbidden content (no real celebrity photos, no URLs
    to non-PD images).
- **Conventions:** `describe/it`; injected fakes; no network/DB in unit tests.

## 2. Integration Testing

- **Tool:** Vitest + Supertest + `socket.io-client` against a **real
  PostgreSQL** — the configured `DATABASE_URL` (local Docker container or the
  CI `postgres:16` service; DECISIONS D021). Files run serially
  (`fileParallelism: false`) so truncates never race across workers; vitest
  loads `server/.env` locally and silences request logs.
- **Scope:**
  - **REST (PRD §8.1):** `POST /api/scores` (valid, duplicate/idempotent,
    unknown gameId, oversized nickname), `GET /api/leaderboard/:gameId` with
    `period=daily|weekly|all-time` and pagination, `GET /api/daily-challenge`,
    `POST /api/room/create`, `GET /api/room/:roomCode`.
  - **Socket (multi-client):** two+ `socket.io-client` connections exercise the
    full PRD §8.2 catalog — `create-room`/`join-room`/`leave-room`/
    `start-game`/`game-state-update`; `draw-stroke` broadcast + replay for a
    late joiner; `send-guess` correct/incorrect paths; `cast-vote` tally →
    live percentages → reveal; `chat-message` sanitization.
  - **Engine with real DB:** finished rooms write `Score` rows; daily-challenge
    upsert `(gameId, date)`; leaderboard queries hit the right index.
  - **Rate limits:** room creation, chat spam, score submission buckets
    trigger and recover.
- **Multi-instance note:** single-instance is the launch topology (D016);
  a Redis-adapter integration suite is added when multi-instance lands.

## 3. E2E Testing

- **Tool:** Playwright (Chromium, Firefox, WebKit; iPhone 14 + Pixel 7
  presets per PRD §9).
- **Forever-green journeys (one per milestone):**
  - **M3:** create room → second browser joins via code → chat → host starts →
    state machine advances; score submitted → appears on leaderboard.
  - **M4:** full Skribbl game (word select, drawing, guesses, hints, podium);
    late-join canvas replay.
  - **M5/M6:** each drawing/voting game journey (canvas replay per drawing
    game; live percentages per voting game).
  - **M7/M8:** solo journeys (Rhyme or Crime, Emoji Plot, Timeline Tussle,
    Price Is Right, Genre Swap, Genre-Bender) + leaderboard submission +
    localStorage streak persistence; Trivia solo + room; daily challenge.
  - **M9:** Charades + Guess Who journeys.
  - **A11y journeys:** keyboard-only completion of a game; screen-reader pass.
  - **SEO journeys:** every `/game/[slug]` renders its SEO section, canonical,
    and JSON-LD; internal related-game links resolve.
- **Environment:** full local stack (Astro dev/preview + server + PG) with
  deterministic seeded data. No arbitrary sleeps — wait on UI state or socket
  events.

## 4. Accessibility Testing

- **Tooling:** axe-core via Playwright; manual WCAG 2.1 AA audit per milestone;
  keyboard-only walkthroughs; focus-trapping checks.
- **Requirements (from PRD §9/§10):** touch targets ≥ 48px (44px minimum for
  buttons per BounceBox §11); color is never the only signal (correct/incorrect
  = icon + text, not green/red alone); screen readers announce round starts and
  results; reduced-motion respected; text ≥ 14px (BounceBox rule).
- **Gate:** Lighthouse **Accessibility = 100** on homepage, ≥ 90 on game pages
  (PRD §10); axe violations = merge blocker.

## 5. Performance Testing

- **Budgets (PRD §10, hard):** Homepage Lighthouse **≥ 95 Performance,
  = 100 Accessibility, = 100 Best Practices, = 100 SEO**; game pages
  **≥ 90 Performance**; static pages **< 100 KB** (excluding game bundles);
  load < 2 s; images WebP + lazy.
- **M2 baseline (measured on local production build, 2026-08-04):**
  home **99/100/100/100**, game page **98/100/100/100**; page weights
  47–57 KB. The 100 KB budget is enforced in `scripts/smoke.mjs` on every
  build (CI gate). Full Lighthouse runs in CI land with E2E (M3+); until
  then, re-measure before each milestone review via
  `npx lighthouse` against `pnpm preview`.
- **Static/CI:** per-island bundle-size budgets (warn +5%, fail +10%) when
  islands land (M3+); Playwright trace on slow game pages.
- **Load (post-M11):** k6 against staging — room create/join churn, chat/guess
  throughput, concurrent sockets (baseline from M3; target TBD), leaderboard
  reads under load, score-write throughput. Single-instance limits are the
  launch envelope; results feed the D016/D017 scale decision.

## 6. Regression Testing

- **Every PR:** full unit + integration suites (fast, parallel).
- **Every merge to `main`:** full CI + E2E + Lighthouse; broken E2E blocks
  deploy.
- **Milestone boundaries:** forever-green E2E list grows; previous milestones'
  journeys stay green — that list is the regression net.
- **Flake policy:** a flaky test is a bug. Fix or quarantine with a tracked
  issue and 7-day expiry; never repeatedly retry CI to force green.

## 7. Manual QA

- Milestone QA checklist covering what automation can't: game pacing/feel,
  real-network socket behavior, multi-tab behavior, mobile touch feel,
  canvas drawing latency, visual polish per BounceBox.
- QA on staging/preview deploys (Cloudflare Pages previews per PR + staging
  server) with seeded data.
- Known-issue list lives in `PROJECT_STATE.md`.

## 8. Deployment Verification

- **Smoke tests (post-deploy, automated):** server `/healthz`; create room →
  join → start on staging; submit score → leaderboard read; daily-challenge
  fetch; static page reachability + `_headers` (noindex on preview domain,
  CSP) via the Pages URL.
- **Staging gate:** Cloudflare Pages preview per PR must pass smoke + E2E
  before merge to `main`.
- **Production rollout:** frontend = atomic static release (rollback =
  redeploy previous build); server = rolling with healthcheck gate;
  migrations run pre-rollout and are backward-compatible.
- **Content checks:** sitemap.xml lists all routes; canonical/OG/JSON-LD
  validate (Google Rich Results test) — part of M10 gate.

---

## CI Gates (every PR — see `.github/workflows/ci.yml`)

1. `format:check`
2. `lint`
3. `typecheck` (astro check)
4. `test:unit` (client: registry, routes, SEO artifacts)
5. `pnpm --filter @partybrain/server db:deploy` (migrations apply on CI Postgres 16)
6. `pnpm --filter @partybrain/server test` (server unit + integration)
7. `pnpm --filter @partybrain/server build` (tsc)
8. `build` (astro static export)
9. `smoke` (post-build route verification over `dist/`)
10. E2E + Lighthouse CI (UI/game PRs; always on `main` — planned M3+)

Red gate blocks merge. Coverage regressions on scoring/engine require explicit
reviewer sign-off.

---

## Tools Summary

| Layer            | Tool                                                                   |
| ---------------- | ---------------------------------------------------------------------- |
| Unit             | Vitest                                                                 |
| Integration      | Vitest + Supertest + socket.io-client + real PostgreSQL (DATABASE_URL) |
| E2E              | Playwright (+ axe-core)                                                |
| Perf/SEO budgets | Lighthouse CI, k6 (post-launch)                                        |
| Coverage         | v8 via Vitest (thresholds per area)                                    |
| CI               | GitHub Actions                                                         |
