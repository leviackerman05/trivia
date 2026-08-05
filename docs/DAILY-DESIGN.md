# Daily Design: Geography, Movies, Music, Drawing (4 Coming-Soon Dailies)

> Engineering design (2026-08-05), Tech Lead deliverable. Source of truth:
> `docs/DAILY-SCOPE.md` (product scope, owner decisions §0, defaults slate
> confirmed §9). Data models are used verbatim from `docs/CONTENT-SOURCING.md`.
> The pattern to extend: Phase A daily seeding (D050) + `DailyRun`
> idempotency (D049). **Design only — no production code in this doc.**
>
> Parallel track: the design-merge branch (theme/pills/gradients, token
> layer) runs in parallel and is **not** a dependency. This phase does not
> touch `src/styles/global.css` or the design-system kit in
> `src/components/ui/`.

---

## 0. Resolved open items (the three RESOLVE gates from the handoff)

### R1 — Flag idempotency: `@@unique([submissionId, memberKey])` ✅ resolved

The scope's `DrawingSubmission.flagCount` int alone is flag-spammable (one
member flags 1,000× → auto-hide). **Resolution:** a third table
`DrawingFlag` with `@@unique([submissionId, memberKey])` — one flag per
member per submission, enforced by the database. `flagCount` stays on the
submission as a denormalized counter, maintained in the same transaction as
flag creation. A duplicate flag is acknowledged idempotently (200, no
double count) — same contract as `DrawingVote`. The unique constraint is
the real anti-spam gate; the 20/min per-IP rate limiter is a secondary
fence.

### R2 — `express.json` body-size limit: verified and resolved ✅

Verified in `server/src/app.ts` L26: the global parser is
`express.json({ limit: '32kb' })` (not 100 KB), registered **before** the
API router. Any body > 32 KB is rejected by the global parser before a
route-scoped parser inside the router could ever see it.

**Resolution — route-scoped parser registered before the global one, in
`app.ts`:**

```ts
app.use(cors({ origin: resolveCorsOrigin() }));
// Large-payload routes only: drawing uploads carry a ≤1 MB base64 PNG
// (decoded); everything else stays under the 32 kb cap.
app.use('/api/drawing', express.json({ limit: '1.5mb' }));
app.use(express.json({ limit: '32kb' }));
```

- Express's `body-parser` sets `req._body` on first parse, so the global
  32 KB parser skips already-parsed `/api/drawing/*` bodies and still
  enforces the cap on every other route. `Content-Type: application/json`
  is required (the client `apiFetch` always sends it).
- **Second required fix:** the global error middleware (`app.ts` L33-36)
  currently maps **every** error to 500 `INTERNAL`. A `413 Payload Too
Large` from the 1.5 MB parser would be masked as 500. Extend the
  middleware to preserve parser status codes (body-parser sets
  `error.status` / `error.statusCode`):

  ```ts
  const status = typeof error.status === 'number' ? error.status : 500;
  res.status(status).json({ error: { code: status === 413 ? 'PAYLOAD_TOO_LARGE' : 'INTERNAL', ... } });
  ```

  This is additive and benefits every route (oversized score bodies today
  also return 500 instead of 413).

- Alternative rejected: raising the global limit (weakens all endpoints,
  defeats the early-reject comment in `app.ts`).

### R3 — Gallery read payload size: `take 50` + `total` ✅ resolved

**Resolution:** `GET /api/drawing/submissions` returns the top **50**
visible submissions by `votes desc, createdAt asc` (stable tie-break) plus
`total` (all visible submissions for the day, for UI copy). No offset
pagination in v1 — the top-50-by-votes surface is the product; the day
gallery is bounded by daily active users.

Payload math (documented, see Risks): 50 × (≤1 MB base64 worst case) is
only reachable if every upload hits the byte cap; in practice a 1024 px
flat-color drawing PNG is 50–250 KB → 2.5–12.5 MB worst-ish JSON. The
island mitigates client-side: `<img loading="lazy">` (browser only decodes
near-viewport images) and initial render of the top 20 with a "Show more"
button up to the 50 cap. Votes re-fetch only the JSON (image URLs are
stable, browser-cached).

Also resolved here: the scope's minimal row shape
`{ id, playerName, image, votes }` cannot express the acceptance criteria
("own submission visible with a 'yours' marker"; "duplicate votes
idempotent" needs a "voted" indicator). **Additive fields:** the GET
accepts an optional `?memberKey=` and returns per-row `mine` and `voted`
booleans. No server-side memberKey lookup beyond the two EXISTS checks.

---

## 1. Architecture

### 1.1 Overview

Four new daily games on the existing Phase A platform: a deterministic
client-side seeded pick (D050) + the `SoloShell` frame (header, streak,
leaderboard, share card, member submit) + the Phase 1.5 submit pipeline.
Three of them (geography, movies, music) are **pure client engines** —
same shape as Emoji Plot: a pick function, an island, a dataset, zero new
server code beyond the `LIVE_DAILY_GAMES` flip. Drawing is the one
**server-persisted user-content subsystem**: canvas → upload → gallery →
vote/flag, with a new router, two new tables, and four new endpoints.

```mermaid
flowchart TD
    subgraph Client (Astro MPA + islands)
        A[daily/[slug].astro] -->|dailyDateKey + dailyGameSeed| B[GeographyDaily]
        A -->|dailyDateKey + dailyGameSeed| C[MoviesDaily]
        A -->|dailyDateKey + dailyGameSeed| D[MusicDaily]
        A -->|dailyDateKey + dailyGameSeed| E[DrawingDaily]
        B --> F[SoloShell: streak / leaderboard / share card / member submit]
        C --> F
        D --> F
        E --> F
        E --> G[canvas.ts exportCanvasPng ≤1024px]
    end

    subgraph Server (Express + Prisma)
        H[POST /api/daily/:gameId/submit] --> I[(DailyRun + DailyStreak)]
        J[POST /api/drawing/submissions] --> K[(DrawingSubmission)]
        L[GET /api/drawing/submissions] --> K
        M[POST /api/drawing/submissions/:id/vote] --> K
        N[POST /api/drawing/submissions/:id/flag] --> K
        O[DELETE /api/drawing/submissions/:id ADMIN_TOKEN] --> K
    end

    F --> H
    G --> J
    J --> L
    M --> L
```

### 1.2 Invariants (non-negotiable, carried from the scope)

1. **Same UTC day + same slug ⇒ identical rounds for everyone**; replay of
   the day is stable; consecutive days differ. All balance rules layer on
   the same seed and never use `Math.random`.
2. **No repeats within a day**: 10 distinct entries per round-game; one
   prompt for drawing.
3. **One run per member per game per day** — the `DailyRun` idempotency
   contract (D049) is untouched. Drawing submits score a flat 100 with
   `totalCount: 1` (or omitted) — no special-casing in
   `server/src/routes/daily.ts` (verified: `validateDailySubmitInput` is
   already generic).
4. **No new dependencies, no audio, no copyrighted content** (PRD §2/§13):
   images are Wikimedia `Special:FilePath` hotlinks with credits on reveal;
   drawings store in Postgres text (R2 is the documented scale path, out of
   scope).
5. **Additive schema only** (D006): `DailyRun`/`DailyStreak`/`Score`/
   `UserProfile` untouched.
6. **Design-merge parallel track**: no edits to `src/styles/global.css` or
   `src/components/ui/*`; `src/components/DrawingCanvas.tsx` is a game
   component and is reused read-only (no restyle).

---

## 2. Shared engine contract

### 2.1 `pickDistinct` (new, `src/lib/pick.ts`)

The Phase A pick pattern (`pickEmojiQuestions`, `src/lib/emoji-plot.ts`
L45-60) is a deterministic cursor shuffle: `index = cursor % pool.length`,
splice, `cursor += 1`. Extract it once, untouched in behavior:

```ts
export function pickDistinct<T>(entries: T[], count: number, seed: number): T[];
```

- New games use it; `emoji-plot.ts` is **not** refactored this milestone
  (avoid churn on a live game — optional cleanup, flagged, not required).
- Pool-edge contract (shared): when `entries.length < count`, returns all
  entries in seeded order (the existing behavior — the island must render
  fewer rounds gracefully; daily runs still submit with `totalCount` =
  rounds actually played).

### 2.2 Deterministic secondary values

Balance rules need more entropy than one integer seed. Convention: derive
sub-seeds with the existing `hashString` (`src/lib/trivia.ts`, FNV-1a):

```ts
hashString(`${seed}:music-tiers`); // tier sub-seeds
hashString(`${seed}:real-count`); // movies real count
```

Every sub-value is a pure function of `(dateKey, slug)` — determinism
preserved by construction, covered by the per-game tests over N
consecutive dates.

### 2.3 Island wiring (Phase A pattern, unchanged)

`[slug].astro` passes `dailyDateKey`; the island computes
`dailyGameSeed(dateKey, slug)` and calls the picker. Non-daily reuse (solo
mode) may pass a random seed — the four games ship **daily-only** this
milestone (no solo-mode change, per scope §1.1).

---

## 3. Engine designs

### 3.1 Geography — "Where in the World?"

**Concept:** photo + 4-option MC; hint after a wrong guess; one retry;
credit line on reveal. 10 rounds/day.

**Data** (`src/data/daily-geography.json`, 120 entries, verbatim from
CONTENT-SOURCING §1): `{ place, url, credit?, options[4], answer, hint,
region }`. `answer` = index into `options`. Region buckets: `africa`,
`americas`, `asia`, `europe`, `oceania`, quota ≥10 each.

**Pick function** — `pickGeographyRounds(entries, count = 10, seed)`:

1. Base pick: `candidate = pickDistinct(entries, 10, seed)`.
2. **Region cap (≤4 per region per day, P1):** count regions in the
   candidate; if any > 4, re-roll deterministically:
   `candidate = pickDistinct(entries, 10, seed + k * 31)` for `k = 1..63`,
   returning the first valid candidate; after 64 tries return the last
   candidate (deterministic; with ≥10 per bucket and 5 buckets a valid
   subset always exists, so the fallback is a theoretical backstop, not a
   path).
3. Returns the entries in seeded order (round order = array order).

Determinism is preserved: the k-sequence is fixed, no randomness. The
per-day test asserts the cap over 90 consecutive dates.

**Round flow** (island state machine):

```
idle → (pick option) → wrong? → hint shown, one retry allowed → 50 pts if correct now
                     → correct → 100 pts
                     → second wrong → 0 pts
any terminal state → reveal (answer, credit line) → next round
```

- Credit line renders only on reveal, only when `credit.license` is `by`
  or `by-sa`: `Photo: {creator} (CC-{license})`. Absent for PD/CC0
  (`credit` omitted).
- Photo: `<img src={entry.url} loading="lazy" referrerPolicy="no-referrer"
alt="" />` — **`alt` intentionally empty** (a descriptive alt leaks the
  answer to screen-reader users; the question is the 4 options, which are
  real buttons). The round container carries an aria-label.

**Scoring:** 100 first-try correct, 50 after hint, 0 wrong. Max 1000.
Submit the run with `correctCount` / `totalCount: 10` (see §3.5).

**Share card:** name "Daily Geography" flows through `SoloShell` →
`drawScoreImage` (game name + score + date). Credit renders on the round
reveal only, never on the card.

**Files:** `src/data/daily-geography.json`, `src/lib/geography.ts`
(`GeographyEntry`, `pickGeographyRounds`), `src/lib/__tests__/geography.test.ts`,
`src/islands/daily/GeographyDaily.tsx`, `[slug].astro` branch.

### 3.2 Movies — "Real or Fake?"

**Concept:** 10 rounds; each shows one synopsis (real or fake, seeded);
player answers Real/Fake. Feedback names the film + year on both outcomes.

**Data** (`src/data/daily-movies.json`, 300 entries, verbatim from
CONTENT-SOURCING §2): `{ title, year, genre, real, fake, difficulty }`.
The pair IS the round (no `options` field).

**Pick function** — `pickMovieRounds(entries, count = 10, seed)` returns
`MovieRound[] = { entry, shown: 'real' | 'fake', text }`:

1. `entries = pickDistinct(entries, 10, seed)` — 10 distinct films.
2. `realCount = 4 + (hashString(`${seed}:real-count`) % 3)` → **4–6 real
   per day, never a learnable fixed pattern** (a 5/5 day occurs ~⅓ of the
   time as one value of the seeded range, not as the only pattern).
3. Side assignment: build 10 slots, mark the first `realCount` as `real`,
   then shuffle the slots deterministically with the cursor technique
   (`seed2 = hashString(`${seed}:sides`)`). Round order = `entries` order;
   which side shows = the shuffled slot.
4. `text` = the shown side's synopsis.

**Round flow:** show `text` + Real/Fake buttons → feedback (both outcomes:
`Yes — The Godfather, 1972` / `No — it was The Godfather, 1972`) → next.

**Scoring:** 100 per correct, 0 wrong. Max 1000. Submit with
`correctCount` / `totalCount: 10`.

**Share card:** "Daily Movie" through `SoloShell` (name is already
"Daily Movie" in the registry — keep; smoke checks for it).

**Files:** `src/data/daily-movies.json`, `src/lib/movies.ts` (`MoviePair`,
`MovieRound`, `pickMovieRounds`), `src/lib/__tests__/movies.test.ts`,
`src/islands/daily/MoviesDaily.tsx`, `[slug].astro` branch.

### 3.3 Music — "Name That Song"

**Concept:** 10 rounds; clue strip = emoji + year + BPM; 4 title options.
**No audio, no lyrics, no album art** (licensing walls, scope §6).

**Data** (`src/data/daily-music.json`, 120 entries, verbatim from
CONTENT-SOURCING §3): `{ title, artist, year, genre, emoji, bpm, difficulty,
options[4], answer, bpmSource }`. `bpmSource` is internal QA metadata —
**never rendered, never shipped in the picker output** (keep it out of the
round type to guarantee this).

**Pick function** — `pickMusicRounds(entries, count = 10, seed)`
(**stratified** 3 easy / 4 medium / 3 hard):

1. Partition by `difficulty` (1/2/3).
2. `easy = pickDistinct(tier1, 3, hashString(`${seed}:t1`))`,
   `medium = pickDistinct(tier2, 4, hashString(`${seed}:t2`))`,
   `hard = pickDistinct(tier3, 3, hashString(`${seed}:t3`))` — tiers are
   disjoint ⇒ 10 distinct entries.
3. Round order: cursor-shuffle the merged 10 with
   `hashString(`${seed}:order`)`.
4. **Pool-edge fallback** (defensive; the ≥30-per-tier dataset test is the
   P0 gate): if a tier has fewer entries than its quota, take what it has,
   fill the shortfall from the remaining pool via `pickDistinct` over the
   merged leftovers, then re-shuffle. Deterministic in every branch.

Stratification keeps a day from being all deep cuts; difficulty affects
selection, not points (flat 100/round keeps the leaderboard legible).

**Round flow:** clue strip (emoji large, `From {year}`, `{bpm} BPM`) + 4
title buttons → feedback (`{title} — {artist}`) → next. The clue layout
never implies audio: no play buttons, no lyrics anywhere (acceptance
criteria).

**Scoring:** 100 per correct, 0 wrong. Max 1000. Submit with
`correctCount` / `totalCount: 10`.

**Share card:** "Daily Music" through `SoloShell`.

**Files:** `src/data/daily-music.json`, `src/lib/music.ts` (`MusicEntry`,
`MusicRound`, `pickMusicRounds`), `src/lib/__tests__/music.test.ts`,
`src/islands/daily/MusicDaily.tsx`, `[slug].astro` branch.

### 3.4 Drawing — "Prompt of the Day"

**Concept:** one prompt/day; draw on the canvas; submit; vote in the day's
gallery. Gallery is server-persisted user content (§5). Votes rank the
gallery only — **never the daily leaderboard** (the one daily where the
leaderboard is not the social surface).

**Data** (`src/data/daily-drawing-prompts.json`, 150 prompts, verbatim
from CONTENT-SOURCING §4): `{ prompt, emoji, category, difficulty,
constraints? }`.

**Pick function** — `pickDailyPrompt(entries, seed)`: a single
deterministic index — `entries[seed % entries.length]`. (No `count`
parameter; the signature stays `(entries, seed)` per scope §1.1.)

**Session flow** (see §4.3 for the island spec):

```
prompt card (prompt + emoji + category chip + difficulty + constraint chips)
  → drawing phase (reused DrawingCanvas + minimal toolbar, no timer in v1)
  → submit → (1) daily run submit: flat 100, (2) PNG upload (idempotent)
  → done view: SoloShell result frame + gallery (upload retry if failed)
```

**Scoring:** flat **100 completion** via the standard daily submit (one run
per member per day; streak/PB pipeline untouched). `totalCount: 1` or
omitted — no special-casing (§1.2.3). Votes arrive after submission so
they can't be part of the run by construction.

**Share card:** "Daily Drawing" through `SoloShell` (score 100 + streak).
The gallery, not the card, is the drawing social surface.

**Files:** `src/data/daily-drawing-prompts.json`, `src/lib/daily-drawing.ts`
(`DrawingPrompt`, `pickDailyPrompt`, gallery client types),
`src/lib/__tests__/daily-drawing.test.ts`, `src/lib/canvas.ts` (+export
helper), `src/lib/api.ts` (+gallery clients), `src/islands/daily/DrawingDaily.tsx`,
`[slug].astro` branch.

### 3.5 `SoloShell` additive change (all four games)

`SoloShell` currently calls `submitDailyRun` without counts (verified,
`src/islands/solo/SoloShell.tsx` L82-90). The scope requires
`correctCount`/`totalCount` on the run for geography/movies/music.

**Change (additive):** `SoloShell` gains two optional props
`correctCount?: number` and `totalCount?: number`, forwarded to
`submitDailyRun` when defined. Default `undefined` keeps every existing
island byte-identical. The four new islands pass `(correct, 10)`; drawing
passes nothing.

---

## 4. Drawing subsystem — client

### 4.1 Canvas export + dimension cap (`src/lib/canvas.ts`, additive)

Two new exports, pure math separated from DOM for testability:

```ts
export const DRAWING_EXPORT_MAX_DIM = 1024; // longest side, px
export const DRAWING_UPLOAD_MAX_BYTES = 1_000_000; // decoded PNG bytes
export const DRAWING_DATA_URL_MAX_CHARS = 1_400_000; // base64 guard (client mirror of server)

/** Pure, testable: aspect-preserving fit. */
export function fitWithinMaxDim(
  w: number,
  h: number,
  maxDim: number
): { width: number; height: number };

/** DOM: export the canvas element as a downscaled PNG data URL + byte count. */
export async function exportCanvasPng(
  source: HTMLCanvasElement,
  maxDim = DRAWING_EXPORT_MAX_DIM
): Promise<{ dataUrl: string; bytes: number }>;
```

Implementation notes:

- `exportCanvasPng` draws the **source element** (already white-filled and
  replay-consistent per `DrawingCanvas`'s rAF repaint) into an offscreen
  canvas fitted by `fitWithinMaxDim`, then uses `canvas.toBlob('image/png')`
  (async per the scope's "toBlob wrapper") and a `FileReader` → data URL;
  `bytes = blob.size`.
- Why 1024 px: the logical canvas is 800×500; 1024 on the longest side ⇒
  ≤1024×640 px (2.6 MB raw), which compresses to well under 1 MB for
  typical flat-color drawings while keeping stroke detail readable in the
  gallery. The cap is the **longest side**, aspect preserved.
- Client-side guard: if `bytes > DRAWING_UPLOAD_MAX_BYTES`, the island
  shows a "drawing too detailed — simplify and resubmit" state (rare at
  1024 px); the upload is never attempted with an oversized image.
- `DrawingCanvas` itself is **untouched** (it already exposes a
  full-resolution `toDataURL` via its ref handle; the new helper
  downscales — the Copycat path stays on the handle).

### 4.2 API client functions (`src/lib/api.ts`, additive)

All through the existing `apiFetch` (`ApiError` with stable codes):

```ts
export interface DrawingSubmissionInput {
  memberKey: string; playerName: string; dateKey: string;
  promptIndex: number; image: string; // PNG data URL
}
export interface DrawingSubmissionDto {
  id: string; playerName: string; image: string;
  votes: number; mine: boolean; voted: boolean;
}
export interface DrawingGalleryResponse {
  submissions: DrawingSubmissionDto[]; total: number;
}

uploadDrawingSubmission(input, retries = 2): Promise<{ submission: { id, dateKey, promptIndex, playerName, votes } }>
fetchDrawingGallery(opts: { dateKey: string; promptIndex: number; memberKey?: string }): Promise<DrawingGalleryResponse>
voteDrawingSubmission(id: string, memberKey: string): Promise<{ votes: number; duplicate: boolean }>
flagDrawingSubmission(id: string, memberKey: string, reason?: string): Promise<{ flagged: boolean; duplicate: boolean; hidden: boolean }>
```

Retries on upload are safe because the endpoint is idempotent per
(dateKey, memberKey) — same policy as `submitScore` (retry 5xx/network
only, never 4xx).

### 4.3 `DrawingDaily.tsx` island

**Phase machine:** `prompt` → `drawing` → `done`.

- **prompt:** prompt card (prompt text, emoji, category chip, difficulty,
  constraint chips — display-only per scope §2.4), "Start drawing" button.
  **`ensureMemberKey()` runs on island mount** — critical ordering detail:
  React runs child effects before parent effects, so if the key were
  created in the done-phase, `SoloShell`'s done-effect (which reads
  `readMemberKey()`) would have already skipped the server run. Creating it
  at mount guarantees the member run + streak/PB pipeline fires for
  everyone (a device key is not a credential and stores zero PII, D047).
- **drawing:** reused `DrawingCanvas` (strokes in local state) + a minimal
  toolbar reusing `COLOR_PALETTE` / `DEFAULT_COLOR` / `DEFAULT_BRUSH_SIZE`
  from `canvas.ts` (color swatches, brush size, undo last stroke via
  `removeStrokeById`, clear). No timer in v1 (scope §2.4: no timer
  pressure). "Submit drawing" button (disabled while empty).
- **done:** `SoloShell` (score 100; streak/leaderboard/share card/member
  flow all free) with `resultSummary` = the gallery panel:
  - **Upload path (done-effect):** `exportCanvasPng` → `uploadDrawingSubmission`
    → `uploadState: idle | uploading | saved | failed`. A 200 duplicate is
    `saved` (already uploaded — e.g., replay of the day). On `failed`, the
    panel shows "Upload didn't go through — retry" (button re-runs the
    upload; server idempotency makes retries safe).
  - **Gallery:** `fetchDrawingGallery({ dateKey, promptIndex, memberKey })`
    on mount of the done view; renders submissions votes-desc; "yours"
    marker on `mine`; vote button per row (disabled on own, on already
    voted — voted state from `voted`); on vote → optimistic `votes+1` +
    `voted=true`, then JSON re-fetch (images browser-cached).
  - **Flag affordance:** a discreet "Report" button per row (not on own),
    optional one-line reason via `prompt()`, plus the required one-line
    copy under the gallery: **"Report inappropriate drawings — anything
    offensive is hidden after 3 reports."** (TOS language itself is out of
    scope, scope §3.2.)
  - **Pagination cap:** server returns top 50; the island renders the top
    20 with a "Show more" button up to 50; every `<img>` is
    `loading="lazy"`.
  - Empty state: "No drawings yet — be the first!"

**Prompt recap** sits above the gallery in the done view (prompt + emoji)
so voters know what they're judging.

---

## 5. Server design

### 5.1 `server/src/routes/drawing.ts` — endpoints

New router `createDrawingRouter(limiters)` mounted in `createApiRouter`
(`server/src/routes/api.ts`) as `router.use(createDrawingRouter(...))`.
All routes rate-limited with the existing `RateLimiter` (per-IP buckets,
in-memory, D016). Errors use the house shape `{ error: { code, message } }`.

| Method + path                            | Body / query                                             | Success                                                                                                                                        | Errors                                                                                                                     | Rate limit (per IP/min) |
| ---------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `POST /api/drawing/submissions`          | `{ memberKey, playerName, dateKey, promptIndex, image }` | **201** created / **200** existing (idempotent per dateKey+memberKey), `{ submission: { id, dateKey, promptIndex, playerName, votes } }`       | 400 `INVALID_BODY` (validator), 400 `INVALID_DATE` (dateKey outside server-today ±1 day), 413 `PAYLOAD_TOO_LARGE` (parser) | `drawingUpload` 10      |
| `GET /api/drawing/submissions`           | query `dateKey` + `promptIndex` (required), `memberKey?` | 200 `{ submissions: [{ id, playerName, image, votes, mine, voted }], total }` — `status: visible` only, `votes desc, createdAt asc`, `take 50` | 400 `INVALID_BODY`                                                                                                         | `drawingRead` 120       |
| `POST /api/drawing/submissions/:id/vote` | `{ memberKey }`                                          | **201** first vote / **200** duplicate, `{ votes, duplicate }` (count derives from rows, no counter drift)                                     | 400, 404 unknown/not visible, 409 own submission, 429                                                                      | `drawingVote` 60        |
| `POST /api/drawing/submissions/:id/flag` | `{ memberKey, reason? }`                                 | 200 `{ flagged, duplicate, hidden }`; **3 distinct flags → `status: flagged`** (auto-hidden from gallery)                                      | 400 (bad memberKey/reason), 404 unknown/not visible, 409 own submission                                                    | `drawingFlag` 20        |
| `DELETE /api/drawing/submissions/:id`    | header `ADMIN_TOKEN`                                     | 204, sets `status: removed` (never visible again)                                                                                              | 401 `UNAUTHORIZED` (missing/wrong token), 404                                                                              | none (owner-only)       |

**Behavior notes:**

- **Upload idempotency:** `@@unique([dateKey, memberKey])` — insert, on
  `P2002` return the existing row with 200. Mirrors the `DailyRun`
  by-day-unique pattern (D049). The route also upserts `UserProfile`
  (nickname, `lastSeenAt`) exactly like `routes/daily.ts` L79-83, so a
  fresh device key becomes a member profile on first upload.
- **dateKey window:** the server accepts `dateKey` ∈ server-UTC-today
  ±1 day (clock-skew tolerance around midnight UTC; the daily submit
  precedent is server-date-wins, but the gallery is client-seeded so a
  small tolerance beats a midnight failure class). Anything else → 400
  `INVALID_DATE`. This bounds cross-day gallery pollution to ±1 day.
- **Vote:** transaction `{ create DrawingVote → count votes → update
submission.votes }`; `P2002` on the unique key ⇒ duplicate, return
  current count. Own submission (`submission.memberKey === memberKey`) ⇒
  409 before the insert.
- **Flag:** same shape as vote (unique row, count, update `flagCount`);
  when `flagCount >= 3` also set `status: flagged`. The invariant that
  matters — one flag per member per submission — is the DB unique
  constraint; a concurrent third flag is idempotent-outcome (both writers
  set the same status).
- **Reads:** `visible` only, ordered `votes desc, createdAt asc`, `take
50`; `total` = count of visible rows for (dateKey, promptIndex). `mine`
  = `submission.memberKey === memberKey`; `voted` = EXISTS
  `DrawingVote(submissionId, memberKey)` (one batched query, not N+1).
- **Admin delete:** compares the `ADMIN_TOKEN` request header against
  `config.adminToken` (env `ADMIN_TOKEN`, read in `server/src/lib/config.ts`
  as `adminToken: readEnv('ADMIN_TOKEN') ?? ''`). Missing/unset token or
  mismatch → 401. No admin UI (curl-level, scope §6).

### 5.2 Rate limiter additions (`server/src/lib/rate-limit.ts`)

`Limiters` interface gains `drawingUpload`, `drawingVote`, `drawingFlag`,
`drawingRead`; `createDefaultLimiters()` provides the values from §5.1.
`createApiRouter` passes them into `createDrawingRouter`. (Values are
generous because the unique constraints are the real gates.)

### 5.3 Validators (`server/src/lib/validation.ts`, +3, house style)

1. `validateDrawingSubmissionInput` → `{ memberKey, playerName, dateKey,
promptIndex, image }`:
   - `memberKey` — `isMemberKey` (existing); `playerName` —
     `sanitizeNickname` (existing); `dateKey` — `isDateKey` (existing),
     then the ±1-day window check at the route level (needs the clock).
   - `promptIndex` — integer, `0 ≤ n ≤ 10_000` (the server has no dataset;
     the client seed is the source of truth).
   - `image` — must match `^data:image/png;base64,[A-Za-z0-9+/=\s]+$`;
     base64 payload length ≤ `1_400_000` chars; **and** decoded via
     `Buffer.from(payload, 'base64')`: length ≤ 1,000,000 bytes and the
     PNG signature (`89 50 4E 47 0D 0A 1A 0A`) present. This makes the
     size cap real (chars ≠ bytes) and rejects non-PNG data URLs without
     image decoding.
2. `validateDrawingVoteInput` → `{ memberKey }` (memberKey only — same
   shape family as `ClaimInput`).
3. `validateDrawingFlagInput` → `{ memberKey, reason? }` — reason
   optional, sanitized (strip control chars), ≤ 200 chars.

Plus `isSubmissionId` (param guard): `/^[A-Za-z0-9]{8,64}$/` (Prisma
cuid-shaped; loose enough to survive id-format changes, strict enough to
reject path garbage).

---

## 6. Database changes (Prisma, additive — D006)

New migration `add_drawing_gallery` (additive: two new models, no column
changes to any existing model).

```prisma
model DrawingSubmission {
  id          String    @id @default(cuid())
  dateKey     String // UTC "YYYY-MM-DD" (matches dailyDateKey)
  promptIndex Int
  memberKey   String // device memberKey (D047); not a credential
  playerName  String // sanitized, ≤20 chars (sanitizeNickname)
  image       String // PNG data URL, ≤1 MB decoded; client downscales to ≤1024 px
  votes       Int       @default(0) // denormalized; derives from DrawingVote rows
  flagCount   Int       @default(0) // denormalized; derives from DrawingFlag rows
  status      String    @default("visible") // visible | flagged | removed
  createdAt   DateTime  @default(now())

  votes       DrawingVote[]
  flags       DrawingFlag[]

  // One submission per member per day — idempotent uploads (D049 pattern).
  @@unique([dateKey, memberKey])
  // Gallery query: (dateKey, visible) filtered, ordered by votes desc.
  // votes included in the index per ARCHITECTURE §11 implementation notes.
  @@index([dateKey, status, votes])
}

model DrawingVote {
  id           String            @id @default(cuid())
  submissionId String
  submission   DrawingSubmission @relation(fields: [submissionId], references: [id], onDelete: Cascade)
  memberKey    String
  createdAt    DateTime          @default(now())

  @@unique([submissionId, memberKey]) // one vote per member per submission (R1)
  @@index([memberKey]) // votedByMe lookups for the gallery read
}

model DrawingFlag {
  id           String            @id @default(cuid())
  submissionId String
  submission   DrawingSubmission @relation(fields: [submissionId], references: [id], onDelete: Cascade)
  memberKey    String
  reason       String? // sanitized, ≤200 chars
  createdAt    DateTime          @default(now())

  @@unique([submissionId, memberKey]) // one flag per member per submission (R1)
  @@index([submissionId])
}
```

Rationale notes:

- **`@@index([dateKey, status, votes])`** refines the scope's
  `@@index([dateKey, status])` — same query, ordering column appended
  (allowed: ARCHITECTURE §11 indexes are implementation notes, additive).
- **Votes/flags as rows + denormalized counters** — rows are the source of
  truth (no counter drift, R1); counters make the top-50 read and the
  3-flag check cheap.
- **Cascade delete** — deleting a submission removes its votes/flags; the
  admin DELETE path only flips status (rows are kept for audit), so
  cascade is a hygiene guard, not the moderation path.
- **Storage note:** `image` as Postgres `text` is the documented MVP
  (scope §6: R2 revisit at gallery scale). 1 MB cap × active users is the
  flagged capacity risk (§12).

---

## 7. Registry + surface updates

| Surface                                               | Change                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/daily.ts`                                    | 4 entries → `live: true`; drop `gameSlug`; final descriptions (remove "Coming in the next milestone"); `estimatedMinutes`: geography/movies/music 5, **drawing 10** (currently 5)                                                                                                                             |
| `src/pages/daily/index.astro`                         | "Eight challenges" → **"Twelve challenges"**; meta description enumerates the new games; wrap the "Coming to the daily hub" section in `{plannedGames.length > 0 && …}` (it will render nothing)                                                                                                              |
| `src/pages/index.astro`                               | Daily strip auto-updates (`liveDaily.slice(0,3)`) — verify only; hero/meta copy already generic (verified: no per-game enumeration in hero/meta)                                                                                                                                                              |
| `public/sitemap.xml`                                  | +4 URLs: `/daily/geography`, `/daily/movies`, `/daily/music`, `/daily/drawing` — `changefreq daily`, `priority 0.9`, `lastmod` today                                                                                                                                                                          |
| `scripts/smoke.mjs`                                   | +4 checks: `/daily/geography` → "Daily Geography", `/daily/movies` → "Daily Movie", `/daily/music` → "Daily Music", `/daily/drawing` → "Daily Drawing"; add `/daily/drawing` to `weightChecks` (heaviest new page); island-bundle budget re-verified by the existing loop (remote photo URLs are not bundled) |
| `src/lib/__tests__/daily.test.ts`                     | 8 → **12 live**; assert zero planned (the current test maps "every planned game" — flip to assert `getPlannedDailyGames()` is empty)                                                                                                                                                                          |
| `src/lib/__tests__/games.test.ts`                     | Lockstep passes automatically once both registries are updated — no edit                                                                                                                                                                                                                                      |
| Share card                                            | Names flow via `SoloShell` → `drawScoreImage`; verify the four names read well on the 1080×540 card (all short — expected fine, no engine change)                                                                                                                                                             |
| `/daily/archive.astro`, `DailyHubStatus`, `DailyCard` | Registry-driven — verify, expect no change                                                                                                                                                                                                                                                                    |

---

## 8. Integration checklist (DoD gates)

1. **Lockstep green:** `src/lib/__tests__/games.test.ts` asserts client
   live set == server `LIVE_DAILY_GAMES` — 12 = 12, zero planned.
2. **`pnpm verify` green** — client + server suites, lint, format,
   typecheck, build, smoke (CI convention).
3. **Sitemap + smoke:** 4 new URLs present; 4 new smoke checks pass;
   `/daily/drawing` under the 100 KB page-weight budget; all island
   bundles under 300 KB.
4. **`[slug].astro` branches:** 4 new render branches; the planned
   fallback branch remains (registry-driven, harmless while
   `getPlannedDailyGames()` is empty).
5. **Homepage strip:** `/` renders 3 live dailies incl. the new ones
   (registry-driven) — verified in smoke (existing `/` check) + manual.
6. **Hub copy:** "Twelve challenges"; no empty coming-soon section.
7. **No regressions to the 8 live dailies** — full suite is the gate.
8. **Design-merge isolation:** zero diffs in `src/styles/global.css` and
   `src/components/ui/*` in this branch (diff review gate).

---

## 9. Test plan deltas

### Client unit (vitest, `src/lib/__tests__/`)

- **`geography.test.ts`** — entry shape; seed determinism (same date/slug
  ⇒ identical rounds; consecutive days differ); **region cap ≤4 per day
  over 90 consecutive dates**; pool-edge (pool < 10 ⇒ fewer rounds, no
  crash); dataset QA: ≥120 entries, ≥10 per region bucket, `answer` ∈
  `[0,3]`, unique `place`, `options` contains `place` at `answer`.
- **`movies.test.ts`** — determinism; **real count ∈ 4..6 over 90 dates,
  and not 5 every day**; 10 distinct entries per day; dataset QA: ≥300
  entries, tiers populated, unique titles, both synopses non-empty and
  length-bounded.
- **`music.test.ts`** — determinism; **tier mix exactly 3/4/3 per day**;
  10 distinct entries; **pool-edge fallback** (tier shortfall filled,
  deterministic); dataset QA: ≥120 entries, ≥30 per tier, 4 options with
  answer index, `bpm` integer, `bpmSource` present (internal QA).
- **`daily-drawing.test.ts`** — `pickDailyPrompt` determinism (same day ⇒
  same prompt, days differ); prompt shape; dataset QA: ≥150 prompts,
  unique, balanced categories, difficulty 1–3, `constraints ⊆
{no_text, no_letters}`, **trademark blocklist gate** (no entry contains
  any token from a curated list: "mickey", "pokémon", "disney", "marvel",
  "star wars", "harry potter", "nike", … — a smoke gate, not a legal
  review).
- **`canvas.test.ts`** (additive) — `fitWithinMaxDim` math (aspect
  preservation, ≤maxDim on longest side, no upscale of smaller canvases);
  the DOM export helper is covered at the island level (node env has no
  canvas).

### Server integration (vitest + supertest + test Postgres, house pattern)

- **`drawing.integration.test.ts`** (new, mirrors `routes.integration.test.ts`):
  - Upload: 201 create; **200 idempotent** (same memberKey+dateKey, count
    stays 1); invalid bodies 400 (bad memberKey/dateKey/image not a PNG
    data URL); **oversized image 400** (base64 > 1.4M chars) and
    **oversized body 413** (via the 1.5 MB route parser); dateKey outside
    ±1 day → 400 `INVALID_DATE`.
  - Gallery GET: visible-only (flagged/removed excluded); votes desc,
    createdAt asc tie-break; `total` correct; `take 50` cap; `mine` /
    `voted` flags with and without `?memberKey=`.
  - Vote: 201 first, 200 duplicate (no double count — votes column equals
    row count); **409 own submission**; 404 unknown/flagged; 429 with a
    small-limiter app (house pattern).
  - Flag: 200 new flag; duplicate flag idempotent; **3 distinct flags from
    3 members → status flagged + excluded from GET**; 409 own; reason
    sanitized.
  - Admin delete: 204 with `ADMIN_TOKEN` header → removed + excluded;
    **401 missing/wrong token**; 404 unknown.
  - Rate limits: upload/vote/flag/read limiter tests (small-limiter app).
- **`routes.integration.test.ts`** (extend): one representative new game
  (e.g. `geography`) — submit accepted → run recorded, streak + PB visible
  via `/api/me` (the submit path is shared; per-game server logic is zero,
  scope §3.1).
- **`identity.integration.test.ts`**: unchanged (submit path untouched).

### Lockstep / registry

- `daily.test.ts` 8 → 12 + zero planned; `games.test.ts` auto-green.

---

## 10. Task briefs (file-level, for the next handoffs)

> Each task lists files + acceptance criteria. All work must keep `pnpm
verify` green at every PR (datasets land with their QA tests in the same
> PR — engines develop against small sample JSONs with no volume tests yet;
> see sequencing §11).

### 10.1 Backend Engineer brief

**B1 — Schema + migration**

- Files: `server/prisma/schema.prisma` (+2 models per §6), migration
  `add_drawing_gallery`, `pnpm --filter @triviahub/server db:migrate`.
- Acceptance: migration applies cleanly to a fresh DB; existing tables
  untouched; `prisma generate` succeeds; unique/index constraints per §6.

**B2 — Validators**

- Files: `server/src/lib/validation.ts` (+`isSubmissionId`,
  `validateDrawingSubmissionInput`, `validateDrawingVoteInput`,
  `validateDrawingFlagInput` per §5.3).
- Acceptance: unit-tested shapes (valid/invalid cases); image rules
  (regex, char cap, decoded-byte cap, PNG signature) enforced; reuses
  `isMemberKey`, `isDateKey`, `sanitizeNickname` — no duplicated logic.

**B3 — Rate limiters**

- Files: `server/src/lib/rate-limit.ts` (+4 limiters per §5.2).
- Acceptance: `Limiters` interface + defaults; existing tests green.

**B4 — Drawing router**

- Files: `server/src/routes/drawing.ts` (new), `server/src/routes/api.ts`
  (mount), `server/src/lib/config.ts` (+`adminToken`), `server/src/app.ts`
  (route-scoped 1.5 MB parser **before** the global 32 KB parser +
  error-middleware status preservation per R2).
- Acceptance: all 5 endpoints behave per §5.1; idempotency via unique
  constraints (P2002 → 200); 409 own-submission; 3-flag auto-hide; admin
  delete gated by `ADMIN_TOKEN`; dateKey ±1-day window; `UserProfile`
  upsert on upload; error shape `{ error: { code, message } }` everywhere;
  413 surfaces as `PAYLOAD_TOO_LARGE`, not 500.

**B5 — Daily registry + integration tests**

- Files: `server/src/lib/daily-games.ts` (+4 slugs, 12 total),
  `server/src/__tests__/drawing.integration.test.ts` (new),
  `server/src/__tests__/routes.integration.test.ts` (extend: one new game
  submit → streak/PB).
- Acceptance: lockstep green (12 = 12); all §9 server test cases pass;
  `pnpm --filter @triviahub/server test` green.

### 10.2 Frontend Engineer brief

**F1 — Shared pick helper**

- Files: `src/lib/pick.ts` (new, `pickDistinct`), `src/lib/__tests__/pick.test.ts`.
- Acceptance: matches `pickEmojiQuestions` behavior on the same seed
  (golden test); pool-edge returns all entries; `emoji-plot.ts` untouched.

**F2 — Geography engine**

- Files: `src/data/daily-geography.json` (sample 12+ to start; full 120
  with the authoring PR), `src/lib/geography.ts`,
  `src/lib/__tests__/geography.test.ts`.
- Acceptance: §9 geography tests green (determinism, region cap over 90
  days, pool-edge, dataset QA when full).

**F3 — Movies engine**

- Files: `src/data/daily-movies.json`, `src/lib/movies.ts`,
  `src/lib/__tests__/movies.test.ts`.
- Acceptance: §9 movies tests green (4–6 real mix, determinism).

**F4 — Music engine**

- Files: `src/data/daily-music.json`, `src/lib/music.ts`,
  `src/lib/__tests__/music.test.ts`.
- Acceptance: §9 music tests green (3/4/3 tiers, pool-edge fallback).

**F5 — Drawing engine (client)**

- Files: `src/data/daily-drawing-prompts.json`, `src/lib/daily-drawing.ts`
  (+`pickDailyPrompt`, gallery DTOs), `src/lib/__tests__/daily-drawing.test.ts`.
- Acceptance: §9 drawing tests green (determinism, trademark blocklist
  when full).

**F6 — Canvas export + API clients**

- Files: `src/lib/canvas.ts` (+`fitWithinMaxDim`, `exportCanvasPng`,
  constants), `src/lib/__tests__/canvas.test.ts`,
  `src/lib/api.ts` (+4 clients per §4.2).
- Acceptance: dimension math tested; export yields a PNG data URL ≤1 MB
  for a maxed 1024 px canvas; clients map `ApiError` codes; no changes to
  existing `api.ts` behavior.

**F7 — Islands + page wiring**

- Files: `src/islands/daily/GeographyDaily.tsx`, `MoviesDaily.tsx`,
  `MusicDaily.tsx`, `DrawingDaily.tsx` (new),
  `src/islands/solo/SoloShell.tsx` (+`correctCount`/`totalCount` optional
  props, default undefined), `src/pages/daily/[slug].astro` (+4 branches).
- Acceptance: all four games playable end-to-end on `/daily/<slug>` in
  daily mode; drawing: prompt → canvas (reused `DrawingCanvas`, toolbar,
  undo/clear) → submit (run 100 + upload) → gallery (top 20 + show more,
  vote, flag, "yours" marker, retry on failed upload); credit line on
  geography reveal; feedback names film+year (movies) and song+artist
  (music); no audio/lyrics UI anywhere; existing islands unchanged.

**F8 — Registry + surface + smoke**

- Files: `src/lib/daily.ts` (flips per §7), `src/pages/daily/index.astro`,
  `src/pages/index.astro` (verify only), `public/sitemap.xml`,
  `scripts/smoke.mjs`, `src/lib/__tests__/daily.test.ts`.
- Acceptance: 12 live / zero planned; "Twelve challenges"; no empty
  coming-soon section; sitemap + smoke updated; `/daily/drawing` weight +
  bundle budgets green; full `pnpm verify` green.

**F9 — Content authoring (parallel, non-blocking)**

- Files: the four datasets filled to target (120/300/120/150 + `bpmSource`
  per entry) + dataset QA tests activated per §9.
- Acceptance: all dataset QA tests green (volume, quotas, uniqueness,
  license checks per `CONTENT-SOURCING` §QA: credit present ⇔ license
  requires it; every `Special:FilePath` URL returns 200 at authoring time;
  movies fake-vs-real-third-film review pass; music two-source checks;
  drawing trademark blocklist).

---

## 11. Sequencing + estimates

**Order (from scope §8, confirmed):**

1. **Track 1 (blocking):** B1–B4 server (schema → validators → limiters →
   router) and F1–F7 engines + islands in parallel (independent write
   sets; the two meet at the drawing endpoints — coordinate the contract
   from §5.1, both sides implement to the table, the integration test is
   the referee).
2. **Track 2 (parallel, non-blocking):** F9 content authoring (the long
   pole: 690 entries).
3. **Track 3 (last, single PR):** F8 registry/surface/smoke + lockstep
   flip (12/12) + full-dataset swap + `pnpm verify` green.

| Workstream         | Files                                                                                                                                          | Size         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Geography engine   | dataset, `lib/geography.ts`, test, island, `[slug].astro`                                                                                      | M            |
| Movies engine      | dataset, `lib/movies.ts`, test, island, `[slug].astro`                                                                                         | M            |
| Music engine       | dataset, `lib/music.ts`, test, island, `[slug].astro`                                                                                          | M            |
| Drawing engine     | dataset, `lib/daily-drawing.ts`, test, island, `canvas.ts`, `api.ts`, `[slug].astro`, SoloShell props                                          | L            |
| Server             | `daily-games.ts`, `routes/drawing.ts`, `validation.ts`, `rate-limit.ts`, `config.ts`, `app.ts`, `schema.prisma` + migration, integration tests | M            |
| Registry + surface | `daily.ts`, `daily/index.astro`, `index.astro` (verify), `sitemap.xml`, `smoke.mjs`, `daily.test.ts`                                           | S            |
| Content authoring  | 690 entries + QA tests                                                                                                                         | L (parallel) |

---

## 12. Risks

| #   | Risk                                                                                                             | Mitigation                                                                                                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Gallery payload size** — 50 base64 images in one JSON (worst ~12 MB)                                           | 1024 px client cap + server 1 MB/1.4M-char caps; `take 50`; lazy images; top-20 initial render. R2/thumbnails at scale (scope §6)                                           |
| 2   | **Inappropriate content visibility** — no pre-approval; a bad drawing is visible until 3 flags                   | Low threshold (3), per-day rotation bounds exposure to the day; PG prompt tone (owner §0); "report" line ships; owner curl removal; revisit pre-approval if AdSense objects |
| 3   | **memberKey spoofing** — votes/flags/claims are keyed by a device key, not a credential (D047)                   | Accepted at v1 (same trust model as the leaderboard); unique constraints stop single-key spam; rate limits bound the rest. Real auth is a Phase C+ decision                 |
| 4   | **Wikimedia hotlink breakage** — a renamed file kills a daily silently                                           | Authoring-time 200 checks (scope §7, the author is the gate); automated CI check flagged, not blocking                                                                      |
| 5   | **Midnight-UTC clock skew** — client seed day ≠ server day near 00:00 UTC                                        | ±1-day dateKey tolerance on upload; daily-submit precedent (server date wins for runs)                                                                                      |
| 6   | **413 masked as 500** — the global error middleware flattens parser errors                                       | R2: preserve `error.status` in the error middleware (in the server brief)                                                                                                   |
| 7   | **Body-limit regression** — a future route added after the global parser assumes 32 KB applies to `/api/drawing` | Path-scoped parser sits before the global one; comment in `app.ts` documents the ordering; integration test asserts 413 on oversize                                         |
| 8   | **Bundle budget** — DrawingDaily (canvas + gallery + API) is the heaviest island                                 | Smoke bundle gate (300 KB) + page-weight gate; gallery images are runtime data URLs, not bundle; keep the island lean                                                       |
| 9   | **DrawingCanvas regression** — room games share the component                                                    | Read-only reuse; no edits to `DrawingCanvas.tsx` this milestone (export lives in `canvas.ts`); room-game suites (socket integration tests) are the regression gate          |
| 10  | **Data URL images in lists** — 50 `<img>` data URLs is mobile memory pressure                                    | Lazy loading + top-20 initial render; R2/thumbnails at scale                                                                                                                |
| 11  | **Authoring volume** (690 entries) — the long pole; engines need samples                                         | Engines develop against sample JSONs with fixture-based tests; full datasets + QA tests land in one authoring PR before the verify gate                                     |
| 12  | **Design-merge branch conflicts** — parallel theme work touches the shell                                        | Explicit no-touch fence (`global.css`, `src/components/ui/*`) is a diff-review gate in this branch (scope §0)                                                               |
| 13  | **"Daily Movie" naming** — registry name is singular ("Daily Movie")                                             | Confirmed by the scope's smoke spec (`/daily/movies` → "Daily Movie"); keep, do not rename                                                                                  |
