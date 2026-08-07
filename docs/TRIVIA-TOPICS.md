# Trivia Topic Hub — "Themed Trivia Tiles" (R10 delivery)

> Product spec (2026-08-06) for the R10 topic-trivia delivery in
> `docs/PLAN-SCOPE.md`. The `/game/trivia` page becomes the trivia hub:
> the existing Daily Trivia stays untouched, and a new **topic mode**
> (themed trivia tiles) is added beside it. Authoring pipeline mirrors
> `docs/CELEBRITY-SOURCING.md`; dual-market rules per D058; seeding
> conventions per D050; daily trivia + leaderboard must not regress.
>
> **Verified current state:** `src/data/trivia-questions.json` = 525
> questions / 10 categories (General 61, Science 63, History 66, Pop
> Culture 71, Sports 66, Geography 40, Movies 39, Music 39, Food 40,
> Technology 40), schema `{category, question, options[4], answer}` — no
> `topic`, no `difficulty`. `src/islands/TriviaSolo.tsx` is daily-only:
> D032 server-seeded challenge with local fallback
> (`selectDailyQuestions`), 10 questions × 15s, flat 10 pts/correct
> (M18, max 100), nickname → daily leaderboard → member submit. R7 answer
> randomization is already shipped for trivia (`shuffleQuestion` +
> `optionSeed` in `src/lib/pick.ts`). Icons: 39 SVG glyphs in
> `src/lib/icons.ts` (no emoji in UI chrome — brand rule). `/game/trivia`
> renders `TriviaSolo` via the shared `game/[slug].astro` template.

## 0. Decisions locked in this spec

| #   | Decision                | Value                                                                                                                                             | Why                                                                                                                                  |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| S1  | Questions per game      | **10** (locked)                                                                                                                                   | Consistent with `TRIVIA_QUESTIONS_PER_GAME` and the daily; 10–15 range per owner, 10 wins on consistency + existing timer/scoring UI |
| S2  | Per-topic content floor | **≥ 150 questions** (hard gate)                                                                                                                   | Owner's floor; test-enforced per topic file                                                                                          |
| S3  | Launch scope            | **15 topics × 150 = 2,250 questions** (≈ "~2,000")                                                                                                | 12–15 per owner; 15 chosen to satisfy D058's ≥6 Indian topics while keeping the launch lot tractable (§1)                            |
| S4  | Topic-mode scoring      | **Local score only — no daily leaderboard, no server submit** (§5)                                                                                | Replay-nonce rotation breaks same-day comparability; daily leaderboard stays on Daily Trivia only                                    |
| S5  | File layout             | **Per-topic JSON files + on-demand dynamic import**; classic 525 stays in the existing single file (§2)                                           | 40 × 150 questions ≈ 850 KB+ — cannot fit the 300 KB island bundle budget                                                            |
| S6  | Rotation                | `hashString(\`${topic}:${dateKey}\`)`for the day's first set;`hashString(\`${topic}:${dateKey}:${replayCount}\`)` for replays (§3)                | Exact contract below; same-for-everyone first set (D050-consistent), personal variety on replays                                     |
| S7  | Classic mode            | The 10 existing categories become a single **"Classic / Mixed"** tile over the 525-question pool, same rotation convention (topic slug `classic`) | No content wasted; one tile, not ten                                                                                                 |
| S8  | BE scope                | **Zero server changes** (§7)                                                                                                                      | Topic mode is client-only; daily challenge (D032) and submit endpoint untouched                                                      |

---

## 1. Topic taxonomy (40 slugs, launch order per D13)

Order follows D13: TV series first → movies → sports → music → video
games → Indian topics → history → science/tech → food/niche. **Launch
subset (15, ★) ships at ≥150 questions each; post-launch grows to 40.**

Fields per topic: `slug` (registry key, file name, seed string) · `label`
(user-facing) · `region` (`US` / `IN` / `global`) · `difficulty` 1–3
(topic-level; 1 = everyone can play, 3 = fans-only) · `icon` (SVG glyph —
reuse an existing `IconName` or `[new]` = additive glyph, §1.2).

### 1.1 Launch subset (15) — 2,250 questions

| #   | slug                  | label             | region | diff | icon                         |
| --- | --------------------- | ----------------- | ------ | ---- | ---------------------------- |
| 1   | `tv-general`          | TV Series         | global | 1    | `film`                       |
| 2   | `tv-friends`          | Friends           | US     | 1    | `users`                      |
| 3   | `movies-hollywood`    | Hollywood Movies  | global | 2    | `film`                       |
| 4   | `movies-bollywood`    | Bollywood Movies  | IN     | 2    | `popcorn`                    |
| 5   | `movies-harry-potter` | Harry Potter      | global | 2    | `sparkles`                   |
| 6   | `bollywood-scandals`  | Bollywood Buzz    | IN     | 3    | `[new] chat` (speech bubble) |
| 7   | `sports-cricket`      | Cricket           | IN     | 2    | `[new] ball`                 |
| 8   | `sports-football`     | Football (Soccer) | global | 1    | `[new] ball`                 |
| 9   | `sports-f1`           | Formula 1         | global | 2    | `[new] car`                  |
| 10  | `sports-tennis`       | Tennis            | global | 1    | `[new] ball`                 |
| 11  | `games-general`       | Video Games       | global | 2    | `gamepad`                    |
| 12  | `music-bollywood`     | Bollywood Music   | IN     | 2    | `music-note`                 |
| 13  | `history-india`       | Indian History    | IN     | 2    | `book`                       |
| 14  | `science-space`       | Space & Astronomy | global | 1    | `globe`                      |
| 15  | `food-india`          | Indian Food       | IN     | 1    | `[new] fork-spoon`           |

D058 check: Indian-region topics at launch = 6 of 15 (movies-bollywood,
bollywood-scandals, sports-cricket, music-bollywood, history-india,
food-india) = **40% of topics, ≥ 15% of pool** ✓ (`food-india` exists
specifically to reach the 6-topic rule — escalate with §8.1 if the owner
prefers a different 6th Indian topic).

### 1.2 Post-launch growth (25) — total 40

| #   | slug                  | label                 | region | diff | icon               |
| --- | --------------------- | --------------------- | ------ | ---- | ------------------ |
| 16  | `tv-thrones`          | Game of Thrones       | US     | 2    | `crown`            |
| 17  | `tv-breaking-bad`     | Breaking Bad          | US     | 2    | `bolt`             |
| 18  | `tv-office`           | The Office            | US     | 1    | `[new] desk`       |
| 19  | `tv-stranger-things`  | Stranger Things       | US     | 2    | `bolt`             |
| 20  | `movies-marvel`       | Marvel Movies         | global | 2    | `bolt`             |
| 21  | `movies-star-wars`    | Star Wars             | global | 2    | `[new] star`       |
| 22  | `movies-disney`       | Disney & Animation    | global | 1    | `sparkles`         |
| 23  | `sports-olympics`     | Olympics              | global | 2    | `trophy`           |
| 24  | `sports-basketball`   | Basketball            | US     | 2    | `[new] ball`       |
| 25  | `sports-nfl`          | American Football     | US     | 2    | `flag`             |
| 26  | `sports-combat`       | Boxing & MMA          | global | 3    | `flame`            |
| 27  | `music-pop`           | Pop Music             | global | 1    | `music-note`       |
| 28  | `music-rock`          | Rock & Metal          | global | 2    | `music-note`       |
| 29  | `music-hiphop`        | Hip-Hop & Rap         | US     | 2    | `music-note`       |
| 30  | `games-nintendo`      | Nintendo              | global | 2    | `gamepad`          |
| 31  | `games-pokemon`       | Pokémon               | global | 2    | `gamepad`          |
| 32  | `games-esports`       | Esports               | global | 3    | `trophy`           |
| 33  | `history-world`       | World History         | global | 2    | `book`             |
| 34  | `history-us`          | US History            | US     | 2    | `flag`             |
| 35  | `history-ancient`     | Ancient Civilizations | global | 2    | `globe`            |
| 36  | `science-nature`      | Nature & Animals      | global | 1    | `[new] leaf`       |
| 37  | `tech-general`        | Technology            | global | 2    | `tools`            |
| 38  | `food-world`          | World Food            | global | 1    | `[new] fork-spoon` |
| 39  | `geography-wonders`   | World Landmarks       | global | 2    | `[new] landmark`   |
| 40  | `general-curiosities` | Curious Facts         | global | 1    | `lightbulb`        |

**New glyphs to add to `src/lib/icons.ts` (9, house stroke style):**
`chat`, `ball`, `car`, `fork-spoon`, `desk`, `star`, `leaf`, `landmark`,
`rocket` (rocket optional — `globe` covers `science-space`; keep the list
to 8 if rocket is dropped). Everything else reuses existing glyphs.

### 1.3 Registry file

New `src/data/topics/registry.json`: the 40 rows above
(`slug`, `label`, `region`, `difficulty`, `icon`, `launch: true|false`)
— small, statically imported. Tests assert: 40 unique slugs; launch set
== 15; every launch slug has a question file; `region ∈ {US, IN, global}`;
`difficulty ∈ {1,2,3}`; ≥ 6 IN topics at launch (D058); icon ∈
`IconName` (after additive glyphs land).

---

## 2. Question schema + file layout

### 2.1 Schema (additive)

Classic rows (`trivia-questions.json`, 525) keep their exact shape —
**no edits, no migration**; they keep working (S7).

Topic files use one additive `topic` (required, must equal the file's
registry slug) and one additive `difficulty` (question-level, 1–3):

```json
{
  "topic": "sports-cricket",
  "difficulty": 2,
  "question": "Which nation won the first Cricket World Cup in 1975?",
  "options": ["Australia", "West Indies", "England", "India"],
  "answer": 1
}
```

`TriviaQuestion` in `src/lib/trivia.ts` gains `topic?: string` and
`difficulty?: number` (both optional — classic rows compile unchanged);
topic files are typed as `TopicQuestion = TriviaQuestion & { topic: string;
difficulty: 1|2|3 }` in the new topic lib.

### 2.2 Single file vs per-topic files — decision: per-topic + dynamic import

- **Size math:** 150 questions × ~140 bytes ≈ 21–35 KB per topic file;
  40 topics ≈ **850 KB–1.4 MB total**. Island bundle gate is **300 KB**
  per chunk (`scripts/smoke.mjs` `BUNDLE_BUDGET_BYTES`) — all topics in
  one statically-imported file fails the gate by ~3–5×.
- **Layout:** `src/data/topics/{slug}.json`, one file per topic. The
  topic play island loads the file on demand:
  `await import(\`../../data/topics/${slug}.json\`)` — Vite code-splits
  each JSON into its own chunk (platform feature, **no new dependency**).
  The registry (1.3) is the only static import.
- **Budget gate:** each topic chunk is ~25–35 KB — well under budget;
  the base hub island (registry + grid) stays small. `smoke.mjs` weight
  checks extend to `/game/trivia` (already covered by the page-weight
  checks — verify no regression) and the island-bundle gate now also
  applies to the new topic chunks.
- **Classic mode** keeps importing `trivia-questions.json` statically
  (already bundled today, in budget — no change).

---

## 3. Rotation algorithm (exact seed contract)

Pure functions in the new `src/lib/trivia-topics.ts`; no `Math.random`
anywhere in topic selection (D050 convention). Both FE and any future BE
consumer implement the strings below identically.

**Seed strings** (hashed with the existing FNV-1a `hashString` from
`src/lib/trivia.ts`):

| Case                              | Seed string                      | Example (`cricket`, 2026-08-06) |
| --------------------------------- | -------------------------------- | ------------------------------- |
| First set of the day (any player) | `` `${topic}:${dateKey}` ``      | `cricket:2026-08-06`            |
| Replay N (N ≥ 1)                  | `` `${topic}:${dateKey}:${N}` `` | `cricket:2026-08-06:1`          |

**Selection** (per game):

1. `seed = hashString(seedString)`.
2. `questions = pickDistinct(entries, 10, seed)` — the shared cursor
   shuffle from `src/lib/pick.ts` (DAILY-DESIGN §2.1 contract); pick
   order = round order; no repeats within a game; pool-edge contract:
   entries < 10 returns all (dev-only).
3. Option order per round: `shuffleQuestion(question, optionSeed(seed,
roundIndex))` — **existing shipped helpers** (`pick.ts`), where
   `optionSeed(seed, i) = hashString(\`${seed}:round:${i}:options\`)`.

**Properties (test-enforced):**

- Same topic + same day + same replay N ⇒ identical set for every player.
- Day change ⇒ different first set (`dateKey` in the seed).
- Replay bump ⇒ different set (`N` in the seed; adjacent-N sets may
  overlap a few questions but never repeat the same ordered set).
- "New questions" ⇒ `replayCount += 1`; the first set of a _new day_ is
  always the fresh `topic:dateKey` set regardless of the counter.
- Question `answer` never changes in data (R7 shuffles at render — the
  existing convention).

**Replay counter (localStorage):** key `triviahub:trivia-topic-replay:v1`,
value `{ [topicSlug]: number }` (monotonic per topic; ~40 keys max —
no pruning needed). First play of the day ignores the counter. Missing
or cleared storage ⇒ counter 0 (fresh first set — acceptable).

---

## 4. Content program (authoring pipeline, mirroring CELEBRITY-SOURCING)

### 4.1 License table (same facts-first logic; trivia-specific rows)

| Source type                                                            | Allowed                | Why / precedent                                                                                 |
| ---------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------- |
| Facts (dates, stats, plot facts, cast facts, records)                  | **Yes**                | Not copyrightable (Feist); Wikidata is CC0 (D010)                                               |
| Wikidata structured statements                                         | **Yes**                | CC0 — no attribution, no share-alike                                                            |
| Titles / character names / team names                                  | **Yes**                | Nominative use (`emoji-plots.json` precedent)                                                   |
| Verbatim Wikipedia / fan-wiki prose                                    | **No**                 | CC-BY-SA + expressive prose; PRD §7 wants original                                              |
| Copied quiz content (any quiz site, trivia packs, LLM verbatim output) | **No**                 | Copyright + D010 "no scraped content"; **original fact-based questions ONLY**                   |
| Quoted dialogue / lyrics / taglines                                    | **No**                 | Copyrighted expression (CONTENT-SOURCING §2 precedent)                                          |
| Plot summaries                                                         | **Yes, written fresh** | Facts; 1–2 sentences of our own prose (movies precedent, `daily-movies.json` style)             |
| Tabloid claims / unproven allegations / private-life details           | **No**                 | Defamation + AdSense risk (CELEBRITY-SOURCING §2 rows) — **binds `bollywood-scandals` hardest** |
| Original question text + distractors                                   | **Yes**                | We write it; `genre-benders.json` house style = quality bar                                     |

### 4.2 Sources + lot-script pattern

- **Candidate material:** Wikidata SPARQL per topic (e.g., cricket:
  records/players via `P641 Q5375`; TV series: episodes/cast via
  `P527`/`P161`; movies: box office, awards `P166`, cast) — extract →
  pre-screen → **human authoring list** (the `scripts/extract-celebrity-candidates.mjs`
  precedent; `scripts/extract-trivia-candidates.mjs`).
- **Authoring:** every question written fresh by the author from
  candidate facts; two independent sources for anything date-sensitive
  or numeric (Wikidata counts as one; a second reference required);
  LLM-assisted drafting allowed **only with mandatory human rewrite**
  (D057) and never asked to reproduce existing quiz/trivia content.
- **No IMDb scraping** (ToS + D010), no lyrics, no dialogue.

### 4.3 Quotas (test-enforced, cumulative per lot)

- **Per topic:** ≥ 150 questions at launch (hard floor).
- **Difficulty mix per topic:** 40% easy / 40% medium / 20% hard (loose
  bounds ±5 pts, test-enforced) — the owner's 40/40/20.
- **Dual-market (D058):** ≥ 6 IN-region topics at launch; IN topics ≥
  15% of the total pool (2,250 ⇒ ≥ 338 IN questions). Launch set
  satisfies both by construction (§1.1); tests enforce cumulatively as
  post-launch topics land.
- **Topic difficulty honesty:** a topic marked 1 must be answerable by a
  casual player; marked 3 by fans only — author review flag, not
  preference (CELEBRITY-SOURCING §5 spot-check rule).

### 4.4 Dedup rules

1. Normalized question text (`lowercase`, strip punctuation/whitespace)
   **unique within the topic file** — automated.
2. **Cross-file uniqueness:** normalized text unique across all topic
   files AND the classic 525 pool (a cricket question must not ship in
   two topics; classic pool is checked read-only) — automated, cheap at
   2–6k questions.
3. Same fact re-asked with different wording across topics is allowed
   only across _different_ topics (e.g., an actor's award in both
   `movies-bollywood` and `bollywood-scandals` is acceptable once each);
   within a topic, no near-duplicate phrasing.
4. Answer index may sit anywhere (R7 renders shuffles) — authors vary
   it naturally; no positional rule.

### 4.5 QA gates

**Automated** — new `src/lib/__tests__/trivia-topics.test.ts`:

1. Registry: 40 slugs unique; launch == 15; `region`/`difficulty`/`icon`
   enums; ≥ 6 IN topics; launch slugs all have files.
2. Schema per topic file: `topic` == slug; `question` 10–200 chars;
   4 non-empty options; `answer` 0–3; `difficulty` 1–3; count ≥ 150.
3. Mix: per-topic difficulty within 40/40/20 ±5; topic-level difficulty
   distribution sane (≥ 3 topics at each level 1/2/3 at launch).
4. Dedup: within-file + cross-file + vs classic pool (4.4).
5. **Golden rotation tests:** same `topic:dateKey` ⇒ same set; adjacent
   dates differ; `replayCount` 0/1/2 differ; no in-game repeats;
   `shuffleQuestion` applied per round with stable positions across
   identical seeds (R7 regression).
6. `pnpm verify` green (client + server suites unchanged — server has no
   topic-mode surface).

**Manual spot-check (every entry, per lot):** two-source rule for
numbers/dates; neutrality (no opinion words); family-safe PG only
(AdSense-prep — a question needing a content warning doesn't ship);
no private-life details (binds `bollywood-scandals`); difficulty honesty;
distractor plausibility (wrong options must be plausible, never silly —
the `daily-geography` distractor bar).

### 4.6 Lot order (D13-first, one lot = 1–2 topics, self-contained per-chat brief)

| Lot | Topics                                      | Questions |
| --- | ------------------------------------------- | --------- |
| T1  | `tv-general`, `tv-friends`                  | 300       |
| T2  | `movies-hollywood`, `movies-bollywood`      | 300       |
| T3  | `movies-harry-potter`, `bollywood-scandals` | 300       |
| T4  | `sports-cricket`, `sports-football`         | 300       |
| T5  | `sports-f1`, `sports-tennis`                | 300       |
| T6  | `games-general`, `music-bollywood`          | 300       |
| T7  | `history-india`, `science-space`            | 300       |
| T8  | `food-india`                                | 150       |

Each lot ships with its cumulative quota tests green (D057 lot
discipline). T1 starts immediately (unblocks FE); FE can demo with T1 +
sample data before the launch gate.

---

## 5. Scoring + leaderboard decision

**Topic mode = local score only. No daily leaderboard, no server
submit — explicitly.**

- Scoring formula identical to the daily: 10 pts per correct, 0 wrong
  (M18 flat), 15 s/question, **max 100** (`scoreTriviaAnswer` reused).
- **Why no leaderboard:** replays rotate the question set per player
  (`topic:dateKey:N`), so scores are not comparable across players after
  the first set; shipping a leaderboard would force either
  first-set-only scoring (confusing) or an unfair race. Daily Trivia
  keeps its D032 server-seeded leaderboard — that comparability is
  exactly why the daily stays curated.
- **No `submitDailyRun` call in topic mode; no `DailyRun` rows; no
  streaks.** Guests and members are treated identically (no nickname
  gate in topic mode).
- Results screen shows score X/100 + correct count; per-topic personal
  best is a **post-launch optional** (localStorage), out of v1.

---

## 6. UI (hub, grid, two-step, replay)

Page: `/game/trivia` becomes the hub (template branch in
`src/pages/game/[slug].astro`, guarded `game.slug === 'trivia'`; the
shared template's solo renderer is swapped for the hub island — daily
page `/daily/trivia` unchanged). Structure, top to bottom:

1. **Daily block (unchanged):** the existing `TriviaSolo` island renders
   first, exactly as today — "Today's Daily" framing. **Regression gate:
   zero changes to `TriviaSolo.tsx`.**
2. **Topic section:** heading ("Pick a topic") + **topic grid** —
   tiles consistent with the games grid (`GameCard` rhythm): SVG icon
   plate (no emoji), label, **question-count badge** ("150 questions"),
   **difficulty badge** (1–3, three-step indicator — design-input
   placement, Designer owns final styling), play affordance on hover.
   Optional (design input, not acceptance): region filter chips
   (All / US / India) over the grid.
3. **Classic tile:** first tile in the grid — "Classic / Mixed",
   `question` icon, "525 questions", plays 10 from the existing pool
   with the same rotation (slug `classic`).
4. **Two-step flow:** tile tap → topic play screen (same round UI
   language as the daily: question, 4 options, 15 s countdown, reveal) →
   results (X/100, correct count) with two CTAs: **"New questions"**
   (bumps the replay counter → new seeded set) and **"Pick another
   topic"** (back to grid). Back affordance available mid-game (round
   abandons; no score kept).
5. **Replay affordance:** the "New questions" button is the only replay
   entry point; label communicates the promise ("Fresh set, same
   topic").

Files (FE): `src/islands/trivia/TopicHub.tsx` (grid + daily block
composition lives on the page — see §7), `src/islands/trivia/TopicPlay.tsx`
(round engine, local-only), `src/lib/trivia-topics.ts` (registry types +
rotation + replay counter — pure, unit-tested), `src/data/topics/registry.json`,
`src/data/topics/{slug}.json` ×15, `src/lib/icons.ts` (+8–9 glyphs),
`src/pages/game/[slug].astro` (trivia branch), tests.

---

## 7. Milestones + task boundaries

| #    | Task                                                                | Owner                           | Depends                | Exit                                                                                                                 |
| ---- | ------------------------------------------------------------------- | ------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| M-T1 | Topic registry + icons + schema types + rotation lib + golden tests | FE                              | —                      | `trivia-topics.ts` green; registry tests pass with sample files                                                      |
| M-T2 | Content lots T1–T8 (2,250 questions)                                | Content author (per-chat lots)  | starts immediately     | quota + QA gates green per lot (cumulative)                                                                          |
| M-T3 | Hub page + topic grid + classic tile                                | FE (Designer styling on branch) | M-T1; T1 data for demo | `/game/trivia` renders hub; daily block pixel-identical                                                              |
| M-T4 | Topic play + replay counter + results                               | FE                              | M-T1                   | play-through works; "New questions" changes the set (golden test)                                                    |
| M-T5 | Budget + smoke + regression pass                                    | FE                              | M-T3/T4                | `/game/trivia` weight + island bundles in budget; daily trivia + leaderboard verified unchanged; `pnpm verify` green |
| M-T6 | **Launch gate**                                                     | PM sign-off                     | T1–T8, M-T3–T5         | 15 topics ≥ 150 each (2,250), D058 quotas met, tests green, daily no-regression                                      |
| M-T7 | Post-launch growth to 40 topics                                     | Program (D12)                   | after launch           | 25 more topics land via the same gates                                                                               |

**BE boundary (explicit): zero server changes.** No new endpoints, no
schema changes, no `LIVE_DAILY_GAMES` changes, no submit-route changes.
The lockstep/daily tests are untouched — this feature cannot regress the
server. The only cross-boundary contract is the seed-string spec (§3),
documented for a future topic leaderboard.

**Regression gate (non-negotiable):** `TriviaSolo.tsx`, D032
daily-challenge seeding, and the daily leaderboard/submit path are not
modified by this feature; the existing 144 client + 190 server tests +
smoke must stay green throughout.

---

## 8. Escalations (owner confirmations, with recommendations)

1. **Launch set composition.** 15 topics incl. `food-india` (6th Indian
   topic) to satisfy D058's ≥6-IN rule. **Recommend: accept as listed**;
   if the owner prefers a different 6th Indian topic (e.g., `movies-marvel`
   is not Indian — alternatives: `tv-sitcoms-indian`, `bollywood-music`
   is already in) — swaps are cheap pre-authoring, cost a day mid-program.
2. **`bollywood-scandals` framing.** Label "Bollywood Buzz" +
   facts-only/public-record gate (no unproven allegations, no
   private-life details — CELEBRITY-SOURCING §2 privacy rows bind here
   hardest). **Recommend: accept the label + gate**; a looser "gossip"
   interpretation is a defamation + AdSense risk.
3. **Classic tile rotation.** Uses the same `topic:dateKey[:N]`
   convention with slug `classic`. **Recommend: yes** — one convention
   for everything; alternative (random per play) breaks the "same for
   everyone today" property for no benefit.
4. **Icon additions.** 8–9 new stroke glyphs in `src/lib/icons.ts`.
   **Recommend: accept** (house pattern, no emoji); drop `rocket` if the
   owner wants a minimal set.
5. **Topic-mode leaderboard.** Permanently local-only in v1 (S4).
   **Recommend: accept**; revisit only if the owner wants first-set-only
   leaderboards (extra surface + seed contract already documented).
6. **Difficulty badges on tiles.** Topic-level difficulty shown as a
   3-step badge; question-level mix stays 40/40/20 internally.
   **Recommend: accept** — badge helps topic choice; hides question-level
   variance.

## 9. Risks

- **Content volume (long pole):** 2,250 original questions at launch
  (15 × 150) — mitigation: T1 starts immediately, lots are
  self-contained per-chat briefs, LLM-assisted drafting with mandatory
  human rewrite (D057), quotas test-enforced cumulatively (risk 5 of
  PLAN-SCOPE).
- **Copyright-adjacent drift:** plot questions, character facts, award
  lists are facts; dialogue/lyrics/verbatim summaries are not — the
  license table (§4.1) + two-source rule bound it; `bollywood-scandals`
  carries the tabloid risk (escalation 8.2).
- **Bundle regression:** topic JSON must stay dynamically imported; a
  static import of all topics fails the 300 KB island gate — budget
  check in M-T5 + `smoke.mjs` weight checks.
- **Daily regression:** any shared-code refactor risks the live daily —
  mitigated by the zero-touch rule on `TriviaSolo.tsx` and the existing
  golden tests.
- **Dual-market balance drift:** post-launch lots could dilute the IN
  share — D058 quota tests are cumulative by design.
- **Replay-counter edge cases:** cleared storage resets counters (fresh
  first set — acceptable); two devices on one browser profile share the
  counter (same as all local state today — acceptable).
- **Cross-topic dedup:** same question in two topic files — automated
  cross-file test; review gate double-checks near-duplicate phrasing.
