# Deployment Runbook (M11, D052)

Production targets: **Cloudflare Pages** (frontend, static) + **Railway**
(backend, Docker) + **Railway Postgres** (or any managed Postgres).
Fallback backend host: Render (same Dockerfile, see §8).

Costs at launch scale: frontend $0, backend + DB ~$5/mo on Railway, domain
renewal only. No email provider needed until auth verification lands.

---

## 1. The moving parts

| Piece                         | Host                       | Artifact                               |
| ----------------------------- | -------------------------- | -------------------------------------- |
| Frontend (Astro static)       | Cloudflare Pages           | `dist/` via `pnpm build`               |
| Backend (Express + Socket.io) | Railway (or Render)        | `server/Dockerfile`                    |
| PostgreSQL                    | Railway Postgres (or Neon) | Prisma migrations                      |
| Domain                        | Cloudflare DNS             | `playtriviahub.com` + `api.` subdomain |

The frontend calls the backend through `PUBLIC_SERVER_URL`, inlined at build
time (`src/lib/api.ts`). The backend validates browser origins through
`CORS_ORIGIN` (`server/src/lib/config.ts`).

## 2. Frontend: Cloudflare Pages

**Path (git integration; verified 2026-08-04):**

1. Cloudflare dashboard, Workers & Pages, Create, Pages, connect the GitHub
   repo (`leviackerman05/trivia`). If the workspace detection error appears
   during connect, continue to the build configuration form and fill it
   manually (auto-detection failing is not a blocker).
2. Build configuration (Settings, Builds & deployments):
   - Root directory: `/` (the Astro app lives at the repo root)
   - Framework preset: Astro
   - Build command: `pnpm build`
   - Build output directory: `dist`
   - Environment variables (production):
     `PUBLIC_SERVER_URL=https://api.playtriviahub.com`
   - Build system: V2 (required for monorepo root-directory support)
3. Save and Deploy. Preview deployments on `*.pages.dev` are already
   noindexed (PRD §6.4). Custom domain: `playtriviahub.com`.

**Why there is no `wrangler.toml` or `pages.json` in the repo:** when the
root directory contains a wrangler config, Build System V2 switches the
deploy step to `npx wrangler deploy`, and wrangler re-runs the workspace
application detection, which fails with "detection logic has been run in the
root of a workspace". Removing the config restores the standard Pages
uploader, which deploys `dist/` directly. Local CLI uploads use the
explicit flag form: `pnpm deploy` runs `wrangler pages deploy
--project-name triviahub` (no config file needed).

**Alternative (direct upload from a machine with a token):**

```sh
export CLOUDFLARE_API_TOKEN=...
export CLOUDFLARE_ACCOUNT_ID=...
PUBLIC_SERVER_URL=https://api.playtriviahub.com pnpm deploy
```

`wrangler.toml` pins the project name (`triviahub`) and output dir.

## 3. Backend: Railway

1. Create a Railway project, deploy from the same GitHub repo. Railway
   auto-detects `server/Dockerfile`; set the root directory to `server`.
2. Add a **PostgreSQL** plugin (Railway managed). Copy its `DATABASE_URL`.
3. Service variables:
   - `DATABASE_URL` (from the Postgres plugin)
   - `CORS_ORIGIN=https://playtriviahub.com`
   - `PORT=3000` (Railway sets PORT automatically; keep the default)
   - `LOG_LEVEL=info`
4. Custom domain: `api.playtriviahub.com` on the service. The Dockerfile
   healthcheck hits `/readyz` (implemented, see routes/health).
5. The service restarts on every push to main (deploy from GitHub).

## 4. Database migrations

Migrations run from CI or a local machine, never from the container:

```sh
DATABASE_URL=postgresql://... pnpm --filter @triviahub/server db:deploy
DATABASE_URL=postgresql://... pnpm --filter @triviahub/server db:seed
```

The seed is idempotent (19 games upserted from the catalog).

## 5. DNS summary

- `playtriviahub.com` -> Cloudflare Pages (CNAME/A, automatic via Pages).
- `api.playtriviahub.com` -> Railway service (CNAME to the Railway domain).
- Keep `robots.txt` and `sitemap.xml` pointing at
  `https://playtriviahub.com` (already updated).

## 6. Post-deploy verification

1. `curl -I https://playtriviahub.com` -> 200, `x-robots-tag` absent.
2. `curl https://api.playtriviahub.com/readyz` -> `{"ok":true}`.
3. Play a daily game from the live site; score lands on the leaderboard.
4. Create a room, join from a second device, play a round over WebSocket.
5. `https://playtriviahub.com/sitemap.xml` resolves; Google Search Console
   submits the sitemap and validates the domain.
6. `pnpm smoke` against the live site once (temporarily point it at the
   domain or run the same route checks manually).

## 7. Rollback

- Frontend: Cloudflare Pages keeps every deployment; promote the previous
  one from the dashboard (instant).
- Backend: Railway redeploys the previous image, or revert the git push
  (deploy-from-GitHub redeploys main).
- DB: no destructive migrations are ever shipped; additive changes only
  (D006). Rollback of schema is not supported, by design.

## 8. Fallback: Render

Same `server/Dockerfile`. Create a Web Service from the repo (root
`server`), add a managed Postgres, set the same env vars. Render free tier
sleeps after 15 min idle, which kills rooms; use the paid tier for launch.

## 9. Launch checklist (carried in PROJECT_STATE)

- [ ] Cloudflare Pages project live with custom domain
- [ ] Railway backend live with healthcheck passing
- [ ] Production DB migrated + seeded
- [ ] `CORS_ORIGIN` and `PUBLIC_SERVER_URL` set
- [ ] Search Console domain + sitemap submitted
- [ ] AdSense application (blocked on ~10 daily users, PRD §1)
- [ ] GA4 real ID (placeholder stays commented until account exists)
- [ ] CSP hardening pass (`_headers` review)
- [ ] First Lighthouse run against the live domain
