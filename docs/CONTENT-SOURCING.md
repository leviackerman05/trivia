# Content Sourcing: 4 Planned Daily Games

> Research deliverable (2026-08-05). Sourcing specs for the four `live:false`
> daily games in `src/lib/daily.ts`: **geography, movies, music, drawing**.
> Data shapes stay consistent with existing datasets (emoji-plots,
> trivia-questions, copycat-images, price-products). No production code —
> PM/TL can hand these specs to a content authoring pass directly.

## How the 4 games plug into the daily framework

- Selection is the **client-side seeded pool** pattern (D050, sudoku
  precedent, per the `daily.ts` contract): `dailyGameSeed(dateKey, slug)`
  picks the day's content deterministically from a static JSON array.
  Trivia alone keeps its server-seeded challenge (D032) — unchanged.
- Therefore every dataset below is **static, flat JSON** in `src/data/`
  (client bundle), selected by index. Index-based identity (no `id` field)
  matches every existing dataset.
- Sizes: each dataset targets **100+ entries** (handoff floor). One entry
  per day ⇒ 100+ days of unique content; the recommended sizes below trade
  authoring cost against months-before-repeat coverage.

## Shared licensing policy (applies to all four)

PRD §7 (AdSense prep): _"No copyrighted material (images must be public
domain or original)"_; PRD §13: _"Do NOT use any paid or copyrighted
images (all images must be public domain, CC0, or self-created SVGs)"_.
Open Question #2 in `PROJECT_STATE.md` (Draw the Lyric licensing) set the
repo precedent: **default = paraphrased / original / public-domain only**,
and the M5 datasets (`genre-benders.json`) ship original paraphrase text.

| Source type                                      | Allowed                                                  | Attribution                                      | Repo precedent                                                                                                       |
| ------------------------------------------------ | -------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Facts (dates, BPM, plot facts, titles)           | Yes — facts are not copyrightable (Feist v. Rural, 1991) | None needed                                      | `emoji-plots.json` ships film titles + years                                                                         |
| Photos: PD / CC0                                 | Yes                                                      | None required (good practice anyway)             | `copycat-images.json` (Wikimedia `Special:FilePath` URLs)                                                            |
| Photos: CC-BY / CC-BY-SA                         | Yes                                                      | **Visible credit on reveal**                     | `price-products.json` `credit: {creator, license}`                                                                   |
| Vector art: CC-BY-SA / GFDL (Cburnett chess set) | Yes                                                      | **Visible footer credit** + comment in each file | `public/images/chess/pieces/*.svg` → footer line "Chess piece set by Colin M.L. Burnett (GFDL / CC BY-SA 3.0 / GPL)" |
| Photos: CC-BY-NC/ND, fair-use, "found on web"    | **No**                                                   | —                                                | —                                                                                                                    |
| Original prose (synopses, prompts, emoji clues)  | Yes — write it ourselves                                 | None                                             | `genre-benders.json`, `genre-swaps.json`, `rhymes.json`                                                              |
| Lyrics, audio, album art, studio/IMDb synopses   | **No**                                                   | —                                                | Open question #2                                                                                                     |

---

## 1. Daily Geography — "Where in the World?"

> **SUPERSEDED — removed in M20 Phase 0.5 (PLAN-SCOPE R5/D6); World Peek
> replaces it with fresh data in Phase C. No dataset work to discard
> (the 15-entry sample dies with the code).**

**Default concept (owner-set):** a photo; pick the place out of 4 options.

### Data model — `src/data/daily-geography.json`

Mirrors `copycat-images.json` (photo URLs) + `trivia-questions.json`
(embedded options/answer pattern):

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

- `options` embedded per entry (4 incl. the answer), `answer` = index —
  exactly the `trivia-questions.json` contract; the seeded day picks one
  entry, the island renders it.
- `region` enables balance checks; `hint` shown after a wrong guess.

### Size target

**120 entries** (~4 months without repeats; distractor quality is the
bottleneck, not photos). Regions quota: ≥10 per continent bucket
(africa, americas, asia, europe, oceania) so the daily doesn't skew
European. No dated landmarks (e.g., event venues); photo must be
guessable without text overlays or recognizable people.

### Sourcing plan

1. **Photos:** Wikimedia Commons via `Special:FilePath` (hotlinked, no
   storage — the proven `copycat-images.json` pattern). Preference order:
   PD/CC0 → CC-BY → CC-BY-SA. Curate from Commons category pages per
   candidate place; verify the file renders and the title/URL pair is
   stable at authoring time (see risk: no hotlink check exists today).
2. **Distractors:** 3 per entry, same-region-or-similar-landform where
   possible (islands vs islands, deserts vs deserts) — a wrong answer must
   be plausible, not silly.
3. **Credits:** `credit` field per `price-products.json` precedent;
   reveal screen shows "Photo: creator (CC-BY)" for non-PD images.

### Licensing notes

- Commons files under CC-BY/CC-BY-SA require attribution — the `credit`
  field + reveal credit covers it. Avoid CC-BY-NC/ND and "fair use" files.
- Freedom-of-panorama caveat: prefer photos of landscapes/cityscapes over
  photos where a copyrighted artwork dominates the frame (varies by
  country) — cheap to avoid at curation time.

### Owner decisions

1. **Distractors:** curated-and-embedded (recommended — quality control,
   matches trivia pattern) vs generated from a place-name pool (halves
   authoring, weaker geographic plausibility).
2. **Credits on reveal:** show credit line (recommended, required for
   CC-BY/SA) vs PD-only photo pool to skip credits.
3. **Hint text:** include (recommended — helps the daily's casual player)
   vs photo-only purity.

---

## 2. Daily Movies — "Real or Fake?"

**Default concept (owner-set):** 10 rounds; each round shows a synopsis,
player answers real vs fake.

### Data model — `src/data/daily-movies.json`

Pairs pattern (real + fake authored together), consistent with
`genre-swaps.json` (original + rewritten description):

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

- 10 rounds/day ⇒ the seed picks 10 entries; `real`/`fake` shown in random
  order per round (client shuffle from the day seed — deterministic per
  day, like sudoku). Both texts must be **original prose**; the fake must
  be plausible (same genre/era family, wrong plot).
- No `options` field: the game is true/false, so the pair IS the round.

### Size target

**150 entries minimum** (15 days of unique rounds); **300 recommended**
(full month + headroom). Real/fake mix per day: 4-6 real of 10, seeded —
never a fixed 5/5 pattern (predictability is a solver exploit).

### Sourcing plan

1. **Real synopses:** hand-written from public plot knowledge — 2-3
   sentences, factual summary, no studio/IMDb copy, no taglines, no
   quoted dialogue. Mix of decades (1950s-2020s) and genres; include
   family-friendly + famous + "cult" tiers for difficulty spread.
2. **Fake synopses:** hand-written wrong-plots in the same tonal register
   (see `genre-swaps.json` for the house style — it is the quality bar).
3. **Optional acceleration:** LLM-assisted drafting with mandatory human
   rewrite/review (see owner decision 3) — never verbatim output.

### Licensing notes (cite: Open Question #2 reasoning)

- Same default as Draw the Lyric/Genre-Bender: PRD forbids copyrighted
  material, so **no studio synopses, no IMDb copy, no taglines, no
  dialogue quotes**. Facts (who-what-where) are not copyrightable
  (Feist v. Rural); expression is — write every sentence fresh.
- Titles are trademarks, not copyright: nominative use for identification
  is fine — `emoji-plots.json` already ships "Harry Potter…", "The
  Godfather", etc. No title art, no logos.
- AdSense angle: PRD §7 wants "original and substantial" content —
  original synopses are exactly that; copied blurbs would be both a legal
  and a policy risk.

### Owner decisions

1. **Authoring volume:** 150 (fast) vs 300 (a month of dailies).
2. **Real/fake ratio:** seeded 4-6/10 (recommended) vs fixed 5/5.
3. **AI-assisted authoring allowed?** Recommended only with a human
   rewrite pass (speed) — but the AI must not be asked to reproduce
   copyrighted summaries (training-data memorization risk).

---

## 3. Daily Music — "Name That Song"

**Default concept (owner-set):** song-ID from emoji / year / BPM clues.
**NO audio** (licensing) — correct call; also no lyrics (Open Question #2).

### Data model — `src/data/daily-music.json`

Mirrors `emoji-plots.json` (emoji clue + title + year) + `genre-benders.json`
(title/artist pair):

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

- `bpm` displayed as a clue ("144 BPM"); `year` and `emoji` are the other
  clues. BPM/year/title/artist are **facts and identifiers** — no
  copyright exposure; emoji sequences are original expression.
- `options` embedded (4 titles incl. answer) — recommended over type-in
  (see owner decision 2); seeded day picks one entry.

### Size target

**120 entries** across decades (1950s-2020s) and genres (pop, rock, hip-hop,
country, EDM, Latin, R&B, K-pop); difficulty tiers by ubiquity
("Happy" = 1, "Bohemian Rhapsody" = 2, deep cuts = 3).

### Sourcing plan

1. **Titles/artists/years:** public knowledge; cross-check with two
   sources at authoring time.
2. **BPM:** public metadata databases (e.g., GetSongBPM/Tunebeat-class
   listings) — BPM is factual data, usable; verify each value manually
   and store the source URL in a `bpmSource` field (internal QA, not
   displayed) to keep accuracy honest.
3. **Emoji clues:** hand-authored, 3-4 emoji per song, same style as
   `emoji-plots.json` (no text, no faces-of-artists — the emoji must
   evoke the song, not the video).
4. **Options:** 3 plausible same-era/same-genre decoys per entry.

### Licensing notes

- **No audio files, no album art, no lyrics, no music videos** — every one
  is a copyright or licensing wall (PRD §13; Open Question #2). The clue
  design (emoji/year/BPM) is deliberately audio-free and lyric-free.
- Titles/artist names: nominative use, `emoji-plots.json` precedent.
- **Radio-safe filter:** site is AdSense-prep (§7) and family-adjacent —
  default to clean/original-radio versions. ⚠ Conflict to flag:
  `genre-benders.json` already ships "WAP" — existing precedent is looser.
  Owner call below.

### Owner decisions

1. **Content filter:** radio-safe only (recommended) vs match the
   genre-benders looseness.
2. **Answer input:** 4-option multiple choice (recommended — deterministic
   scoring, no answer normalization, consistent with geography/trivia) vs
   type-in (needs artist/title fuzzy matching — new engine work).
3. **BPM exactness:** show integer BPM as-is (recommended) vs banded
   ("130s") to reduce clue ambiguity.

---

## 4. Daily Drawing — "Prompt of the Day"

**Default concept (owner-set):** prompt of the day + canvas submission +
gallery voting.

### Data model — `src/data/daily-drawing-prompts.json`

Mirrors `rhymes.json` (prompt + category):

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

- The prompt + constraints render on the island; the seeded day picks one
  entry. **The gallery lives server-side** — submissions are user
  content, not static JSON (see note below).
- `constraints` optional; `no_text`/`no_letters` are the enforceable ones
  today (gallery filtering can check for text-ish strokes later — engine
  work, out of scope here).

### Size target

**150 prompts** across balanced categories (animals, food, objects,
actions/scenes, fantasy, jobs, transport, nature). Difficulty 1-3
(1 = single noun, 3 = compound scene). Evergreen only — no holiday-timed
prompts unless a seasonal calendar is added later.

### Sourcing plan

1. **Prompts:** 100% original authoring — short phrases, no proper nouns,
   no trademarked characters ("Mickey Mouse", "Pokémon" — rejected:
   trademark + derivative-work risk), no brand names. Nothing prompting
   real people or real events.
2. **Seed material:** the existing 5,686-word skribbl word bank (already
   curated for drawability, technical-debt note in PROJECT_STATE) can be
   combined into compound prompts — reuse, don't re-derive.
3. **Gallery/voting:** server-persisted submissions keyed by
   `(dateKey, slug)` — the static JSON only carries the day's prompt; a
   submissions table + moderation flag is a server schema addition
   (follows the `DailyRun` idempotency pattern, D049).

### Licensing notes

- Prompts are original expression — zero copyright exposure by
  construction. The ban on trademarks/characters is the one rule to
  enforce in review.
- Submissions are user-generated: AdSense-safe moderation matters more
  than licensing (report/flag + age-gating note in TOS); PRD §7's
  "original and substantial" applies to our pages, not the gallery.

### Owner decisions

1. **Gallery moderation:** flag-and-remove (recommended, cheap) vs
   pre-approval (safe, heavy) vs none (risky — children's content).
2. **Prompt tone:** family-safe PG (recommended) vs edgier (conflicts
   with AdSense prep).
3. **Trademark rule:** strict ban (recommended) vs allow famous
   characters for drawability (legal exposure, needs the "no derivative
   works" review — default stays strict).

---

## QA for all four datasets

- **Schema validation:** a vitest suite (repo convention) asserting shape,
  `answer`/`options` consistency, unique titles/places, ≥100 entries, and
  region/category/difficulty quotas — same pattern as the existing
  dataset tests (TESTING_STRATEGY).
- **Seed determinism:** one test per dataset: `dailyGameSeed(dateKey,
slug)` over N consecutive dates selects valid indexes with no crashes
  and full coverage of the pool.
- **Photo checks:** at authoring time, every `Special:FilePath` URL must
  return 200 and a real image. ⚠ Known gap: no automated hotlink check
  exists today (`copycat-images.json` has none) — a CI smoke step is
  recommended but is engine work, flagged, not blocking.
- **License checklist:** each entry reviewed against the table at the top
  of this doc before merge (credit present ⇔ license requires it).

## Risks

- **Hotlink breakage:** Wikimedia file renames kill a daily silently —
  mitigate with the CI check (above) and a `verified` date stamp per entry.
- **Authoring volume:** 120-300 hand-written entries × 4 games is the
  long pole; the LLM-assisted option (movies fakes, music decoys) is
  viable only with human review — AI output must never reproduce
  copyrighted summaries verbatim (memorization risk).
- **BPM accuracy:** wrong BPMs make clues unsolvable; the two-source +
  `bpmSource` rule bounds this.
- **Movie-fake quality:** a fake synopsis that accidentally matches a real
  third film is a correctness bug, not a legal one — review pass catches
  it; worth a note in the authoring checklist.
- **Daily-movies ratio exploit:** a fixed 5/5 pattern is learnable; seeded
  4-6/10 (and reshuffled rounds) keeps the puzzle honest.
