# Daily Games, The 24-Hour Ritual Layer

**Task 3 of the Vision 2.0 brief.** This is the retention spine of TriviaHub: 12 daily
games that reset every 24 hours, one identity, streaks, leaderboards, share cards, and
statistics. It is inspired by the Sporcle/Wordle daily format but has its own identity:
**the same game, the same day, for everyone, then the group talks about it.**

---

## 1. The daily loop

```text
00:00 UTC  →  new seeds for all 12 games (deterministic, on-read, no cron)
morning    →  "Today at TriviaHub": streak flames, friend scores, personal bests
play       →  one game in ~3-5 minutes, tier chosen (Easy/Normal/Hard)
share      →  share card (score, tier, day, streak), the Wordle-style hook
tomorrow   →  new seeds; yesterday's Drawing Challenge winner revealed
```

**Why this wins:** Wordle proved that _shared constraint_ (same puzzle, everyone) creates
conversation. TriviaHub's twist: 12 puzzles, not 1, variety without losing the
"did you do today's?" ritual. The group can even compare in the room lobby.

## 2. The 12 daily games

| #   | Daily game                       | Engine source (exists today)                                                                        | Daily twist                                                                     |
| --- | -------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1   | **Daily Trivia**                 | ✅ live (seeded 10 questions)                                                                       | Add tiers; friend leaderboard                                                   |
| 2   | **Daily Sudoku**                 | ✅ live (400-puzzle pool)                                                                           | Add tiers (Easy/Medium/Hard pools)                                              |
| 3   | **Daily Emoji Plot**             | EmojiPlot island + dataset                                                                          | Same 10 plots for everyone; hints cost points (already)                         |
| 4   | **Daily Timeline**               | TimelineTussle island                                                                               | Same 5 rounds for everyone; score = cards in place                              |
| 5   | **Daily Price Guess**            | PriceIsRight island                                                                                 | 5 curated products for the day; blurb shown                                     |
| 6   | **Daily Rhyme**                  | RhymeOrCrime island                                                                                 | Same 5 prompts; tier = category set                                             |
| 7   | **Daily Guess Who**              | GuessWho dataset (205 celebs + facts)                                                               | One celebrity of the day; score = questions used to identify (clues on request) |
| 8   | **Daily Geography (World Peek)** | NEW (02 #13)                                                                                        | Same 5 CC photos for everyone; pin-drop scoring                                 |
| 9   | **Daily Movie**                  | NEW, "Reel or Fake": 10 movie-synopsis questions (AI-assisted, moderated)                           | Same 10 for everyone                                                            |
| 10  | **Daily Music (Hum It Back)**    | NEW (02 #11)                                                                                        | Same 5 synthesized melodies for everyone                                        |
| 11  | **Daily Logic Puzzle**           | Sudoku engine (rotation: Sudoku Mon/Wed/Fri, Mastermind Tue/Thu, Numberline Sat, Memory Market Sun) | Genre rotation keeps it fresh                                                   |
| 12  | **Daily Memory Challenge**       | NEW, Simon Sequence + Memory Market combo (02 #21/#30)                                              | Same sequence for everyone; score = longest pattern                             |

**Drawing Challenge** (brief listed it) is implemented as the **community vote loop**.
see §6. It is the thirteenth entry in the hub, promoted as "Daily Drawing."

## 3. Difficulty tiers

- **Easy / Normal / Hard** chosen at start (persisted per user per game).
- Content differs by tier (trivia difficulty tags, sudoku clue counts, emoji hint
  availability, rhyme category sets).
- **Leaderboards are per game + date + tier**, but scores are **tier-weighted**
  (Easy ×1, Normal ×2, Hard ×3) on the _global_ board so Hard players aren't ghettoized.
  Friend boards show raw scores side by side ("Aditi beat you on Hard!").

## 4. Streaks, server-side, finally

**Current:** localStorage per game (wipeable, per-browser). **Proposed:**

- **Guest:** device-bound streak (same as today), works with no account.
- **Member:** server-side streak per game + a **grand streak** (played _any_ daily game
  today). Grand streak is the flagship number on the profile.
- Streak freeze tokens: earn 1 freeze per week (miss a day without losing the streak).
  a daily-reward that itself drives returns.
- Streak restoration: one "oops I missed a day" restore per season (the Wordle streak
  mercy rule, it converts frustration into gratitude).

## 5. Backend architecture

### Data model (additive to the existing schema)

```text
UserProfile (new)
  id, memberKey (device-generated, unique), email?, nickname,
  xp, level, createdAt, lastSeenAt

DailyRun (new)                    , one row per completed daily play
  id, userId?, gameId, date, tier,
  score, durationMs, correctCount, totalCount,
  clientKey (unique, idempotency, existing pattern)
  @@unique([userId?, gameId, date, tier, clientKey])

DailyStreak (new)
  id, userId?, gameId, current, longest, lastDate
  + grandStreak fields on UserProfile (or a row per user)

DailyContent (replaces DailyChallenge)
  id, gameId, date, tier, data (Json) , seeded deterministically on read
  @@unique([gameId, date, tier])      , same upsert pattern as today
```

### Endpoints

```text
GET  /api/daily                       → hub: all games, your streaks, friend plays
GET  /api/daily/:gameId               → today's content (server-validated shape)
POST /api/daily/:gameId/submit        → score + stats (idempotent clientKey)
GET  /api/daily/:gameId/leaderboard?tier=&scope=global|friends
GET  /api/me/stats?gameId=            → lifetime stats, personal bests, streaks
GET  /api/daily/drawing?date=         → yesterday's entries for the vote (evening)
POST /api/daily/drawing/vote          → community vote (1 per member per day)
```

### Seeding strategy (no cron, on-read like today)

- Trivia/Sudoku/etc. reuse the existing FNV-1a + seeded-shuffle pattern.
- **Static pools** (celebs, prices, emoji plots, timeline events, melodies) pick via
  `seed(date) % pool.length`, the pool rotates ~yearly, which is fine.
- **AI-assisted pools** (Movie, Rhyme categories, Geography captions) are generated
  ahead by the content engine (07) into `DailyContent`, _never_ at request time.
- Rollover is implicit: `dailyDateKey(new Date())` changes at midnight UTC.

### Fairness & anti-cheat

- Scores arrive with clientKey idempotency (exists); daily content is server-served
  (exists for trivia; extend to all games).
- Rate-limit submits per game+day (existing rate limiter pattern).
- Leaderboard entries for members link to profiles (tap to challenge); guests are
  shown but flagged "guest", subtle nudge to upgrade.

## 6. The community vote loop (Daily Drawing Challenge)

The one daily game that can't be self-scored fairly becomes the **social** daily:

1. Prompt at 00:00 UTC: "Draw a cat doing something unexpected" (DRAW engine).
2. Players submit their drawing (existing Copycat data-URL upload path).
3. From 18:00 UTC, everyone can view submissions and vote once (Copycat voting engine
   reused); the vote closes at 00:00.
4. At 00:00, **yesterday's winner is announced** on the hub with a confetti moment.
   _the reason to open the app every morning._
5. Winner gets a badge + XP; all entrants get participation XP.

This turns "drawing daily" from a chore into a competition with a 24-hour verdict.

## 7. Statistics (per player)

- Per game: plays, best score, average score, best streak, win rate vs. self.
- Per day: total games played, XP earned, grand-streak day count.
- Global: percentile ("you're in the top 8% today"), leaderboard position drift
  ("you climbed 4 spots, 2 players ahead of you are active right now").
- Weekly recap email (member): "You played 9 daily games, best streak 6, top 3% in
  Daily Trivia on Tuesday."

## 8. Share cards

Upgrade the existing canvas share-image: game name, score, tier badge, date, grand
streak flame, percentile, and a **unique daily invite code** ("Join today's trivia.
code H2K4M9"). The invite code doubles as the room-join wedge: share → friends open →
they're in a room in 10 seconds. Share targets: download PNG (exists), native share,
WhatsApp/Telegram deep links.

## 9. Success metrics

- % of DAU who play ≥1 daily game (target 40%)
- Grand-streak 7-day retention (target: 2× non-streak retention)
- Share actions per daily play (target 8%)
- Vote participation on Daily Drawing (target 50% of that game's players)
