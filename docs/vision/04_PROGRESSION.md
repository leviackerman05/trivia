# Progression, Play That Accumulates

**Task 4 of the Vision 2.0 brief.** No payments. Everything below is free and designed
to make a player's history _mean something_. Progression is the answer to the question
"why play Skribbl here instead of skribbl.io?", **because here, it counts.**

---

## 1. The XP economy

| Action                        | XP       | Notes                              |
| ----------------------------- | -------- | ---------------------------------- |
| Complete any daily game       | 25       | once per game per day              |
| Complete a room game          | 10       | per game, capped 5/day (anti-farm) |
| Win a room game (podium #1)   | 50       | capped 3/day                       |
| Beat a personal best          | 40       | any game                           |
| Beat a friend's score (daily) | 30       | friend battle trigger              |
| Daily Drawing: win the vote   | 200      | the big dopamine moment            |
| Daily Drawing: participate    | 20       |                                    |
| First game of the day (any)   | 15       | "daily warmup" bonus               |
| Weekly challenge completion   | 100      |                                    |
| Season event completion       | 300-1000 | per event                          |

- **Level curve:** `level = floor(sqrt(xp / 100))`, level 1 at 100 XP, level 10 at
  10k, level 50 at 250k. Sub-linear growth keeps early levels fast (addiction curve)
  and late levels prestigious. No arbitrary caps.
- **XP is never lost** on reset/reroll of a game, only additive.

## 2. Achievements (launch set: 48)

Organized in six families; each family has a "completionist" capstone badge:

| Family       | Examples                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------ |
| **Ritual**   | First daily game · 7-day grand streak · 30-day grand streak · Streak frozen once · Play all 12 dailies in one week |
| **Explorer** | Play 10 different games · Play all 19 games · Win on every game family · Host 5 rooms                              |
| **Social**   | Win a room with 6+ players · Beat 3 friends' dailies in a week · First tournament · Spectate 10 games              |
| **Skill**    | Perfect daily trivia (10/10) · Sudoku under 5 min · Price Is Right exact guess ×3 · 10-game win streak in a room   |
| **Creator**  | Win Daily Drawing · 5 drawings submitted · First caption voted best                                                |
| **Seasonal** | Complete a seasonal event · Collect 5 seasonal badges                                                              |

Each achievement: name, icon (emoji), description, hidden variant (surprise
achievements for delight), and an optional title unlock.

## 3. Titles & badges

- **Titles** are the social currency: shown next to nicknames in lobbies and on share
  cards. Examples: "Word Wizard" (25 anagram wins), "Cartographer" (World Peek top
  10%), "Streak Phoenix" (restored a streak), "Trivia Oracle" (100 daily trivia plays).
- **Badges** are collectibles: displayed on a profile shelf, sorted by rarity
  (common/uncommon/rare/legendary). Seasonal badges are time-limited → FOMO → retention.
- Title loadout: players equip ONE title; earning the next one is a visible progress
  bar ("3/5 word wins until Word Wizard").

## 4. Collections & completion

- **Game completion percentage:** per game, track lifetime stats (plays, best, badges
  available). The catalog page shows a completion ring on each card.
- **Collections:** "Beat every daily game on Hard" (12/12), "Win every drawing game",
  "All 19 games played 10+ times." Collections have a shelf page with a completion bar.
- **Completionist reward:** per-collection capstone badge + title.

## 5. Player statistics & play history

- **Profile page** (member): nickname, avatar (emoji picker), level + XP bar, title,
  badges shelf, lifetime stats (games played, rooms hosted, wins, best streak,
  total XP), per-game table (plays / best / average / badges), and a **play history
  feed** (last 30 days, filterable by game).
- **Guest profiles:** same page minus persistence, with a "keep your progress" CTA.
- **Privacy:** history defaults to private; "share my stats" toggle for social pages.
  Hosts never see participant history (rooms stay anonymous by default, PRD §13
  respect).

## 6. Seasonal events

- 4-6 events/year: Halloween, Year-End, Valentine's, Summer, plus one Indian-culture
  event (Diwali/Holi, the audience is Indian-first; this is a differentiator no US
  competitor has).
- Structure per event: 7-14 days, 3-5 event challenges ("play 3 drawing games",
  "win 2 dailies on Hard"), exclusive badges + titles, event leaderboard, and a themed
  skin for the hub + one game (dark-mode-compatible gradient tokens, PRD §11).
- Events are pure content + config: no new engines.

## 7. Anti-farm & fairness

- XP caps per day per action type (above).
- Room wins require ≥3 players (no solo farming).
- Daily-game XP once per game per day.
- Leaderboards: same-game, same-tier, same-scope; ties broken by earlier submission.

## 8. Why this beats the competition

- **Jackbox:** has no persistent identity at all. **Kahoot:** XP exists but is
  classroom-shaped. **CrowdParty:** no progression surfaced. **Sporcle:** streaks +
  badges but no XP/levels/titles.
- TriviaHub's combination, **daily ritual + XP + titles + seasons + collections**.
  is the full stack, and it's the first thing any competitor must now copy.
