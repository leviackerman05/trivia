# SEO Strategy, The Static MPA Advantage, Compounded

**Task 8 of the Vision 2.0 brief.** TriviaHub already made the single most
important SEO decision in the category: **Astro static MPA** (PRD §13 explicitly
bans SPA). Every game page is server-rendered HTML with 150-160-char meta,
400-600-word original bodies, FAQPage/WebApplication/BreadcrumbList JSON-LD,
OG images, and a sitemap. CrowdParty's catalog is a client-rendered SPA whose
"loading" categories and `undefined` previews are crawlable-but-broken. Our job is
to compound this advantage, not just maintain it.

---

## 1. Principle: pages must earn their index slot

CrowdParty publishes 558 URLs, many thin or drifting (title/H1 mismatches, stale
counts). We publish **fewer, thicker, verified** pages. Every TriviaHub page must
pass the route-integrity test before it can ship:

```text
- internal link returns 200
- <title> matches the H1 topic
- every count on the page matches the dataset it claims
- no placeholder/undefined text
- one canonical URL, correct trailing-slash form
```

This is an automated CI test (extend the existing dataset-integrity tests), not a
vibe.

---

## 2. Page architecture (what we build and why)

### 2.1 Game landing pages (exist, deepen)

Each of the 19 games has `/game/[slug]`. Add per-game **secondary pages** that are
legitimately distinct search intents:

- `/game/[slug]/how-to-play`, rules-only, keyword "how to play X"
- `/game/[slug]/tips`, strategy, keyword "X tips"
- `/game/[slug]/custom-words`, "custom X word list" (hosts search for this!)

These are generated from the same `GameSeoContent` system with hand-edited
variation, thin duplication of the parent page is a ranking risk, so each
secondary page must have a genuinely different body (rules vs. strategy vs.
word-list guidance).

### 2.2 Category pages (new)

- `/games/party` · `/games/family` · `/games/classroom` · `/games/teams`
  (audience-based)
- `/games/drawing` · `/games/trivia` · `/games/voting` · `/games/music`
  (mechanic-based)
- Each category page lists qualifying games **with a playable CTA on the card**.
  category pages convert, and they interlink every game in the category.

### 2.3 Difficulty pages (new)

- `/games/easy` · `/games/medium` · `/games/hard`, backed by the calibrated
  difficulty from the content engine (07 §5). "Easy party games" and "hard trivia"
  are real queries; a _data-backed_ difficulty page is a moat, competitors either
  fake it or lack the data.

### 2.4 Audience/occasion pages (the programmatic core)

CrowdParty's 219 featured rooms prove occasion pages work. We do it with less
inventory and more intent:

- **Holidays:** 20 evergreen holiday pages (`/holiday/halloween` etc.) each with
  themed daily challenge coverage, recommended games, and custom word packs.
  Updated annually (stale years kill freshness, CrowdParty's known weakness).
- **Event pages:** `/event/virtual-team-building`, `/event/birthday-party`,
  `/event/wedding-shower`, `/event/holiday-party`, `/event/icebreaker`,
  `/event/family-game-night`, one page per high-value event query.
- **Audience pages:** `/audience/teachers`, `/audience/remote-teams`,
  `/audience/streamers`, each with a genuinely tailored guide, not re-skinned
  marketing.

### 2.5 Teacher resources (new, Kahoot's home turf)

- `/teachers/` hub: classroom modes, no-account student join, safety tiers,
  vocabulary packs for common subjects.
- Printable lesson plans that use a TriviaHub game as the activity (ranked by
  teachers, seasonal). **Printable versions** of word lists, bingo-style grids,
  and trivia answer sheets, a classic teacher search intent that drives links
  from school domains.

### 2.6 Printables (new, evergreen)

- `/printables/trivia-questions` · `/printables/icebreaker-questions` ·
  `/printables/word-lists`, printable = linkable = another content surface that
  costs nothing to maintain once the content engine exists (07).

### 2.7 Blog (the acquisition engine)

Current blog docs live in `docs/`; the site ships SEO bodies per game. Build the
publishing cadence on **evergreen clusters**, mirroring what CrowdParty proved
works, with better discipline:

- **Topical clusters** (each with a hub + 4-6 spokes):
  - "Trivia questions for X" (holidays, teams, classrooms, dates) → hub `/blog/trivia-questions`
  - "Icebreaker games for X" → hub `/blog/icebreakers`
  - "Drawing games online" → hub `/blog/drawing-games`
  - "Would You Rather questions" → hub `/blog/would-you-rather-questions`
  - "Team building games" → hub `/blog/team-building-games`
- **Holiday posts** scheduled 6 weeks out, updated annually.
- **News-adjacent evergreen:** "X party games for Y event" can be written once
  and refreshed with the year.
- Every article ends with exactly three internal links: one recommended game,
  one related article, one play CTA (the CrowdParty pattern, disciplined).

### 2.8 Game-specific landing pages for every _new_ game (02)

Every new game ships with the full SEO stack (meta, body, FAQ, OG). Games with
high search intent (Daily Sudoku already is one) get extra depth. **SEO is a
feature of the game spec, not an afterthought.**

---

## 3. Programmatic SEO, the honest version

Programmatic pages fail when they are templates with swapped nouns. They succeed
when each page has unique, verified, useful content. Our programmatic surfaces:

| Surface                                 | Generated from                       | Unique content per page                                                  |
| --------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------ |
| Daily game pages (`/daily/trivia` etc.) | DailyChallenge data                  | Real today's puzzle preview + stats + streaks leaderboard snippet        |
| Holiday pages                           | Holiday calendar + game catalog      | Hand-written guides + themed packs + dates                               |
| Category/difficulty pages               | Game catalog + calibrated difficulty | Real counts, real games, real descriptions                               |
| "Games like X" pages                    | Catalog similarity                   | Comparison written by data (player counts, mechanics), never a fake list |

**No page is published until the route-integrity test passes**, that rule makes
programmatic SEO safe where CrowdParty's drifted.

---

## 4. Technical SEO checklist (mostly done, close the gaps)

- [x] Static HTML (Astro SSG), best-in-category crawlability
- [x] Per-game meta + JSON-LD (FAQPage, WebApplication, BreadcrumbList)
- [x] OG images (existing share-canvas pipeline can generate per-game OG art)
- [x] Sitemap
- [ ] **Canonical + trailing-slash test** (CrowdParty had normalization drift, we
      test it in CI instead)
- [ ] **Robots policy for live rooms:** `/room/[code]` must be noindex
      (transient content, mirrors CrowdParty's `/rooms` disallow; rooms are
      session surfaces, never index surfaces)
- [ ] **Perf budget:** the existing 400-600-word bodies must not regress LCP;
      keep JS islands lazy (already the architecture)
- [ ] **Sitelinks/structured data:** add `CollectionPage` to categories,
      `ItemList` to rails, free SERP real estate
- [ ] **Image SEO:** CC images carry `credit`, also carry descriptive alt text
      (accessibility + image search double win)

---

## 5. Internal linking system

- **Game pages** link: category page → 2 related games → 1 daily game → 1 article.
- **Articles** link: 1 game → 1 category → 1 more article → play CTA.
- **Homepage** links: top 3 daily games + 3 categories + 1 seasonal page
  (rotated monthly).
- **Footer/sitemap:** all static pages; the test suite verifies no orphan pages
  (every page reachable from homepage in ≤3 clicks).
- **Daily game pages** link each other ("try today's Emoji Plot"), this is the
  retention-to-SEO loop: daily pages get crawled daily, and internal links push
  fresh crawl budget to the whole site.

---

## 6. Why this beats the competition

- **vs. CrowdParty:** same occasion-page playbook, but static HTML, verified
  counts/titles, no `undefined` previews, and no loading-state categories. Their
  558 URLs vs. our ~150 thicker ones is a race we win on quality signals.
- **vs. Kahoot/Quizizz:** they bury discovery behind login walls; our catalog is
  fully crawlable and playable without an account (crawlers land on a _playable_
  page, the strongest possible content signal).
- **vs. Jackbox:** no SEO presence at all (app-gated).
- **vs. Sporcle:** strong trivia SEO, but no live-room intent, no printable
  surfaces, no teacher hub. We take their trivia head and add the layers they
  don't have.
- **vs. Skribbl/Gartic:** single-game SEO. We own "party games online" as a
  category, not one keyword.
