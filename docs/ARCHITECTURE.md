# PartyBrain — Architecture

> **Status:** v2 — regenerated against `PRD.md` (2026-08-04). The earlier
> architecture (v1, pre-PRD) was written before the PRD existed and is
> **superseded**. Where the PRD says "DO NOT DEVIATE", this document follows it
> exactly. Contradictions or unclear requirements found in the PRD are tracked
> in [PROJECT_STATE.md](PROJECT_STATE.md#open-product-questions) and
> [DECISIONS.md](DECISIONS.md).

---

## 1. Project Overview

**PartyBrain** is a free online party games hub featuring **18 multiplayer and
solo games** — no downloads, no accounts. Players share a room link (or just
open a game) and start playing instantly. It competes with skribbl.io, Jackbox
Games, and browser game hubs.

- **Audience:** US-based, ages 16–35 (virtual parties, classrooms, streamers).
- **Monetization:** Google AdSense, applied for after ~10 daily users; the site
  is built AdSense-compliant from day one.
- **SEO:** MPA with a static page per game; this is a core requirement, not a
  nice-to-have. Google ranking is a primary success metric.
- **Identity:** No accounts, no authentication — a nickname is the only identity.

---

## 2. Guiding Principles

| Principle                                 | Implication                                                                                                                      |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Stack is fixed (PRD §2)**               | Astro v5 MPA · React islands · Tailwind v4 · Express · Socket.io · Prisma · PostgreSQL. No substitutions without a PRD amendment |
| **MPA, never SPA**                        | Every page is static HTML with per-page React islands; no client-side routing shell                                              |
| **SEO-first**                             | Unique titles/metas/OG per page, JSON-LD (FAQ, WebApplication, breadcrumbs), sitemap, canonical, robots                          |
| **AdSense-compliant from day one**        | Legal pages, original content, placeholders only (GA4 + ad units commented out)                                                  |
| **Build once, reuse everywhere**          | Room Engine (12 games), Drawing Canvas (5), Voting/Poll (6), Solo Game Template (6)                                              |
| **Server-authoritative where it matters** | Rooms, guesses, votes, timers, scores are decided server-side; clients render                                                    |
| **No accounts**                           | Nickname-only identity; zero PII by design                                                                                       |
| **Static-first, island hydration**        | Only the interactive island on a page loads JavaScript                                                                           |
| **Performance budgets are requirements**  | Homepage Lighthouse ≥ 95 Perf / 100 A11y / 100 Best Practices / 100 SEO; game pages ≥ 90 Perf; static pages < 100 KB             |
| **Milestone discipline**                  | Every milestone ships a working, testable slice of the site                                                                      |

---

## 3. High-Level Architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│                          Cloudflare Pages (CDN + static)                    │
│  Astro v5 MPA — SSG at build time; every route is static HTML               │
│                                                                             │
│  SEO pages (title/meta/OG/JSON-LD, 400–600-word content, FAQs)              │
│  ┌──────────────┐ ┌──────────────────┐ ┌──────────────────────────────┐    │
│  │ / (home)     │ │ /game/[18 slugs] │ │ /privacy · /terms · /about   │    │
│  │ /faq /404 /500│ │ each has ONE    │ │ /contact                     │    │
│  └──────────────┘ │ React island     │ └──────────────────────────────┘    │
│                   └──────────────────┘                                      │
│  React islands (client:load, per-page):                                    │
│   RoomEngine · DrawingCanvas · VotingComponent · SoloGameTemplate          │
│  Static data: src/data/*.json (word banks, lyrics, questions, pairs…)      │
│  public/: robots.txt · sitemap.xml · _headers · OG images                  │
└──────────────┬─────────────────────────────────────────────────────────────┘
               │  HTTPS · REST (/api/*) + Socket.io (WSS)
               ▼
┌────────────────────────────────────────────────────────────────────────────┐
│              /server — Node.js + Express + Socket.io (Railway/Render)      │
│  ┌───────────────────┐   ┌────────────────────────────────────────────┐   │
│  │ REST routes       │   │ Socket.io gateway (rooms, game events)     │   │
│  │ /api/scores       │   │  room handlers · drawing broadcast ·       │   │
│  │ /api/leaderboard  │   │  chat/guesses · voting tally               │   │
│  │ /api/daily-…      │   └──────────────────┬─────────────────────────┘   │
│  │ /api/room/*       │                      │                            │
│  └─────────┬─────────┘                      ▼                            │
│            │                ┌──────────────────────────────┐             │
│            │                │ Game engine (server-side)    │             │
│            │                │ generic RoomEngine state     │             │
│            │                │ machine + per-game adapters  │             │
│            │                │ (drawing/voting/quiz/special)│             │
│            │                └──────────────────────────────┘             │
│            ▼                                                              │
│  PostgreSQL (Prisma) — scores · room history · daily challenges           │
└────────────────────────────────────────────────────────────────────────────┘
```

**Runtime model:** the frontend is a static export served by Cloudflare Pages;
the backend is a single Node process (initially) on Railway/Render. Socket.io
rooms live in server memory; the client is a thin event-driven island. No auth,
no sessions — a room code + nickname is everything.

---

## 4. Folder Structure

```
partybrain/
├── src/                          # Astro app (root package.json)
│   ├── pages/
│   │   ├── index.astro           # Homepage (hero, game grid, 600-word SEO content)
│   │   ├── game/[slug].astro     # Static per-game page (SEO + island) — 18 games
│   │   ├── privacy-policy.astro
│   │   ├── terms-and-conditions.astro
│   │   ├── about-us.astro
│   │   ├── contact-us.astro
│   │   ├── faq.astro             # Global FAQ + JSON-LD
│   │   └── 404.astro / 500.astro
│   ├── layouts/                  # BaseLayout: head (SEO/meta/OG/GA4 placeholder),
│   │   │                         # header/footer (legal links), ad-container placeholder
│   │   └── ...
│   ├── components/               # Astro components (GameCard, FAQSection, SEOHead,
│   │   │                         # GameRegistry helpers…)
│   ├── islands/                  # React islands (hydrated per page)
│   │   ├── room/                 # RoomEngine (lobby, code entry, chat, setup)
│   │   ├── drawing/              # DrawingCanvas + per-game drawing islands
│   │   ├── voting/               # VotingComponent + per-game voting islands
│   │   ├── solo/                 # SoloGameTemplate + per-game solo islands
│   │   └── trivia/               # Trivia island (solo + room modes)
│   ├── data/                     # Static JSON datasets (see §16)
│   ├── lib/                      # api client, socket client, shared constants,
│   │   │                         # validation helpers, game registry
│   ├── styles/                   # Tailwind v4 entry + design tokens
│   └── assets/                   # self-created SVGs, public-domain images (WebP)
├── public/
│   ├── robots.txt                # sitemap link
│   ├── sitemap.xml               # all routes
│   ├── _headers                  # noindex preview domain, CSP, cache headers
│   └── og/                       # template-based OG images per game
├── server/                       # Backend (own package.json)
│   ├── src/
│   │   ├── index.ts              # Express + Socket.io bootstrap (HTTP + WSS)
│   │   ├── app.ts                # Express app (middleware, routes, CORS, limits)
│   │   ├── routes/               # scores, leaderboard, daily-challenge, room
│   │   ├── socket/               # room handlers, drawing, chat, voting handlers
│   │   ├── engine/               # generic RoomEngine state machine + adapters
│   │   │   ├── room-engine.ts    # lobby → setup → in-progress → results → lobby
│   │   │   ├── drawing-game.ts   # Skribbl-style logic (guesses, hints, scores)
│   │   │   ├── voting-game.ts    # WYR-style logic (tallies, reveal)
│   │   │   ├── trivia-game.ts    # quiz logic (solo + room race)
│   │   │   └── special-games.ts  # charades, guess-who
│   │   ├── lib/                  # prisma client, logger, validation, constants
│   │   └── types/                # server-side types (shared with client via
│   │                             #  src/lib/events.ts contract mirror)
│   ├── prisma/
│   │   ├── schema.prisma         # Game, Room, RoomPlayer, Score, DailyChallenge
│   │   ├── migrations/
│   │   └── seed.ts
│   └── Dockerfile                # deploy to Railway/Render
├── docs/                         # Engineering documentation (this set)
├── .github/workflows/            # CI + deploy
└── package.json                  # root: astro scripts + "deploy" script
```

> **Note:** PRD §8 mandates `/server`; the Astro app lives at the repo root with
> a single root `package.json` (`astro build` + `wrangler pages deploy dist`).
> pnpm 11 manages both packages via a workspace root (`pnpm-workspace.yaml`,
> `server` is a member) — one `pnpm install` covers the repo (DECISIONS D018).

---

## 5. Frontend Architecture (Astro MPA + React Islands)

- **Astro v5, static site generation.** Every route is rendered to static HTML
  at build time. `output: 'static'`. No SSR.
- **Islands:** only interactive components are React islands loaded with
  `client:load` (the game itself). Everything else is plain Astro/HTML/CSS.
- **Per-game page anatomy** (required by PRD §3):
  1. SEO section — title, meta description (150–160 chars), OG/Twitter tags,
     canonical, JSON-LD (WebApplication + FAQ + breadcrumbs), 400–600-word
     original content (how to play, rules, tips), links to 2–3 related games.
  2. Interactive section — the playable game island.
- **Static data:** game datasets ship as JSON in `src/data/` (imported by
  islands and validated at build time by a dataset-integrity test).
- **API client:** thin `fetch` wrapper in `src/lib/api.ts` for scores,
  leaderboards, daily challenges, room info.
- **Socket client:** one shared `src/lib/socket.ts` (Socket.io client) with the
  typed event map; islands subscribe through a small `useRoom`-style hook.
- **State inside islands:** plain React state/refs (no global store). Canvas
  strokes live in refs for performance; streaks persist to `localStorage`
  (PRD §4.4).
- **Accessibility:** 48px touch targets, keyboard-operable games, focus
  management, color+icon signals (not color alone), WCAG AA — target
  Lighthouse Accessibility = 100 (PRD §10).

---

## 6. Backend Architecture (Express + Socket.io)

- **Express** serves REST under `/api/*` (PRD §8.1): scores, leaderboard,
  daily-challenge, room create/info.
- **Socket.io** serves real-time rooms (PRD §8.2) on the same process.
- **Game engine** (`server/src/engine/`): a generic RoomEngine state machine
  (`lobby → game-setup → in-progress → results → lobby`, PRD §4.1) plus small
  per-game adapters (drawing, voting, trivia, special). One engine powers all
  12 multiplayer games.
- **Server-authoritative:** the server owns room state, round timers, guess
  correctness, vote tallies, and scores. Clients send intents (`send-guess`,
  `cast-vote`, `draw-stroke`) and render what the server broadcasts.
- **Validation:** every REST body and socket payload is validated server-side
  (small hand-rolled validators or zod) — malformed payloads are rejected and
  logged as a security signal.
- **Errors:** consistent JSON error shape; socket errors emitted as typed
  error events; never leak stack traces.
- **Logging:** structured logs (pino) with request ids; log room lifecycle and
  errors for operability.
- **Concurrency model (v2):** single backend instance with in-memory rooms is
  the initial target (matches PRD stack — no Redis). Redis-based Socket.io
  adapter + PG-backed state is the documented scale-up path (see
  [DECISIONS.md](DECISIONS.md) D015/D017 and §19).

---

## 7. Shared Component Strategy (Build Once, Reuse Everywhere)

PRD §4 defines four shared systems. They are the foundation; games are thin
configurations on top of them.

### 7.1 Room Engine — powers all 12 real-time games

- 6-character alphanumeric room code (e.g., `ABC123`); join via code or
  `partybrain.com/room/ABC123`.
- Player management: join, leave, rejoin, **host migration**.
- Generic state machine: `lobby → game-setup → in-progress → results → lobby`.
- Chat: text messages + system notifications ("Alice guessed correctly!").
- Implemented as one client island + one server engine; each game supplies a
  config (rounds, timers, scoring fn, phases).

### 7.2 Drawing Canvas — powers all 5 drawing games

- Pen (variable brush sizes), eraser, color picker (≥ 12 colors), undo, clear.
- Stroke broadcast: `draw-stroke` `{x, y, prevX, prevY, color, brushSize, tool}`.
- **Canvas replay:** late joiners receive stored strokes to see the drawing.
- Touch: `touchstart/move/end` → mouse events; responsive canvas (PRD §9).

### 7.3 Voting/Poll — powers the voting games

- Prompt + 2–6 options; tap to vote; live percentage bars via Socket.io;
  reveal animation when all votes in or timer expires.

### 7.4 Solo Game Template — powers the 6 solo games

- Loads data from static JSON; UI pattern
  `prompt → input → score → result → leaderboard submit → play again`.
- `POST /api/scores` on completion; local streak in `localStorage`.

### Game catalog (18) — how they map to shared systems

| #   | Game (slug)         | Type           | Shared systems                | Key data (static JSON)                   |
| --- | ------------------- | -------------- | ----------------------------- | ---------------------------------------- |
| 1   | Skribbl Arena       | Drawing/Room   | RoomEngine + Canvas + Chat    | 500+ words, 5 difficulties               |
| 2   | Rhyme or Crime      | Solo/Word      | SoloTemplate                  | CMU dict, category word lists            |
| 3   | Emoji Plot          | Solo/Pop       | SoloTemplate                  | 200+ movies, 100+ books                  |
| 4   | Copycat Challenge   | Drawing/Room   | RoomEngine + Canvas (private) | 50+ paintings + 50+ photos (PD)          |
| 5   | Draw the Lyric      | Drawing/Room   | RoomEngine + Canvas + Chat    | 300+ lyrics + titles ⚠ licensing         |
| 6   | One Line, One Shape | Drawing/Room   | RoomEngine + Canvas + Chat    | 200+ objects                             |
| 7   | Timeline Tussle     | Solo/Trivia    | SoloTemplate                  | 200+ events with years                   |
| 8   | Price Is Right      | Solo/Trivia    | SoloTemplate                  | 100+ products (curated, no scraping)     |
| 9   | Genre Swap          | Solo/Word      | SoloTemplate                  | 150+ swapped movie plots                 |
| 10  | Genre-Bender        | Solo/Word      | SoloTemplate                  | 100+ "bended" lyrics ⚠ licensing         |
| 11  | Shadow Sketch       | Drawing/Room   | RoomEngine + Canvas           | 100+ SVG silhouettes                     |
| 12  | Charades            | Acting/Room    | RoomEngine (no canvas)        | 300+ Hollywood/Bollywood titles          |
| 13  | Would You Rather    | Voting/Room    | RoomEngine + Voting           | 500+ dilemmas                            |
| 14  | Most Likely To…     | Voting/Room    | RoomEngine + Voting           | 200+ prompts                             |
| 15  | Trivia              | Quiz/Solo+Room | SoloTemplate + RoomEngine     | 500+ questions, 5 categories             |
| 16  | Never Have I Ever   | Voting/Room    | RoomEngine + Voting           | suggested statements                     |
| 17  | Guess Who? Celeb.   | Deduction/Room | RoomEngine + Chat             | 200+ celebrity trait objects (text only) |
| 18  | This or That        | Voting/Room    | RoomEngine + Voting           | 300+ pairs                               |

⚠ = content-licensing risk flagged in PROJECT_STATE.md.

---

## 8. Data Flow

### Solo game (e.g., Emoji Plot)

```
island mounts → imports src/data/emoji-plots.json
prompt → input → local scoring → result screen
  → POST /api/scores {gameId, playerName, score}      (server validates, stores)
  → GET  /api/leaderboard/:gameId?period=daily        (server returns top scores)
  → streak saved to localStorage (client-only)
```

### Multiplayer room game (e.g., Skribbl Arena)

```
Browser A (host)                /server (authoritative)              Browser B
  create-room (socket) ────────▶ creates room ABC123, host=A
  start-game ──────────────────▶ engine: lobby → setup → in-progress
                                drawer word-select (3 choices)
  draw-stroke ─────────────────▶ validate → broadcast ──────────────▶ canvas
  send-guess "apple" ──────────▶ check (case-insensitive) ──────────▶ system msg
                                scorer: guesser 100 - t*2; drawer Σ/2
  game-state-update ◀─────────── broadcast phase/score deltas ◀───────
  game ends ───────────────────▶ results → podium → lobby (rematch)
```

### Voting game (e.g., Would You Rather)

```
cast-vote {option} ──▶ server tallies ──▶ broadcast percentages (live bars)
  → all votes in or 30s timer → reveal ──▶ game-state-update → next question
```

---

## 9. API Architecture (REST — PRD §8.1)

| Endpoint                       | Purpose                                       | Notes                                                              |
| ------------------------------ | --------------------------------------------- | ------------------------------------------------------------------ |
| `POST /api/scores`             | Submit score `{gameId, playerName, score}`    | Validated; gameId must exist; playerName sanitized & length-capped |
| `GET /api/leaderboard/:gameId` | Top scores, `?period=daily\|weekly\|all-time` | Indexed query on `Score`                                           |
| `GET /api/daily-challenge`     | Today's daily challenge per solo game         | From `DailyChallenge` table; seeded daily                          |
| `POST /api/room/create`        | `{gameId}` → `{roomCode}`                     | Creates Room + assigns host                                        |
| `GET /api/room/:roomCode`      | Room info (players, game type, status)        | Read-only public info                                              |

Conventions: JSON only; consistent error shape `{error: {code, message}}`;
CORS allowlist (Cloudflare Pages domain + localhost); no versioning in the URL
(PRD defines `/api/*` verbatim — any future versioning is additive); optional
idempotency for score submission (client-generated key) to survive retries.

---

## 10. State Management

| Layer                                      | Owner             | Approach                                                              |
| ------------------------------------------ | ----------------- | --------------------------------------------------------------------- |
| Room/round/votes/scores                    | `/server` engine  | In-memory room objects + Socket.io rooms; the only writer of outcomes |
| REST reads (leaderboards, daily challenge) | PostgreSQL        | Indexed reads; no cache layer initially (PRD stack)                   |
| Frontend islands                           | React state/refs  | Per-island state; canvas strokes in refs; no global store             |
| Streaks                                    | `localStorage`    | Client-only per PRD §4.4                                              |
| Static datasets                            | `src/data/*.json` | Read-only, imported at build time                                     |

**Invariant:** clients send intents; the server decides. Drawing strokes are the
one exception (rendering data, not outcomes) — but replay/state remain
server-managed for late joiners.

---

## 11. Database Design (Prisma — PRD §8.3)

The PRD defines five models. This document preserves them **verbatim** and adds
indexes/constraints as implementation notes (flagged as such).

```
Game            id(cuid) · slug(unique) · name · type("solo"|"multiplayer-realtime"|"multiplayer-voting") · createdAt
Room            id(cuid) · code(unique) · gameId · status("lobby"|"in-progress"|"finished") · createdAt · players: RoomPlayer[]
RoomPlayer      id(cuid) · roomId→Room · playerName · joinedAt
Score           id(cuid) · gameId · playerName · score · playedAt
DailyChallenge  id(cuid) · gameId · date · data(Json)
```

Implementation notes (additive, not schema changes):

- **Indexes:** `Score(gameId, playedAt)` for period leaderboards;
  `Score(gameId, score)` for top-N; `DailyChallenge(gameId, date)` —
  recommend `@@unique([gameId, date])` so the daily rollover is upsert-safe.
- **Room is ephemeral metadata** (code, game, status, players); live game state
  lives in the engine. Finished room results are captured as `Score` rows.
- **No users table, no auth** — `playerName` is free-text, sanitized,
  length-capped (e.g., ≤ 20 chars). This is intentional (PRD §13: no auth).
- **Scores are the leaderboard source of truth**; period filtering derives
  from `playedAt`.

---

## 12. Socket Architecture (PRD §8.2 + extensions)

### Base event catalog (verbatim from PRD)

| Event               | Direction          | Meaning                                 |
| ------------------- | ------------------ | --------------------------------------- |
| `create-room`       | client→server      | Create room, returns roomCode           |
| `join-room`         | client→server      | Join room                               |
| `leave-room`        | client→server      | Leave room                              |
| `start-game`        | client→server      | Host starts the game                    |
| `game-state-update` | server→client      | Broadcast current game state            |
| `draw-stroke`       | client→server→room | Broadcast stroke data                   |
| `clear-canvas`      | client→server→room | Broadcast clear command                 |
| `undo-stroke`       | client→server→room | Broadcast undo                          |
| `send-guess`        | client→server→room | Guess; server checks, broadcasts result |
| `chat-message`      | client→server→room | Text message                            |
| `cast-vote`         | client→server→room | Vote; server tallies, broadcasts %      |

### Additive extensions (required by game specs; additive only, PRD base preserved)

- Room lifecycle detail: `room-created` (echo with code + host id),
  `player-joined`, `player-left`, `host-changed`, `room-closed`.
- Rounds: `round-start`, `round-end`, `round-reveal`, `game-end` (results →
  podium), `game-restart` (rematch).
- Drawing: `stroke-replay` (bulk stored strokes to a late joiner, PRD §4.2),
  `canvas-snapshot`; `draw-stroke`/`undo-stroke`/`clear-canvas` also
  broadcast server→client (M4).
- Guessing: `guess-result` (correct/incorrect + scorer delta),
  `guess-feedback` (near-miss hint for "one line" penalty timers).
- Skribbl round protocol (M4, D023): `choose-word` (drawer picks 1 of 3),
  `next-round` (host skip), `restart-game` (host rematch), `set-custom-words`
  (host paste), `round-hint` (first letter at 30s / last at 45s),
  `end-round-now` (host cuts the drawing phase short — M4.1, D026). The
  word-select `round-start` carries the 3 choices only to the drawer
  (private emit; drawer excluded from the public emit).
- Voting: `vote-update` (live percentages), `vote-reveal`.
- Errors: `game-error` (typed, e.g., `ROOM_FULL`, `NOT_HOST`, `ROUND_LOCKED`).

### Room engine state machine (server-side, per game config)

```
        ┌─────────┐
        │  LOBBY  │◀──────────────────────────────┐ (rematch)
        └────┬────┘                               │
             │ all players ready / host start     │
             ▼                                    │
        ┌────────────┐   per-game phases:         │
        │GAME-SETUP  │   drawing: word-select     │
        │ (game-config)│  charades: category pick │
        └────┬───────┘                            │
             ▼                                    │
        ┌─────────────┐   round loop (server-timed):   question/prompt →
        │ IN-PROGRESS │   input window → lock → score → reveal
        └────┬────────┘                            │
             ▼                                    │
        ┌─────────┐   last round done              │
        │ RESULTS │───────────────────────────────┘
        └────┬────┘
             ▼
        (scores persisted via POST /api/scores equivalent path)
```

**Engine rules (non-negotiable):**

1. Timers are server-side; clients receive deadlines, the server enforces them.
2. Late guesses/votes are rejected (`ROUND_LOCKED`).
3. Guess checking is server-side (case-insensitive, trimmed — PRD §5.1).
4. Scores are pure functions defined per game (e.g., Skribbl:
   `guesser = 100 − seconds*2`, `drawer = Σ guesser points / 2`).
5. Host disconnects → host migration; player disconnects → marked absent,
   rejoin returns current `game-state-update`.
6. Stroke payloads are rate-limited and size-capped; malformed events logged.

---

## 13. Security Considerations

- **No accounts = minimal PII.** Nicknames only; sanitize (strip control
  chars/HTML), cap length; never persist emails/IPs.
- **Input validation everywhere** (REST bodies, socket payloads, query params).
- **Rate limiting:** room creation, chat/guess spam, score submission
  (per-IP buckets; lightweight in-memory limiter is fine for one instance;
  swap for Redis-backed at scale).
- **Chat safety:** sanitize output; system-message prefix reserved;
  optional profanity filter flag on messages.
- **CSP + headers** via `public/_headers` on Cloudflare Pages (CSP, X-Frame
  Options, nosniff, referrer policy); HTTPS everywhere (Cloudflare default).
- **CORS:** allow the Pages domain + localhost only; no credentials needed
  (no cookies).
- **DoS on sockets:** per-socket message rate caps, room size caps (e.g.,
  ≤ 24 players), payload size caps on `draw-stroke`.
- **No secrets in the client bundle.** Backend env (DATABASE_URL, port) stays
  server-side; a single public `VITE_`-style backend URL is exposed.
- **Content licensing (PRD §13):** only public-domain/CC0/self-created assets.
  No scraping. Flagged risks: song lyrics (Draw the Lyric, Genre-Bender),
  celebrity names (Guess Who — text only, no photos), "Price Is Right" name
  (trademark — see PROJECT_STATE.md open questions).
- **AdSense compliance:** placeholders only (commented GA4 + ad container);
  no pop-ups/auto-redirects/deceptive content (PRD §7, §13).

---

## 14. Performance Strategy (PRD §10)

- **Budgets (hard):** Homepage Lighthouse ≥ 95 Performance / 100 Accessibility
  / 100 Best Practices / 100 SEO; game pages ≥ 90 Performance; static pages
  < 100 KB total (excluding game bundles); images lazy-loaded, WebP with
  fallbacks; < 2 s load (AdSense §7).
- **Static-first:** Astro SSG; only the game island hydrates on its page
  (`client:load`); no JS on the homepage beyond analytics placeholder.
- **Bundle discipline:** one island per game page; shared island code is code-
  split so each game page ships only what it needs; no heavy animation
  libraries — CSS animations only (PRD §13).
- **Assets:** self-created SVGs, WebP images, `loading="lazy"` for below-fold
  media, hashed filenames, CDN cache via Cloudflare Pages.
- **Runtime (server):** indexed leaderboard queries; batched score writes;
  canvas stroke payloads coalesced/batched where safe; memory-conscious room
  eviction (finished rooms cleaned after TTL).
- **Measurement:** Lighthouse CI on every PR; bundle-size budgets; Playwright
  traces on slow game pages (see TESTING_STRATEGY.md).

---

## 15. Deployment Strategy (PRD §12)

```
GitHub repo
  └─ push to main ──▶ GitHub Actions
        ├─ CI: format → lint → typecheck → dataset tests → unit → integration → build
        └─ Deploy:
              ├─ Frontend → Cloudflare Pages (astro build && wrangler pages deploy dist)
              │    · static export from dist/
              │    · _headers: noindex .pages.dev preview domain (PRD §6.4)
              │    · custom domain (partybrain.com) with canonical URLs
              └─ Backend → Railway or Render
                   · /server with Dockerfile (Node 20, non-root, healthcheck)
                   · env: DATABASE_URL (managed PostgreSQL addon), PORT, CORS_ORIGIN
```

- **Environments:** local (Astro dev + server dev + local Postgres via
  Docker or managed local) → production (Cloudflare Pages + Railway/Render).
  A staging preview is provided by Cloudflare Pages per-PR deploys
  (`noindex` via `_headers`).
- **DB migrations:** Prisma migrate runs as a deploy step **before** the server
  rollout; backward-compatible migrations only.
- **Rollout:** frontend deploys are atomic static releases (instant rollback by
  redeploying a previous build); server deploys are rolling with healthcheck
  gate; Socket.io clients reconnect with backoff.
- **Env management:** `.env` per environment (backend URL, DATABASE_URL);
  example file committed, real values in platform secret stores.

---

## 16. Coding Conventions

- **TypeScript strict** everywhere (client islands + server + seed scripts).
- **Astro:** pages under `src/pages/` (route = file); islands under
  `src/islands/`; Astro components under `src/components/`; datasets under
  `src/data/`.
- **Server:** `server/src/` — Express bootstrap in `app.ts`/`index.ts`; routes
  thin (validate → call service/engine → respond); engine logic pure and
  transport-free where possible (unit-testable).
- **Validation:** every inbound boundary validates (small validators or zod).
- **Naming:** files/folders kebab-case; React components PascalCase; Prisma
  models PascalCase; socket events exactly as PRD defines (`draw-stroke`,
  `cast-vote`, …) — a shared constants module (`events.ts`) used by both
  client and server so names can never drift.
- **Logging:** structured (pino); no `console.log` in committed code.
- **Data hygiene:** datasets validated by a test (shape, duplicates, counts ≥
  PRD minimums, licensing notes in file headers).

---

## 17. Naming Conventions

| Thing         | Convention                  | Example                                       |
| ------------- | --------------------------- | --------------------------------------------- |
| Game slugs    | kebab-case, from PRD routes | `skribbl-arena`, `price-is-right`             |
| Files/folders | kebab-case                  | `room-engine.ts`, `drawing-canvas.tsx`        |
| React islands | PascalCase                  | `SkribblArena.tsx`, `SoloGameTemplate.tsx`    |
| Socket events | PRD verbatim                | `draw-stroke`, `game-state-update`            |
| Prisma models | PascalCase (PRD verbatim)   | `RoomPlayer`, `DailyChallenge`                |
| Datasets      | snake_case JSON             | `skribbl-words.json`, `would-you-rather.json` |
| Branches      | `type/scope`                | `feat/room-engine`, `feat/skribbl`            |
| Commits       | Conventional Commits        | `feat(drawing): add canvas replay`            |

---

## 18. Reusable Abstractions

| Abstraction                  | Location                                                           | Reused by                    |
| ---------------------------- | ------------------------------------------------------------------ | ---------------------------- |
| RoomEngine (island + server) | `src/islands/room/` + `server/src/engine/room-engine.ts`           | 12 real-time games           |
| DrawingCanvas                | `src/islands/drawing/`                                             | 5 drawing games              |
| VotingComponent              | `src/islands/voting/`                                              | 4–6 voting games             |
| SoloGameTemplate             | `src/islands/solo/`                                                | 6 solo games (+ solo Trivia) |
| Socket event constants       | `src/lib/events.ts` ↔ `server/src/lib/events.ts`                   | all real-time islands        |
| API client                   | `src/lib/api.ts`                                                   | all islands                  |
| Game registry                | `src/lib/games.ts` (slug → config, SEO copy ref, island, datasets) | home grid, per-game pages    |
| SEO head component           | `src/components/SEOHead.astro`                                     | every page                   |
| Score/leaderboard queries    | `server/src/routes/leaderboard.ts`                                 | solo + room results          |

---

## 19. Future Scalability Notes

- **Multi-instance backend:** add Redis + `@socket.io/redis-adapter`; move room
  state to Redis; documented as the first scale step (DECISIONS D015/D017).
- **Leaderboard scale:** materialized daily/weekly tables or Redis ZSETs when
  score volume grows; PG indexes are the initial mitigation.
- **Content:** content collections (Astro) for SEO copy when pages multiply;
  i18n via hreflang (PRD §6.4) when multi-language is added.
- **Mobile:** PWA shell later; the MPA + islands model is PWA-friendly.
- **Observability:** structured logs → log drain; request/room metrics; uptime
  monitoring once live.
- **New games:** adding a game = new static page + island + dataset + optional
  engine adapter — the shared systems are the compatibility boundary.

---

## 20. Technology Stack (PRD §2 — DO NOT DEVIATE)

| Layer               | Choice                                                       |
| ------------------- | ------------------------------------------------------------ |
| Frontend            | Astro v5+ (SSG/MPA; 7.x since M1 — DECISIONS D018)           |
| Interactive islands | React (TypeScript strict)                                    |
| Styling             | Tailwind CSS v4                                              |
| Design system       | BounceBox (PRD §11 — see open question re: §2 contradiction) |
| Real-time           | Socket.io (client + server)                                  |
| Backend             | Node.js + Express.js (`/server`)                             |
| Database            | PostgreSQL + Prisma ORM                                      |
| Hosting             | Cloudflare Pages (frontend) + Railway/Render (backend)       |
| Package manager     | pnpm (preferred) or npm                                      |
| Language            | TypeScript everywhere (strict)                               |
