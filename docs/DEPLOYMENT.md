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

**Path (git integration via API; verified 2026-08-04):**

The Pages project is created and connected to GitHub through the Cloudflare
API, because the dashboard connect flow runs wrangler workspace detection
and aborts with "detection logic has been run in the root of a workspace"
before the project is created. The API path skips detection entirely.

1. Authenticate wrangler: `pnpm exec wrangler login` (browser OAuth).
2. Read the account id: `pnpm exec wrangler whoami --json`.
3. Create the project with the GitHub source attached. This requires the
   Cloudflare GitHub app to be installed on the repo (the earlier dashboard
   attempt installed it). Example request:

   ```sh
   curl -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/pages/projects" \
     -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json" \
     --data '{
       "name": "triviahub",
       "production_branch": "main",
       "build_config": {
         "build_command": "pnpm build",
         "destination_dir": "dist",
         "root_dir": "/"
       },
       "deployment_configs": {
         "production": {
           "env_vars": {
             "PUBLIC_SERVER_URL": { "value": "https://api.playtriviahub.com" }
           }
         },
         "preview": {
           "env_vars": {
             "PUBLIC_SERVER_URL": { "value": "https://api.playtriviahub.com" }
           }
         }
       },
       "source": {
         "type": "github",
         "config": {
           "owner": "leviackerman05",
           "repo_name": "trivia",
           "production_branch": "main"
         }
       }
     }'
   ```

4. Push to main. Every push triggers a production build (`pnpm build`)
   and deploys `dist/` with the standard uploader. No wrangler config, no
   deploy command, and no workflow file are needed.
5. Attach the custom domain: `playtriviahub.com` (same Cloudflare zone as
   the account, so it verifies automatically).

**Notes:**

- Do not add `wrangler.toml` or `pages.json` at the repo root. With either
  present, Build System V2 runs `npx wrangler deploy` as the deploy step,
  which re-runs workspace detection and fails with the detection error.
- A Direct Uploads project (created via `wrangler pages project create`)
  cannot switch to git integration later; the API rejects the update with
  "You cannot update the `source` object in a Direct Uploads project".
  Recreate the project with the `source` field instead.
- Preview deployments on `*.pages.dev` are already noindexed (PRD §6.4).

**Alternative (direct upload from a machine with a token):**

```sh
export CLOUDFLARE_API_TOKEN=...
export CLOUDFLARE_ACCOUNT_ID=...
PUBLIC_SERVER_URL=https://api.playtriviahub.com pnpm deploy
```

`pnpm deploy` runs `wrangler pages deploy --project-name triviahub`
(explicit project name, no config file needed).

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

Verified live 2026-08-04 (`dig` + HTTP checks):

- `playtriviahub.com` -> CNAME `triviahub.pages.dev` (proxied, flattened
  at the apex; Pages custom domain active).
- `www.playtriviahub.com` -> CNAME `triviahub.pages.dev` (proxied; Pages
  custom domain active).
- `api.playtriviahub.com` -> Railway service (CNAME to the Railway domain;
  pending backend setup).
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

- [x] Cloudflare Pages project live with custom domain (apex + www
      verified 200, 2026-08-04)
- [x] Railway backend live with healthcheck passing (`readyz` 200,
      2026-08-04)
- [x] Production DB migrated + seeded (2026-08-04)
- [x] `CORS_ORIGIN` and `PUBLIC_SERVER_URL` set (bundle verified)
- [ ] Browser smoke test: daily game score on the live leaderboard,
      two-device room over WebSocket
- [ ] Search Console domain + sitemap submitted
- [ ] AdSense application (blocked on ~10 daily users, PRD §1)
- [ ] GA4 real ID (placeholder stays commented until account exists)
- [ ] CSP hardening pass (`_headers` review)
- [ ] First Lighthouse run against the live domain
