# Content Engine, From Finite Datasets to an Infinite, Trustworthy Catalog

**Task 7 of the Vision 2.0 brief.** Today TriviaHub ships hand-curated static JSON.
That is a strength (quality, licensing safety) and a ceiling (525 trivia questions
cannot feed 12 daily games forever). This doc designs the pipeline that removes the
ceiling **without** removing the safety rails.

---

## 1. Ground truth: what the content layer looks like today

| Dataset                               | Size / shape                     | Notes                                                      |
| ------------------------------------- | -------------------------------- | ---------------------------------------------------------- |
| `trivia-questions.json`               | ~525 questions, 4 options        | Hand-curated, categorized                                  |
| `emoji-plots.json`                    | curated plots                    | ,                                                          |
| `would-you-rather.json`               | curated pairs                    | ,                                                          |
| `genre-swaps.json`                    | curated songs, swapped titles    | Paraphrased/original only (PRD §13)                        |
| `genre-benders.json`                  | 200 bended titles                | 130 added via paraphrasing pipeline, licensing-safe        |
| `price-products.json`                 | 536 products, 523 with CC photos | Openverse `commercial`-license enrichment + credits (D034) |
| `timeline-events.json`                | curated events                   | ,                                                          |
| `rhymes.json` + `rhyme-phonemes.json` | curated                          | ,                                                          |
| `sudoku-puzzles.json`                 | 400 unique-solution grids        | Offline generator, daily pick seeded by date               |

Content rules that must never be relaxed:

- **PRD §13:** no copyrighted material, no scraping, no paid images. All images
  public domain, CC0, or self-created. Lyrics paraphrased or original only.
- **D010:** datasets live in-repo, validated by a dataset-integrity test.
- **D034:** CC image pipeline with embedded `credit` (creator + license) shown in UI.

The honest problem: **maintenance cost is linear in catalog size, but replay value
needs exponential content.** Every daily game consumes 1 prompt/day minimum
(Trivia consumes 10). One year of dailies = ~4,600 prompts. Hand-curation cannot
scale; unmoderated AI cannot be trusted. The engine below is the answer.

---

## 2. Design principles

1. **AI assists; humans certify.** Every content item carries provenance, and every
   item reaches players only after passing automated gates. Sensitive categories
   (NHIE tiers, MLT) get human review or stay restricted.
2. **The static dataset is the floor, not the ceiling.** Bundled curated content
   remains the cold-start and offline fallback; the engine adds a versioned overlay.
3. **Never generate what we cannot verify.** Trivia facts need a source check;
   price guesses need a licensed image or emoji; rhymes need a phoneme check.
4. **Dedup is a first-class gate, not an afterthought.** Same question reworded
   three ways is three items of boredom.
5. **Licensing by construction.** No copyrighted input, no copyrighted output.
   The pipeline refuses copyrighted prompts (lyrics, quotes, stills) outright.

---

## 3. The content item model

```text
ContentItem {
  id            // stable slug
  gameType      // trivia | emoji-plot | wyr | nhie | mlt | genre-swap |
                // genre-bender | guess-who-prompt | timeline | price | rhyme
  payload       // game-specific: question+options+answer, pair, prompt, event...
  tags          // category, difficulty (calibrated), audience, culture, holiday
  difficulty    // 1-5, calibrated by play data (see §5)
  provenance    // { kind: curated | ai-assisted | player-derived,
                //   model?, promptHash, reviewedBy?, reviewedAt }
  license       // { status: pd | cc0 | cc-by | cc-by-sa | original,
                //   credit?, sourceUrl? }
  state         // draft -> gated -> live | rejected | quarantined
  usage         // play count, report count, fun rating (surveys)
  version       // content items are immutable; edits create new versions
  i18n          // locale fields (future)
}
```

Storage: today `src/data/*.json`; the engine adds a `ContentItem` table (Postgres)
with the bundled JSON as a migration-seeded baseline. The game runtime reads
"bundled + live overlay" with the bundle as fallback, a missing remote item
never breaks a game.

---

## 4. Per-type generation pipelines

Common skeleton for every pipeline:

```text
prompt spec -> generate batch (model + strict JSON schema) -> structural validation
-> dedup vs. corpus -> difficulty pre-calibration -> safety gates -> sample human
review (rate-based) -> stage as draft -> promote to live
```

### 4.1 Trivia

- **Source strategy:** facts must come from public-domain/CC references or be
  verifiable common knowledge. No pop-culture quotes (copyright), no trademarked
  imagery. Where a fact needs an image, reuse the Openverse pipeline with credits.
- **Generation:** batch 50 questions per topic (topic = category + difficulty +
  audience). Model writes 4 options, marks the answer, and self-justifies with a
  source sentence; a **fact-check pass** (second model call, or a small curated
  source list) rejects unverifiable claims.
- **Gates:** structural JSON, 1 correct + 3 plausible-but-wrong distractors,
  no duplicate answer strings, distractor similarity check (all options must be
  same _kind_, years vs. people vs. places must not mix).
- **Freshness:** "on this day" trivia (historical events for the current date)
  generates a rotating pool that keeps the daily game feeling alive without
  hand-curation.

### 4.2 Emoji plots

- Generate 5-emoji sequences for a movie/book plot; the answer is a title that
  must be **in the public domain or original** (classic books, myths, original
  TriviaHub premises). Franchise titles (Harry Potter etc.) stay hand-curated
  and rare, they are promotional references, not copied content, but only where
  the owner explicitly approves the pack.
- Gate: emoji lexicon is restricted to a fixed allowlist (no rendering surprises),
  and answer normalization runs through the same `normalizeTitle` used by
  Draw the Lyric.

### 4.3 Would You Rather / Never Have I Ever / Most Likely To

- These are the safest and highest-volume pipelines: original prompt authoring
  needs no facts. Batch-generate per tier (family / party / adult), audience
  (workplace / classroom / friends), and season.
- Gates: **tier classifier** (family/party/adult) must agree with the target tier;
  NHIE adult tier stays behind the existing AdSense-safe default (D040) and can
  never be the daily game. Profanity + policy filters, then human review for the
  adult tier.
- Dedup: near-duplicate detection (normalized text + embedding distance below
  threshold = reject).

### 4.4 Genre Swap / Genre Bender

- **Hard constraint: no copyrighted lyrics.** The existing paraphrasing rule is
  the law of the land (open question #2 in PROJECT_STATE). Generation takes
  _original_ hook lines written by the model (or the community) and swaps genres,
  or paraphrases a public-domain poem. Never accepts a real lyric as input.
- Gate: "did the model copy a real lyric?" check, model must produce a
  paraphrase of its own original line; a similarity check against a
  known-lyrics hash index rejects near-exact matches (the industry-standard
  approach without storing lyrics).

### 4.5 Guess Who prompts (for daily Guess Who)

- Daily Guess Who plays _against the machine_: the engine authors a persona
  ("I collect train tickets from every country I visit") and players guess the
  persona archetype or answer questions. Generation is original-character
  authoring, no real people, no celebrities (persona engine).
- Gate: persona must pass the "no real person" check (name + trait collision
  with a small celebrity/notable list) and the tier classifier.

### 4.6 Timeline

- Generate event sequences from public-domain/CC history sources only. The
  date-verification gate uses a curated calendar of historical events as ground
  truth; any event the source list cannot confirm is rejected.
- The "this week in history" pool gives dailies a calendar hook.

### 4.7 Price Guess

- The 536-product corpus grows via the Openverse pipeline: propose a product →
  search CC `commercial`-licensed photo → human/auto relevance check → store with
  credit. No photo = emoji fallback (existing behavior, D031/D034).
- Gate: product must be a real, recognizable object; prices from public list
  prices at enrichment time; a stale-price check on rotation.

### 4.8 Rhyme

- Generation composes original limericks/haiku pairs from the phoneme dictionary
  (`rhyme-phonemes.json`). Gate: actual phoneme validation (the model may not
  actually rhyme, the phoneme matcher decides), meter check, tier classifier.

### 4.9 Community content (the second pipeline)

- **Drawing Challenge** (03) already has a community vote loop, that is a content
  engine for drawing. Extend the principle: players can submit original
  Would-You-Rather pairs, trivia questions, and emoji plots from the results
  screen ("your question could be a Daily"). Community submissions enter the same
  pipeline as **player-derived** items: moderation queue → tier check → dedup →
  human review → credited author badge. This converts engagement into inventory.

---

## 5. Quality gates (the non-negotiable layer)

| Gate                  | What it catches                  | Implemented as                                                         |
| --------------------- | -------------------------------- | ---------------------------------------------------------------------- |
| Structural schema     | Malformed JSON, missing fields   | JSON Schema + contract test                                            |
| Dedup (exact)         | Same string twice                | Normalized hash index                                                  |
| Dedup (near)          | Reworded duplicates              | Embedding distance > threshold, or shingled Jaccard (cheaper, offline) |
| Fact check            | Unverifiable trivia/timeline     | Source-list lookup + second-model review                               |
| Tier classifier       | Adult content in family pools    | Classifier + keyword layer; adult tier never dailies                   |
| Profanity/policy      | AdSense violations (D040)        | Blocklist + classifier, always server-side                             |
| Licensing             | Copyrighted lyrics/quotes/images | Known-lyrics hash index; CC-only image source; no-scrape rule          |
| Answer quality        | Ambiguous questions              | Distractor-kind check, answer-normalization test                       |
| Play-data calibration | Difficulty mislabeled            | Posterior adjustment from correctness rates (see below)                |

**Difficulty calibration:** every item ships with a prior (category-based) and a
posterior (play-data-based). After N≥50 plays, `difficulty = f(correctRate)`;
daily and solo matchmaking use the posterior. This is a content-engine feature
CrowdParty does not have at all, their difficulty is vibes.

---

## 6. Moderation & review workflow

- **Tiers:** auto-approved (structural + gates pass, family tier), **sampled
  review** (party tier, 10% human sample + report-triggered review), **full
  review** (adult tier, community submissions, anything with an image).
- **Reports:** in-game "report prompt" flows into the same queue with the item's
  provenance attached; 3 reports on a live item = automatic quarantine pending
  review.
- **Human review surface:** an admin queue (host-workspace-grade, V2.0) showing
  item, provenance, gate results, play stats. Reviewers approve/reject with one
  click; decisions feed the classifier retraining set.
- **Player-generated content in rooms** (drawings, chat, NHIE answers) uses the
  existing moderation surface (06 §8), the content engine covers _catalog_
  content; the room engine covers _live_ content. Both share the same policy
  classifier.

---

## 7. Freshness math (why this matters)

| Game             | Daily consumption | Yearly need | Hand-curated pool today |
| ---------------- | ----------------: | ----------: | ----------------------: |
| Daily Trivia     |      10 questions |       3,650 |                    ~525 |
| Daily Emoji Plot |                 1 |         365 |                 curated |
| Daily Rhyme      |          1 prompt |         365 |                 curated |
| Daily Timeline   |                 1 |         365 |                 curated |
| 8 other dailies  |            1 each |      ~2,920 |                 curated |

Without the engine, the catalog dies of consumption in 3-6 months. With it,
**the floor is "all daily content is gated,"** and the ceiling disappears.
The engine is not a nice-to-have; it is the load-bearing wall of the ritual pillar.

---

## 8. Why this beats the competition

- **CrowdParty:** AI generation exists but visibly unmoderated (`undefined OR
undefined` previews, no provenance shown). We show provenance on every item,
  certify licensing, and calibrate difficulty from data.
- **Sporcle/Quizizz:** authoring is manual; a human writes each quiz. We keep
  human _certification_ while machines do the bulk writing.
- **Kahoot:** same manual ceiling, plus their community Q banks are the
  copyright nightmare we refuse to have.
- TriviaHub's position: **"infinite content, but you can trust every item"**.
  provenance, licensing, tiers, and calibration visible in the UI.
