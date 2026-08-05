# TL-DESIGN-1: Phase 0.5 (Geography removal) + Phase B (Gameplay fixes)

> Engineering design (2026-08-05), Tech Lead deliverable. Source of truth:
> `docs/PLAN-SCOPE.md` (R5, R7, R8, R9, R11, R12; §2 decisions; §3 phases;
> §6 escalations). **Design only — no production code.** The three M19
> dailies that survive (movies, music, drawing) keep their shipped engines;
> only geography is deleted.
>
> Status of the audit: **M19 shipped on `main`** — 12 live dailies
> (geography, movies, music, drawing are live), `daily.test.ts` asserts 12,
> smoke/sitemap/integration tests cover geography. This doc's counts assume
> that state. Daily count after 0.5: **11**.

---

## 0. Verified current state (what the design builds on)

| Fact                                                                                                                                                                                                                        | Verified at |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `src/data/daily-geography.json` exists (15 sample entries — the 120-entry lot never ran)                                                                                                                                    | find_path   |
| `src/lib/geography.ts`, `src/lib/__tests__/geography.test.ts`, `src/islands/daily/GeographyDaily.tsx` exist                                                                                                                 | find_path   |
| `[slug].astro` imports `GeographyDaily` and has a `slug === 'geography'` branch (L12-16, L112-116)                                                                                                                          | grep        |
| `daily.ts`: `'geography'` in `DailyCategory` union + live registry entry (emoji `'globe'`-class icon key)                                                                                                                   | read        |
| `server/src/lib/daily-games.ts`: `'geography'` in `LIVE_DAILY_GAMES` (12 total, M19 comment)                                                                                                                                | read        |
| `routes.integration.test.ts` has a geography submit → streak/PB case (L233-259)                                                                                                                                             | grep        |
| `public/sitemap.xml` has `/daily/geography` (lastmod 2026-08-05)                                                                                                                                                            | grep        |
| `scripts/smoke.mjs` has `{ path: '/daily/geography', contains: 'Daily Geography' }`                                                                                                                                         | grep        |
| `src/pages/daily/index.astro` meta enumerates "geography"; "Twelve challenges" copy                                                                                                                                         | grep        |
| Docs referencing geography: `DAILY-DESIGN.md` (§3.1 + brief F2 + §7/§9 tables), `ARCHITECTURE.md` (§21.8 M19), `PROJECT_STATE.md` (M19 line), `DECISIONS.md` (D053), `CONTENT-SOURCING.md` (§1), `DAILY-SCOPE.md` (§2.1/§7) | grep        |

**Do-NOT-delete list** (matched by a naive `geography` grep — all legitimately stay):

- Trivia category `"Geography"` in `src/data/trivia-questions.json` + `server/src/data/trivia-questions.json` + `NEW_CATEGORIES` in `scripts/generate-trivia.mjs` — trivia content category, unrelated to the daily game (Phase D/L1 owns it).
- The word `"geography"` in `server/src/data/skribbl-words.json` — word-bank entry.
- `docs/` prose (handled per A.6 — superseded markers, not deletions).

---

## A. Phase 0.5 — Geography removal (own early PR on `main`)

### A.1 Deletion list (every path verified to exist)

| #   | Path / surface                                    | Change                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `src/data/daily-geography.json`                   | delete                                                                                                                                                                                                                                       |
| 2   | `src/lib/geography.ts`                            | delete                                                                                                                                                                                                                                       |
| 3   | `src/lib/__tests__/geography.test.ts`             | delete                                                                                                                                                                                                                                       |
| 4   | `src/islands/daily/GeographyDaily.tsx`            | delete                                                                                                                                                                                                                                       |
| 5   | `src/pages/daily/[slug].astro`                    | remove import + `slug === 'geography'` branch                                                                                                                                                                                                |
| 6   | `src/lib/daily.ts`                                | remove registry entry; **remove `'geography'` from `DailyCategory`** (see A.5)                                                                                                                                                               |
| 7   | `server/src/lib/daily-games.ts`                   | remove `'geography'` (12 → 11); drop the "four coming-soon" comment                                                                                                                                                                          |
| 8   | `server/src/__tests__/routes.integration.test.ts` | remove the geography submit → streak/PB case (L233-259); keep the movies/music/drawing cases from the same describe block — verify one remains so the "one representative new game" coverage survives                                        |
| 9   | `public/sitemap.xml`                              | remove the `/daily/geography` URL                                                                                                                                                                                                            |
| 10  | `scripts/smoke.mjs`                               | remove the geography check; **add** `{ path: '/daily/geography', status: 404 }` (the smoke server returns 404 for missing files — PLAN-SCOPE risk 12 requires the 404 assertion; extend the check loop to honor an optional expected status) |
| 11  | `src/pages/daily/index.astro`                     | meta description: drop "geography" from the enumeration                                                                                                                                                                                      |
| 12  | `src/lib/__tests__/daily.test.ts`                 | `toHaveLength(12)` → `toHaveLength(11)`; zero-planned assertion stays                                                                                                                                                                        |
| 13  | `src/lib/__tests__/games.test.ts`                 | no edit — lockstep auto-green (client live set == server registry, both 11)                                                                                                                                                                  |
| 14  | Docs (A.6)                                        | superseded markers, no file deletions                                                                                                                                                                                                        |

### A.2 Ordered task list (one PR)

1. Delete the four source files (#1–4).
2. Edit `[slug].astro`, `daily.ts`, `daily-games.ts` (#5–7).
3. Edit the integration test, sitemap, smoke, hub meta, daily.test.ts (#8–12).
4. Docs markers (#14).
5. **Grep gate:** `grep -rn "geography\|GeographyDaily" src server scripts public` → **zero matches** (case-insensitive, excluding the do-not-delete list in §0, which lives in `data/trivia-questions.json`, `generate-trivia.mjs`, `skribbl-words.json` — the gate command scopes to `src/lib`, `src/islands`, `src/pages`, `server/src/lib`, `server/src/routes`, `scripts/smoke.mjs`, `public/sitemap.xml`).
6. `pnpm verify` green (client + server suites, build, smoke).

### A.3 Acceptance (DoD)

- 11 live dailies; zero planned; lockstep green (11 = 11).
- `/daily/geography` 404s in smoke; no geography URL in the sitemap.
- Grep gate clean (scoped list above).
- No geography data reused anywhere (World Peek gets a fresh `lat`/`lon` dataset in Phase C — R4/D6).
- `pnpm verify` green.

### A.4 Sequencing note

Phase 0.5 must land **before** the Phase B PRs and **before** any Phase C work that touches `DailyCategory` — it is the deletion that makes the union truthful. It can land before/parallel to Phase A (design branch) — branch divergence risk handled by the existing main-into-design merge policy (risk 6).

### A.5 `DailyCategory` decision — remove `'geography'` NOW, add `'geo'` in Phase C

Escalation 2 asks to pick the cheaper order between removing `'geography'` here or in Phase C alongside World Peek's `'geo'`.

**Recommendation: remove `'geography'` in this PR.** Rationale: the union member describes a live game; leaving it for months (Phase C) keeps a lie in the type system and forces a "cleanup" pass later. Adding `'geo'` in Phase C is a purely additive one-member change with its hub chip copy — trivially cheap whenever. Both are cheap; removing now keeps `DailyCategory` == reality at every point in time, and the `'geo'` addition in Phase C is independent of this deletion. (If the owner prefers one-touch, Phase C can do both — flag in the review.)

### A.6 Docs treatment (in the same PR)

Do NOT delete docs prose (Phase E owns the docs sweep, PLAN-SCOPE §3). But stale instructions actively mislead engineers — so this PR adds superseded markers only:

- `docs/DAILY-DESIGN.md`: replace §3.1 (Geography engine) with a 3-line "**SUPERSEDED — removed in M20 Phase 0.5 (PLAN-SCOPE R5/D6). World Peek replaces it with fresh data in Phase C.**" marker; remove brief **F2** from §10; amend §7 table (sitemap/smoke rows: drop the geography strings) and §9 (drop the geography test delta). Leave movies/music/drawing untouched.
- `docs/ARCHITECTURE.md` §21.8 (M19): amend the "Twelve live dailies" bullet → "Eleven live dailies (geography removed, M20 Phase 0.5)".
- `docs/PROJECT_STATE.md` M19 line: append "(geography removed 2026-08-05, Phase 0.5)".
- `docs/CONTENT-SOURCING.md` §1 and `docs/DAILY-SCOPE.md` §2.1/§7: one-line "superseded by R5" note at the top of the geography sections (the geography authoring lot never ran — no dataset work to discard; `daily-geography.json` at 15 entries dies with the code).
- `docs/DECISIONS.md`: append **D055** (this design) — see task brief; D053's geography references are historical record, leave them.

---

## B. Phase B — Gameplay fixes

### B.1 R7 — True answer randomization

#### B.1.1 Audit table (every option-based engine, verified)

| Engine                             | Where options render                                                                              | Correct index source                                                                                          | Today                                                                                    | R7 fix                                                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Trivia solo (+ daily)              | `TriviaSolo.tsx` renders `question.options` in payload order; judges `picked === question.answer` | dataset `answer` (payload from `GET /api/daily-challenge` includes it; local fallback `selectDailyQuestions`) | Fixed at dataset index; sample-heavy `answer: 0`                                         | **Client-side shuffle at game start** (per-question sub-seed)                                                |
| Trivia room                        | `TriviaArena.tsx` renders `question.options`; server judges                                       | server-only (`trivia-engine.ts`, never sent pre-reveal)                                                       | Fixed at dataset index                                                                   | **Server-side shuffle** when the room session is built (per-room seed)                                       |
| Daily Music                        | `MusicDaily.tsx` renders `round.options` in dataset order; judges `optionIndex === round.answer`  | dataset `answer` (sample: all `0`)                                                                            | Fixed — the "always A" bug is real here                                                  | Shuffle inside `pickMusicRounds` (per-round sub-seed)                                                        |
| Movies (daily)                     | — true/false, no options                                                                          | shown side seeded already                                                                                     | N/A                                                                                      | N/A (audited)                                                                                                |
| Geography                          | deleted in Phase 0.5                                                                              | —                                                                                                             | —                                                                                        | N/A (deleted)                                                                                                |
| Would You Rather (solo one-screen) | island renders `dilemma.a` / `dilemma.b` in dataset order                                         | no correct answer                                                                                             | order fixed                                                                              | Shuffle a/b presentation per round (Math.random — solo, no leaderboard)                                      |
| Would You Rather (room)            | server `voting-engine.ts` builds `options [{id:'a'},{id:'b'}]`; reveal shows winner by id         | no correct answer                                                                                             | order fixed                                                                              | Shuffle presentation order per round in the socket adapter (ids remapped consistently), Math.random per room |
| Genre Swap (solo + daily)          | `genreSwapOptions` → `buildOptions` (solo.ts) with **`Math.random`**                              | label equality                                                                                                | Random per round but **NOT day-deterministic** (daily exploit: replay changes positions) | Seeded `random` param — daily passes `seededRandom(per-round sub-seed)`                                      |
| Genre-Bender (solo + daily)        | `genreBenderOptions` → `buildOptions`, same                                                       | label equality                                                                                                | same                                                                                     | same                                                                                                         |
| Emoji Plot                         | type-in answer, no options                                                                        | —                                                                                                             | N/A                                                                                      | N/A (audited)                                                                                                |
| Price Is Right                     | price input, no options                                                                           | —                                                                                                             | N/A                                                                                      | N/A (audited)                                                                                                |
| Sudoku                             | grid digits, no options                                                                           | —                                                                                                             | N/A                                                                                      | N/A (audited)                                                                                                |
| NHIE / MLT / ToT (rooms)           | player-name / have-have-not / pair options; no correct answer                                     | —                                                                                                             | —                                                                                        | N/A (audited — no answer to hide)                                                                            |

**Cross-cutting rule:** datasets keep their `answer` field **untouched** — shuffle at render/build (R7 mechanics). Dailies must stay deterministic per day (risk 2); solo non-daily may use `Math.random`.

#### B.1.2 Shared helpers (`src/lib/pick.ts` extension — the DAILY-DESIGN shared-engine home)

```ts
/** Seeded Fisher-Yates over the given array (mulberry32 via trivia.seededRandom). */
export function shuffleOptions<T>(options: readonly T[], seed: number): T[];

/** Shuffle a { options, answer } question: options reordered, answer remapped
 *  to the shuffled position of the original correct option. Returns a new
 *  object; the input is never mutated. */
export function shuffleQuestion<Q extends { options: readonly string[]; answer: number }>(
  question: Q,
  seed: number
): Q;

/** Per-round option sub-seed convention (varies across rounds AND days). */
export function optionSeed(seed: number, roundIndex: number): number;
// = hashString(`${seed}:round:${roundIndex}:options`)
```

- `pick.ts` gains `import { hashString, seededRandom } from './trivia'` — both already exist and are exported (`trivia.ts` L29-48). No duplication.
- `shuffleQuestion` correctness is trivial to golden-test: `shuffled.options[shuffled.answer] === original.options[original.answer]`.
- Why Fisher-Yates + mulberry32 over the cursor technique: option shuffles need near-uniform permutations (a cursor shuffle is biased); `seededRandom` is the repo's existing seeded PRNG (used by `selectDailyQuestions` on both client and server).

#### B.1.3 Per-engine application

1. **Trivia solo/daily (`TriviaSolo.tsx`)** — in `startGame`, map the question set:
   `questions.map((q, i) => shuffleQuestion(q, optionSeed(gameSeed, i)))` where `gameSeed = dailyDateKey ? dailyGameSeed(dateKey, 'trivia') : Math.floor(Math.random() * 1e9)` (daily mode is server-payload-backed; the shuffle happens on the payload, so the D032 server data is untouched — R7 mechanics). The server daily-challenge payload keeps `answer` (the client needs it to judge); the shuffled client copy judges by the remapped index. No server change for daily trivia.
2. **Trivia room (server)** — new pure helper `server/src/lib/trivia-options.ts`: `shuffleTriviaDeck(questions, roomCode): TriviaQuestion[]` — maps every question through the same Fisher-Yates (server copy of `seededRandom` already exists in `daily-seed.ts`; extract or duplicate deliberately — see brief) with seed `hashString(roomCode + ':' + qIndex)`. `startTrivia` (`server/src/socket/index.ts` L1065-1074) passes the shuffled deck to `new TriviaSession(...)`. TriviaSession is unchanged; the answer never leaves the server (round-start payload excludes it — verified).
3. **Daily Music (`src/lib/music.ts`)** — in `pickMusicRounds`, after building `ordered`, map each round: `{ ...round, options: shuffleOptions(round.options, optionSeed(seed, index)), answer: <remapped> }`. Because `MusicRound` embeds options/answer, the island needs **zero changes** (it already renders by index and judges by `round.answer`).
4. **Genre Swap / Genre-Bender (`genre-swap.ts`, `genre-bender.ts`)** — the `buildOptions(correct, pool, count, random)` 4th param already exists. Change `genreSwapOptions(entry, allOriginals, random = Math.random)` / `genreBenderOptions(entry, allEntries, random = Math.random)`. Islands pass `seededRandom(optionSeed(seed, index))` in daily mode (they already hold the daily seed — `GenreSwap.tsx` L53-61), `Math.random` otherwise. Option order becomes day-deterministic; the daily's replay stability returns.
5. **WYR solo (`would-you-rather.ts` or the island)** — add `shuffleDilemma(dilemma, random = Math.random): Dilemma` (swap a/b). Island calls it once per round. Solo-only, no seed discipline required.
6. **WYR room (`server/src/socket/index.ts` voting adapter)** — when emitting a WYR round-start, ~50% of rounds present `b` as option index 0; ids must stay consistent with the vote payload (`winnerId` semantics — swap the id↔label binding, not just the labels). Server-side `randomIntFn` per room; a unit/integration test asserts both orderings occur over repeated rounds.

#### B.1.4 Golden tests (B1 acceptance)

- `pick.test.ts`: `shuffleOptions`/`shuffleQuestion` — permutation validity (same multiset), determinism (same seed ⇒ same order), **answer-position variance over N=100 seeds** (every position 0–3 occurs; no seed keeps position 0 for all 10 rounds of a day), answer-remap correctness.
- `music.test.ts`: over 90 consecutive dates — `pickMusicRounds` output answer positions cover 0–3, day-deterministic.
- `trivia.test.ts`: client shuffle golden (same date ⇒ same order for everyone; different days differ).
- `server/src/lib/__tests__/trivia-options.test.ts`: deck shuffle determinism per roomCode, remap correctness, payload-never-leaks-answer stays green (existing socket test).
- Genre tests: daily mode deterministic per (date, slug); solo mode random.
- WYR: order variance test (solo + room).

### B.2 R9 — Sudoku native keyboard input

#### B.2.1 Design

`src/islands/solo/Sudoku.tsx` rework (lib untouched — `src/lib/sudoku.ts` stays byte-identical):

- All 81 cells become `<input>` elements; given cells render as `disabled` inputs (uniform grid semantics; tab order skips them; styling unchanged via the existing token classes).
- Input contract per cell:
  - `type="text"` (NOT `type="number"` — avoids spinners and iOS numeric-keyboard quirks), `inputMode="numeric"`, `pattern="[1-9]"`, `maxLength={1}`, `autoComplete="off"`, `aria-label` unchanged (`Row r, column c, digit|empty`).
  - `onChange`: accept only a single digit `1–9` (strip everything else; multi-char paste → keep the last digit). Calls the existing `place(value)` path — `place(0)` semantics for erase.
  - `onKeyDown`: ArrowLeft/Right/Up/Down → `preventDefault()` + move selection (wrap at row/col edges); Backspace/Delete → `place(0)` + keep focus; digits 1–9 → typed normally (keyboard events already produce onChange); `Tab` passes through.
- **Remove** the `DIGITS` pad and the `✕ Erase` button (Sudoku.tsx L172-193). The conflicts counter + hint text stay.
- Selected-cell highlight stays (tap to select, then type — same mental model as before).
- New pure helpers in **`src/lib/sudoku-input.ts`** (testable without DOM; keeps the sudoku lib untouched):
  - `sanitizeDigitInput(raw: string): number` → 0 for empty/invalid, digit otherwise.
  - `nextCellIndex(current: number, key: 'ArrowLeft'|'ArrowRight'|'ArrowUp'|'ArrowDown'): number` — 9×9 wrap (left: `(col+8)%9`; right: `(col+1)%9`; up/down: `±9 mod 81`).
- A11y specifics: focus ring via existing `focus:` tokens (already in the codebase's input styling); `aria-label` per cell; no `type=number` so iOS shows the numeric keypad without the "done/scroll" weirdness; `maxLength=1` prevents multi-digit entries on mobile.

#### B.2.2 Acceptance

- Full keyboard play-through on desktop (arrows navigate, digits fill, Backspace erases, conflicts highlight, completion → done) and mobile/tablet (native numeric keypad appears, no page scroll on digit input).
- `src/lib/sudoku.ts` diff = **zero**.
- `src/lib/__tests__/sudoku-input.test.ts`: digit sanitize cases, arrow wrap at edges, erase semantics.
- `src/lib/__tests__/sudoku.test.ts` unchanged (lib untouched); smoke + `pnpm verify` green.

### B.3 R8 — Year-range filter

#### B.3.1 Dataset audit (verified)

| Dataset                                | `year` today?  | Entries                     | Gap                                         |
| -------------------------------------- | -------------- | --------------------------- | ------------------------------------------- |
| `src/data/daily-music.json`            | ✅ year        | 15 (sample; L3 target 250+) | decade quotas at target volume              |
| `src/data/daily-movies.json`           | ✅ year        | 15 (sample; L4 target 500+) | decade quotas at target volume              |
| `src/data/emoji-plots.json`            | ✅ year        | 210                         | —                                           |
| `src/data/genre-benders.json`          | ✅ year        | 200                         | —                                           |
| `src/data/genre-swaps.json`            | ❌ **no year** | 150                         | **L10 backfill: add `year` to every entry** |
| `server/src/data/charades-movies.json` | ❌ **no year** | 300                         | **L10 backfill: add `year` to every entry** |

#### B.3.2 Design

- **Decade derivation (pure, new `src/lib/decade.ts`):**
  - `decadeOf(year: number): number` → `Math.floor(year / 10) * 10`.
  - `DECADE_PRESETS: number[]` → `[1960, 1970, 1980, 1990, 2000, 2010, 2020]` + `null` (All) — the "60s–20s" slate.
  - `filterByDecade<T>(entries, decade: number | null, yearOf: (e: T) => number | undefined): T[]` — `decade === null` ⇒ all entries; otherwise entries whose `yearOf` decade matches; **entries without a year are excluded under a filter, included under All** (so the charades/genre-swap surfaces work before L10 lands — see B.3.4).
- **Filter BEFORE seeding** (R8 mechanics): islands filter the pool, then call the existing picker with the unchanged seed. Daily determinism is preserved: same day + same filter ⇒ same rounds for everyone (golden test).
- **UI:** a decade preset chip row (`All · 1960s · 1970s … 2020s`) in each surface's setup phase:
  - Solo islands (GenreSwap, GenreBender, EmojiPlot — game pages): state in the island; default `All`.
  - Daily-only islands (MusicDaily, MoviesDaily): chip row in the island's setup card (before "Start").
  - Charades (room): decade chips in the host lobby next to the Hollywood/Bollywood/Mixed toggle; the choice is sent to the server with the start (new pending map + filtered pool in the adapter — mirrors `pendingCharadesCategories`).
  - Genre Swap / Genre-Bender / Emoji Plot daily pages: same chip row via their daily-mode islands (the daily pages reuse the same island — one filter implementation per island, surfaced in both modes).
- **Empty-decade guard:** a preset renders only if the filtered pool ≥ the game's round count (10; charades 5×players); otherwise hidden (not disabled — no dead buttons). This is deterministic and self-healing as content lands.
- **Quota tests (the "datasets serve any audience" gate):** per dataset, **every preset 1960s–2020s that renders must have ≥ 15 entries**; tests assert `filterByDecade` counts per preset ≥ 15 at full volume. Tests ship with the content lots (L3/L4/L10) so sample datasets don't red `pnpm verify` (see §D sequencing).
- **Pickers:** no signature changes (`(entries, count, seed)` — filtered pool in, same seed). The pickDistinct pool-edge contract already handles small pools.

#### B.3.3 Surfaces (6)

| Surface                                                    | Where the filter lives                  |
| ---------------------------------------------------------- | --------------------------------------- |
| `/daily/music` (MusicDaily)                                | setup card chip row                     |
| `/daily/movies` (MoviesDaily)                              | setup card chip row                     |
| `/game/charades` (CharadesArena)                           | host lobby chips → server-filtered pool |
| `/game/genre-swap` + `/daily/genre-swap` (GenreSwap)       | setup card chip row (both modes)        |
| `/game/genre-bender` + `/daily/genre-bender` (GenreBender) | setup card chip row (both modes)        |
| `/game/emoji-plot` + `/daily/emoji-plot` (EmojiPlot)       | setup card chip row (both modes)        |

#### B.3.4 L10 gap list (content brief, companion to the filter PR)

- `genre-swaps.json`: add `year: number` to all 150 entries (author from film release years, two-source check where uncertain).
- `charades-movies.json`: add `year: number` to all 300 entries.
- `daily-music.json` / `daily-movies.json`: decade coverage at L3/L4 volume (≥15 per preset is a hard quota in those lots).
- The filter PR must not block on L10: surfaces render "All" only until the backfill lands (B.3.2 guard handles it), and L10 ships immediately after with the quota tests.

#### B.3.5 Acceptance

- Chip row present on all six surfaces; filtering happens before seeding; dailies stay deterministic per (day, slug, filter); golden tests over 90 days; quota tests green at full volume; no empty decade states (presets hidden below the round-count floor); `pnpm verify` green.

### B.4 R11 / R12 — Island-level content fixes

#### B.4.1 R12 — Price Is Right reveal (island change + L9 lot)

**Verified current state:** `price-products.json` already ships `image` (Flickr hotlink), `credit`, `description`; the island already renders image + credit + name + description on the round card (L111-142). Gaps vs R12: no `specs`, Flickr hotlinks (not self-hosted), no specs on the **reveal**.

**Island + schema change (Phase B):**

- `src/data/price-products.json` gains an additive `specs: string[]` (3–6 short factual lines; authoring in L9) — additive, no existing field changes.
- `PriceIsRight.tsx` reveal block (after "It costs …, you were …") renders the product name + description + a `<ul>` of `specs` — the "richer reveal page". The round card keeps its current compact layout; the reveal expands it.
- **Image hosting (escalation 5 — recommended):** the L9 lot downloads/resizes images to self-hosted `public/images/products/*.webp` (≤1200px) and repoints `image` to the local path — kills the Flickr hotlink + rename risk; island code unchanged (`<img src={product.image}>` works for both). Credit stays on the reveal (already implemented, escalation 9 precedent). No new dependencies (resize via existing `scripts/` tooling style; webp preferred, PNG/JPEG ≤1200px acceptable).
- Schema test: every entry has `image` (local path after L9), `credit`, `description`, `specs` (3–6 items, ≤120 chars each), price bounds.

#### B.4.2 R11 — Emoji Plot + Daily Music clue quality (schema gates + lots L5/L6)

**FACT respected:** no licensed emoji source exists; this is a rewrite program (D9). Phase B ships the **enforcement**, the lots ship the **content**:

- `src/lib/__tests__/daily-drawing.test.ts`-style dataset gates moved/added for the two datasets:
  - `emoji-plots.json`: every entry's `emoji` is 4–6 code points (today: 3–4, R11 standard), no artist faces/text (blocklist tokens — the existing house blocklist test pattern), year present, unique titles; volume ≥ 210 stays.
  - `daily-music.json`: same 4–6 emoji standard, `bpmSource` present, difficulty calibration bounds (≈35/45/20), volume target per L3 (250+).
- **Island-level fixes only** (per PLAN-SCOPE R11): `EmojiPlot.tsx` + `MusicDaily.tsx` render up to 6 emoji without layout change (they already render the raw string — verify wrapping at 6 emoji on small screens; adjust the clue strip `text-5xl` to a responsive size if needed). **No engine changes** — hint tiers/difficulty calibration are dataset properties (L5/L6).
- Golden seed tests stay green after every lot (they must — the lots re-run the seed suite).

---

## C. Test plan deltas (summary)

| Area      | New/updated tests                                                                                                                                                                                                                                                                                 |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 0.5 | `daily.test.ts` 11 live; `games.test.ts` lockstep (auto); smoke `/daily/geography` → 404; grep gate (CI-able one-liner in the PR description + a smoke absence check per PLAN-SCOPE risk 12)                                                                                                      |
| R7        | `pick.test.ts` (shuffleOptions/shuffleQuestion goldens incl. position variance over 100 seeds); `music.test.ts` answer-position variance over 90 days; genre seeded-option determinism; `trivia.test.ts` client shuffle golden; server `trivia-options.test.ts`; WYR order variance (solo + room) |
| R9        | `sudoku-input.test.ts` (sanitizeDigitInput, nextCellIndex wrap); sudoku lib suite unchanged; smoke unchanged                                                                                                                                                                                      |
| R8        | `decade.test.ts` (decadeOf, filterByDecade incl. missing-year behavior); per-dataset decade quota tests (land with L3/L4/L10); daily determinism-under-filter golden (90 days)                                                                                                                    |
| R12       | `price-products` schema test (specs shape, local image path, credit); island behavior covered by smoke (existing `/game/price-is-right` check — extend contains-string for "specs" heading on reveal if feasible)                                                                                 |
| R11       | emoji-standard schema tests (4–6 code points) for `emoji-plots.json` + `daily-music.json`; calibration bounds; golden seeds re-run per lot                                                                                                                                                        |

---

## D. Sequencing (PR order on `main`)

```
PR1  Phase 0.5 geography removal            (independent, unblocks everything)
PR2  B1 R7 answer randomization             (shared helpers first — later engine work builds on shuffled output)
PR3  B2 R9 sudoku keyboard                  (independent; can pair with PR2)
PR4  B3 R8 year filters plumbing            (six surfaces; charades needs the server filter)
PR5  L10 year backfill (genre-swaps + charades-movies) + decade quota tests   (companion to PR4; content)
PR6  B4 R12 reveal + specs schema           (island-first; L9 images land after)
PR7  L5/L6 emoji/music clue rewrites + schema gates   (content; re-runs seed goldens)
PR8  Phase E gate: full pnpm verify + docs sweep (PROJECT_STATE, DECISIONS D055, ARCHITECTURE, TODO)
```

- PR1–PR3 are mutually independent — parallelizable after PR1 (PR1 must lead: PR2's audit table and PR4's surfaces assume geography is gone; also the deletion PR is small and derisks the grep gate).
- Content lots (L9, L10, L5/L6) run in parallel with PR2–PR4 (authoring lots are chat-scoped per PLAN-SCOPE §4).
- **Verify-gate discipline:** sample datasets (music 15, movies 15) must not trip the new quota tests — quota tests ship with their content PRs, never before (§B.3.2, §B.4.2). `pnpm verify` green at every PR boundary.

---

## E. Risk additions (for PROJECT_STATE)

| #   | Risk                                                                                                                                    | Mitigation (this design)                                                                                                                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 13  | **D6 deletion regression** — geography refs survive in docs, hub meta, archive caches, share-card strings (PLAN-SCOPE risk 12 restated) | Scoped grep gate in the PR + smoke 404 assertion + docs superseded markers in the same PR                                                                                                      |
| 14  | **R7 determinism-vs-random tension** — a dev "fixes" the shuffle with `Math.random` in a daily path                                     | Golden tests assert daily determinism (same seed/day ⇒ same order) — a random-seeded daily fails CI immediately                                                                                |
| 15  | **Room-trivia shuffle regression** — the answer index must never leak pre-reveal; a remap bug breaks judging                            | `trivia-options.test.ts` remap goldens + existing socket integration test (payload-excludes-answer) re-run                                                                                     |
| 16  | **Sudoku input regressions on iOS** — `type=number` scroll/spinner quirks, focus loss on re-render                                      | `type=text` + `inputMode=numeric` + `maxLength=1`; pure helpers isolate logic; manual mobile pass in Phase E                                                                                   |
| 17  | **R8 empty decade states** — a preset with no content ships a dead button                                                               | Presets hidden below the round-count floor + quota tests at full volume                                                                                                                        |
| 18  | **Sample datasets vs quota tests** — verify goes red if tests land before content                                                       | Quota tests ship with their content lots, never before (explicit sequencing rule)                                                                                                              |
| 19  | **R12 image hosting** — self-hosting adds a download/resize step to authoring                                                           | Escalation 5 recommendation adopted (webp ≤1200px in `public/images/products/`); credit line already on reveal; no new dependencies                                                            |
| 20  | **Daily count drift across phases** — 11 (post-0.5) → 15 (Phase C); copy/strings may hardcode 12                                        | All copy in this design is count-agnostic ("the live registry"); hub "Twelve challenges" string is updated by the 0.5 PR to "Eleven challenges" and Phase C updates it again (registry-driven) |

---

## F. File-level task briefs (for Backend + Frontend handoffs)

> Rules: `pnpm verify` green at every PR; datasets keep `answer` untouched (shuffle at render); daily paths never use `Math.random`; no new dependencies; no `src/styles/global.css` / `src/components/ui/*` changes (design branch owns them).

### Backend Engineer

**BE1 — Phase 0.5 registry + tests** (with the frontend's 0.5 PR or as its server half)

- Files: `server/src/lib/daily-games.ts`, `server/src/__tests__/routes.integration.test.ts`.
- Acceptance: `LIVE_DAILY_GAMES` = 11; the geography integration case removed, movies/music/drawing cases intact; server suite green.

**BE2 — R7 room-trivia shuffle**

- Files: `server/src/lib/trivia-options.ts` (new), `server/src/socket/index.ts` (`startTrivia`), `server/src/lib/__tests__/trivia-options.test.ts` (new).
- Acceptance: deck shuffled per roomCode (deterministic per room, per question), answer remapped, options-only payload unchanged (no answer leak), existing trivia socket suite green.

**BE3 — R7 WYR room order**

- Files: `server/src/socket/index.ts` (voting adapter round-start emit).
- Acceptance: both a/b orders occur over repeated rounds; vote ids stay consistent with the reveal (`winnerId` semantics preserved); voting socket suite green.

**BE4 — R8 charades decade filter (server half)**

- Files: `server/src/socket/index.ts` (pending charades decade map + filtered pool), `server/src/engine/charades-engine.ts` (constructor accepts the filtered pool — no logic change).
- Acceptance: host-selected decade filters the movie pool before session start; fallback to full pool when the filter yields < 1 round; charades socket suite green (with L10 data present; "All" path green without it).

**BE5 — D055 decision entry**

- Files: `docs/DECISIONS.md` (append D055: Phase 0.5 + Phase B decisions, superseding DAILY-DESIGN §3.1 geography; references R7/R8/R9/R11/R12 and escalations 2/5).
- Acceptance: append-only; format matches D052-D054.

### Frontend Engineer

**FE1 — Phase 0.5 deletion**

- Files: delete `src/data/daily-geography.json`, `src/lib/geography.ts`, `src/lib/__tests__/geography.test.ts`, `src/islands/daily/GeographyDaily.tsx`; edit `src/lib/daily.ts` (entry + `DailyCategory`), `src/pages/daily/[slug].astro`, `src/pages/daily/index.astro` (meta), `public/sitemap.xml`, `scripts/smoke.mjs` (+404 check), `src/lib/__tests__/daily.test.ts` (11 live); docs markers per §A.6.
- Acceptance: §A.3 gates — grep gate clean (scoped), smoke 404, verify green, "Eleven challenges" copy (count-agnostic wording preferred).

**FE2 — R7 shared helpers + client engines**

- Files: `src/lib/pick.ts` (+`shuffleOptions`, `shuffleQuestion`, `optionSeed`), `src/lib/__tests__/pick.test.ts` (goldens incl. 100-seed position variance), `src/lib/music.ts` (per-round shuffle in `pickMusicRounds`), `src/lib/genre-swap.ts` + `src/lib/genre-bender.ts` (seeded `random` param), `src/lib/would-you-rather.ts` (+`shuffleDilemma`), `src/islands/TriviaSolo.tsx` (shuffle on start), `src/islands/solo/GenreSwap.tsx` + `GenreBender.tsx` (pass seeded random in daily mode), `src/islands/daily/MusicDaily.tsx` (no change expected — verify), WYR island (shuffle per round), tests per §B.1.4.
- Acceptance: golden tests green; daily determinism preserved; solo random; no dataset `answer` field changed anywhere.

**FE3 — R9 sudoku keyboard**

- Files: `src/lib/sudoku-input.ts` (new: `sanitizeDigitInput`, `nextCellIndex`), `src/lib/__tests__/sudoku-input.test.ts`, `src/islands/solo/Sudoku.tsx` (inputs, key handlers, remove pad + Erase).
- Acceptance: §B.2.2 — full keyboard play-through, `src/lib/sudoku.ts` zero diff, tests green.

**FE4 — R8 decade filter (client half)**

- Files: `src/lib/decade.ts` (new: `decadeOf`, `DECADE_PRESETS`, `filterByDecade`), `src/lib/__tests__/decade.test.ts`, the six surfaces (§B.3.3: MusicDaily, MoviesDaily, CharadesArena lobby, GenreSwap, GenreBender, EmojiPlot — chip rows + filter-before-seed), `src/lib/__tests__/music.test.ts` + `movies.test.ts` (determinism-under-filter goldens).
- Acceptance: §B.3.5 — filter before seeding on all six surfaces, dailies deterministic per (day, slug, filter), presets hidden below the round-count floor, verify green with sample datasets (quota tests NOT in this PR — they land with L10/L3/L4).

**FE5 — R12 reveal + specs schema**

- Files: `src/data/price-products.json` (additive `specs` on the L9 subset — or ship the field on all entries with placeholder-free content in L9), `src/islands/solo/PriceIsRight.tsx` (reveal block: name + description + specs list), schema test.
- Acceptance: reveal shows name/description/specs after guessing; existing image/credit rendering untouched; L9 lot repoints `image` to `public/images/products/*.webp` in a follow-up PR; verify green.

**FE6 — R11 schema gates**

- Files: `src/lib/__tests__/emoji-plot.test.ts` + `src/lib/__tests__/music.test.ts` (emoji-standard schema checks: 4–6 code points, blocklist, calibration bounds — enforced at dataset level), `EmojiPlot.tsx` + `MusicDaily.tsx` clue-strip responsive check (6-emoji wrap).
- Acceptance: gates red on the current 3–4-emoji entries **only until L5/L6 land** — so the gates ship **with** the lots (same PR), not before (verify-gate rule §D). If the owner wants the gates early, the lots must land first.

---

## G. Review handoff

This document is ready for the **Software Architect review (APPROVE / RETURN)** before any engineer starts. Review focus points: (1) `DailyCategory` timing (A.5), (2) the room-trivia shuffle placement (B.1.3.2 — adapter vs engine), (3) the decade-filter guard semantics (B.3.2), (4) the R11 gate timing (FE6), (5) PR ordering (D).
