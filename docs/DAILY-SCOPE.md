# Daily Scope: 4 Coming-Soon Daily Games

> Product scope (2026-08-05) for the four `live:false` daily games in
> `src/lib/daily.ts`: **geography, movies, music, drawing**. Inputs:
> `docs/CONTENT-SOURCING.md` (data models, sizes, licensing — models used
> verbatim), `docs/DESIGN-MERGE.md` (context only), `docs/TODO.md` Phase A
> (the pattern to follow), `docs/PROJECT_STATE.md` (identity/streaks).
> Audience: a Tech Lead designs from this; a content author writes from
> §7. Zero open product questions except §9 (escalated with
> recommendations).

---

## 0. Owner decision log (2026-08-05)

Defaults as recommended in the research docs (confirmed owner slate:
music filter, drawing moderation, movies volume, geography options; design
track — theme/pills/gradients — runs parallel in `DESIGN-MERGE.md` and is
**not** a dependency of this scope):

| Decision                     | Picked default                                              |
| ---------------------------- | ----------------------------------------------------------- |
| Geography distractors        | Curated and embedded (4 options per entry)                  |
| Geography credits            | Shown on reveal (required for CC-BY/SA)                     |
| Geography hint               | Included (shown after a wrong guess)                        |
| Movies authoring volume      | 300 entries (a month + headroom)                            |
| Movies real/fake mix         | Seeded 4–6 real of 10, never fixed 5/5                      |
| Movies AI-assisted authoring | Allowed **only** with a human rewrite pass                  |
| Music content filter         | Radio-safe only (family + AdSense-safe)                     |
| Music answer input           | 4-option multiple choice                                    |
| Music BPM display            | Integer BPM as-is, verified two-source (`bpmSource` for QA) |
| Drawing moderation           | Flag-and-remove (auto-hide at 3 flags + owner removal)      |
| Drawing prompt tone          | Family-safe PG                                              |
| Drawing trademark rule       | Strict ban (no characters, brands, proper nouns)            |

---

## 1. Session shape: the rounds resolution

Research implies one entry per day for geography/music; every live daily is
a full play session (5–15 min, ~10 rounds). **Resolution: 10 rounds per day
for geography, movies, and music; drawing keeps 1 prompt per day** (its
session is draw → submit → vote in the gallery, not a rounds loop).

All round selection uses the established Phase A pattern (D050): a
deterministic seeded shuffle (`dailyGameSeed(dateKey, slug)`, FNV-1a hash
of UTC date + slug) over the static pool, taking **10 distinct entries —
no repeats within a day, same picks for everyone, stable on replay**.
Per-game balance rules (§2.1–2.3) layer on top of the same seed and must
stay deterministic.

### 1.1 Seeded pick contract (shared)

- One pick function per game in `src/lib/` (`pickGeographyRounds`,
  `pickMovieRounds`, `pickMusicRounds`, `pickDailyPrompt`), mirroring the
  existing `pickEmojiQuestions` signature: `(entries, count, seed)`.
- The daily island receives `dailyDateKey` from `/daily/[slug].astro`
  (exactly the Phase A pattern) and passes `dailyGameSeed(dateKey, slug)`.
- Solo (non-daily) reuse of the same pickers may use a random seed; the
  four games ship **daily-only** in this milestone — no solo-mode change.

---

## 2. Per-game scope

### 2.1 Geography — "Where in the World?"

> **SUPERSEDED — removed in M20 Phase 0.5 (PLAN-SCOPE R5/D6); World Peek
> replaces it with fresh data in Phase C.**

**Concept:** a photo; pick the place out of 4 options. Hint after a wrong
guess; credit line on reveal for CC-BY/CC-BY-SA photos.

**Data model — `src/data/daily-geography.json`** (verbatim from Research §1):

```json
[
  {
    "place": "Santorini, Greece",
    "url": "https://commons.wikimedia.org/wiki/Special:FilePath/Santorini_caldera.jpg",
    "credit": { "creator": "Milosh Kitchovitch", "license": "by" },
    "options": ["Santorini, Greece", "Mykonos, Greece", "Bodrum, Turkey", "Malta"],
    "answer": 0,
    "hint": "A Cycladic island whose caldera villages are painted white",
    "region": "europe"
  }
]
```

**Rounds:** 10/day. Seeded shuffle, take 10, no repeats. Region balance:
dataset quota is the P0 control (≥10 per continent bucket); day-level cap
of **≤4 entries from one region per day** is P1 (deterministic re-roll
against the same seed if violated — do not compromise determinism).

**Scoring:** 100 pts first-try correct, 50 pts correct after the hint,
0 wrong. Max 1000. Submit `correctCount`/`totalCount` (10) with the run.

**Engine: new island, no engine reuse.** The 4-option MC + hint-reveal +
credit pattern doesn't exist today (Trivia is text-only MC without hint
mechanics). Files:

- `src/data/daily-geography.json` — dataset (120 entries)
- `src/lib/geography.ts` — `GeographyEntry` type, `pickGeographyRounds`
- `src/lib/__tests__/geography.test.ts` — shape, seed determinism, region cap
- `src/islands/daily/GeographyDaily.tsx` — rounds body composed inside
  the existing `SoloShell` (header/streak/leaderboard/share-card/member
  flow come free — same composition as `EmojiPlot.tsx` → `SoloShell`)
- `src/pages/daily/[slug].astro` — add the render branch

**Share card:** name "Daily Geography" flows through `SoloShell` →
`drawScoreImage`. Photo credit line renders on the round reveal (not the
share card).

### 2.2 Movies — "Real or Fake?"

**Concept:** 10 rounds; each round shows one synopsis (real or fake,
seeded), player answers real vs fake.

**Data model — `src/data/daily-movies.json`** (verbatim from Research §2):

```json
[
  {
    "title": "The Godfather",
    "year": 1972,
    "genre": "crime",
    "real": "An aging crime patriarch hands his empire to his reluctant youngest son, who must harden himself to hold the family together.",
    "fake": "A mild-mannered botanist inherits his uncle's florist shop and discovers the flower business is run by rival mafia families.",
    "difficulty": 1
  }
]
```

**Rounds:** 10/day. Seeded shuffle, take 10, no repeats. Real/fake mix:
**4–6 real of 10 per day, seeded** (never a fixed 5/5 — learnable exploit).
Which side is shown and the round order come from the same day seed
(deterministic per day, like sudoku).

**Scoring:** 100 pts per correct, 0 wrong. Max 1000.

**Engine: new true/false round engine.** No existing daily renders
true/false pairs (Genre Swap is 4-option; the fake-synopsis mechanic is
new). Files:

- `src/data/daily-movies.json` — dataset (300 entries)
- `src/lib/movies.ts` — `MoviePair` type, `pickMovieRounds` (returns
  rounds with the shown side + real/fake mix enforced)
- `src/lib/__tests__/movies.test.ts` — shape, seed determinism, 4–6 real mix
- `src/islands/daily/MoviesDaily.tsx` — composed inside `SoloShell`
- `src/pages/daily/[slug].astro` — render branch

### 2.3 Music — "Name That Song"

**Concept:** 10 rounds; each round shows emoji / year / BPM clues, player
picks the song from 4 options. **No audio, no lyrics** (licensing).

**Data model — `src/data/daily-music.json`** (verbatim from Research §3):

```json
[
  {
    "title": "Bohemian Rhapsody",
    "artist": "Queen",
    "year": 1975,
    "genre": "rock",
    "emoji": "🎸🎹🖤",
    "bpm": 144,
    "difficulty": 2,
    "options": [
      "Bohemian Rhapsody",
      "Stairway to Heaven",
      "Sweet Child o' Mine",
      "Don't Stop Me Now"
    ],
    "answer": 0
  }
]
```

**Rounds:** 10/day. Seeded **stratified** pick: 3 easy / 4 medium / 3 hard
(difficulty 1/2/3), no repeats within a day. Stratification keeps a single
day from being all deep cuts; implement deterministically from the day
seed (dataset quotas ≥30 per tier are the P0 backstop).

**Scoring:** 100 pts per correct, 0 wrong. Max 1000. (Difficulty affects
selection mix, not points — flat scoring keeps the leaderboard legible.)

**Engine: new 4-option MC engine.** Trivia's MC renderer is
question-text-based with no multi-clue layout (emoji + year + BPM strip);
a dedicated island is cheaper than contorting Trivia. Files:

- `src/data/daily-music.json` — dataset (120 entries)
- `src/lib/music.ts` — `MusicEntry` type, `pickMusicRounds` (stratified)
- `src/lib/__tests__/music.test.ts` — shape, seed determinism, tier mix
- `src/islands/daily/MusicDaily.tsx` — composed inside `SoloShell`
- `src/pages/daily/[slug].astro` — render branch

### 2.4 Drawing — "Prompt of the Day"

**Concept:** one prompt per day; draw on a canvas, submit to the daily
gallery, then vote on the world's best. The gallery is server-persisted
user content (not static JSON) — §3.2.

**Data model — `src/data/daily-drawing-prompts.json`** (verbatim from
Research §4):

```json
[
  {
    "prompt": "A penguin riding a unicycle through a snowstorm",
    "emoji": "🐧",
    "category": "animals",
    "difficulty": 2,
    "constraints": ["no_text", "no_letters"]
  }
]
```

**Session:** 1 prompt/day (`pickDailyPrompt(entries, seed)`). Draw (no
timer pressure in v1 — the play session is 5–10 min), submit, then the
gallery shows today's submissions to vote on. `constraints` render as
chips; they are display-only (auto-enforcement is engine work — out of
scope, §6).

**Scoring:** flat **100 pts completion** via the standard daily submit
(one run per member per day — the streak/PB pipeline needs a score, and
gallery votes arrive after submission so they can't be part of the run).
Votes drive the gallery rank, **not** the daily leaderboard — drawing is
the one daily where the leaderboard is not the social surface.

**Engine: reuses the Skribbl canvas for input; new submission/gallery
island.** Files:

- `src/data/daily-drawing-prompts.json` — dataset (150 prompts)
- `src/lib/daily-drawing.ts` — `DrawingPrompt` type, `pickDailyPrompt`,
  client types for gallery responses
- `src/lib/__tests__/daily-drawing.test.ts` — shape, seed determinism,
  category/trademark checks
- `src/islands/daily/DrawingDaily.tsx` — prompt header + **reused**
  `src/components/DrawingCanvas.tsx` input + submit + gallery + vote UI
- `src/lib/canvas.ts` — add a PNG export helper (toBlob wrapper,
  downscaled to ≤1024 px) for gallery upload
- `src/lib/api.ts` — add gallery client functions (upload, list, vote,
  flag) alongside `submitDailyRun`
- `src/pages/daily/[slug].astro` — render branch

**Client flow on completion:** (1) standard `submitDailyRun` (score 100,
`clientKey` per the `soloClientKey` pattern) — the streak/PB/run pipeline
is untouched; (2) `POST /api/drawing/submissions` with the PNG. If the
upload fails, the run still records and the user can retry the upload
from the gallery (idempotent per member per day).

---

## 3. Server scope

### 3.1 Daily registry + submit acceptance (Phase A pattern, non-negotiable)

- `server/src/lib/daily-games.ts`: add `geography`, `movies`, `music`,
  `drawing` to `LIVE_DAILY_GAMES` (12 total). This alone flips
  `/api/daily/:gameId/submit` acceptance — the route validates through
  `isLiveDailyGame`, and `validateDailySubmitInput` is already generic
  (score ≤ 1,000,000, optional `correctCount`/`totalCount`/`durationMs`).
  **No change to `server/src/routes/daily.ts` or the validation file for
  the three scored games.**
- Drawing submits score 100 with `totalCount: 1` (or omitted) — no
  special-casing.
- Lockstep: `src/lib/__tests__/games.test.ts` asserts client live set ==
  server `LIVE_DAILY_GAMES` (already implemented — green once both sides
  update). `src/lib/__tests__/daily.test.ts` asserts "8 live" — update to
  12 and assert zero planned.
- Server integration tests: extend `routes.integration.test.ts` (submit →
  accepted, streak + PB via `/api/me`) for one representative new game;
  the submit path is shared, no per-game server logic.

### 3.2 Drawing gallery — new schema, endpoints, moderation

**New table `DrawingSubmission`** (additive migration; `DailyRun`/
`DailyStreak` untouched):

| Field       | Type / rule                                                |
| ----------- | ---------------------------------------------------------- |
| id          | cuid, PK                                                   |
| dateKey     | string `YYYY-MM-DD` (matches `dailyDateKey`)               |
| promptIndex | int (the day's prompt; gallery scoped per day)             |
| memberKey   | string, indexed                                            |
| playerName  | string (sanitized, ≤20 chars — reuse `sanitizeNickname`)   |
| image       | PNG as base64/text; ≤1 MB after base64 (client downscales) |
| votes       | int, default 0                                             |
| flagCount   | int, default 0                                             |
| status      | `visible` \| `flagged` \| `removed`, default `visible`     |
| createdAt   | timestamp                                                  |

- **Uniqueness:** `@@unique([dateKey, memberKey])` — one submission per
  member per day, idempotent uploads (mirror the `DailyRun` idempotency
  pattern, D049). `@@index([dateKey, status])` for gallery queries.
- **New table `DrawingVote`:** `submissionId` + `memberKey` with
  `@@unique([submissionId, memberKey])` — one vote per member per
  submission; vote counts derive from rows (no counter drift).

**Endpoints** (new router `server/src/routes/drawing.ts`, mounted in
`server/src/app.ts`; all rate-limited with the existing `RateLimiter`
like daily submit):

| Method + path                                        | Body                                                     | Behavior                                                                                                              |
| ---------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `POST /api/drawing/submissions`                      | `{ memberKey, playerName, dateKey, promptIndex, image }` | 201 created / 200 existing (idempotent per day+member); 400 invalid (size/type/dateKey); image must be a PNG data URL |
| `GET /api/drawing/submissions?dateKey=&promptIndex=` | —                                                        | `{ submissions: [{ id, playerName, image, votes }], total }` — **`status: visible` only**, ordered votes desc         |
| `POST /api/drawing/submissions/:id/vote`             | `{ memberKey }`                                          | 200 `{ votes }`; duplicate vote idempotent (no double count); 409 if voting own submission                            |
| `POST /api/drawing/submissions/:id/flag`             | `{ memberKey, reason? }`                                 | 409 own submission; at **3 flags** status → `flagged` (hidden from gallery automatically)                             |
| `DELETE /api/drawing/submissions/:id`                | header `ADMIN_TOKEN` (env, owner-only)                   | 204; sets status `removed` — the "remove" half of flag-and-remove, no admin UI                                        |

**Moderation model (owner pick: flag-and-remove):**

- Self-serve: any member can flag; 3 flags auto-hides (status `flagged`,
  excluded from gallery reads). No appeal flow in v1.
- Owner: manual removal via the `ADMIN_TOKEN` endpoint (curl-level tool;
  an admin UI is out of scope). Removed stays excluded.
- Validation: `server/src/lib/validation.ts` gains
  `validateDrawingSubmissionInput` (image size/format, dateKey pattern —
  reuse `isDateKey`), `validateVoteInput`-style payloads for vote/flag.
- TOS/privacy: the gallery is user-generated content — a one-line
  "report inappropriate drawings" affordance on the gallery is in scope;
  TOS language is not (existing legal pages unchanged this milestone).

---

## 4. Registry + surface updates

| Surface                                               | Change                                                                                                                                                                                                                                                                                                               |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/daily.ts`                                    | 4 entries → `live: true`; drop `gameSlug` (planned-only); final descriptions (remove "Coming in the next milestone"); `estimatedMinutes` geography/movies/music 5, drawing 10                                                                                                                                        |
| `src/pages/daily/index.astro`                         | "Eight challenges" → **"Twelve challenges"**; meta description enumerates the new games; render the "Coming to the daily hub" section only if `getPlannedDailyGames()` is non-empty (it will be empty)                                                                                                               |
| `src/pages/index.astro`                               | Daily strip auto-updates (registry-driven `slice(0,3)`); refresh any copy that enumerates daily games (homepage hero/meta already generic — verify)                                                                                                                                                                  |
| `public/sitemap.xml`                                  | Add `/daily/geography`, `/daily/movies`, `/daily/music`, `/daily/drawing` — `changefreq daily`, `priority 0.9`, `lastmod` updated                                                                                                                                                                                    |
| `scripts/smoke.mjs`                                   | Add 4 checks: `/daily/geography` → "Daily Geography", `/daily/movies` → "Daily Movie", `/daily/music` → "Daily Music", `/daily/drawing` → "Daily Drawing" (h1 names, same pattern as existing daily checks); page-weight + island-bundle budgets re-verified (new islands add JS; remote photo URLs are not bundled) |
| `src/lib/__tests__/daily.test.ts`                     | 8 → 12 live; zero planned                                                                                                                                                                                                                                                                                            |
| `src/lib/__tests__/games.test.ts`                     | Lockstep passes automatically once both registries updated                                                                                                                                                                                                                                                           |
| Share card                                            | Names flow through `SoloShell` → `drawScoreImage` (game name + score + date). Verify the four names read well on the card; per-game copy lives in the registry `description` (hub) and `[slug].astro` (h1/JSON-LD) — no share-card engine change                                                                     |
| `/daily/archive.astro`, `DailyHubStatus`, `DailyCard` | Registry-driven — verify, expect no change                                                                                                                                                                                                                                                                           |

---

## 5. Acceptance criteria

### 5.1 Cross-cutting (all four games)

- **Seeded content:** same UTC day + same slug ⇒ identical rounds for
  every player; consecutive days differ; replay of the day is stable
  (covered by the per-game seed tests).
- **No repeats within a day:** 10 distinct entries per day (drawing: one
  prompt).
- **Member pipeline:** completing a daily as a member records one run via
  `/api/daily/:gameId/submit`; streak increments (per-game + grand),
  personal best updates in `/api/me` (`personalBests`), replays are
  idempotent (no double run, no double streak).
- **Guest flow unchanged:** guests keep the device-bound streak +
  leaderboard path (`SoloShell` behavior untouched).
- **No regression to the 8 live dailies:** lockstep test green (12 = 12),
  `pnpm verify` green (client + server suites), `pnpm smoke` green,
  homepage and daily pages within PRD §10 budgets.
- **Hub:** 12 live cards; "Twelve challenges" copy; no empty coming-soon
  section; sitemap + smoke include the 4 new pages.

### 5.2 Per game

**Geography**

- Round shows photo + 4 options; wrong guess reveals the hint and allows
  one retry (50 pts); correct first try = 100 pts.
- Credit line shown on reveal when `credit.license` is `by`/`by-sa`;
  absent for PD.
- Region cap ≤4 of 10 per day holds deterministically; dataset quotas
  (≥10 per continent bucket) enforced by the dataset test.

**Movies**

- Each round shows one synopsis + Real/Fake buttons; day's mix is 4–6
  real of 10; round order and shown side are day-deterministic.
- Feedback names the film + year on both outcomes ("Yes — The Godfather,
  1972").

**Music**

- Each round shows emoji + year + BPM strip and 4 title options; day is
  stratified 3/4/3 across difficulty tiers; correct = 100 pts.
- Clue layout never implies audio: no play buttons, no lyrics anywhere.

**Drawing**

- Prompt + constraints + emoji render; canvas input matches the Skribbl
  experience (existing `DrawingCanvas` component, no regression to room
  drawing games).
- Submit → run recorded (100 pts, streak + PB flow) and PNG uploaded
  idempotently; gallery shows today's visible submissions ordered by
  votes; own submission visible with a "yours" marker.
- Vote: one per member per submission; own submission not votable;
  duplicate votes idempotent.
- Moderation: 3 flags auto-hides; `ADMIN_TOKEN` removal excludes from
  gallery; flagged/removed never appear in `GET`.

---

## 6. Out of scope (explicit)

- **XP/levels, weekly challenge, share-card polish** — Phase B retention
  loop; this milestone only wires the four games into the existing
  streak/PB pipeline.
- **Audio files, album art, lyrics, music videos** — licensing walls
  (PRD §13; Open Question #2 precedent); music is clue-only by design.
- **Drawing auto-moderation** (text-in-image detection, stroke analysis
  for `no_text`/`no_letters` constraints) — engine work, later milestone.
- **Admin UI** for gallery moderation (curl-level endpoint only).
- **Blob/object storage (R2)** for gallery images — Postgres text column
  is the MVP; revisit at gallery scale.
- **Automated hotlink CI check** for `Special:FilePath` URLs — recommended
  in Research, flagged not blocking; authoring-time 200 checks required
  (§7).
- **Design-system restyle** (theme default, pill radius, gradients) —
  parallel track in `DESIGN-MERGE.md`, token-layer only, no dependency.

---

## 7. Data authoring briefs

**Shared QA checklist (from CONTENT-SOURCING §QA, applies to all four):**
schema validation suite (vitest, repo convention) asserting shape,
answer/options consistency, unique titles/places, ≥100 entries, and
quota/tier/region counts; one seed-determinism test per dataset
(`dailyGameSeed` over N consecutive dates, no crashes, full pool
coverage); license checklist per entry (credit present ⇔ license
requires it); every `Special:FilePath` URL returns 200 at authoring time
(no hotlink CI exists yet — the author is the gate).

1. **Geography (120 entries, ~4 months of dailies).** Produce
   `src/data/daily-geography.json`: 120 entries, ≥10 per continent bucket
   (africa, americas, asia, europe, oceania), photos hotlinked from
   Wikimedia Commons via `Special:FilePath` with preference PD/CC0 →
   CC-BY → CC-BY-SA (never NC/ND or fair use), landscape/cityscape
   emphasis (avoid frames dominated by copyrighted artwork), no dated
   landmarks, no recognizable people. Distractors: 3 per entry,
   same-region-or-similar-landform (islands vs islands, deserts vs
   deserts) — wrong answers must be plausible, never silly; options array
   embeds the answer at a varied index. Hints: one line, evocative, no
   answer leakage. Quality bar: a player who knows the place recognizes
   the photo without text overlays; a player who doesn't can still reason
   from hint + distractor elimination. Verify every URL renders at
   authoring time; set `credit` exactly per the license.

2. **Movies (300 entries, a month + headroom).** Produce
   `src/data/daily-movies.json`: 300 pairs, 1950s–2020s, genres spread
   (drama, comedy, crime, sci-fi, family, cult), difficulty 1–3 tiers by
   ubiquity. Real synopses: hand-written 2–3 sentences of factual plot
   summary — no studio/IMDb copy, no taglines, no quoted dialogue, no
   spoiler endings (the reveal names the film, the synopsis shouldn't).
   Fakes: hand-written wrong-plots in the same tonal register (the
   `genre-swaps.json` house style is the quality bar); a fake that
   accidentally matches a real third film is a correctness bug — a
   dedicated review pass checks this. LLM-assisted drafting is allowed
   only with a human rewrite pass and must never be asked to reproduce
   copyrighted summaries. Titles are nominative use (precedent:
   `emoji-plots.json`).

3. **Music (120 entries).** Produce `src/data/daily-music.json`: 120
   songs, 1950s–2020s, genres pop/rock/hip-hop/country/EDM/Latin/R&B/
   K-pop, ≥30 per difficulty tier (1 = ubiquitous, 2 = well-known,
   3 = deep cut). Radio-safe only (clean/original versions — no "WAP"-
   class content). Titles/artists/years cross-checked with two sources;
   BPM from public metadata, verified manually, source URL stored in
   `bpmSource` (internal QA, never displayed). Emoji clues: 3–4 emoji,
   hand-authored, evoking the song not the video (no artist faces, no
   text). Decoys: 3 same-era/same-genre titles per entry. Quality bar:
   the emoji + year + BPM combination is solvable by a fan of the song
   and only the song.

4. **Drawing prompts (150).** Produce
   `src/data/daily-drawing-prompts.json`: 150 original prompts, balanced
   categories (animals, food, objects, actions/scenes, fantasy, jobs,
   transport, nature), difficulty 1–3 (1 = single noun, 3 = compound
   scene), evergreen only (no holiday timing). Short phrases, family-safe
   PG, **strict ban on proper nouns, trademarked characters ("Mickey
   Mouse", "Pokémon"), brand names, real people, real events** — the
   trademark review is the one hard gate. Compound prompts may combine
   the existing 5,686-word skribbl word bank (reuse, don't re-derive).
   `constraints` optional; only `no_text`/`no_letters` ship. Quality bar:
   a prompt paints a clear picture in one read and leaves room for
   creativity — "A penguin riding a unicycle through a snowstorm", not
   "An animal".

---

## 8. Estimate summary (file-accurate)

| Workstream         | Files                                                                                                                                                                                                     | Size                                   |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Geography engine   | `daily-geography.json`, `lib/geography.ts`, `lib/__tests__/geography.test.ts`, `islands/daily/GeographyDaily.tsx`, `[slug].astro` branch                                                                  | M                                      |
| Movies engine      | `daily-movies.json`, `lib/movies.ts`, `lib/__tests__/movies.test.ts`, `islands/daily/MoviesDaily.tsx`, `[slug].astro` branch                                                                              | M                                      |
| Music engine       | `daily-music.json`, `lib/music.ts`, `lib/__tests__/music.test.ts`, `islands/daily/MusicDaily.tsx`, `[slug].astro` branch                                                                                  | M                                      |
| Drawing engine     | `daily-drawing-prompts.json`, `lib/daily-drawing.ts`, `lib/__tests__/daily-drawing.test.ts`, `islands/daily/DrawingDaily.tsx`, `canvas.ts` export helper, `api.ts` gallery clients, `[slug].astro` branch | L                                      |
| Server             | `daily-games.ts` (+4), `routes/drawing.ts` (new), `validation.ts` (+3 validators), `app.ts` (mount), `schema.prisma` (+2 tables, migration), integration tests                                            | M                                      |
| Registry + surface | `daily.ts` flips, `daily/index.astro` copy, `index.astro` verify, `sitemap.xml`, `smoke.mjs`, `daily.test.ts`, `games.test.ts` (auto)                                                                     | S                                      |
| Content authoring  | 690 entries across 4 datasets + QA checks                                                                                                                                                                 | L (parallel, non-blocking for engines) |

Sequencing recommendation: engines + server first (games playable with
small sample data), datasets land in parallel, surface + copy last, one
PR per game or one PR for the milestone per team convention (Phase A
shipped as a milestone).

---

## 9. Escalated owner confirmations (with recommendations)

1. **Confirm the defaults slate** (§0) — all recommended; if any pick
   changes (e.g., movies at 150, music less strict), the affected dataset
   size or review gate adjusts, no engine impact.
2. **Drawing scoring** — flat 100 completion pts, votes excluded from the
   leaderboard (recommended; the gallery is the social surface). If the
   owner wants votes to matter in the leaderboard, that changes the
   submit pipeline (runs are immutable per day) — escalate early.
3. **Geography day-level region cap** (≤4 of 10 per region, P1) — pure
   polish; drop if it complicates the pick function.
