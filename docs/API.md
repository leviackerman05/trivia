# API Reference, TriviaHub

REST + Socket.io contract for the TriviaHub backend (`server/`).

Verified against the implementation (2026-08-05): `server/src/routes/*.ts`,
`server/src/lib/events.ts`, `server/src/lib/validation.ts`,
`server/src/lib/rate-limit.ts`, `server/src/lib/config.ts`, and the client
mirror `src/lib/api.ts` + `src/lib/events.ts`. If this document disagrees
with the code, the code wins — fix the document.

---

## 1. Conventions

- **Base URL:** the Astro app resolves it at build time from
  `PUBLIC_SERVER_URL` (`src/lib/api.ts`); falls back to
  `http://localhost:3000` in dev. Production: `https://api.playtriviahub.com`.
- **JSON only.** The Express body parser caps payloads at 32 KB.
- **Errors:** every REST error is `{ "error": { "code": string, "message": string } }`.
- **No URL versioning** (`/api/*` is defined verbatim in PRD §8.1; any future
  versioning is additive).
- **CORS:** allowlist from `CORS_ORIGIN` (comma-separated env var). When
  unset, all origins are allowed — local development only; production must
  set `CORS_ORIGIN` (enforced at deploy review).
- **Idempotency:** `POST /api/scores` and `POST /api/daily/:gameId/submit`
  accept a client-generated `clientKey`; retries with the same key return
  the original result instead of creating duplicates.

## 2. REST endpoints

| Method | Path                        | Purpose                                              |
| ------ | --------------------------- | ---------------------------------------------------- |
| `POST` | `/api/scores`               | Submit a score (leaderboard source of truth)         |
| `GET`  | `/api/leaderboard/:gameId`  | Top scores for a game, by period                     |
| `GET`  | `/api/daily-challenge`      | Today's daily challenge per solo game                |
| `POST` | `/api/room/create`          | Create a room for a game                             |
| `GET`  | `/api/room/:roomCode`       | Room info (players, game, status)                    |
| `POST` | `/api/me/claim`             | One-tap guest → member conversion (D047)             |
| `GET`  | `/api/me`                   | Member read-model: profile, streaks, bests, runs     |
| `POST` | `/api/daily/:gameId/submit` | Record a member's daily run + streak (D048/D049)     |
| `GET`  | `/healthz`                  | Liveness probe (not under `/api`)                    |
| `GET`  | `/readyz`                   | Readiness probe, pings PostgreSQL (not under `/api`) |

### POST /api/scores

Body: `{ gameId, playerName, score, clientKey? }`

- `gameId` — game slug from the catalog (1–64 chars).
- `playerName` — sanitized (control chars stripped, trimmed), 1–20 chars.
- `score` — integer, 0–1,000,000.
- `clientKey` — optional idempotency key, 8–128 chars, `[A-Za-z0-9._:-]`.

Responses:

- `201` — `{ score: { id, gameId, playerName, score, playedAt }, duplicate: false }`
- `200` — same shape with `duplicate: true` when `clientKey` was already seen
  (the original row is returned).
- `400` `INVALID_BODY` — validation failed.
- `404` `GAME_NOT_FOUND` — unknown `gameId`.
- `429` `RATE_LIMITED` — rate limit exceeded (30/min per IP).

### GET /api/leaderboard/:gameId

Query params:

- `period` — `daily` \| `weekly` \| `all-time` (default `all-time`; any other
  value falls back to `all-time`). `daily` = UTC day, `weekly` = UTC week
  starting Monday.
- `limit` — 1–100 (clamped; default 10).

Responses:

- `200` — `{ gameId, period, entries: [{ rank, playerName, score, playedAt }] }`,
  ordered by `score` desc, then `playedAt` asc.
- `400` `INVALID_GAME_ID`, `404` `GAME_NOT_FOUND`.

### GET /api/daily-challenge

Query params:

- `date` — optional `YYYY-MM-DD` (UTC); defaults to today UTC.

Behavior: seeds the day's challenges on first read (idempotent upsert,
`ensureDailyChallenges`), then returns them.

- `200` — `{ date, challenges: [{ gameId, data }] }` (`data` is the
  game-specific Json payload; shape varies per game).

### POST /api/room/create

Body: `{ gameId }`

- `201` — `{ roomCode, gameId, status }` (`status` is the room phase,
  e.g. `lobby`).
- `400` `INVALID_BODY` — validation failed or the room engine rejected the
  create (code returned as-is from the engine).
- `404` `GAME_NOT_FOUND` — unknown `gameId`.
- `429` `RATE_LIMITED` — 10/min per IP.

### GET /api/room/:roomCode

`roomCode` is 6 alphanumeric chars, case-insensitive. The live engine is
checked first; if the room is not in memory it is read from the database.

- `200` — `{ code, gameId, status, players: string[] }`.
- `400` `INVALID_ROOM_CODE`, `404` `ROOM_NOT_FOUND`.

### POST /api/me/claim

Body: `{ memberKey, nickname? }`

- `memberKey` — device-generated opaque id, 8–128 chars, `[A-Za-z0-9-]`.
  Not a credential; no passwords, no email, no PII (D047).
- `nickname` — optional; sanitized like `playerName` (1–20 chars).

Idempotent upsert by `memberKey` (repeat claims update nickname + lastSeen).

- `200` — `{ profile: { nickname, xp, level, streakFreezes, restoreUsedSeason, createdAt } }`
- `400` `INVALID_BODY`, `429` `RATE_LIMITED` (10/min per IP).

### GET /api/me

Query params: `memberKey` (required).

- `200` — member read-model:
  ```json
  {
    "profile": {
      "nickname": "",
      "xp": 0,
      "level": 1,
      "streakFreezes": 0,
      "restoreUsedSeason": null,
      "createdAt": ""
    },
    "streaks": [{ "scope": "grand", "current": 0, "longest": 0, "lastDate": "" }],
    "personalBests": [{ "gameId": "", "bestScore": 0, "plays": 0 }],
    "recentRuns": [{ "gameId": "", "dateKey": "YYYY-MM-DD", "score": 0 }]
  }
  ```
  (`recentRuns` covers the last 90 days, up to 200 rows, newest first.)
- `400` `INVALID_BODY` — invalid `memberKey`.
- `404` `MEMBER_NOT_FOUND`.

### POST /api/daily/:gameId/submit

Members only (guests keep the device-bound solo streak and use
`POST /api/scores`). Records a daily run and transitions both the per-game
and `grand` streaks in one transaction.

Body: `{ gameId, memberKey, playerName, score, clientKey, tier?, durationMs?, correctCount?, totalCount? }`

- `gameId` must match the path segment and be a live daily game.
- `clientKey` — required idempotency key (same rules as `/api/scores`).
- `tier` — optional, ≤ 16 chars (e.g. `normal`).
- `durationMs` — optional integer, 0–24 h.
- `correctCount` / `totalCount` — optional integers, 0–10,000,
  `correctCount ≤ totalCount`.

Idempotency: a repeated `clientKey` returns the original result; a second
run for the same member + game + UTC day is acknowledged, not re-scored.

- `201` — accepted:
  ```json
  {
    "accepted": true,
    "duplicate": false,
    "member": true,
    "streaks": [{ "scope": "grand", "current": 0, "longest": 0, "lastDate": "" }],
    "streakFreezes": 0,
    "restoreUsedSeason": null
  }
  ```
- `200` — same shape with `duplicate: true` (replay or already played today).
- `400` `INVALID_BODY` (validation failed or `gameId` mismatch).
- `404` `GAME_NOT_FOUND` — not a live daily game.
- `429` `RATE_LIMITED` — 30/min per IP.

### GET /healthz, GET /readyz

Platform healthcheck probes (Railway/Render; the Dockerfile healthcheck
hits `/readyz`).

- `/healthz` — `200` `{ "status": "ok" }` (process up).
- `/readyz` — `200` `{ "status": "ready" }` when PostgreSQL answers
  `SELECT 1`; `503` `{ "status": "not-ready" }` otherwise.

## 3. Validation rules (shared)

| Field                         | Rule                                                     |
| ----------------------------- | -------------------------------------------------------- |
| `gameId`                      | string, 1–64 chars                                       |
| `playerName` / `nickname`     | control chars stripped, trimmed, 1–20 chars              |
| `score`                       | integer, 0–1,000,000                                     |
| `clientKey`                   | 8–128 chars, `[A-Za-z0-9._:-]`                           |
| `memberKey`                   | 8–128 chars, `[A-Za-z0-9-]`                              |
| `roomCode`                    | 6 alphanumeric chars, case-insensitive (`^[a-z0-9]{6}$`) |
| `tier`                        | ≤ 16 chars                                               |
| `durationMs`                  | integer, 0–86,400,000                                    |
| `correctCount` / `totalCount` | integer, 0–10,000; `correct ≤ total`                     |

## 4. Rate limits

Sliding-window, in-memory, per IP per minute (`server/src/lib/rate-limit.ts`;
single-instance topology makes in-memory state correct, D016).

| Bucket        | Limit     | Used by                                        |
| ------------- | --------- | ---------------------------------------------- |
| `scoreSubmit` | 30/min    | `POST /api/scores`                             |
| `dailySubmit` | 30/min    | `POST /api/daily/:gameId/submit`               |
| `roomCreate`  | 10/min    | `POST /api/room/create` + socket `create-room` |
| `memberClaim` | 10/min    | `POST /api/me/claim`                           |
| `joinRoom`    | 20/min    | socket `join-room`                             |
| `chat`        | 60/min    | socket `chat-message`                          |
| `guess`       | 60/min    | socket `send-guess`                            |
| `drawStroke`  | 6,000/min | socket `draw-stroke`                           |

Exceeded → `429` `RATE_LIMITED` (REST) or `ack { ok: false, error: 'RATE_LIMITED' }` (socket).

## 5. Error codes

| Code                | HTTP | Meaning                                   |
| ------------------- | ---- | ----------------------------------------- |
| `INVALID_BODY`      | 400  | Payload failed validation                 |
| `INVALID_GAME_ID`   | 400  | `gameId` shape invalid                    |
| `INVALID_ROOM_CODE` | 400  | `roomCode` shape invalid                  |
| `GAME_NOT_FOUND`    | 404  | Unknown `gameId` / not a live daily game  |
| `ROOM_NOT_FOUND`    | 404  | Unknown room                              |
| `MEMBER_NOT_FOUND`  | 404  | No profile for the `memberKey`            |
| `RATE_LIMITED`      | 429  | Bucket exhausted                          |
| `NOT_FOUND`         | 404  | Unknown `/api/*` route                    |
| `INTERNAL`          | 500  | Unhandled error (stack traces never leak) |

## 6. Socket.io

- Same origin as the REST API (`/socket.io`), CORS governed by `CORS_ORIGIN`.
- Every client→server event takes a payload and an optional ack callback:
  `ack({ ok: true, ... })` on success, `ack({ ok: false, error: 'CODE', message? })`
  on failure. Failure codes include `INVALID_PAYLOAD`, `RATE_LIMITED`, and
  typed `game-error` codes (`ROOM_FULL`, `NOT_HOST`, `ROUND_LOCKED`, …).
- Event names are the single source of truth in
  `server/src/lib/events.ts`, mirrored by `src/lib/events.ts` (client);
  lockstep is enforced by `src/lib/__tests__/events.contract.test.ts`.
  Never edit one side without the other.
- Game state machines, timers, and per-game phases: see `ARCHITECTURE.md §12`.

### Client → server (`ClientEvents`)

| Event                   | Group                                            |
| ----------------------- | ------------------------------------------------ |
| `create-room`           | Room system (PRD §8.2)                           |
| `join-room`             | Room system (PRD §8.2)                           |
| `leave-room`            | Room system (PRD §8.2)                           |
| `start-game`            | Room system (PRD §8.2)                           |
| `draw-stroke`           | Drawing (PRD §8.2)                               |
| `clear-canvas`          | Drawing (PRD §8.2)                               |
| `undo-stroke`           | Drawing (PRD §8.2)                               |
| `send-guess`            | Chat/guessing (PRD §8.2)                         |
| `chat-message`          | Chat/guessing (PRD §8.2)                         |
| `cast-vote`             | Voting (PRD §8.2)                                |
| `stroke-lift`           | Additive (M5, one-line lift penalty)             |
| `submit-drawing`        | Additive (M5, Copycat private drawings)          |
| `copycat-image-loaded`  | Additive (M13, Copycat reveal sync)              |
| `submit-prompt`         | Additive (M6, player-submitted prompts)          |
| `set-voting-config`     | Additive (M15, NHIE tier/source, TOT genre)      |
| `set-shadow-genre`      | Additive (M15, Shadow Sketch genre)              |
| `guess-who-next`        | Additive (M17, Guess Who advance)                |
| `set-trivia-mode`       | Additive (M8, Trivia room mode)                  |
| `answer-question`       | Additive (M8, Trivia answers + Guess Who yes/no) |
| `mark-correct`          | Additive (M9, Charades)                          |
| `ask-question`          | Additive (M9, Guess Who)                         |
| `set-charades-category` | Additive (M9, Charades)                          |
| `game-resync`           | Additive (rejoin mid-game)                       |
| `choose-word`           | Additive (M4, Skribbl round lifecycle)           |
| `next-round`            | Additive (M4, Skribbl round lifecycle)           |
| `restart-game`          | Additive (M4, Skribbl round lifecycle)           |
| `set-custom-words`      | Additive (M4, Skribbl round lifecycle)           |
| `end-round-now`         | Additive (M4, Skribbl round lifecycle)           |

### Server → client (`ServerEvents`)

| Event                                          | Group                                                       |
| ---------------------------------------------- | ----------------------------------------------------------- |
| `game-state-update`                            | Room system (PRD §8.2)                                      |
| `chat-message`                                 | Chat/guessing (PRD §8.2, echoed)                            |
| `room-created`                                 | Room lifecycle                                              |
| `player-joined` / `player-left`                | Room lifecycle                                              |
| `player-disconnected` / `player-reconnected`   | Room lifecycle                                              |
| `host-changed` / `room-closed`                 | Room lifecycle                                              |
| `round-start` / `round-end` / `round-reveal`   | Round lifecycle                                             |
| `guess-reveal`                                 | Round lifecycle (M17, Guess Who)                            |
| `game-end` / `game-restart`                    | Round lifecycle                                             |
| `stroke-replay` / `canvas-snapshot`            | Drawing                                                     |
| `draw-stroke` / `undo-stroke` / `clear-canvas` | Drawing (echoed to the room)                                |
| `guess-result` / `guess-feedback`              | Guessing                                                    |
| `round-hint`                                   | Drawing hints (Skribbl: first letter at 30 s, last at 45 s) |
| `vote-update` / `vote-reveal`                  | Voting                                                      |
| `round-timer` / `vote-start`                   | Timers (M5)                                                 |
| `game-error`                                   | Typed errors                                                |

## 7. Client reference (`src/lib/`)

- `api.ts` — typed REST client. `submitScore()` retries on network errors and
  5xx only (never 4xx), 2 retries, exponential backoff (250 ms × 2^n), and
  never re-sends a new `clientKey` for the same completed game.
  `fetchLeaderboard(gameId, period, limit)` covers the leaderboard endpoint.
- `events.ts` — socket event name mirror (see §6).
- `member.ts` — Phase 1.5 member client (claim, read-model, daily submit).
