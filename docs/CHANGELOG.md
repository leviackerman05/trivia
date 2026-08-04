# Changelog

All notable changes to TriviaHub are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/); versions track package
metadata (`triviahub`, `@triviahub/server`).

## [0.5.2] - 2026-08-04

### Added

- **Live frontend:** Pages project `triviahub` created via the Cloudflare
  API with the GitHub source attached. Every push to main builds
  (`pnpm build`) and deploys `dist/` through the standard Pages uploader;
  no wrangler config or workflow file is required.
- **Custom domains:** `playtriviahub.com` and `www.playtriviahub.com`
  attached to the Pages project and active (certificates issued).

### Changed

- `docs/DEPLOYMENT.md`: replaced the dashboard connect instructions (they
  abort on wrangler workspace detection before the project is created)
  with the verified API-based setup, and updated the DNS summary and
  launch checklist.

### Fixed

- `https://playtriviahub.com` and `www.playtriviahub.com` now serve 200;
  `triviahub.pages.dev` was the only reachable host before.

## [0.5.1] - 2026-08-04

### Fixed

- **CI pnpm install:** `pnpm/action-setup` cannot download pnpm 11.20.0
  (pnpm switched GitHub release assets to .tar.gz), and corepack no longer
  ships with Node 25+. CI now installs pnpm from the npm registry
  (`npm install -g pnpm@11.20.0`) matching the `packageManager` field.
- **Cloudflare Pages deploy:** removed `wrangler.toml` and `pages.json` from
  the repo root. Their presence made Pages Build System V2 run
  `npx wrangler deploy`, which re-runs workspace detection at the monorepo
  root and fails. The standard Pages uploader now deploys `dist/` directly;
  `pnpm deploy` remains for manual direct uploads with an explicit
  `--project-name`.
- Removed `.github/workflows/deploy.yml` (direct-upload fallback) to avoid
  double deployments; git integration is the only deploy path.

## [0.5.0] - 2026-08-04

### Added

- **M11 deploy artifacts (D052):** `server/Dockerfile` (multi-stage,
  non-root, /readyz healthcheck, `pnpm deploy --prod` runtime),
  `server/.dockerignore`, `wrangler.toml` (Pages project triviahub),
  wrangler devDependency, and `docs/DEPLOYMENT.md` runbook (frontend git
  integration + direct upload, Railway backend + Postgres, DNS, migrations,
  verification, rollback, Render fallback).

### Changed

- Host decision: Cloudflare Pages + Railway (D052), resolving open question
  #8; Render stays as the documented fallback.
- `pnpm deploy` now uses the wrangler.toml project config.

### Fixed

- None (no open bug reports).

## [0.4.0] - 2026-08-04

### Added

- **Six new live daily games (Phase A, D050):** Daily Emoji Plot, Daily
  Timeline, Daily Price Guess, Daily Rhyme, Daily Genre Swap, and Daily
  Genre-Bender join Trivia and Sudoku in the daily hub. Each reuses its
  existing solo engine with a `dailyDateKey` prop that seeds the day's
  content deterministically (`dailyGameSeed`, FNV-1a of UTC date + slug), so
  everyone plays the same content and replays are stable.
- **Server registry extended** to the eight live dailies; member daily
  submissions now record streaks, history, and personal bests for all of
  them via the Phase 1.5 endpoint.
- **Daily pages** (`/daily/[slug]`) render the new games in daily mode;
  sitemap and smoke checks cover the new routes.
- **Deterministic seeding tests** (`src/lib/__tests__/daily.test.ts`): same
  day stable, different days differ, registry + playedToday coverage.
- **Revised roadmap (D051):** TODO.md now sequences phases by user value
  (A daily expansion, B retention, C social, D content engine, E engine
  contract, F launch) with exit criteria and success metrics.

### Changed

- Homepage daily strip caps at three cards with a link to the full hub;
  page weight stays under the 100 KB budget.
- Integration test uses skribbl-arena as the unknown daily game (the six
  solo games are now valid daily slugs).

### Fixed

- None (no open bug reports).

## [0.3.0] - 2026-08-04

### Added

- **Account-lite identity (Phase 1.5, D047):** `UserProfile` keyed by a
  device-generated memberKey; `POST /api/me/claim` one-tap guest to member
  conversion; `GET /api/me` returns the member read model (profile, streaks,
  personal bests, recent runs). No passwords, no email, no PII.
- **Server-side streaks (D048):** `DailyStreak` scopes (grand + per game)
  driven by a pure streak engine: consecutive UTC days, freeze tokens earned
  every 7-day milestone (cap 3), one one-day restore per calendar quarter,
  longest-streak history preserved. Fully unit tested.
- **Daily runs (D049):** `DailyRun` records member plays idempotently (unique
  clientKey + one run per member per game per day) in a transaction with
  streak updates; personal bests per game; rate-limited submit endpoint.
  The `Score` table remains the leaderboard source for guests and members.
- **Member surfaces:** "Keep my progress (free)" conversion buttons in
  SoloShell, TriviaSolo, and the daily hub; hub shows grand streak, freezes,
  per-game bests, and a server-backed 7-day strip for members; archive is
  server-synced for members with a device fallback for guests.
- **Lockstep test** keeping the client and server live-daily registries in
  sync (same pattern as PLAYABLE_ROOM_GAMES).

### Changed

- Prisma schema: three new tables (UserProfile, DailyRun, DailyStreak) via
  migration `phase15_identity_streaks`; integration test cleanup covers them.
- `src/lib/api.ts` exports `apiFetch` for the new member client
  (`src/lib/member.ts`).
- Archive page copy reflects server-synced history for members.

### Fixed

- None (no open bug reports).

## [0.2.0] - 2026-08-04

### Added

- **Rebrand to TriviaHub** (playtriviahub.com): site config, SEO metadata,
  page titles, OpenGraph, JSON-LD, sitemap, robots, manifest, favicon, OG
  image generator, package names, server logging, README, and docs (D043).
- **Design system** (`src/components/ui/`): Badge, Skeleton, EmptyState,
  Dialog, Tabs, StatCard, LeaderboardTable, PlayerCard, CategoryCard; GameCard
  upgraded with discovery metadata (players, duration, energy, badges) (D045).
- **Daily games framework** (`src/lib/daily.ts`): registry-driven daily games,
  `/daily` hub with streak + 7-day strip, `/daily/trivia` and `/daily/sudoku`
  live pages, `/daily/archive` with client-side history, play-history recording
  in SoloShell and TriviaSolo (D044).
- **Navigation**: Home, Daily Games, Games, Categories, Multiplayer, New
  Games, Trending links, skip-to-main link, `aria-current` on active nav.
- **Landing page redesign**: daily strip, trending, multiplayer, new games,
  and recently played rails above the family grid.
- **Discovery metadata**: `players`, `durationMinutes`, `energy`, `featured`,
  `isNew`, `popularity` on every game in `games.json` (D046).
- **Categories page** (`/categories`) with five family tiles and quick links.
- **Writing standard**: `scripts/purge-dashes.mjs` and a repo-wide purge of
  em dashes and en dashes.
- **Branding analysis**: `docs/BRANDING.md` with 100 evaluated name candidates
  and the top-10 recommendation.

### Changed

- Domain references from partybrain.com to playtriviahub.com in canonical
  URLs, sitemap, robots, share-card footer text, and OG images.
- Client storage keys moved to the `triviahub:` prefix (streaks, nickname,
  timers, daily history) with read-only fallback to legacy `partybrain:` keys,
  so player streaks and nicknames survive the rebrand.
- SEOHead: `og:site_name` TriviaHub, theme-color, manifest link, OG image
  dimensions; breadcrumb JSON-LD on all daily pages.
- Server workspace package renamed to `@triviahub/server`; CI workflow,
  README, and docs updated to match.
- Trivia solo: streak and history recording on completion; em-dash strings
  rewritten.

### Fixed

- None (foundation phase; no bug reports open).

## [0.1.0] - 2026-08-04

Initial release of the PartyBrain-era codebase: 19 games (18 party games +
Daily Sudoku), PRD parity, `pnpm verify` green (136 client + 134 server
tests). See `docs/PROJECT_STATE.md` for the full milestone history.
