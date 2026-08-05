# PROMPT CHAIN — Prompt Engineer → Backend Engineer

**You are the Backend Engineer for TriviaHub** (Astro MPA + React islands; Express + Socket.io server; Prisma/Postgres; workspace `@triviahub/server`). This brief contains every decision you need, inline and verbatim. The design docs (`docs/TL-DESIGN-1.md`, `docs/ARCH-DESIGN-2.md`) are **verification only** — if a doc conflicts with this brief, this brief wins; flag the conflict in your report. Work on `main`. Three PRs, each landing with `pnpm verify` fully green.

## Decisions confirmed (verbatim — do not re-litigate)

1. **D055** (Tech Lead design, APPROVED): Phase 0.5 geography removal + Phase B gameplay fixes, exactly as scoped here.
2. **D056** (price pipeline): Amazon PA-API is the PRIMARY image source (Associates Operating Agreement route; scraping/hotlinking retailer URLs remains rejected). Build-time resolution only — **no runtime network anywhere**.
3. **D059 (owner-confirmed default):** shared product pool with **per-region price pairs** (`prices.usd` + `prices.inr`) + **client market toggle** (localStorage key `triviahub:market`, values `US`/`IN`, default `US`). The correct price is the selected market's price.
4. **No new npm dependencies** in any PR (SigV4 via built-in `node:crypto`; mulberry32 already in-repo).
5. **Datasets' `answer` fields are NEVER modified** — shuffling happens at render/build only.
6. **Daily paths never use `Math.random`** — dailies stay deterministic per day (D050).
7. **No changes** to `src/styles/global.css` or `src/components/ui/*` (the design branch owns them).
8. **Images: JPEG ≤1200px as-served** (webp would need `sharp` — a new dependency — explicitly out of scope). Keys live in build env only, never in the bundle.

## PR-1 — Phase 0.5: Daily Geography removal (first; unblocks everything)

**Goal:** delete Daily Geography completely, keep the 11 other live dailies green, land one PR with `pnpm verify` green.

### Deletion list (verify each path exists before deleting)

| #   | Path / surface                                    | Change                                                                                                                                                                                                                                               |
| --- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `src/data/daily-geography.json`                   | delete                                                                                                                                                                                                                                               |
| 2   | `src/lib/geography.ts`                            | delete                                                                                                                                                                                                                                               |
| 3   | `src/lib/__tests__/geography.test.ts`             | delete                                                                                                                                                                                                                                               |
| 4   | `src/islands/daily/GeographyDaily.tsx`            | delete                                                                                                                                                                                                                                               |
| 5   | `src/pages/daily/[slug].astro`                    | remove the `GeographyDaily` import (L12-16) and the `game.slug === 'geography'` render branch (L112-116)                                                                                                                                             |
| 6   | `src/lib/daily.ts`                                | remove the registry entry (emoji `'globe'`); **remove `'geography'` from the `DailyCategory` union NOW** (it returns as `'geo'` with World Peek in Phase C — do not add `'geo'` in this PR)                                                          |
| 7   | `server/src/lib/daily-games.ts`                   | remove `'geography'` from `LIVE_DAILY_GAMES` (12 → 11); drop the "four coming-soon dailies" comment                                                                                                                                                  |
| 8   | `server/src/__tests__/routes.integration.test.ts` | remove the geography submit → streak/PB integration case (L233-259); keep the movies/music/drawing cases from the same describe block — at least one must remain so the "one representative new game" coverage survives                              |
| 9   | `public/sitemap.xml`                              | remove the `/daily/geography` URL                                                                                                                                                                                                                    |
| 10  | `scripts/smoke.mjs`                               | remove `{ path: '/daily/geography', contains: 'Daily Geography' }`; **add** `{ path: '/daily/geography', status: 404 }` — extend the check loop to honor an optional expected `status` (default 200); the smoke server returns 404 for missing files |
| 11  | `src/pages/daily/index.astro`                     | meta description: drop "geography" from the enumeration; replace the "Twelve challenges" copy with count-agnostic wording ("the live registry" preferred; "Eleven challenges" minimum)                                                               |
| 12  | `src/lib/__tests__/daily.test.ts`                 | `toHaveLength(12)` → `toHaveLength(11)`; the zero-planned assertion stays                                                                                                                                                                            |
| 13  | `src/lib/__tests__/games.test.ts`                 | **no edit** — lockstep goes green automatically (client live set == server registry, both 11)                                                                                                                                                        |

### Do-NOT-delete list (a naive `geography` grep will match these — they legitimately stay)

- Trivia content category `"Geography"` in `src/data/trivia-questions.json`, `server/src/data/trivia-questions.json`, and `NEW_CATEGORIES` in `scripts/generate-trivia.mjs` (Phase D owns it).
- The word "geography" in `server/src/data/skribbl-words.json` (word-bank entry).

### Docs treatment (in the SAME PR — superseded markers, no prose deletions)

1. `docs/DAILY-DESIGN.md`: replace §3.1 (Geography engine) with a 3-line marker: **"SUPERSEDED — removed in M20 Phase 0.5 (PLAN-SCOPE R5/D6). World Peek replaces it with fresh data in Phase C."**; remove brief **F2** from §10; amend §7 (sitemap/smoke rows) and §9 (geography test delta). Movies/music/drawing sections untouched.
2. `docs/ARCHITECTURE.md` §21.8 (M19): "Twelve live dailies" → "Eleven live dailies (geography removed, M20 Phase 0.5)".
3. `docs/PROJECT_STATE.md` M19 line: append "(geography removed 2026-08-05, Phase 0.5)".
4. `docs/CONTENT-SOURCING.md` §1 and `docs/DAILY-SCOPE.md` §2.1/§7: one-line "superseded by R5" note at the top of the geography sections. (`daily-geography.json` at 15 entries dies with the code; no dataset work to discard.)
5. `docs/DECISIONS.md`: append **D055** (append-only; format matches D052–D054): Phase 0.5 + Phase B decisions — geography removal (superseding DAILY-DESIGN §3.1), R7/R8/R9/R11/R12 scope, referencing escalations 2/5, DailyCategory timing (remove `'geography'` now, add `'geo'` in Phase C), and the PR ordering of §D.

### PR-1 acceptance (DoD)

- 11 live dailies; zero planned; lockstep green (11 = 11).
- `/daily/geography` 404s in smoke; no geography URL in sitemap.
- **Grep gate:** `grep -rn "geography\|GeographyDaily" src/lib src/islands src/pages server/src/lib server/src/routes server/src/__tests__ scripts/smoke.mjs public/sitemap.xml` → **zero matches** (this scoped list excludes the do-not-delete files above).
- `pnpm verify` green (client + server suites, builds, smoke).

## PR-2 — Server Phase B (answer randomization, room side)

### 2a. Trivia room deck shuffle

**New file `server/src/lib/trivia-options.ts`** (pure, no imports from socket code):

- `shuffleTriviaDeck(questions: TriviaQuestion[], roomCode: string): TriviaQuestion[]` — maps every question through seeded Fisher-Yates with per-question seed `hashString(roomCode + ':' + qIndex)`. The correct answer index is remapped to the shuffled position of the original correct option (`shuffled.options[shuffled.answer] === original.options[original.answer]`).
- The server already has `seededRandom` (mulberry32) + `hashString` in `server/src/lib/daily-seed.ts` — `seededRandom` is currently **not exported**: add the `export` keyword (one-keyword change, behavior identical) and import both into `trivia-options.ts`. Do not duplicate the PRNG.
- **Wire-in:** `startTrivia` (`server/src/socket/index.ts` L1065-1077) currently constructs `new TriviaSession(triviaQuestionsJson as TriviaQuestion[], {...TRIVIA_CONFIG, mode})`. Pass the shuffled deck: `new TriviaSession(shuffleTriviaDeck(triviaQuestionsJson as TriviaQuestion[], room.code), {...})`. `TriviaSession` and the engine are **unchanged**. The answer index is remapped server-side and **never leaves the server** (the round-start payload excludes it — the existing socket test enforces this; it must stay green).

**Edge cases:** rooms with the same code across different sessions still shuffle deterministically per code (acceptable — the seed is the room code, per design); empty question pool (shouldn't occur — guard by returning input unchanged if `questions.length === 0`); questions with ≠4 options shuffle generically (any length).

### 2b. WYR room presentation shuffle (voting adapter)

- In the WYR round-start emit path of the voting adapter (`server/src/socket/index.ts` — the payload builder near `advanceVotingRound`, L977+; `VOTING_CONFIGS['would-you-rather']` L158-165), when constructing the options array `[{id:'a'},{id:'b'}]` for a WYR round: with probability **~50%** present `b` as option index 0. Implementation: a per-room `randomIntFn` (create once per room via `Math.random` — this is a server room path, not a daily, so `Math.random` is correct), and swap when `randomIntFn() < 0.5`.
- **Critical:** swap the **id↔label binding, not just the labels** — when swapped, option 0 is `{id:'b', label: dilemma.b}` and option 1 is `{id:'a', label: dilemma.a}`. Vote payloads reference ids, so `winnerId` reveal semantics stay correct with zero engine changes.
- The swap applies at the single emit point that builds WYR options — this automatically covers dataset dilemmas AND player-submitted dilemmas (the `pendingPrompts` queue path).

**Edge cases:** rounds where a submitted dilemma is used (same emit point — no special-casing); voting session across rounds uses the same per-room RNG (orderings vary round to round); room games are not dailies — no determinism requirement, only that **both orderings occur over repeated rounds** (test assertion).

### PR-2 verification

- New `server/src/lib/__tests__/trivia-options.test.ts`: deck shuffle determinism per roomCode (same code ⇒ same order; different codes differ), answer-remap correctness on every question, payload-never-leaks-answer (existing socket integration test re-runs green), empty-input guard.
- WYR order variance test: over repeated rounds (e.g., 200 simulated round-starts with a seeded `randomIntFn` injection point — make the RNG injectable for the test), both `a`-first and `b`-first orderings occur; vote payload ids remain valid winners.
- `pnpm verify` green.

## PR-3 — Price pipeline skeleton (mock-first)

**Goal:** the full price-image pipeline runs end-to-end **without keys or network** using a MOCK adapter; the merged client loader ships; every test is green. The real PA-API run (S4/S5/S5b) activates when keys exist — the mock path must cover S4's download step with a fixture.

### New script `scripts/resolve-price-images.mjs` (reuse `scripts/` style; **no new deps**)

- **Auth/adapter:** injectable PA-API adapter. Real path: AWS Signature V4 signed REST via built-in `node:crypto` (`createHmac`), endpoints `webservices.amazon.com` (US) and `webservices.amazon.in` (IN). Env keys (build env only): `PAAPI_ACCESS_KEY_US`, `PAAPI_SECRET_KEY_US`, `PAAPI_PARTNER_TAG_US` and `_IN` variants. **When any key is missing, run with a MOCK adapter** (deterministic fixture candidates; the mock's "image" is a fixture file). No key material ever enters the bundle.
- **CLI modes** (add `"resolve:price": "node scripts/resolve-price-images.mjs"` to `package.json`): `--search` (S1–S3), `--apply` (S4–S5), `--refresh` (S5b). Each stage is separately runnable and idempotent.
- **S0 — word-first generator:** update `scripts/generate-price-products.mjs`: output entries gain `id` (slugified name, stable key, deduped), `category` (one of the bucket registry: `kitchen, bar, home, office, electronics, outdoors, toys, sports, beauty, grocery` — mapped to the PA-API `SearchIndex` of the same name where valid, else `All`), `specs` (additive `string[]`, shape supported now; content lands with lot L9 — no QA gate on `specs` content in this PR). **Strip `image`/`credit` from the output** (§1.8 — enrichment artifacts; no engine or existing consumer depends on them beyond the island render path, which moves to the merged loader; the emoji fallback is preserved). Re-run the generator: this migrates the 535 entries (data migration, not a schema-meaning change).
- **S1 — PA-API bulk search:** per product × 2 markets (`searchTerm` + `category` → ItemSearch). Pacing **≈1 rps** with retry + backoff; **5 candidates/product/market** written to `scripts/.cache/price-candidates.json` (add `scripts/.cache/` to `.gitignore`).
- **S2 — ranking:** automatic — title-token overlap with the product name (reuse the enrich script's rank fn style, `scripts/enrich-price-products.mjs`), reject non-raster URLs, prefer the Large image, apply `BAD_TOKENS` (L19-29 precedent) + the offensive-term blocklist (jigger-class), require the product-family token when ambiguous.
- **S3 — human verification gate:** writes `scripts/.cache/price-review/` — one row per product: top-3 candidates + local thumbnails + auto-flags + source + rank reason — plus an HTML/CSV review list. Review output never ships. **Nothing ships without an explicit approve.**
- **S4 — download + self-host** (real mode): fetch approved images at ≤1200px via the Amazon URL size token (`._SL1200_.`), save `public/images/price/{id}.jpg` (JPEG as-served — no webp). **Mock mode:** copy the fixture image (ship one at `scripts/fixtures/price-sample.jpg`) to `public/images/price/{id}.jpg` — this is how the mock covers S4.
- **S5 — resolved layer:** write `src/data/price-resolved.json`, keyed by product `id`:
  - resolved row: `{ status: "resolved", source: "amazon.com"|"amazon.in"|"pexels"|"pixabay"|"wikimedia", asin, image: "/images/price/{id}.jpg", detailPageUrl, prices: { usd, inr }, priceUpdatedAt: ISO, approvedAt: ISO }`. `detailPageUrl` is stored **tag-free** (tags are appended at render).
  - unresolved row: `{ status: "unresolved", reason: "no-candidates" | "rejected" | "offensive" | "download-failed" | "not-yet-resolved" }` — **every unresolved row has a non-empty `reason`**.
  - The initial commit after the S0 migration writes all 535 as `"not-yet-resolved"` so the dataset tests pass before the first search run.
- **S5b — price refresh (daily):** `--refresh` mode: PA-API GetItems, **10 ASINs/request per market**, updates `prices` + `priceUpdatedAt`, commits. Implement now (mock-testable); it runs in CI after keys exist.

### New client libs (part of this PR — the FE brief imports these)

- **`src/lib/price.ts`**: `loadPriceProducts()` — merges the word-first authoring file + the resolved layer (additive; no existing field changes). Behavior contract: a product with a missing resolved entry OR a stale price (**`priceUpdatedAt` older than 24h at build**) is treated as **unresolved at render** (authored price + emoji fallback — game stays playable). Export `isStalePrice(priceUpdatedAt: string, now?: Date): boolean`.
- **`src/lib/amazon.ts`**: public per-market affiliate tag constants (e.g., `AMAZON_TAGS = { US: '…', IN: '…' }` — placeholder values to be filled with the real Associates tags) + `amazonUrl(detailPageUrl: string, market: 'US' | 'IN'): string` (appends the tag). Public constants — tags are not secrets; secret keys never leave build env.

### PR-3 dataset tests (in `src/lib/__tests__/price-is-right.test.ts` or a new `price-resolved.test.ts`)

- Every unresolved row: non-empty `reason`.
- Every resolved row: `image`, `asin`, `detailPageUrl`, `prices.usd`, `prices.inr`, `priceUpdatedAt` present (risk 24 gate: amazon-source rows have `asin` + `detailPageUrl`).
- `isStalePrice`: >24h ⇒ true; fresh ⇒ false.
- `loadPriceProducts`: resolved rows expose the resolved view; missing/stale rows fall back to the emoji path; the loader never throws on a malformed resolved file (defensive: treat parse failure as all-unresolved).

### PR-3 acceptance

- `pnpm resolve:price --search` + `--apply` complete end-to-end with no keys (mock adapter), produce `scripts/.cache/` review artifacts + `price-resolved.json` + fixture-based images.
- `pnpm build` consumes the committed resolved layer with **zero network access** (verify: no fetch calls in any runtime/import graph).
- `pnpm verify` green; no new dependencies; no webp.

## Verification (all PRs)

`pnpm verify` green at every PR boundary (format, lint, typecheck, client tests, server tests, server build, site build, smoke). Exact suites touched: `daily.test.ts` (11), `games.test.ts` (lockstep), `routes.integration.test.ts` (PR-1), `trivia-options.test.ts` (new), the voting/trivia socket suites (PR-2), `price-is-right.test.ts` / `price-resolved.test.ts` (PR-3).

## DoD

- PR-1 → PR-2 → PR-3 land in order on `main`, each independently green; PR-1 leads (PR-2's audit table assumes geography is gone).
- Grep gate output pasted into the PR-1 description.
- Review artifacts referenced (not committed) for PR-3; `scripts/.cache/` gitignored.
- Summary reply per PR: files changed, verify output tail, any doc-vs-brief conflict, and what remains blocked on the real PA-API keys (S4/S5b end-to-end).

<!-- END OF PROMPT — nothing after this line belongs to this prompt. -->
