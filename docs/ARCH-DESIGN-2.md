# ARCH-DESIGN-2: Price Is Right image pipeline, content scale, dual-market dimensions

> Engineering design (2026-08-05), **Software Architect deliverable** for the
> M20-M23 program. Sources of truth: `docs/BIG-PLAN.md` (D1-D13),
> `docs/PLAN-SCOPE.md` (R12, §4 content program, §6 escalations),
> `docs/TL-DESIGN-1.md` (Phase 0.5 + Phase B — reviewed in parallel,
> **APPROVED**, decisions logged as D055), `docs/CONTENT-SOURCING.md`
> (licensing table), and the **FOLLOW-UP #2 amendment** (2026-08-05): Amazon
> PA-API approved as the PRIMARY image source — baked in verbatim in §1.
> **Design only — no production code.** Constraints: additive schema only
> (D006), no new dependencies, stack fixed (PRD §2), datasets stay static
> JSON + server data files, licensing gates per CONTENT-SOURCING, `pnpm
verify` green after every lot.

---

## 0. Executive summary

Three designs for the CEO-approved M20-M23 program:

1. **§1 — Price Is Right image pipeline (D11 + FOLLOW-UP #2).** The dataset
   becomes word-first (name/searchTerm/description/specs). A build-time
   script queries **Amazon PA-API (primary)** — and Pexels/Pixabay +
   Wikimedia (fallback) — for each product, a **human verification gate**
   approves the final image, and approved images are **self-hosted**
   (`public/images/price/*`, ≤1200px) with a machine-readable resolved
   layer. Prices refresh **daily at build** (24h freshness). Runtime image
   search is rejected and the rationale is documented (§1.2) — the CEO's
   question, answered in writing.
2. **§2 — Content scale program (D12).** Graduated volume targets
   (price 1,000-2,000; eight other datasets 2,000-3,000), staged milestones
   (v1 = 1,000 → v2 = 2,000+), authoring capacity math, LLM-assisted
   drafting with mandatory human rewrite and memorization guardrails,
   per-dataset QA gates, algorithmic-exempt list, and sequencing that keeps
   the L9 hold honest.
3. **§3 — Dual-market dimensions (D13, India + US).** Additive
   region/language/year schema for Charades and Guess Who, Bollywood quotas
   for music/movies, Indian topics for trivia, server-vs-client filter
   contract, quota table, English-only UI (i18n explicitly out of scope).

**Decisions drafted:** D055 (TL-DESIGN-1 Phase 0.5 + Phase B, reviewed and
approved today), D056 (image pipeline), D057 (content scale), D058
(dual-market), D059 (INR/USD price model — PM escalation with a
conservative default). All appended to `docs/DECISIONS.md` in the same PR.

**Owner actions required before the pipeline runs end-to-end:** two Amazon
Associates accounts (amazon.com + amazon.in) and PA-API keys via build env
vars (server-side only — never in the bundle). See §1.9 and §5.

---

## 1. Price Is Right image pipeline (D11 + FOLLOW-UP #2)

### 1.1 Current state (verified)

- `src/data/price-products.json`: **535 entries**, 523 with hotlinked image
  URLs across 9 hosts (Flickr 391, Wikimedia 93, rawpixel 17, Thingiverse
  15, …), 428 with a CC credit. Sourced by `scripts/enrich-price-products.mjs`
  from the Openverse API (D034). The island renders image + credit + name +
  description on the round card (TL-DESIGN-1 B.4.1 verified).
- The "jigger" precedent: the `Jigger Set` row uses `searchTerm: "jigger"`,
  which is also a slur/parasite term — an unmoderated auto-pick surfaced
  offensive candidates. The gate below is the direct response.
- `generate-price-products.mjs` is the authoring generator (ROWS tuples →
  JSON); `enrich-price-products.mjs` is the enrichment precedent (ranking,
  `BAD_TOKENS`, concurrency worker — its style is reused, its Openverse
  source is superseded).

### 1.2 Why build-time resolution — runtime image search is non-viable

> **The CEO's question, answered in one paragraph:** Runtime image search
> (fetching a product image live, when a player plays) is not viable — it
> fails on **stability** (every play would depend on a live third-party API
> and today's listings; prices and availability change mid-day), on
> **licensing** (Amazon images are only usable under the Associates
> Operating Agreement, which requires the controlled link/display rules we
> bake into the build pipeline — a free search API guarantees nothing), on
> **moderation** (an unmoderated live fetch is exactly the failure mode
> behind the "jigger" incident, and we cannot review every image a player
> could trigger in real time), and on **cost + AdSense risk** (per-play API
> bills scale with traffic, and unpredictable third-party content on a
> monetized page is an AdSense policy risk). Fetching once at build time,
> reviewing by hand, and serving our own copies turns all four problems off
> at once.

**Why stored image links were also rejected (CEO, 2026-08-05):** the
current 535-entry dataset hotlinks random CC photos (Flickr users,
Thingiverse, etc.) — most are not the actual product, and hotlinks break
when hosts rename/delete files (PLAN-SCOPE risk 3). Both the CEO rejection
and the D034 tradeoff note agree: hotlinks are a dead end.

### 1.3 Source strategy (amended by FOLLOW-UP #2, verbatim)

| Tier         | Source                                                                                        | Role                                                                                          | Legal basis                                          | Display obligations                                                                                                                                                                               |
| ------------ | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Primary**  | **Amazon PA-API** (Product Advertising API), Associates accounts — **amazon.com + amazon.in** | Bulk build-time keyword search into the product pool; ASIN, title, price, category, image URL | Associates Operating Agreement (the legal API route) | Image hyperlinks to the Amazon listing **with the affiliate tag**; "See it on Amazon" on the reveal; no misleading use; local webp/JPEG copies allowed for display; **prices never cached > 24h** |
| **Fallback** | **Pexels / Pixabay** stock APIs                                                               | Products not on Amazon                                                                        | Pexels/Pixabay licenses (free commercial use)        | None (no affiliate link); source recorded for audit                                                                                                                                               |
| **Fallback** | **Wikimedia Commons** (`Special:FilePath`)                                                    | Niche products absent from stock APIs                                                         | PD/CC0/CC-BY (CONTENT-SOURCING table)                | Visible credit on reveal for CC-BY/SA (existing `credit` precedent)                                                                                                                               |
| Rejected     | eBay                                                                                          | —                                                                                             | No legal API route                                   | —                                                                                                                                                                                                 |
| Rejected     | Amazon scraping / hotlinking retailer URLs                                                    | —                                                                                             | ToS violation                                        | —                                                                                                                                                                                                 |
| Rejected     | Runtime fetching (any source)                                                                 | —                                                                                             | See §1.2                                             | —                                                                                                                                                                                                 |

> **Note:** PLAN-SCOPE R12's "Amazon images are copyrighted and
> hotlink-blocked — legally infeasible" line is **superseded** by FOLLOW-UP
> #2: that finding was about scraping/hotlinking, not the official PA-API.
> The R12 `specs`/reveal work (TL-DESIGN-1 B.4.1) is unchanged; only the
> image-sourcing half is replaced by this design.

### 1.4 Dataset contract — word-first authoring + additive resolved layer

**Authoring file stays static and word-only** (`src/data/price-products.json`,
written by `generate-price-products.mjs`):

```json
{
  "id": "jigger-set",
  "name": "Jigger Set",
  "searchTerm": "cocktail jigger",
  "emoji": "🥃",
  "description": "Measure twice, pour once.",
  "specs": ["Stainless steel", "Double-sided 1 oz / 2 oz"],
  "price": 12,
  "category": "kitchen"
}
```

Additive authoring fields: `id` (slugified name, stable key — backfilled by
the generator, deduped), `specs` (3-6 short lines, R12), `category` (one of
a small bucket registry → PA-API `SearchIndex`: kitchen, bar, home, office,
electronics, outdoors, toys, sports, beauty, grocery — see §1.8). **No
`image`/`credit` in the authoring file** — those were enrichment artifacts
and are migrated out.

**Resolved layer (machine-written, additive, separate file)**
`src/data/price-resolved.json`, keyed by product `id`:

```json
{
  "jigger-set": {
    "status": "resolved",
    "source": "amazon.com",
    "asin": "B0XXXXXXXX",
    "image": "/images/price/jigger-set.jpg",
    "detailPageUrl": "https://www.amazon.com/dp/B0XXXXXXXX",
    "prices": { "usd": 11.99, "inr": 899.0 },
    "priceUpdatedAt": "2026-08-05T08:00:00Z",
    "approvedAt": "2026-08-05T14:30:00Z"
  },
  "unresolved-product": { "status": "unresolved", "reason": "no-candidates" }
}
```

The island merges authoring + resolved via a small loader
(`src/lib/price.ts`: `loadPriceProducts()` — additive, no existing field
changes). Two files keeps the authoring source clean and the machine output
git-controllable; the two-writer rule is explicit: **generator writes
`price-products.json` only; the pipeline writes `price-resolved.json` +
`public/images/price/*` only.**

### 1.5 Pipeline stages (build-time script, `scripts/resolve-price-images.mjs`, reuse `scripts/` style, **no new deps**)

```
S0 Word-first authoring      generate-price-products.mjs → price-products.json (id, word fields, no image)
S1 PA-API bulk search        per product: searchTerm + category → ItemSearch (amazon.com AND amazon.in)
                             ~1 rps; N = 5 candidates/product/market stored → scripts/.cache/price-candidates.json
S2 Candidate ranking         automatic: title-token overlap with product name (enrich script's rank fn),
                             reject non-raster URLs, prefer Large image, apply BAD_TOKENS +
                             offensive-term blocklist (jigger-class), require product-family token when ambiguous
S3 Human verification gate   script writes scripts/.cache/price-review/ (one row per product: top-3
                             candidates + local thumbnails + auto-flags + source + rank reason) + an
                             HTML/CSV review list; human marks approve / approve-alt / reject-all
S4 Download + self-host      approved → fetch image at ≤1200px via Amazon URL size token (e.g. ._SL1200_.)
                             → save public/images/price/{id}.jpg (JPEG as-served; webp needs a new
                             dependency — see §1.10 risk 5) → record source/asin/detailPageUrl
S5 Resolved layer merge      write price-resolved.json (status resolved/unresolved, prices, audit fields)
                             → commit; build consumes it with no network
S5b Price refresh (daily)    separate script mode (--refresh): PA-API GetItems, 10 ASINs/request, per
                             market → update prices + priceUpdatedAt → commit → rebuild
```

- **Auth:** PA-API uses AWS Signature V4 — signed REST via built-in `crypto`
  (no dependency). Per-marketplace keys: `PAAPI_ACCESS_KEY_US`,
  `PAAPI_SECRET_KEY_US`, `PAAPI_PARTNER_TAG_US` (+ `_IN` variants), in build
  env only.
- **Capacity:** full search pass = products × 2 markets at ~1 rps
  (535 → ~18 min; pool 1,000-2,000 → 35-70 min one-time, or incremental per
  authoring batch — recommended). Daily price refresh = ceil(ASINs/10)
  requests/market (~2 min for 535).
- **Determinism note:** the pipeline is authoring tooling, not a runtime
  path — D050 daily-seeding rules are untouched. `price-resolved.json` is
  committed; a build without keys or network uses the committed layer.

### 1.6 The human verification gate (rules + workflow)

Rules (unchanged by FOLLOW-UP #2, apply to PA-API results too):

1. **No people/portraits** in the product photo.
2. **Subject matches the product** (title-token overlap is a hint, the human
   is the judge — PA-API results for "jigger" return real barware, but the
   gate still runs).
3. **No offensive terms / slur homonyms** — automated blocklist on candidate
   titles + authoring rule: ambiguous search terms are disambiguated at the
   source ("jigger" → "cocktail jigger"). The blocklist is a smoke gate
   (dataset test), the human is the backstop.

Workflow: `pnpm resolve:price --search` → review list (`scripts/.cache/`,
gitignored) → approver marks candidates (one row per product, thumbs +
auto-flags) → `pnpm resolve:price --apply` downloads + writes the resolved
layer. Review output never ships. **Nothing ships without an explicit
approve.**

### 1.7 Display rules (Associates Operating Agreement — designed into the UI)

- **Product image = a link** to the Amazon listing with the affiliate tag:
  `<a href={detailPageUrl + '?tag=' + TAG} target="_blank" rel="noopener sponsored">`.
  The tag is a public constant per market (`src/lib/amazon.ts`), appended at
  render; `detailPageUrl` is stored tag-free in the resolved layer.
- **Reveal page**: existing image/credit/name/description + **`specs` list**
  (R12) + **"See it on Amazon" button** (shown only when `source` starts
  with `amazon.`; hidden for fallback sources) + a one-line FTC disclosure
  (proposed copy: _"Prices shown are for reference. Buying through our
  Amazon links supports the site at no extra cost to you."_ — owner
  approval requested, §5).
- **No misleading use**: the page stays a game; the affiliate link is
  labeled, not disguised (rel="sponsored" + visible button).
- **Caching:** local JPEG/webp copies are allowed for display (stored in
  `public/`, lazy-loaded, ≤1200px, not bundled — homepage/perf gates
  untouched). **Prices are never cached > 24h** — the daily refresh (S5b)
  enforces it; a stale resolved price (>24h) is treated as unresolved at
  render (authored fallback price + the product stays playable).

### 1.8 Schema changes (additive, D006) + migration of the 535 entries

**Additive to `price-products.json`:** `id`, `specs`, `category` (bucket
registry). `image`/`credit` are **removed** from the authoring file —
technically a field removal, but only of enrichment artifacts (no engine or
existing consumer depends on them beyond the island's render path, which now
reads the merged resolved layer; the emoji fallback path is preserved).
Migration is a data migration, not a schema-meaning change.

**New files:** `src/data/price-resolved.json` (resolved layer),
`src/lib/price.ts` (merge loader + `amazon.ts` tag/market constants),
`public/images/price/*.jpg` (self-hosted images), `scripts/resolve-price-images.mjs`
(pipeline). `.gitignore`: `scripts/.cache/`.

**Migration of the 535 existing entries (one pipeline PR):**

1. Generator re-run: strip `image`/`credit`, add `id` (slugified, deduped)
   - `category` (bucket mapping) — word-first file.
2. Search pass (S1-S3) over all 535 × 2 markets → review → approve →
   self-host → resolved layer.
3. Island reads the merged view; emoji fallback for `unresolved`.
4. Old hotlinks leave the bundle (perf win); nothing else changes.

**Unresolved ≠ broken:** any product the pipeline cannot resolve is
`status: "unresolved"` with a `reason`, keeps its emoji card, and appears on
the next review pass's worklist. Verified by a dataset test: every
`unresolved` row has a non-empty `reason`; `resolved` rows have
image/asin/detailPageUrl/prices/audit fields.

### 1.9 Env/secrets + CI wiring

- Keys live in **build env only** (CI secrets / author `.env`), never in the
  bundle: `PAAPI_*_US/_IN`, `PEXELS_KEY` (fallback). The committed resolved
  layer is the only artifact the deployed site touches.
- CI: a **scheduled daily job** runs `pnpm resolve:price --refresh` and
  commits `price-resolved.json` (triggering the Cloudflare Pages rebuild) —
  this is the 24h freshness mechanism. The `--search` pass is an authoring
  step run by the content author (per L9 batch), not CI.
- Local dev without keys: `pnpm build` consumes the committed resolved
  layer; no network at build. A smoke warning fires if any resolved price is
  stale >24h at build time.

### 1.10 Risks (additions to PROJECT_STATE)

| #   | Risk                                                            | Mitigation                                                                                                                                                         |
| --- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 21  | PA-API quota/throttle on the bulk pass                          | ~1 rps pacing (documented); incremental per-batch search; retry with backoff; the refresh pass is tiny (10 ASINs/req)                                              |
| 22  | PA-API image URL breakage (Amazon changes URL format)           | Images are downloaded + self-hosted at approval time — the runtime never touches Amazon URLs; a broken download = reject at the gate                               |
| 23  | 24h price freshness missed (daily job fails)                    | Stale check at build (smoke warning) + render falls back to authored price; game stays playable; alert surfaces in the build log                                   |
| 24  | Affiliate display non-compliance (missing tag/link on an image) | Dataset test asserts every resolved amazon-source row has asin + detailPageUrl; island contract test asserts the link wrapper + rel=sponsored on amazon rows       |
| 25  | Offensive-term homonyms at authoring (jigger-class)             | Authoring rule (disambiguate search terms) + candidate blocklist + human gate + dataset smoke test — three layers, one human                                       |
| 26  | webp requirement would need a new dependency                    | Conservative default: JPEG ≤1200px as-served (PLAN-SCOPE §6.5 explicitly allows JPEG/PNG). webp conversion (sharp) is a separate owner decision if the CEO insists |
| 27  | Associates account/approval delay blocks L9                     | Pipeline ships + is unit-tested with mocks now; end-to-end run waits on keys; content tracks (§2.6) proceed regardless                                             |

---

## 2. Content scale program (D12)

### 2.1 Targets + staged milestones

| Dataset                                          | Current                   | v1 target | v2 target | Band max (program end) |
| ------------------------------------------------ | ------------------------- | --------- | --------- | ---------------------- |
| `price-products.json`                            | 535                       | 1,000     | 1,500     | 2,000                  |
| `daily-music.json`                               | 15 (sample; 120 authored) | 1,000     | 2,000     | 3,000                  |
| `daily-movies.json`                              | 15 (sample; 300 authored) | 1,000     | 2,000     | 3,000                  |
| `emoji-plots.json`                               | 210                       | 1,000     | 2,000     | 3,000                  |
| `genre-swaps.json`                               | 150                       | 1,000     | 2,000     | 3,000                  |
| `genre-benders.json`                             | 200                       | 1,000     | 2,000     | 3,000                  |
| `charades-movies.json`                           | 300                       | 1,000     | 2,000     | 3,000                  |
| `celebrities.json`                               | 205                       | 1,000     | 2,000     | 3,000                  |
| `trivia-questions.json` (client + server mirror) | 525                       | 1,000     | 2,000     | 3,000                  |

**Staged milestones:** v1 = 1,000/game (price: 1,000) → **owner go/no-go
gate** → v2 = 2,000+ → go/no-go → band max. Each milestone ships with its
quota tests in the same PRs (verify-gate discipline, TL-DESIGN-1 §D). Daily
games only need ~365+/year for a no-repeat year (D050 pool-edge handles the
rest) — the 2,000-3,000 targets are **catalog depth** per the CEO's ask, not
a gameplay requirement; the staged gate exists so we can stop early if
content quality falters.

### 2.2 Authoring capacity math (planning numbers, assumptions stated)

Entry types: **A = structured short** (price products, music rows, charades
titles, celebrities, clue sets) — ~3 min/entry human-reviewed; **B = prose**
(trivia question sets, movie synopsis pairs = 2 texts, emoji-plots, genre
swaps/benders) — ~6-8 min/entry. Sustained author-day (6h deep work):
A ≈ 100-150, B ≈ 45-60.

| Lot | Game → 1,000            | Days (1 author) |
| --- | ----------------------- | --------------- |
| L9  | price (A)               | 7-10            |
| L3  | music (A)               | 7-10            |
| L11 | charades (A)            | 7-10            |
| L12 | celebrities (A)         | 7-10            |
| L4  | movies (B, 2,000 texts) | 15-20           |
| L2  | trivia (B)              | 15-20           |
| L5  | emoji-plots (B)         | 15-20           |
| L6a | genre-swaps (B)         | 15-20           |
| L6b | genre-benders (B)       | 15-20           |

**v1 total ≈ 110-140 author-days; 2-3 parallel authoring tracks ≈ 6-8
weeks.** v2 doubles ≈ 3 months; band max ≈ 4-5 months at 2-3 tracks. The
bottleneck is human review, not drafting — LLM drafting compresses drafting
but the per-entry rewrite/review floor stands.

### 2.3 LLM-assisted drafting — guardrails (CONTENT-SOURCING, D9)

- **Mandatory human rewrite pass** on every LLM-drafted entry (movies
  precedent) — never ship verbatim model output.
- **Memorization guardrails:** the model must never be asked to reproduce
  copyrighted summaries, lyrics, or blurbs (training-data risk); movie
  synopses are written fresh from plot facts (Feist: facts are not
  copyrightable, expression is).
- Two-source fact checks (music `bpmSource` precedent), radio-safe filter
  (music), trademark blocklist (drawing precedent), dedup gates (normalized
  text), no audio/lyrics/album art anywhere.

### 2.4 Schema/QA gates per dataset (ship WITH the lot, never before)

Volume ≥ milestone · quotas (region × language × decade / origin × decade /
category / tier per §3.6 + TL-DESIGN-1 B.3.2) · uniqueness (normalized) ·
required fields + licensing headers + credit-consistency · determinism
goldens re-run (D050) · trivia client/server mirror byte-identical (lockstep
check) · `pnpm verify` green at every PR boundary.

### 2.5 Algorithmic-exempt datasets (no volume quota — generator/curation gates)

`sudoku` (generator, D039) · `crown-logic` (algorithmic generator + solver,
Phase C) · `word-ladder` (generated from the word bank) · `skribbl-words`
(5,686, curation-only — the queued word-bank debt) · `world-peek` photos
(imagery pipeline, own photo targets — not prose) · rhyme phonemes
(CMU-derived). Exempt datasets still carry their existing integrity tests.

### 2.6 Sequencing given the L9 hold

```
Track D (price — held):  pipeline v1 (script + gate + resolved layer + 535 migration) → L9 authoring
                          to 1,000 → 2,000. Pipeline PR is independent and can ship/test with mocks
                          NOW; end-to-end run waits on CEO Associates accounts (§5).
Track A (already approved): TL-DESIGN-1 PR1-8 (geography removal → Phase B) — first PR unblocks everything.
Track B (content, startable now): L1 trivia quality → L2 trivia expansion (Indian topics folded in, §3.4)
                          → L3 music + L4 movies (+ Bollywood quotas, §3.3) / L10 year backfill (parallel)
                          → L5/L6 clue rewrites → L8 clue trail → L7 world-peek photos.
Track C (dual-market, parallel to B): L11 charades volume (year/language/region) → L12 celebrities
                          volume (Bollywood first) — server-only data files, no client lockstep.
```

---

## 3. Dual-market dimensions (D13, India + US)

**UI language stays English. i18n is explicitly out of scope** (no
translation infrastructure, no RTL, no locale negotiation — the dual-market
work is _content and filters_, not localization).

### 3.1 Charades — `server/src/data/charades-movies.json` (300 → 2,000-3,000)

Additive fields: `year: number` (already planned, L10), `language:
"hindi" | "english"`, `region: "bollywood" | "hollywood"`. The existing
`category` field ("hollywood"/"bollywood") is retained and documented as the
legacy region alias — its meaning does not change; new code reads `region`.

```json
{
  "title": "Sholay",
  "category": "bollywood",
  "region": "bollywood",
  "language": "hindi",
  "year": 1975
}
```

**Lobby filters (extends TL-DESIGN-1 B.3.2 charades pattern):** the host
lobby's Hollywood/Bollywood/Mixed toggle becomes a **region + language +
decade chip row** (Region: All/Bollywood/Hollywood · Language: All/Hindi/
English · Decade: All/60s-20s presets). Chips are sent with the start
(`pendingCharadesFilter` — additive extension of `pendingCharadesCategories`),
the **server filters the pool** and constructs the deck; the engine is
unchanged (takes a filtered pool). Empty-cell guard: a cell with fewer
entries than the round need is hidden, never disabled (B.3.2 guard
semantics).

### 3.2 Guess Who — `server/src/data/celebrities.json` (205 → 2,000-3,000)

Additive field: `region: "bollywood" | "hollywood" | "row"` (rest-of-world
default; existing entries default `"row"` unless the author knows
otherwise — no forced recategorization). Lobby/room filter: region chips
(All/Bollywood/Hollywood/RoW), host-set at setup, **server-side filter**
(room game, server-authoritative pool). **Volume: Bollywood quota first**
(CEO ask): v1 1,000 total → Bollywood ≥ 400, Hollywood ≥ 400, RoW ≥ 200;
v2 2,000+ → Bollywood 800-1,000, Hollywood 1,000-1,200, RoW 400-600.
Bollywood entries use the same schema (name, gender, alive, profession,
nationality, ageRange, hairColor, famousFor, facts — D041 shape) with
facts written to the same quality bar.

### 3.3 Music + movies — Bollywood quotas alongside Hollywood

- `daily-music.json` (→ 2,000-3,000): additive `origin: "bollywood" |
"hollywood" | "other"` (+ existing year/genre). Decade quotas per origin
  (1960s-2020s presets, ≥15 per preset per origin at volume — extends
  TL-DESIGN-1 B.3.2 quota). Volume split: bollywood 500-800, hollywood
  1,200-1,600, other 300-600. Bollywood rows: songs from Hindi cinema,
  radio-safe, two-source checks, `bpmSource` present.
- `daily-movies.json` (→ 2,000-3,000): additive `region: "bollywood" |
"hollywood" | "other"` (+ existing year/genre). Same decade quotas per
  region; bollywood 500-800 at volume. Fake-synopsis quality bar unchanged
  (the fake must be plausible in its own cinema's register).
- **Filters:** origin/region chip row on the setup card of `MusicDaily` /
  `MoviesDaily` (client-side **filter-before-seed**, same mechanics as the
  decade filter, TL-DESIGN-1 B.3.3) — applies to solo AND daily surfaces,
  deterministic per (day, slug, filter). **Per-region dailies (different
  content for IN vs US) are rejected** — they break D050's
  same-for-everyone contract; the shared pool + user-facing filters is the
  market switch.

### 3.4 Trivia — Indian topics in the topic program (L1/L2)

The L1/L2 topic registry (PLAN-SCOPE §4) gains Indian topics — start set:
"Indian Cinema", "Bollywood", "Indian Sports", "India & South Asia"
(Geography/History) — as normal registry members (no new schema field).
Quota: ≥ 6 Indian/regional topics in the 40+ registry at L2; Indian-topic
questions ≥ 15% of the pool at 2,000+. The topic picker (R10) surfaces them
like any other topic; room trivia topic selection mirrors the solo picker
(host picks topic at setup; server filters the question pool).

### 3.5 Filter contract — server vs client

| Surface                       | Where the filter lives                                                         | Why                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Charades (room)               | **Server** — host lobby chips → `pendingCharadesFilter` → filtered pool → deck | Server-authoritative room game (D008); mirrors `pendingCharadesCategories` |
| Guess Who (room)              | **Server** — host lobby region chips → filtered pool                           | Same                                                                       |
| Music / Movies (solo + daily) | **Client** — setup-card chip row, filter-before-seed                           | Seeded client engines (D050); deterministic per (day, slug, filter)        |
| Trivia (solo + daily)         | **Client** — topic picker                                                      | R10 design                                                                 |
| Trivia (room)                 | **Server** — host topic at setup                                               | Server question pool (D032)                                                |

### 3.6 Quota table (test-enforced per lot)

| Dataset   | Cell                         | Quota at v1 (1,000)                                                  | Quota at v2 (2,000+)                              |
| --------- | ---------------------------- | -------------------------------------------------------------------- | ------------------------------------------------- |
| Charades  | (region × language × decade) | every rendered cell ≥ 15 per preset 1960s-2020s; region split ~50/50 | same cells ≥ 15; bollywood ≥ 800, hollywood ≥ 800 |
| Guess Who | region                       | bollywood ≥ 400, hollywood ≥ 400, row ≥ 200                          | bollywood ≥ 800, hollywood ≥ 1,000, row ≥ 400     |
| Music     | origin × decade              | every rendered preset ≥ 15 per origin; bollywood ≥ 300               | bollywood ≥ 500, hollywood ≥ 1,200, other ≥ 300   |
| Movies    | region × decade              | every rendered preset ≥ 15 per region; bollywood ≥ 300               | bollywood ≥ 500, hollywood ≥ 1,000, other ≥ 300   |
| Trivia    | Indian topics                | ≥ 6 topics; Indian-topic questions ≥ 100                             | ≥ 300 (≥ 15% of 2,000)                            |

### 3.7 Lockstep/registry implications — **none expected (verified)**

Charades/celebrities are **server-only** data files (no client mirror —
unlike trivia, which has the byte-identical mirror rule). The daily registry
count is unaffected (music/movies stay at the post-0.5 count of 11; charades
and guess-who are not dailies). The only test-surface changes are: the
decade-quota tests gain region/origin cells (extend, don't replace), and
the `games.test.ts` lockstep stays green untouched. **Flag: none.**

---

## 4. Decision entries drafted (appended to `docs/DECISIONS.md`)

- **D055 — Phase 0.5 + Phase B gameplay fixes** (from TL-DESIGN-1, reviewed
  and APPROVED today: geography removal, seeded answer randomization,
  sudoku keyboard, decade filters, reveal/specs, clue gates). Resolves the
  numbering TL-DESIGN-1 reserved.
- **D056 — Price Is Right image pipeline: PA-API primary, build-time
  resolution, human gate, self-hosted cache** (supersedes D034's Openverse
  source + R12's "Amazon infeasible" text).
- **D057 — Content scale program** (graduated volume, staged milestones,
  capacity math, LLM guardrails, QA gates, algorithmic-exempt list).
- **D058 — Dual-market dimensions** (additive schemas, filter contracts,
  quota table, English-only UI, i18n out of scope, no lockstep change).
- **D059 — INR/USD price model** (shared pool + per-region prices,
  market toggle; region-scoped pools documented as the alternative — PM
  escalation with a conservative default).

## 5. Escalations (owner/PM decisions required)

1. **INR/USD price model (PM call, before L9 authoring at scale):** shared
   pool with per-region price pairs (recommended default, designed in D059)
   vs region-scoped pools (separate US/IN catalogs). Affects authoring
   briefs and the correctness semantics of "the right price".
2. **Associates accounts (owner action):** two accounts (amazon.com +
   amazon.in) + PA-API keys via build env. Blocks the pipeline's end-to-end
   run, not its development.
3. **Affiliate disclosure copy (owner approval):** proposed one-liner in
   §1.7 (FTC requirement for affiliate links).
4. **webp vs JPEG (owner call only if the CEO insists):** conservative
   default JPEG ≤1200px as-served (no new dependency); webp needs `sharp`
   — a stack question (PRD §2) if pursued.
5. **L9 hold (confirm):** Price authoring stays held until pipeline v1 is
   approved; tracks B/C (§2.6) proceed now.
6. **Per-region dailies (out of scope, note):** different daily content per
   market would break D050 — rejected; filters are the market switch.

## 6. DoD checklist

- [ ] Backend/Frontend briefs derivable from §1.5/§1.7/§3.1-3.4 (each stage
      names files + acceptance)
- [ ] Content lots resumable with the pipeline approved (§2.6 tracks B/C
      start now; track D unblocks on keys)
- [ ] `pnpm verify` green after every lot (verify-gate discipline)
- [ ] Additive schema only (D006); no new dependencies; no
      `src/styles/global.css` / `src/components/ui/*` changes (design branch)
- [ ] CEO's runtime-search question answered in writing (§1.2)
