# Development Guide — PartyBrain

> How to work in this repo day to day (v2.1, 2026-08-04 — commands updated for
> the pnpm workspace setup from M1). Read `ARCHITECTURE.md`, `CONTRIBUTING.md`,
> and `docs/PRD.md` alongside.

---

## Prerequisites

- **Node.js 22.12+** (repo targets Node 26 LTS line; `engines` enforces ≥22.12)
- **pnpm 11+** (workspace root; `pnpm-workspace.yaml` at the repo root)
- **Docker** (local PostgreSQL + future testcontainers)
- **Wrangler** (Cloudflare Pages deploys — `pnpm dlx wrangler` or install once)
- **Git** with GitHub access

## Initial Setup

```bash
git clone <repo-url> partybrain
cd partybrain
pnpm install            # workspace install — root Astro app + @partybrain/server

# Local PostgreSQL (Docker)
docker run -d --name partybrain-pg -e POSTGRES_USER=partybrain \
  -e POSTGRES_PASSWORD=partybrain -e POSTGRES_DB=partybrain \
  -p 5432:5432 postgres:16

# Env files (server)
cp server/.env.example server/.env    # DATABASE_URL, PORT, CORS_ORIGIN

# DB (M1+)
pnpm --filter @partybrain/server db:migrate   # migrate dev
pnpm --filter @partybrain/server db:seed      # seed 18 games
```

## Running the App (M1+)

```bash
pnpm dev                    # Astro dev server → http://localhost:4321
pnpm --filter @partybrain/server dev   # Express + Socket.io → http://localhost:3000
```

- Frontend: http://localhost:4321 (Astro hot reload for pages/islands)
- Backend: http://localhost:3000 (`/healthz`, `/readyz`, `/api/*` — scores,
  leaderboard, daily-challenge, room endpoints live since M3)
- Socket.io: `ws://localhost:3000` (room events per PRD §8.2)

## Project Workflow

1. Pick a task from `docs/TODO.md` (current milestone only — never work ahead).
2. Read the relevant `docs/ARCHITECTURE.md` sections and `docs/DECISIONS.md`
   entries; check the game spec in `docs/PRD.md` §5.
3. Branch: `feat/<scope>` (see CONTRIBUTING).
4. Implement in small Conventional Commits.
5. Run the full gate locally: `pnpm verify` (format → lint → typecheck → unit →
   server tests → server build → astro build → smoke).
6. Open a PR; CI runs all gates; request review.
7. After merge: update `docs/PROJECT_STATE.md`, check off `docs/TODO.md`
   tasks, append `docs/DECISIONS.md` for architecture choices.

## Branch Strategy

- `main` is the only long-lived branch; always deployable, protected.
- Short-lived branches: `feat/<scope>`, `fix/<scope>`, `chore/<scope>`,
  `docs/<scope>`, `refactor/<scope>`, `test/<scope>`.
- Rebase on `main` before PR; squash-merge with a Conventional Commit.
- Never force-push shared branches.

## Milestone Workflow

1. Milestone defined in `docs/TODO.md` with a **Definition of Done**.
2. Work strictly within the milestone; unrelated ideas go to Backlog.
3. Each milestone ends with: `pnpm verify` green, forever-green E2E journeys
   added (M3+), docs updated, manual QA checklist run, `PROJECT_STATE.md`
   advanced.
4. Demo the milestone to the owner before starting the next one.

## Release Workflow (M11+)

- **Versioning:** semantic tags (`v1.0.0`) on `main`.
- **Frontend release:** `pnpm deploy` → `astro build && wrangler pages deploy
dist` (PRD §12) → Cloudflare Pages serves the static export; rollback =
  redeploy a previous build.
- **Backend release:** `pnpm --filter @partybrain/server build` → deploy
  `/server` Docker image to Railway/Render with `DATABASE_URL` + `CORS_ORIGIN`;
  migrations run **before** rollout (`db:deploy`).
- **Smoke after deploy:** create/join room, submit score, read leaderboard,
  fetch daily challenge, reachability + headers on the Pages URL.
- **Hotfix:** branch from the release tag, fix, bump patch, re-run release flow.

## Debugging Workflow

- **Logs:** structured JSON (pino) in the server; follow request ids through
  REST and socket handlers.
- **API locally:** `pnpm --filter @partybrain/server dev`; set `LOG_LEVEL=debug`
  in `server/.env`.
- **DB:** `pnpm --filter @partybrain/server db:studio`; reset dev data with
  `pnpm --filter @partybrain/server db:migrate` (or drop the container and
  re-run).
- **Integration tests** (DB-backed suites) require a reachable PostgreSQL at
  `DATABASE_URL` — the local Docker container or the CI service. Run
  `pnpm --filter @partybrain/server test` with the container up.
- **Sockets:** enable client debug (`localStorage.debug = 'socket.io-client*'`);
  the event contract lives in `server/src/lib/events.ts` (client mirror lands
  M3) — reproduce races in an integration test before touching the engine.
- **Islands (M3+):** Astro dev hot-reloads islands; React DevTools; check
  hydration with `client:load` (an island not appearing = hydration/import
  issue).
- **Reproduce-first rule:** write the failing test, watch it fail, then fix.
  Never fix blind.
- **Common issues:**
  - CORS errors: `CORS_ORIGIN` in `server/.env` must include
    `http://localhost:4321`.
  - Socket connects then immediately disconnects: check room-code/nickname
    validation, then rate limits (land in M3).
  - Leaderboard wrong period (M3+): `playedAt` filtering — verify the index
    and the `?period=` parsing.
  - `pnpm` says "command not found" for server scripts: use
    `pnpm --filter @partybrain/server <script>`, not `pnpm --dir server …`.

## Deployment Workflow

- **Frontend (Cloudflare Pages):** GitHub-connected project; every push to
  `main` deploys production, PRs get preview URLs (**`noindex`** via Pages'
  automatic `X-Robots-Tag: noindex` on preview deployments — PRD §6.4).
  Custom domain + canonical URLs at M11.
- **Backend (Railway or Render):** Dockerfile in `/server` (M11); managed
  PostgreSQL addon; env vars in the platform secret store (never in git).
- **Local infra:** Postgres via Docker (`partybrain-pg` container).
- **Env matrix:** `dev` (local), preview (Pages per-PR), production (Pages +
  Railway/Render). `.env.example` committed; real values in secret stores.

## Docs Maintenance

- `PROJECT_STATE.md` — update after **every** PR (memory file).
- `DECISIONS.md` — append on architecture changes; never edit history.
- `TODO.md` — check off completed tasks; add new scope as new tasks.
- `ARCHITECTURE.md` — update when system design changes, referencing the new
  decision entry.
- `PRD.md` — owned by the product owner; engineering proposes amendments, the
  owner approves.

## Common Commands

```bash
pnpm install                              # workspace install (root + server)
pnpm dev                                  # Astro dev (frontend)
pnpm --filter @partybrain/server dev      # Express + Socket.io dev
pnpm verify                               # full gate: format→lint→typecheck→tests→builds→smoke
pnpm format / pnpm format:check           # Prettier write / check
pnpm lint                                 # ESLint (whole repo)
pnpm typecheck                            # astro check
pnpm test:unit                            # client unit tests (vitest)
pnpm --filter @partybrain/server test     # server tests (validation/HTTP/socket)
pnpm build                                # astro build → dist/ (runs OG generation first)
pnpm og:generate                          # regenerate public/og/*.png manually
pnpm smoke                                # post-build smoke over dist/ (+ 100 KB page-weight gate)
pnpm deploy                               # astro build && wrangler pages deploy dist (M11)
pnpm --filter @partybrain/server db:migrate   # prisma migrate dev
pnpm --filter @partybrain/server db:deploy    # prisma migrate deploy (CI/prod)
pnpm --filter @partybrain/server db:seed      # seed 18 games
pnpm --filter @partybrain/server db:studio    # Prisma Studio
```
