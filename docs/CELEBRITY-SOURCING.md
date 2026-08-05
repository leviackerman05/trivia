# Celebrity Dataset Sourcing: Guess Who (Celebrity Edition)

> Research deliverable (2026-08-06). Sourcing spec for the Guess Who
> celebrity pool — `server/src/data/celebrities.json` (205 entries today →
> 1,000 at v1 → 2,000-3,000, D057/D12). Follows the pattern of
> `docs/CONTENT-SOURCING.md`; quotes the D058 draft in `docs/ARCH-DESIGN-2.md`
> §3.2/§3.6. No production code — this doc hands a complete authoring spec
> (sources, licensing, schema, quotas, QA gates) to PM/TL.

## How Guess Who uses the dataset

- **Game contract (M9/M17, PRD §5.17):** 5 rounds; the answerer holds a
  secret celebrity; everyone else asks yes/no questions (20-question cap);
  a correct guess scores +1 and reveals the celebrity **with fun facts**
  (`facts`). Text-only — no images anywhere in the pipeline.
- **Data is server-only** (`server/src/data/` — no client mirror, D058 §3.7
  verified). The engine takes a pool and never mutates entries; the only
  filter today is the D058 region chip row (All/Bollywood/Hollywood/RoW,
  server-side filter, §3.5). `genre`/`difficulty` are authoring/balance
  fields — the engine ignores them until a deck-construction guard is
  added (flagged, not blocking).
- **Traits are the game:** the answerer judges questions against the trait
  fields (gender, alive, profession, nationality, ageRange, hairColor,
  famousFor). Every schema field below exists because a player can ask
  "is it a man?", "is she alive?", "are they in music?" — so field
  **accuracy and mutual exclusivity are gameplay-critical**, not cosmetic.

---

## 1. SOURCES

### Recommendation: Wikidata (CC0) as primary · public knowledge with two-source verification as fallback

**Why Wikidata:**

- **CC0 public-domain dedication** — every structured statement is free to
  reuse without attribution, remix, or share-alike obligations. This is the
  cleanest license in the entire repo's world (PRD §13 floor is "PD/CC0").
- **Queryable by profession/country via SPARQL** at `query.wikidata.org` —
  occupation (`P106`), country of citizenship (`P27`), sex/gender (`P21`),
  birth/death dates (`P569`/`P570` → `alive`, `ageRange`), **hair color
  (`P1884`)** — the one field that would otherwise be a pain to source —
  awards (`P166`), notable works (`P800`).
- **A ubiquity proxy for free:** `wikibase:sitelinks` (how many language
  Wikipedias cover the person) is a decent automated pre-screen for
  difficulty tiers (see §4).
- **Repo precedent:** CONTENT-SOURCING already treats facts as
  license-free and uses Wikimedia infra (`Special:FilePath`) for the one
  dataset that carries images.

**Why not verbatim Wikipedia bios:** Wikipedia article text is
**CC-BY-SA 4.0** — attribution _and_ share-alike. Copying prose (even with
a credit) drags our content under SA (derivative work), and expressive
prose is copyrighted expression anyway, not facts. PRD §7 wants "original
and substantial" content — pasted bios fail both the legal test and the
AdSense test. **Facts from Wikidata, prose written by us.**

**Why NO celebrity images at all (even PD/CC0):** PRD §13 is explicit —
_"Do NOT use any real celebrity photos for Guess Who, use text descriptions
only or public domain images"_ — and the safer reading (and ARCHITECTURE
§13's flag: "Guess Who, text only, no photos") is **text-only**. Beyond the
PRD, personality/right-of-publicity laws (US state statutes like California
Civil Code §3344; recognized by Indian courts for living persons) can
restrict _commercial_ use of a person's image even when the photograph
itself is public domain. The existing dataset is 100% text; keep it that
way — it costs us nothing game-wise (the answerer holds the name; the room
never sees a face).

### Concrete extraction approach (lot-script pattern)

Follow the repo lot-script precedent (`scripts/sample-world-peeks.mjs`:
extract → pre-screen flags → **human review list, no unresolved entries
ship**). A new `scripts/extract-celebrity-candidates.mjs` (or similar):

1. **SPARQL extract** per region bucket (queries below) → JSON candidate
   list (name, dob, occupation, country, gender, hairColor, sitelinks).
2. **Pre-screen** → drop non-humans (`P31 wd:Q5`), drop <15-sitelink
   entries (adjust per region — see Risks), flag missing `P1884` hair
   color (≈50% missing — manual fill at authoring).
3. **Human authoring pass** → author writes `famousFor`, `facts` (≥3),
   assigns `genre`, `difficulty`, canonical `name` per the dedup rules
   (§4), verified against **two independent sources** (§2 spot-check).
4. **Review gate** → QA gates (§5) run per lot before merge.

**Query template A — Bollywood actors (Indian citizenship):**

```sparql
SELECT ?person ?personLabel ?dob ?genderLabel WHERE {
  ?person wdt:P31 wd:Q5 .               # human
  ?person wdt:P106 wd:Q33999 .          # occupation: actor (Q33999)
  ?person wdt:P27 wd:Q668 .             # citizenship: India (Q668)
  OPTIONAL { ?person wdt:P569 ?dob . }  # → ageRange, alive
  OPTIONAL { ?person wdt:P21 ?gender . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 2000
```

**Query template B — Hollywood actors (US citizenship, ubiquity pre-screen):**

```sparql
SELECT ?person ?personLabel ?dob ?sl WHERE {
  ?person wdt:P31 wd:Q5 .
  ?person wdt:P106 wd:Q33999 .
  ?person wdt:P27 wd:Q30 .              # citizenship: USA (Q30)
  ?person wikibase:sitelinks ?sl .
  FILTER (?sl >= 30)                    # ubiquity proxy → difficulty pre-screen
  OPTIONAL { ?person wdt:P569 ?dob . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 2000
```

**Query template C — musicians/singers (per country):** same skeleton, swap
occupation items: singer `Q639669`, singer-songwriter `Q488205`, musician
`Q188451`; country = `Q668` (India) / `Q30` (USA) / `Q145` (UK) / `Q16`
(Canada) / `Q159` (Russia) / `Q668`…, and a third pass for "row" with no
country filter (minus the two above). **Athletes:** `Q2066131` (+ optional
`sport` `P641` filter for cricket `Q5375`/tennis `Q847017`/football
`Q2736`). **TV presenters:** `Q947873` (covers the Oprah/Kapil Sharma
tier). Combine with `P21`/`P1884`/`P166` in the projection as needed.

**Fallback — public knowledge + two-source verification:** for anything
Wikidata lacks or gets wrong (missing hair color, thin Bollywood coverage,
disputed facts), author from public knowledge with the CONTENT-SOURCING
music rule: **every fact cross-checked against two independent sources at
authoring time** (Wikidata counts as source #1; an official bio, major
outlet, or encyclopedic reference as source #2). ⚠ **No IMDb scraping**
(ToS + PRD §13 "do NOT scrape any external site" precedent).

### Candidate pool (research artifact — extracted 2026-08-06)

- **`docs/celebrities-candidates.json`** — 859 pre-authoring candidates
  (bollywood 391 / hollywood 275 / row 193) extracted with
  `scripts/extract-celebrity-candidates.mjs` (SPARQL, CC0): two-phase,
  sitelink-banded ranking (no WDQS truncation), exact occupations with
  verified subclass QIDs (singer Q177220, musician Q639669, film/TV actor,
  playback singer, rapper, cricketer, footballer, tennis player, …),
  region/genre per query bucket, `difficulty` = sitelink-proxy **HINT**,
  `sitelinks` + `wikidataId` for authoring traceability.
- **NOT in the pool — authoring pass only:** `facts` (≥3, two-source
  verification), `famousFor`, `hairColor` confirmation. `genre` is
  bucket-claimed (cinema-first) — the author re-judges it per §3/§6.1;
  `profession` is approximate for multi-talents (e.g., singer-actors may
  read "Actor").
- **Known gaps:** music buckets run thinner than cinema (bucket-order claim
  artifact; limits raised to mitigate); a few edge names (e.g., Zendaya)
  fall just below ranking cutoffs; the football band-60 query can flake
  under WDQS load (retries added). The authoring pass should spot-add any
  must-have names.

---

## 2. LICENSING TABLE

Shared policy is CONTENT-SOURCING's (PRD §7 "no copyrighted material",
§13 "PD/CC0/self-created only", no scraping). Celebrity-specific rows:

| Source type                                | Allowed | Why / precedent                                                                                                      |
| ------------------------------------------ | ------- | -------------------------------------------------------------------------------------------------------------------- |
| Facts (name, dates, roles, awards, counts) | **Yes** | Facts aren't copyrightable (Feist v. Rural, 1991); Wikidata is CC0                                                   |
| Celebrity names / stage names              | **Yes** | Nominative use; not copyright (`emoji-plots.json` ships titles)                                                      |
| Wikidata structured statements             | **Yes** | CC0 — no attribution, no share-alike                                                                                 |
| **Photos — ANY (incl. PD/CC0)**            | **No**  | PRD §13 "no real celebrity photos… text descriptions only"; publicity rights vary by jurisdiction even for PD photos |
| Verbatim Wikipedia bios / bio prose        | **No**  | CC-BY-SA + expressive prose is copyrighted; PRD §7 wants original                                                    |
| Quoted dialogue / interview excerpts       | **No**  | Copyrighted expression (CONTENT-SOURCING §2 music precedent)                                                         |
| Tabloid claims, rumors, allegations        | **No**  | Defamation + AdSense "deceptive content" risk                                                                        |
| Private data on living people (see below)  | **No**  | Privacy rules                                                                                                        |
| Original `facts`/`famousFor` text          | **Yes** | We write it (genre-benders house style = quality bar)                                                                |

### Privacy rules for living people

- **Facts only:** public roles, works, awards, publicly-reported career
  facts. No home addresses, no contact info, no family members' private
  details, no non-public personal information.
- **Mainstream sourcing only:** facts must trace to public record / major
  coverage — never tabloids; no allegations (innuendo is a defamation and
  AdSense risk even when "true" is unproven).
- **Neutral tone:** attributable statements ("Won X in 2019", "Serves as
  Y") — no editorializing, no superlative opinions, no scandal framing.
- **Minors / child stars:** professional facts only; nothing about family
  or schooling beyond the public record.
- **Deceased with living families:** public record only; no salacious
  material (still defamation-adjacent, and it's not family-safe).
- The game is AdSense-prep and family-adjacent — a fact that would need a
  content warning doesn't ship (owner decision 5).

---

## 3. DATA MODEL

### Existing shape (D041, unchanged — 205 entries today)

```json
{
  "name": "Beyoncé",
  "gender": "f",
  "alive": true,
  "profession": "Singer",
  "nationality": "American",
  "ageRange": "40s",
  "hairColor": "blonde",
  "famousFor": "Run the World, Lemonade",
  "facts": ["Won 32 Grammys, the most of any artist", "Headlined Coachella 2018 (Beychella)"]
}
```

Types (from `server/src/engine/guess-who-engine.ts`): `gender: 'm' | 'f'`,
`alive: boolean`, `profession/nationality/ageRange/hairColor/famousFor:
string`, `facts: string[]`. **New authoring standard: ≥3 facts per entry**
(current entries carry 2 — backfill flag, see Risks). Fields are
gameplay-critical: `hairColor`/`ageRange`/`nationality`/`gender` are the
question surface, so accuracy gates in §5 are mandatory.

### Additive fields (D058 + CEO ask)

```json
{
  "name": "Shah Rukh Khan",
  "gender": "m",
  "alive": true,
  "profession": "Actor",
  "nationality": "Indian",
  "ageRange": "50s",
  "hairColor": "black",
  "famousFor": "Dilwale Dulhania Le Jayenge, Pathaan",
  "facts": [
    "Known as the King of Bollywood",
    "DDLJ (1995) ran for over 25 years at a single Mumbai cinema",
    "Co-owns the IPL team Kolkata Knight Riders"
  ],
  "region": "bollywood",
  "genre": "cinema",
  "difficulty": 1
}
```

- **`region: "bollywood" | "hollywood" | "row"`** (D058 §3.2) — _the
  market/audience the person is famous in_, NOT nationality: bollywood =
  Indian-market fame (film stars, cricketers, Indian politicians, Indian
  musicians), hollywood = US-market fame, row = everywhere else (British,
  European, Latin, Japanese, …). Existing entries default `"row"` unless
  the author knows otherwise — **no forced recategorization** (D058).
- **`genre`** — see taxonomy below (CEO ask).
- **`difficulty: 1 | 2 | 3`** — ubiquity tier, §4 (authoring/balance
  field; engine ignores it today).

### Genre taxonomy — what "genre" means here

**Recommendation: `genre` = the person's primary fame domain** — a closed
taxonomy of 12 industry categories. It normalizes the free-form
`profession` field ("Actor"/"Actress"/"Singer"/"Entrepreneur") into a
queryable, balanceable dimension and works uniformly for _every_ entry.
**Film genres for actors (action/comedy/drama) are rejected** as a stored
field: they apply to only ~40% of the pool (non-actors have no film genre),
they're ambiguous (Bollywood vs Hollywood genre vocabulary differs), and
they add nothing the deduction game can use — a questioner asks "are they
in sports?", not "are they in rom-coms?". A `famousFor` work (e.g.,
"Gully Boy") already carries the film-genre signal when it matters.

| genre         | Definition                                               | Example                           |
| ------------- | -------------------------------------------------------- | --------------------------------- |
| `music`       | Singers, musicians, bands, composers (non-film-first)    | Beyoncé, A. R. Rahman             |
| `cinema`      | Film actors/directors whose fame is film-led             | Shah Rukh Khan, Tom Hanks         |
| `television`  | TV-led fame: hosts, presenters, reality stars, TV actors | Oprah Winfrey, Zendaya (Euphoria) |
| `sports`      | Athletes across all sports                               | Virat Kohli, Serena Williams      |
| `politics`    | Politicians, heads of state, diplomats                   | Narendra Modi, Barack Obama       |
| `business`    | Entrepreneurs, founders, investors, executives           | Ratan Tata, Warren Buffett        |
| `science`     | Researchers, discoverers, medical pioneers               | Marie Curie, A.P.J. Abdul Kalam   |
| `technology`  | Tech founders/CEOs known for products, not finance       | Elon Musk, Sundar Pichai          |
| `literature`  | Authors, poets, playwrights                              | Ruskin Bond, J.K. Rowling         |
| `internet`    | YouTubers, influencers, streamers                        | MrBeast, Bhuvan Bam               |
| `art-fashion` | Visual artists, designers, photographers, architects     | Pablo Picasso, Sabyasachi         |
| `royalty`     | Monarchs, royals                                         | Queen Elizabeth II                |

**Assignment rules (closed set — exactly one primary value per entry):**

- Actor/actress → `cinema` unless bulk of fame is TV-led (→ `television`).
- Film composer/singer → `music` (playback singers included — their fame
  domain is music even when Bollywood-adjacent).
- Tech founders/CEOs → `technology`; non-tech entrepreneurs/investors →
  `business` (Musk = technology, Buffett = business).
- Scientist-politicians (Kalam) → `science` (primary fame domain).
- 20-entry sample below covers 9 of 12 genres; the remaining three are
  quota cells to fill per lot, not gaps.

---

## 4. QUOTAS + DIFFICULTY

### Quotas (D058 §3.6 — test-enforced per lot)

| Stage  | Total       | bollywood | hollywood   | row       |
| ------ | ----------- | --------- | ----------- | --------- |
| **v1** | 1,000       | **≥ 400** | **≥ 400**   | **≥ 200** |
| **v2** | 2,000-3,000 | 800-1,000 | 1,000-1,200 | 400-600   |

- Bollywood quota is the CEO's priority (D058 §3.2: "Bollywood quota
  first") — authoring lots should front-load bollywood (existing file has
  ~0 Indian-market entries; the 400 floor is essentially all-new authoring).
- Lot discipline (D057): each lot ships with its region counts; the gate
  test (§5) runs against the _cumulative_ file after every lot.

### Difficulty calibration — ubiquity tiers

The room must not be all A-listers (a game where every secret celebrity is
instantly guessed is boring; all niche is unsolvable). Author-assigned
`difficulty` from a ubiquity tier:

| Tier | `difficulty` | Definition                                                  | Example                        | Wikidata sitelink proxy (pre-screen only) |
| ---- | ------------ | ----------------------------------------------------------- | ------------------------------ | ----------------------------------------- |
| 1    | 1            | Household name in the _region market_                       | Shah Rukh Khan, Messi, Beyoncé | ≥ 50 sitelinks (adjust per region)        |
| 2    | 2            | Well known; most rooms recognize the name                   | Keanu Reeves, Simone Biles     | 15-49                                     |
| 3    | 3            | Fans-only: character actors, niche athletes, regional stars | Rajkummar Rao                  | < 15                                      |

- **Region context wins:** tier is judged against the _region's_ room, not
  global sitelinks (a row-tier-2 global star can be tier-1 in their home
  market). Sitelinks are a pre-screen flag, never the final value —
  author judgment assigns `difficulty`.
- **Pool mix target (per lot, cumulative):** tier 1 ≤ 40%, tier 3 ≥ 15%
  (the rest tier 2). Enforced by a §5 test.
- **Engine-side guard (flagged engine work, not blocking):** cap tier-1
  picks at ≤ 2 of the 5 rounds per game when the deck is constructed —
  keeps rooms honest without data changes.

### Dedup rules (name identity is the game — one person, one entry)

1. **Canonical display name** = the name a player in that region's market
   would type/say ("A. R. Rahman", not "Allah Rakha Rahman"; "SRK" is
   never a display name). The guess flow matches on this name — make it
   the recognizable form.
2. **One person = one entry.** Nicknames, birth names, and aliases are not
   separate entries (no "The King"/"Elvis Presley" pair). Optional
   internal `aka` array is an owner decision (see §6) — it helps a future
   fuzzy guess match, never ships as extra rows.
3. **Anglicized / transliterated variants:** use the common English-market
   spelling, chosen at authoring and frozen ("Aishwarya Rai Bachchan" —
   one canonical form; "Ash" variants rejected; "Aishwarya Rai" is not a
   second entry).
4. **Shared stage names (two people, same name):** uniqueness key =
   normalized name (`lowercase`, NFD strip diacritics, collapse
   whitespace). Collision → keep the higher-ubiquity/region-relevant
   person, **exclude the other at v1** (the game has no disambiguation UX;
   two "Will Smith"s would make the room guess wrong).
5. **Name changes** ("Diddy"/"P. Diddy"/"Sean Combs"): one entry, current
   or most-recognizable name; past names are aliases, not rows.
6. **Family members** (Bachchans, Kohli-Anushka): each is a person — own
   entry is fine _only if independently famous_; the name key handles any
   collision.

---

## 5. QA GATES

### Automated (vitest — repo convention; extends TESTING_STRATEGY dataset integrity)

New/updated suite `server/src/data/__tests__/celebrities.test.ts`
(TESTING_STRATEGY already asserts: required fields, no duplicates, no
non-PD image URLs — extend, don't replace):

1. **Schema:** every entry has the 9 base fields + `region` + `genre` +
   `difficulty`; correct types; strings non-empty; **`facts` ≥ 3
   non-empty strings**; `famousFor` ≤ 5 tokens.
2. **Enums:** `region ∈ {bollywood, hollywood, row}`; `genre` ∈ the closed
   12-value taxonomy; `difficulty ∈ {1,2,3}`; `gender ∈ {m, f}`;
   `ageRange` matches `^\d+s$` (e.g., "40s").
3. **Region quotas (D058, per lot, cumulative):** bollywood ≥ 400,
   hollywood ≥ 400, row ≥ 200 at v1; v2 thresholds switch at 2,000+.
4. **Uniqueness:** normalized display names are unique across the file
   (catches anglicized dupes + shared stage names).
5. **Genre balance:** no single genre > 40% of the pool; each of the 12
   genres ≥ 20 entries at 1,000 (guarantees "are they in X?" is always a
   live question).
6. **Difficulty mix:** tier 1 ≤ 40%, tier 3 ≥ 15% of the pool.
7. **Alive/gender sanity:** both genders ≥ 30% (a room must be able to
   ask "is it a woman?"); `alive` has both values; deceased ≥ 10%
   (historical figures keep the pool interesting).

### Spot-check rules (manual, at authoring time — every entry)

- **Two-source rule:** each `fact` verified against two independent
  sources (Wikidata counts as one; official bio / major outlet / reference
  as the second). Record the pair in the authoring log (or an internal
  `sources` field — owner decision 3).
- **Region/nationality consistency:** bollywood region ⇒ Indian-market
  fame; a random ≥ 10% sample of each lot is second-reviewed against the
  lobby chip semantics (D058 §3.2).
- **Neutrality:** no opinion words, no superlatives, no private-life
  details for living people (§2 privacy rules).
- **`famousFor` format:** works/roles, not full titles with years, 2-5
  tokens ("Padmaavat, Pathaan" ✓; "The Godfather (1972)" ✗).
- **`hairColor` sourcing:** from Wikidata `P1884` or two-source visual
  cross-check; for deceased figures use the widely-known color; gray/white
  is fine for elderly (existing data precedent).
- **Difficulty honesty:** a tier-1-in-its-region entry marked 3 is a
  review flag, not just a preference.

### 20 draft entries — proof of model (mixed regions, difficulties, genres)

```json
[
  {
    "name": "Shah Rukh Khan",
    "gender": "m",
    "alive": true,
    "profession": "Actor",
    "nationality": "Indian",
    "ageRange": "50s",
    "hairColor": "black",
    "famousFor": "DDLJ, Pathaan",
    "facts": [
      "Known as the King of Bollywood",
      "DDLJ (1995) ran for over 25 years at a single Mumbai cinema",
      "Co-owns the IPL team Kolkata Knight Riders"
    ],
    "region": "bollywood",
    "genre": "cinema",
    "difficulty": 1
  },
  {
    "name": "Deepika Padukone",
    "gender": "f",
    "alive": true,
    "profession": "Actress",
    "nationality": "Indian",
    "ageRange": "30s",
    "hairColor": "black",
    "famousFor": "Padmaavat, Pathaan",
    "facts": [
      "Played junior-level badminton before acting",
      "Appeared in xXx: Return of Xander Cage (2017)",
      "Founded the LiveLoveLaugh mental-health foundation"
    ],
    "region": "bollywood",
    "genre": "cinema",
    "difficulty": 1
  },
  {
    "name": "A. R. Rahman",
    "gender": "m",
    "alive": true,
    "profession": "Music composer",
    "nationality": "Indian",
    "ageRange": "50s",
    "hairColor": "black",
    "famousFor": "Slumdog Millionaire score",
    "facts": [
      "Won two Oscars for Slumdog Millionaire (2009)",
      "Has won six National Film Awards",
      "Nicknamed the Mozart of Madras"
    ],
    "region": "bollywood",
    "genre": "music",
    "difficulty": 1
  },
  {
    "name": "Virat Kohli",
    "gender": "m",
    "alive": true,
    "profession": "Cricketer",
    "nationality": "Indian",
    "ageRange": "30s",
    "hairColor": "black",
    "famousFor": "Indian cricket",
    "facts": [
      "Scored 50 ODI centuries — the first player ever",
      "Won the 2023 Cricket World Cup",
      "Married to actress Anushka Sharma"
    ],
    "region": "bollywood",
    "genre": "sports",
    "difficulty": 1
  },
  {
    "name": "Narendra Modi",
    "gender": "m",
    "alive": true,
    "profession": "Politician",
    "nationality": "Indian",
    "ageRange": "70s",
    "hairColor": "white",
    "famousFor": "Prime Minister of India",
    "facts": [
      "Prime Minister of India since 2014",
      "Was Chief Minister of Gujarat from 2001 to 2014",
      "Began his career as an RSS pracharak"
    ],
    "region": "bollywood",
    "genre": "politics",
    "difficulty": 1
  },
  {
    "name": "Sachin Tendulkar",
    "gender": "m",
    "alive": true,
    "profession": "Cricketer",
    "nationality": "Indian",
    "ageRange": "50s",
    "hairColor": "black",
    "famousFor": "100 international centuries",
    "facts": [
      "First player to score 100 international centuries",
      "Played 200 Test matches for India",
      "Youngest recipient of the Bharat Ratna (2014)"
    ],
    "region": "bollywood",
    "genre": "sports",
    "difficulty": 1
  },
  {
    "name": "Lata Mangeshkar",
    "gender": "f",
    "alive": false,
    "profession": "Singer",
    "nationality": "Indian",
    "ageRange": "90s",
    "hairColor": "black",
    "famousFor": "Playback singing",
    "facts": [
      "Recorded songs in over 30 languages",
      "Received the Bharat Ratna in 2001",
      "One of the most-recorded artists in history"
    ],
    "region": "bollywood",
    "genre": "music",
    "difficulty": 2
  },
  {
    "name": "A.P.J. Abdul Kalam",
    "gender": "m",
    "alive": false,
    "profession": "Scientist",
    "nationality": "Indian",
    "ageRange": "80s",
    "hairColor": "white",
    "famousFor": "Missile Man of India",
    "facts": [
      "11th President of India (2002-2007)",
      "Led India's Pokhran-II nuclear tests as DRDO chief",
      "Wrote the memoir Wings of Fire"
    ],
    "region": "bollywood",
    "genre": "science",
    "difficulty": 2
  },
  {
    "name": "Ratan Tata",
    "gender": "m",
    "alive": false,
    "profession": "Businessman",
    "nationality": "Indian",
    "ageRange": "80s",
    "hairColor": "white",
    "famousFor": "Tata Group",
    "facts": [
      "Led the Tata Group for over 20 years",
      "Launched the Tata Nano in 2008",
      "Most of Tata Sons' shares are held by charitable trusts"
    ],
    "region": "bollywood",
    "genre": "business",
    "difficulty": 2
  },
  {
    "name": "Ruskin Bond",
    "gender": "m",
    "alive": true,
    "profession": "Author",
    "nationality": "Indian",
    "ageRange": "90s",
    "hairColor": "white",
    "famousFor": "The Room on the Roof",
    "facts": [
      "Won the John Llewellyn Rhys Prize at 23 — youngest winner at the time",
      "Awarded the Padma Shri (1999) and Padma Bhushan (2014)",
      "Has lived in Mussoorie since 1963"
    ],
    "region": "bollywood",
    "genre": "literature",
    "difficulty": 3
  },
  {
    "name": "Tom Hanks",
    "gender": "m",
    "alive": true,
    "profession": "Actor",
    "nationality": "American",
    "ageRange": "60s",
    "hairColor": "brown",
    "famousFor": "Forrest Gump, Cast Away",
    "facts": [
      "Won two consecutive Best Actor Oscars (1994-95)",
      "Voiced Woody in the Toy Story films",
      "Published a debut novel in 2023"
    ],
    "region": "hollywood",
    "genre": "cinema",
    "difficulty": 1
  },
  {
    "name": "Meryl Streep",
    "gender": "f",
    "alive": true,
    "profession": "Actress",
    "nationality": "American",
    "ageRange": "70s",
    "hairColor": "blonde",
    "famousFor": "Most Oscar-nominated actor",
    "facts": [
      "Holds 21 Academy Award nominations — a record",
      "Won three Oscars, including for The Iron Lady",
      "Trained at the Yale School of Drama"
    ],
    "region": "hollywood",
    "genre": "cinema",
    "difficulty": 1
  },
  {
    "name": "Serena Williams",
    "gender": "f",
    "alive": true,
    "profession": "Tennis player",
    "nationality": "American",
    "ageRange": "40s",
    "hairColor": "black",
    "famousFor": "23 Grand Slam titles",
    "facts": [
      "Won 23 Grand Slam singles titles — an Open-era record",
      "Won four Olympic gold medals",
      "Founded the Serena Ventures investment fund"
    ],
    "region": "hollywood",
    "genre": "sports",
    "difficulty": 1
  },
  {
    "name": "Keanu Reeves",
    "gender": "m",
    "alive": true,
    "profession": "Actor",
    "nationality": "Canadian",
    "ageRange": "60s",
    "hairColor": "brown",
    "famousFor": "The Matrix, John Wick",
    "facts": [
      "Trained in judo and jiu-jitsu for John Wick",
      "Co-wrote the comic book BRZRKR",
      "Played Neo in The Matrix trilogy"
    ],
    "region": "hollywood",
    "genre": "cinema",
    "difficulty": 2
  },
  {
    "name": "Zendaya",
    "gender": "f",
    "alive": true,
    "profession": "Actress",
    "nationality": "American",
    "ageRange": "20s",
    "hairColor": "black",
    "famousFor": "Euphoria, Dune",
    "facts": [
      "Two-time Emmy winner for Euphoria",
      "Youngest two-time lead-actress Emmy winner",
      "Started on the Disney show Shake It Up"
    ],
    "region": "hollywood",
    "genre": "television",
    "difficulty": 2
  },
  {
    "name": "Simone Biles",
    "gender": "f",
    "alive": true,
    "profession": "Gymnast",
    "nationality": "American",
    "ageRange": "20s",
    "hairColor": "black",
    "famousFor": "Most decorated gymnast",
    "facts": [
      "Holds 41 Olympic and World medals — a gymnastics record",
      "Has five skills named after her in the Code of Points",
      "Won three golds and a silver at the 2024 Paris Olympics"
    ],
    "region": "hollywood",
    "genre": "sports",
    "difficulty": 2
  },
  {
    "name": "MrBeast",
    "gender": "m",
    "alive": true,
    "profession": "YouTuber",
    "nationality": "American",
    "ageRange": "20s",
    "hairColor": "brown",
    "famousFor": "YouTube giveaways and stunts",
    "facts": [
      "The most-subscribed individual YouTuber",
      "Founded the Feastables chocolate brand",
      "His Squid Game video is one of YouTube's most-viewed"
    ],
    "region": "hollywood",
    "genre": "internet",
    "difficulty": 2
  },
  {
    "name": "Lionel Messi",
    "gender": "m",
    "alive": true,
    "profession": "Footballer",
    "nationality": "Argentine",
    "ageRange": "30s",
    "hairColor": "black",
    "famousFor": "8 Ballon d'Or awards",
    "facts": [
      "Won 8 Ballon d'Or awards — a record",
      "Won the 2022 World Cup with Argentina",
      "Has played for Inter Miami since 2023"
    ],
    "region": "row",
    "genre": "sports",
    "difficulty": 1
  },
  {
    "name": "Shakira",
    "gender": "f",
    "alive": true,
    "profession": "Singer",
    "nationality": "Colombian",
    "ageRange": "40s",
    "hairColor": "brown",
    "famousFor": "Hips Don't Lie, Waka Waka",
    "facts": [
      "Performed at two World Cup ceremonies (2010 and 2014)",
      "One of the best-selling Latin artists of all time",
      "Named a UNICEF Goodwill Ambassador"
    ],
    "region": "row",
    "genre": "music",
    "difficulty": 1
  },
  {
    "name": "Queen Elizabeth II",
    "gender": "f",
    "alive": false,
    "profession": "Monarch",
    "nationality": "British",
    "ageRange": "90s",
    "hairColor": "white",
    "famousFor": "Longest-reigning British monarch",
    "facts": [
      "Reigned for 70 years (1952-2022)",
      "The longest-reigning British monarch",
      "The second-longest-reigning monarch in recorded history"
    ],
    "region": "row",
    "genre": "royalty",
    "difficulty": 2
  }
]
```

Sample mix (illustrative, not quota): regions bollywood 10 / hollywood 7 /
row 3; difficulties 1×10 / 2×9 / 3×1; genres cinema 5, sports 5, music 2,
science 1, business 1, politics 1, literature 1, television 1, internet 1,
royalty 1 (9 of 12 genres). Pool-level mix targets (§4) are enforced by the
lot gate, not by the sample.

---

## 6. OWNER DECISIONS

1. **Genre semantics:** closed fame-domain taxonomy (recommended — uniform,
   queryable, balanceable) vs film-genre-for-actors (rejected: sparse,
   non-uniform, no gameplay value) vs free-form tags (no quotas possible).
2. **Difficulty storage:** stored `difficulty: 1|2|3` (recommended —
   region-context author judgment) vs derived at runtime from sitelinks
   (breaks region context; adds engine work).
3. **Traceability:** internal `sources` field per entry (recommended —
   mirrors music's `bpmSource` precedent; not displayed) vs authoring-log
   only (leaner file).
4. **Existing 205 entries:** backfill `region` (default `row`, D058) +
   `genre` + `difficulty` + facts to ≥ 3 (required before quota tests can
   pass; the 400-bollywood floor is all-new authoring either way).
5. **Family-safe filter:** PG-only facts (recommended — AdSense-prep,
   children's rooms) vs match genre-benders' looser precedent (WAP exists
   in `genre-benders.json`; flagged conflict).
6. **Optional `aka` aliases array:** include (helps future fuzzy guess
   matching) vs omit (dedup test stays the only identity rule). Not
   required by any gate — authoring convenience only.
7. **Engine tier-mix guard** (≤ 2 tier-1 per 5-round game): engine work,
   recommended, **not blocking** data authoring.

## RISKS

- **Wikidata quality:** user-edited and uneven — Bollywood/hair-color
  coverage is thinner than Hollywood's; treat every extract as _candidate
  material_, not truth. The two-source rule + review-list gate bounds it.
- **Sitelink ubiquity skews Western:** Bollywood stars carry fewer
  sitelinks than US peers of equal regional fame — per-region thresholds
  (and author judgment overriding the proxy) are mandatory or tier-1
  Bollywood entries get mis-ranked.
- **Name collisions/anglicization drift:** the normalized-name uniqueness
  test catches collisions; authoring discipline (canonical-form freeze)
  is the only defense against variant drift — dedup rules are enforced by
  gate 4 (§5).
- **Backfill debt:** existing 205 entries fail the new gates (facts ≥ 3,
  no region/genre/difficulty) until backfilled — schedule backfill into
  the first lots or the quota tests stay red.
- **Publicity rights:** even text-only, avoid merchandising-style framing
  of living people (the facts-only + neutral-tone rules are the
  mitigation; images would reopen this entirely — they stay out, PRD §13).
- **LLM-assisted drafting (D057):** allowed for drafting only with a
  mandatory human rewrite/review pass — never verbatim output, and never
  asked to reproduce bio prose (memorization risk, same rule as
  CONTENT-SOURCING §2.3).
