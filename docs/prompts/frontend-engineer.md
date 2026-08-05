# PROMPT CHAIN — Prompt Engineer → Frontend Engineer

**You are the Frontend Engineer for TriviaHub** (Astro MPA + React islands, Tailwind v4 tokens; design work lives on branch `design-airbnb`, but **you work on `main`**). This brief contains every decision inline and verbatim; `docs/TL-DESIGN-1.md` and `docs/ARCH-DESIGN-2.md` are verification only — this brief wins on conflict (flag it). Four tasks: seeded answer randomization, Sudoku native keyboard, decade filters (client half), and the Price Is Right reveal. No global.css or `src/components/ui/*` changes (design branch owns them). `pnpm verify` green at the end.

## Decisions confirmed (verbatim — do not re-litigate)

1. **R7 (D055):** datasets keep their `answer` field **untouched** — shuffle at render/build only. Dailies stay deterministic per day (D050): same day + same seed ⇒ same order for everyone. Solo non-daily may use `Math.random`. **Daily paths never use `Math.random`.**
2. **R8:** filter BEFORE seeding (same seed, filtered pool) — same day + same filter ⇒ same rounds. Entries without a `year` are excluded under a decade filter, included under `All`.
3. **R9:** `src/lib/sudoku.ts` diff = **zero**. Sudoku cells become real `<input>`s; the on-screen pad + Erase button are removed.
4. **D059 (owner-confirmed default):** shared product pool, per-region price pairs (`usd`/`inr`), client market toggle persisted at localStorage key `triviahub:market` (values `US`/`IN`, default `US`). Correctness price = selected market's price.
5. **No new dependencies.** Images ≤1200px, lazy-loaded. Focus ring via existing `focus:` tokens.
6. **Charades decade filter is server-side — skip the client half** (a separate backend PR owns the host-lobby chips + server-filtered pool; do not build client filtering for charades).

## Task 1 — Seeded answer randomization (R7)

### 1a. Shared helpers — extend `src/lib/pick.ts`

Import `hashString` and `seededRandom` from `./trivia` (both already exported, trivia.ts L29-48 — no duplication). Add, exactly:

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

Fisher-Yates via `seededRandom` (near-uniform permutations — the cursor technique is biased and must not be used for options). `shuffleQuestion` returns a new object; never mutate the input question.

### 1b. Apply to the engines

1. **Trivia solo/daily — `src/islands/TriviaSolo.tsx`** (`startGame`, L85-97): map the question set exactly as `setQuestions((dailyQuestions ?? selectDailyQuestions(new Date())).map((q, i) => shuffleQuestion(q, optionSeed(gameSeed, i))))` where `gameSeed = dailyDateKey ? dailyGameSeed(dailyDateKey, 'trivia') : Math.floor(Math.random() * 1e9)`. Daily mode is server-payload-backed: shuffle the payload copy (the server's D032 data is untouched); the shuffled client copy judges by the remapped index. No server change for daily trivia.
2. **Daily Music — `src/lib/music.ts`** inside `pickMusicRounds` (after the picked rounds are built): map each round `{ ...round, options: shuffleOptions(round.options, optionSeed(seed, index)), answer: <remapped> }`. `MusicRound` embeds options/answer, so **`MusicDaily.tsx` needs zero changes** — verify, don't edit.
3. **Genre Swap — `src/lib/genre-swap.ts`**: `genreSwapOptions(entry, allOriginals, random = Math.random)` — thread the 4th `random` param into `buildOptions` (already supported, `src/lib/solo.ts` L204-214).
4. **Genre-Bender — `src/lib/genre-bender.ts`**: same, `genreBenderOptions(entry, allEntries, random = Math.random)`.
5. **Genre islands — `src/islands/solo/GenreSwap.tsx` + `GenreBender.tsx`**: in daily mode pass `seededRandom(optionSeed(seed, index))` per round (the islands already hold the daily seed — `GenreSwap.tsx` L53-61); `Math.random` in solo mode. This restores daily replay stability (today's `Math.random` is a daily exploit).
6. **WYR solo — `src/lib/would-you-rather.ts`**: add `shuffleDilemma(dilemma, random = Math.random): Dilemma` (swaps a/b); the island calls it once per round. Solo-only — no seed discipline.

**Edge cases:** question objects must not be mutated (map returns new objects); option arrays of any length (shuffle generically); daily trivia when `dailyQuestions` is null (fall back to `selectDailyQuestions(new Date())` before shuffling — the seed still comes from `dailyDateKey`).

### 1c. Golden tests (add to `src/lib/__tests__/pick.test.ts` + engine test files)

- `pick.test.ts`: `shuffleOptions`/`shuffleQuestion` — permutation validity (same multiset), same-seed determinism, **answer-position variance over N=100 seeds: every position 0–3 occurs; no seed keeps position 0 for all 10 rounds of a day**; remap correctness (`shuffled.options[shuffled.answer] === original.options[original.answer]`); input never mutated (deep-equal snapshot of the input after the call).
- `music.test.ts`: over 90 consecutive dates — `pickMusicRounds` answer positions cover 0–3 and output is day-deterministic.
- `trivia.test.ts`: client shuffle golden — same date ⇒ same order; different days differ.
- Genre tests: daily mode deterministic per (date, slug); solo mode varies.
- WYR: order variance (both a-first and b-first occur over repeated rounds).

## Task 2 — Sudoku native keyboard (R9)

**`src/islands/solo/Sudoku.tsx` rework only; `src/lib/sudoku.ts` byte-identical.**

- All 81 cells become `<input>` elements. Given cells render as `disabled` inputs (uniform grid semantics; tab order skips them; styling unchanged via existing token classes).
- Per-cell contract: `type="text"` (NOT `type="number"` — avoids spinners and iOS quirks), `inputMode="numeric"`, `pattern="[1-9]"`, `maxLength={1}`, `autoComplete="off"`, `aria-label` unchanged (`Row r, column c, digit|empty`).
- `onChange`: accept only a single digit `1–9` via `sanitizeDigitInput` (multi-char paste → keep the last digit). Writes through the existing `place(value)` path — `place(0)` semantics for erase.
- `onKeyDown`: ArrowLeft/Right/Up/Down → `preventDefault()` + move selection (9×9 wrap via `nextCellIndex`); Backspace/Delete → `place(0)` + keep focus on the cell; digits 1–9 typed normally (keyboard events produce `onChange`); `Tab` passes through (default).
- **Remove** the `DIGITS` pad (Sudoku.tsx L17-21, render L174-181) and the `✕ Erase` button (L185-192). The conflicts counter + hint text stay. Selected-cell highlight stays (tap to select, then type).
- **New pure `src/lib/sudoku-input.ts`** (DOM-free, keeps the sudoku lib untouched):
  - `sanitizeDigitInput(raw: string): number` → `0` for empty/invalid, digit `1–9` otherwise.
  - `nextCellIndex(current: number, key: 'ArrowLeft'|'ArrowRight'|'ArrowUp'|'ArrowDown'): number` — 9×9 wrap: left `(col+8)%9`, right `(col+1)%9`, up/down `±9 mod 81`.
- **A11y:** focus ring via existing `focus:` tokens; `maxLength=1` prevents multi-digit entries on mobile; `type=text` + `inputMode=numeric` shows the native numeric keypad without iOS scroll/spinner weirdness.

**Acceptance:** full keyboard play-through on desktop (arrows navigate, digits fill, Backspace erases, conflicts highlight, completion → done) and mobile/tablet (native numeric keypad, no page scroll on digit input). `src/lib/sudoku.ts` diff = zero. New `src/lib/__tests__/sudoku-input.test.ts`: sanitize cases (empty, letters, multi-char paste → last digit, digit), arrow wrap at all four edges, erase semantics. `sudoku.test.ts` unchanged.

## Task 3 — Decade filters (R8, client half)

### 3a. New `src/lib/decade.ts` (pure)

- `decadeOf(year: number): number` → `Math.floor(year / 10) * 10`.
- `DECADE_PRESETS: number[]` → `[1960, 1970, 1980, 1990, 2000, 2010, 2020]` (+ `null` = All — the "60s–20s" slate).
- `filterByDecade<T>(entries, decade: number | null, yearOf: (e: T) => number | undefined): T[]` — `decade === null` ⇒ all entries; otherwise entries whose `decadeOf(yearOf(e))` matches; **entries without a year are excluded under a filter, included under All**.

### 3b. Surfaces (5 of 6 — charades is server-side, skip)

| Surface                                                    | Where the filter lives                   |
| ---------------------------------------------------------- | ---------------------------------------- |
| `/daily/music` (MusicDaily)                                | chip row in the setup card, before Start |
| `/daily/movies` (MoviesDaily)                              | chip row in the setup card, before Start |
| `/game/genre-swap` + `/daily/genre-swap` (GenreSwap)       | chip row, both modes                     |
| `/game/genre-bender` + `/daily/genre-bender` (GenreBender) | chip row, both modes                     |
| `/game/emoji-plot` + `/daily/emoji-plot` (EmojiPlot)       | chip row, both modes                     |

- UI: a decade preset chip row (`All · 1960s · 1970s … 2020s`), default `All`. Solo islands: state in the island. Daily-only islands: in the setup card.
- **Filter BEFORE seeding** (R8 mechanics): filter the pool, then call the existing picker with the unchanged seed. No picker signature changes (`(entries, count, seed)` — filtered pool in, same seed).
- **Empty-decade guard:** a preset renders ONLY if the filtered pool ≥ the game's round count (10; daily games use their round constant). Otherwise **hidden, not disabled** — no dead buttons. Deterministic and self-healing as content lands.
- Genre Swap's `genre-swaps.json` currently has **no `year`** (L10 backfill lands later): under a filter those surfaces show nothing until content lands — the guard handles it (presets hidden); "All" always works.

### 3c. Tests

- New `src/lib/__tests__/decade.test.ts`: `decadeOf`, `filterByDecade` (matching, missing-year behavior under filter vs All, boundary years 1969/1970).
- `music.test.ts` + `movies.test.ts`: **daily determinism under filter** golden — same (day, slug, filter) ⇒ same rounds, over 90 days.
- **Quota tests (≥15 entries per rendered preset at full volume) are NOT in this PR** — they land with the content lots (L3/L4/L10). Do not add them; sample datasets (15 entries) must stay green.

## Task 4 — Price Is Right reveal + market toggle (R12/D059)

**Depends on backend PR-3** (`src/lib/price.ts` + `src/lib/amazon.ts` — if PR-3 hasn't landed, develop against its committed contract; do not write your own loader).

- **Merged view:** read `loadPriceProducts()` from `src/lib/price.ts` — the island merges authoring + resolved layers. A product with a missing/stale resolved entry renders via the **emoji fallback** (existing card path).
- **Reveal block** (`src/islands/solo/PriceIsRight.tsx`, after the "It costs …" line): product name + description + a `<ul>` of `specs` (3–6 short lines — the "richer reveal"). The round card keeps its compact layout; the reveal expands. Existing image + credit rendering untouched.
- **"See it on Amazon" button** — shown ONLY when the resolved row's `source` starts with `amazon.` (hidden for pexels/pixabay/wikimedia): `<a href={amazonUrl(detailPageUrl, market)} target="_blank" rel="noopener sponsored">` — the tag comes from `src/lib/amazon.ts` (appended at render; `detailPageUrl` is stored tag-free). Labeled, not disguised.
- **FTC disclosure** — renders once on the game page, verbatim: _"Prices shown are for reference. Buying through our Amazon links supports the site at no extra cost to you."_
- **Market toggle (D059):** US/IN toggle on the setup card, persisting to localStorage `triviahub:market` (default `US`; reads on load, writes on change). **Correctness price = the selected market's price** from the resolved row's `prices.usd` / `prices.inr`; when the market's price is missing, fall back to the authored `price` (game stays playable). The toggle lives on the setup card; the reveal shows the price for the selected market.

**Edge cases:** unresolved product + Amazon button must never co-occur (button is source-gated); stale price (>24h) renders the authored price, not a stale resolved one (`isStalePrice` from `price.ts`); market toggle with a stale/missing `prices.inr` falls back to authored price; the disclosure renders exactly once per page regardless of rounds played.

## Verification

`pnpm verify` green: format, lint, typecheck, client tests, server tests, builds, smoke. Exact suites added/updated: `pick.test.ts`, `music.test.ts`, `trivia.test.ts`, genre tests, `would-you-rather.test.ts` (Task 1); `sudoku-input.test.ts` (Task 2); `decade.test.ts`, `music.test.ts`/`movies.test.ts` determinism-under-filter (Task 3); `price-is-right.test.ts` schema/contract additions (Task 4 — only the parts not owned by backend PR-3's dataset tests).

## DoD

- All four tasks land on `main` (Task 4 after backend PR-3's `price.ts`/`amazon.ts` are available).
- No dataset `answer` field changed anywhere; no `Math.random` in any daily path (grep-verifiable); `src/lib/sudoku.ts` zero diff; no changes to `src/styles/global.css` or `src/components/ui/*`; no new dependencies.
- Summary reply: files touched per task, verify output tail, golden-test results, the charades-decade **server-half gap** (TL-DESIGN-1 §F BE4 — host-lobby chips + server-filtered pool are NOT covered by this brief or the backend brief's three PRs; recommend a follow-up PR), and any doc-vs-brief conflicts.

<!-- END OF PROMPT — nothing after this line belongs to this prompt. -->
