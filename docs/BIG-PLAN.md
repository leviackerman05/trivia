# Big Plan: "Trivia and Games" (M20–M23)

> Owner brief (2026-08-05): rebrand, real images, family restructure,
> GeoGuessr-style game, true answer randomization, year-range filters,
> topic trivia, mobile sweep, streak-box simplification, LinkedIn-style
> puzzles. Status: planning. This file is the source of truth for the
> program; per-milestone detail lands in docs/TODO.md and the specialist
> docs (DAILY-SCOPE/DAILY-DESIGN pattern).

---

## Phase 0b — Feedback delta (2026-08-05, owner batch 2)

| #   | Decision                                        | Default                                                                                                                                                                                                                                                                                                                                                                                                                          | Scope of change                                                                                                                                                                                                                                                             |
| --- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D6  | **Scrap Daily Geography** (photo → 1-of-4 quiz) | Remove entirely; **World Peek** (Phase C) is the geography-style replacement with a fresh lat/lon dataset                                                                                                                                                                                                                                                                                                                        | Delete `daily-geography.json`, `src/lib/geography.ts`, `geography.test.ts`, `islands/daily/GeographyDaily.tsx`, `daily.ts` entry, `[slug].astro` branch, server `LIVE_DAILY_GAMES` (12 → 11), sitemap, smoke, `daily.test.ts`/lockstep counts — one PR, `pnpm verify` green |
| D7  | **"Daily Games" → "Daily Challenges"**          | Rename ALL user-facing copy (nav label in `BaseLayout.astro`, meta titles/descriptions, hub section labels, archive page, footer links); code identifiers (`dailyGames`, `DailyGame`, routes `/daily`) stay                                                                                                                                                                                                                      | Copy sweep + smoke/sitemap strings                                                                                                                                                                                                                                          |
| D8  | **Sudoku native keyboard input**                | Cells become real `<input>`s (`inputMode="numeric"`, digit-only, arrow-key navigation, Backspace/Delete erase); the on-screen number pad + Erase button is removed; desktop physical keys + mobile/tablet native virtual keyboard                                                                                                                                                                                                | `src/islands/solo/Sudoku.tsx` rework; sudoku lib logic untouched; tests updated                                                                                                                                                                                             |
| D9  | **Content quality program**                     | Emoji Plot + Daily Music emoji clues: standardized 4–6 emoji, hint tiers, difficulty calibration, volume growth (NOTE: no licensed source exists — datasets are in-repo original; quality is a rewrite program, not a source swap). Price Is Right: curated recognizable branded-product photos (CC/Wikimedia — Amazon images are copyrighted/hotlink-blocked, infeasible) + product name/description/specs + richer reveal page | Dataset rewrites + island copy/layout (Price Is Right)                                                                                                                                                                                                                      |
| D10 | **Game-page UI standard**                       | One consistent template for all 19 game pages + daily pages (header: title/tagline/players·duration·energy chips; consistent control surface; consistent results/summary area; consistent rhythm); retrofitted in the design branch                                                                                                                                                                                              | Design branch scope + page template in `src/pages/game/[slug].astro`/`daily/[slug].astro` + islands' shared chrome                                                                                                                                                          |

Phase A (design v4) absorbs: D1 name, D7 rename, D10 game-page standard, card images, party family, mobile sweep, streak-box simplification.
Phase B (gameplay fixes) absorbs: D8 sudoku keyboard, answer randomization, year filters, D9 island-level fixes.
Phase C: World Peek now REPLACES geography (not complements).
Phase D: trivia topics + quality; emoji/music/price content quality lives here too (content lots).

---

## Phase 0c — Feedback delta 3 (2026-08-05, owner batch 3)

| #   | Decision                                                | Default                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Scope                                                                                                                                         |
| --- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| D11 | **Price Is Right: word-first dataset + image pipeline** | Dataset stores product words only (name/searchTerm/description/specs); a BUILD-TIME script resolves images from a licensed stock API (Pexels/Pixabay primary, Wikimedia Commons fallback — owner-approved 2026-08-05) with a HUMAN verification gate (no people, subject matches, license OK); images cached self-hosted (webp ≤1200px). Amazon/eBay direct pull and runtime fetching explicitly REJECTED (ToS + copyright + unstable URLs; documented in ARCH-DESIGN-2). Existing 535 entries re-resolved through the pipeline | New pipeline design (Architect) + dataset restructure (drop `image`/`credit` from authoring, keep as resolved fields) + verification workflow |
| D12 | **Volume targets 2,000–3,000 per game**                 | Staged: 1,000 minimum v1 → 2,000+ per content game by program end (price 1,000-2,000; music/movies/emoji/genre/charades/celebrities/trivia 2,000-3,000); algorithmic games (sudoku, Crown Logic) exempt; LLM-assisted drafting with mandatory human review + schema/QA gates; authoring capacity is the constraint — graduated lots                                                                                                                                                                                             | PLAN-SCOPE content program rewrite (lots + quotas), CONTENT-SOURCING v2                                                                       |
| D13 | **Dual-market content (India + US)**                    | Charades: year filter + language (Hindi/English) + Bollywood/Hollywood/Mixed (Bollywood exists — extend + quota); Guess Who celebrities: Bollywood/Hollywood region filter + volume; music/movies: Bollywood songs + Bollywood films quotas; trivia: Indian topics; UI language stays English (i18n out of scope)                                                                                                                                                                                                               | Data schemas (+`region`, +`language`), island filters, content quotas                                                                         |

---

## Phase 0 — Decisions (owner slate, gates everything)

| #   | Decision                                                                                               | Recommended default                                                                                                                                                                                                                                                   | Why                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| D1  | Name → **"Trivia"** (superseded "Trivia and Games", 2026-08-05; never "TriviaHub" in user-facing copy) | Keep domain `playtriviahub.com`, storage keys `triviahub:*`, package names (backward compat, D043 precedent); rename ALL user-facing copy: logo, meta titles/descriptions, JSON-LD, OG text, README/PRD/BRANDING, nav/footer, 404/500                                 | SEO equity + storage continuity; a domain change is a separate owner decision                |
| D2  | Families: delete `voting`, rename `special` → `party`                                                  | Voting games (WYR, MLT, NHIE, ToT) + Charades + Guess Who all live under **Party**; type stays `multiplayer-voting` internally                                                                                                                                        | "Voting" is mechanic jargon; "Party" is the product                                          |
| D3  | Card images (real, not emoji/monogram)                                                                 | Research sources 1 image per game (19) + per family (5) + per daily (12): Wikimedia Commons PD/CC0/CC-BY with credit line (price-products precedent) OR self-created SVG illustrations (PRD §13); images are runtime assets, not bundled (homepage <100 KB HTML gate) | "Actual images" owner ask; licensing + hotlink risk needs the CONTENT-SOURCING license table |
| D4  | Trademark-safe names                                                                                   | GeoGuessr → **"World Peek"** (name already reserved in TODO backlog); LinkedIn puzzles → original names (e.g. **Crown Logic**, **Clue Trail**, **Word Ladder**)                                                                                                       | GeoGuessr/Queens/Crossclimb/Zip are trademarked                                              |
| D5  | Topic trivia                                                                                           | Trivia gains category → topic picker (e.g. TV Series → "Breaking Bad"); dataset gains `topic` field; quality pass on existing 525 questions                                                                                                                           | Owner ask #7                                                                                 |

## Phase A — Design v4 (branch `design-airbnb`, Frontend Engineer)

Name change in UI (logo, meta, copy, JSON-LD) · real images on game/category/daily cards · Party family restructure in nav/homepage/categories/related-games · mobile-friendliness sweep (touch targets ≥48px, tables, room screens, hero) · **simplify DailyHubStatus** ("Your day at TriviaHub" streak box → one-line summary, e.g. "🔥 12-day streak · 3 of 12 played today"; member pipeline untouched) · design-error sweep report. Exit: owner-approved preview → merge to main.

## Phase B — Gameplay fixes (main, independent — can ship before design)

1. **Answer randomization** (owner bug): trivia, geography, music, movies options must be **seeded-shuffled** per round (deterministic per day for dailies; random seed for solo non-daily) so the correct option is never predictably "A". Golden tests: answer position varies across seeds/days; existing lockstep/daily tests stay green. Audit EVERY option-based engine.
2. **Year-range filter** for music, movies, charades, genre-swap, genre-bender, emoji-plot: add `year`/`decade` metadata (fill gaps), decade preset UI (e.g. 60s–20s + All) on game + daily pages; filter content client-side before seeding. Datasets grow to "serve any audience" (decade quotas below).

## Phase C — New games

| Game                         | Inspiration       | Engine                                                                                           | Data                                                           | Size |
| ---------------------------- | ----------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- | ---- |
| **World Peek** (solo)        | GeoGuessr         | Photo → pin on a self-made simplified SVG world map → distance-based scoring (10 rounds, seeded) | Expand geography photo pool → 200+ entries w/ lat/lon + region | L    |
| **Crown Logic** (solo/daily) | LinkedIn Queens   | Algorithmic n×n logic grid generator (seeded), no content                                        | Generator + solver-check, difficulty tiers 5–9 grids           | M    |
| **Clue Trail** (solo/daily)  | LinkedIn Pinpoint | 4-5 clue cards → guess the category (cost per clue)                                              | 150+ curated clue sets                                         | M    |
| **Word Ladder** (solo/daily) | LinkedIn Zip      | Seeded word-ladder puzzle (start/end words + steps)                                              | Word list from existing 5,686-word bank                        | M    |

All four: catalog entries (games.json), game pages, engines + unit tests, daily registry entries (live 12 → 16), server lockstep (LIVE_DAILY_GAMES +4, submit is registry-driven — no route changes), sitemap + smoke, share cards.

## Phase D — Topic Trivia + content engine (longest pole)

- Trivia quality pass: review existing 525 questions (accuracy, difficulty, dedup) + rewrite pass.
- **Topic mode**: category (TV/movies/sports/science/gaming/music/history…) → topic list (clickable) → topic question set (10 per topic); new `topic` field; two-step picker UI in Trivia solo + daily.
- Dataset expansion with quotas: trivia → 1,000+ questions / 40+ topics (TV series list first, per owner); music 120 → 250+ with decade quotas; movies 300 → 500+; charades/emoji-plots/genre games year-tagged; World Peek pool 200+.
- Authoring: CONTENT-SOURCING QA gates (volume, quotas, uniqueness, licensing) + LLM-assisted drafting with mandatory human rewrite (movies precedent).

## Phase E — QA + ship

Full `pnpm verify` · mobile audit (real devices/emulation) · axe contrast (Rausch buttons → #e00b41 if < 4.5:1) · perf budgets (home <100 KB, LCP with new images, bundle gates) · preview comparisons · design merge · deploy. Docs sweep: PRD amendment (name, families), BRANDING, ARCHITECTURE, DECISIONS (D054+), TODO, PROJECT_STATE, sitemap/smoke.

---

## Sequencing & dependencies

```
Phase 0 decisions ──► Phase A design v4 (branch) ──► merge ──► Phase E QA/ship
        │                    ▲
        └──► Phase B fixes (main, any time) ────────┘
        └──► Phase C new games (main, after D2/D4)  ┘
        └──► Phase D topic trivia + content (main, after D5; longest pole)
```

## Risks

1. **Trademarks** — GeoGuessr/Queens/Crossclimb/Pinpoint/Zip names are owned; D4 names are the mitigation (never say "like GeoGuessr" on-page).
2. **Deterministic-vs-random tension** — dailies must stay seeded (same for everyone, D050); "truly random" applies to solo non-daily rounds only.
3. **Image licensing/hotlinks** — CONTENT-SOURCING table applies (PD/CC0/CC-BY + credits on reveal; CC-BY-NC/ND banned); Wikimedia renames kill images silently → authoring-time 200 checks.
4. **Name-change SEO** — keep domain + storage keys; meta/JSON-LD update is a ranking-neutral restatement of brand, not a URL migration.
5. **Content volume** — 1,000+ trivia / 500+ movies / 250+ music / 200+ photos / 150+ clue sets is the long pole; F9 program must parallelize (dedicated authoring chats, LLM-assisted with human review).
6. **Branch divergence** — design-airbnb is long-lived; merge main into it before the final merge (B/C land on main while A iterates).
7. **Perf** — new images must be lazy-loaded, compact (webp/avif or ~1200px max), hotlinked (not bundled); homepage HTML gate stays <100 KB.
8. **Puzzle difficulty** — generators need solvability + difficulty tiers tested (Crown Logic solver in tests).
9. **Streak box** — simplification is UI-only; the member pipeline (DailyRun/streaks) is the API, not to be touched.
10. **Family restructure breaks tests** — special.test.ts, categories page, related-games expectations; update in the same PR as the catalog change.
