# Retention, Why Someone Comes Back Tomorrow

**Task 9 of the Vision 2.0 brief.** This is the load-bearing doc: the entire
strategy exists to answer one question. Today the honest answer is "two daily
games and a localStorage streak." This doc turns retention from a feature into
an architecture.

---

## 1. Ground truth: the retention surface today

| Surface       | Current state                                      | Problem                                                             |
| ------------- | -------------------------------------------------- | ------------------------------------------------------------------- |
| Daily games   | Trivia + Sudoku, UTC-seeded, idempotent score keys | Only 2; streaks in localStorage (wipeable, gameable, browser-bound) |
| Streaks       | localStorage                                       | Die with a browser clear; no server truth; no streak-freeze         |
| Leaderboards  | Daily, per-game, per-day                           | No lifetime, no friends, no history                                 |
| Stats         | Per-browser nicknames                              | No identity → no "you" to retain                                    |
| Notifications | None                                               | No reason to return at a specific time                              |

The retention architecture in 03/04/06 (server-side streaks, XP, friends,
tournaments) is the foundation. This doc adds the **cadence layer**: the systems
that create a rhythm of small, recurring reasons to open the site.

---

## 2. The retention stack (in order of leverage)

### 2.1 Daily games, the habit core (already in 03)

12 daily games, one shared streak, streak-freeze (1/day), share cards, global +
friend leaderboards. The daily game page is the **homepage for returning users**

- "today's games" is the first thing a logged-in visitor sees. This is the Wordle
  loop generalized: deterministic, social, shareable, 5 minutes a day.

### 2.2 Daily rewards, the second hook

- **Daily login/play reward:** playing any daily game awards the daily bonus
  (XP + a collectible token, see 04 §collections). Stacking the reward with the
  habit is the difference between "a thing to do" and "a thing that pays."
- **Streak milestone rewards:** 3/7/30/100-day streak badges + titles. Milestone
  announcements are the re-engagement moment ("you're 3 days from 100, don't
  break the chain").
- **No payment, no premium currency.** Rewards are XP, badges, titles, cosmetic
  card themes. Status is the prize (same principle as tournaments in 06).

### 2.3 Weekly challenges, the weekly beat

- **Weekly challenge:** one rotating goal per week ("score 5,000 in Trivia
  this week", "play 3 drawing games", "win a room in Friendly Fire"). Auto-generated
  from catalog + play data; always achievable in ~3 sessions.
- **Weekly streak:** distinct from daily streak (more forgiving, weekly streaks
  survive missed days, which protects users from "all or nothing" churn).
- **Community challenge** (06 §7): global goal with a progress bar, the
  "everyone plays together" beat.

### 2.4 Monthly tournaments, the monthly beat

- 4 weekly legs + final (06 §5). Monthly tournaments are the _scheduled event_
  that gives the calendar a spine: dailies = daily, challenges = weekly,
  tournaments = monthly, seasons = quarterly.

### 2.5 Seasons, the quarterly beat

- 4 seasons/year with a theme, a seasonal title track, a seasonal badge set, and
  a seasonal game mode or daily variant (Halloween NHIE tier, holiday trivia,
  Valentine's WYR). Seasonal content is the freshness beat that the content
  engine (07) makes cheap.
- Season pass is **free**; paid pass is explicitly out of scope for now
  (00 §monetization).

### 2.6 Leaderboards, the competitive beat

- Tiers: **global** (lifetime + daily), **friends** (the one that matters most.
  see 06), **regional?** no, party games compete globally, friends compete
  personally.
- Leaderboards get the "so close" affordance: "you're 120 points from #7".
  the single highest-converting nudge in games.

### 2.7 Friend competitions, the social beat

- Async "battle a friend" (06 §2), friend feed nudges ("Aditi beat your Daily
  Trivia score"), and the **group streak**: a shared "we've played 14 days in a
  row" counter for a friend group. Group streaks are stronger than individual
  ones, you're not breaking the chain alone.

### 2.8 Completion tracking, the collector beat

- Per-game completion (play every game, win every game, earn every badge),
  collection sets (04), and a "mastery" indicator per game. Completion is a
  promise of future reward, the slow burn that keeps casual players returning
  for months.

### 2.9 Personal bests, the self-competition beat

- Per-game PB, PB celebrations on results screens ("New PB! +2,400"), PB
  notifications ("you beat your Sudoku time by 90 seconds"). Self-competition
  works when friend competition isn't available, it is the retention floor.

### 2.10 Surprise events, the delight beat

- **Unexpected, scheduled surprises** (not random, not gambling): "Double XP
  weekend", "Mystery Daily, play today's mystery game for 2× tokens",
  "Retro week, the original 5 games return with retro card themes".
- Surprise events must never require payment or create FOMO pressure, the goal
  is delight, not anxiety. 1-2 per month, announced in-app.

### 2.11 Notifications, the re-entry beat

- **PWA push** (V3.0, requires the PWA work in the roadmap): daily game reminder
  at the user's chosen hour (default: their local evening), streak-at-risk
  warning, friend-battle challenge, tournament leg reminder, weekly challenge
  deadline.
- **In-app notification center** (V2.0): a bell with all of the above, plus
  "results are in" for rooms played yesterday. Never more than one notification
  per day per category, notification spam is churn.

---

## 3. The retention engine (server design)

One table makes most of this real:

```text
DailyPlay   (userId, dateKey, gameId, score, playedAt)   @@unique(userId, dateKey, gameId)
Streak      (userId, kind: daily|weekly|group, current, longest, lastPlayedDate, freezeAvailable)
Challenge   (id, kind: weekly|community|seasonal, definition Json, startsAt, endsAt)
ChallengeProgress (challengeId, userId, value, claimed)
PersonalBest (userId, gameId, mode, bestScore, bestTime?, updatedAt)
Notification (userId, kind, payload Json, readAt, createdAt)
```

- **Server-side streaks replace localStorage:** the client reports play with an
  idempotency key (same pattern as `Score.clientKey` today); the server computes
  streak from `DailyPlay` rows. LocalStorage remains only as an offline cache.
- **Streak freeze:** 1 free skip per N days (consumed automatically on first
  miss, never purchasable).
- **Challenge definitions** are data (not code): a `definition Json` with
  goal/type/scope lets ops ship weekly challenges without deploys, the same
  pattern as the daily seeding (deterministic, on-read, no cron).
- **Cadence scheduler:** daily resets at UTC midnight (existing pattern);
  weekly/monthly/seasonal resets are pure functions of the current date.
  **no cron jobs**, matching the deterministic-seed philosophy in the codebase.
- **Anti-abuse:** rate limits on play reporting, one score per game per day
  (already enforced by unique keys), server-side score validation for dailies.

---

## 4. The "tomorrow" moment, designed

Concretely, a returning user's first screen (V2.0):

```text
┌─ Good evening, Aditi ────────────────────────────────┐
│  🔥 12-day streak (freeze: 1 left)                   │
│  Today's games: [Trivia] [Sudoku] [Emoji Plot]       │
│  Weekly challenge: 3,200 / 5,000 XP in Trivia  [>>]  │
│  ⚔ Priyansh beat your Daily Trivia score by 40       │
│  🏆 Tournament leg 3 of 4 starts Friday              │
│  🎁 Season badge unlocked at 2 more dailies          │
└──────────────────────────────────────────────────────┘
```

Every row answers "why today" and every row is a button. This screen alone is
the retention feature, the rest of the site supports it.

---

## 5. Retention metrics (what we measure)

| Metric                         | Definition                                       | Target                                |
| ------------------------------ | ------------------------------------------------ | ------------------------------------- |
| D1/D7/D30 retention            | Returning visitors                               | Beat category norms (Sporcle ~D30≈5%) |
| Daily game completion          | Plays a daily game today                         | 40% of weekly actives                 |
| Streak survival                | % of 7-day streaks reaching 30                   | 25%                                   |
| Weekly challenge participation | % of actives with ≥1 claim                       | 30%                                   |
| Return reason                  | self-reported ("daily", "friends", "tournament") | daily #1                              |
| Notification CTR               | opens per push                                   | >15%                                  |

---

## 6. Why this beats the competition

- **CrowdParty:** zero retention architecture, event-driven by design. We win
  the "next 30 days" they never built.
- **Sporcle:** has daily games and streaks but no friends graph, no async
  battles, no tournaments, no server identity. We take their daily loop and add
  the social stack.
- **Wordle:** one game, one streak, no progression. We generalize the loop
  across 12 dailies with the same share-card virality.
- **Kahoot/Quizizz:** classroom-shaped (teacher-driven); no personal habit loop.
- **Jackbox:** session-only by design; no daily surface at all.
- The combination, **daily habit + weekly challenges + monthly tournaments +
  friend pressure + collection completion + surprise events**, is the first
  complete retention stack in browser party games.
