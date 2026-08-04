# Product Vision, Redesign from First Principles

**Task 1 of the Vision 2.0 brief.** This document challenges the current product shape
and proposes what TriviaHub should _be_, not just what it should _have_.

---

## 1. The core question

> If TriviaHub launched today, what would make it unforgettable?

The answer is not "more games." Games are table stakes. The unforgettable part is a
**single sentence a player can say to a friend**:

> "We play the same daily puzzle every day, and I'm trying to beat your score."

No competitor in the space owns that sentence. Sporcle owns quizzes, Wordle owns the
daily word, GeoGuessr owns location, Jackbox owns the couch. **Nobody owns "the daily
party."** That is TriviaHub's lane: a _shared daily ritual_, same game, same day,
same rules, everyone, combined with the instant-start room loop.

## 2. Product definition

**TriviaHub is the party OS.** Three layers, one identity:

```text
RITUAL          Daily games (12), streaks, personal bests, global + friend leaderboards
   │
PROGRESSION     XP, levels, badges, titles, seasons, play history, play accumulates
   │
TOGETHER        Rooms (instant, no-account for players), friends, spectating, tournaments
```

Every layer feeds the next: a daily game earns XP; XP unlocks titles; titles are shown
in rooms; rooms create rivalries; rivalries drive the next daily game.

## 3. Audience-first design (replacing the "one catalog" model)

CrowdParty's catalog is a warehouse. TriviaHub's discovery asks **"what are we doing
tonight?"**, four intent paths instead of one undifferentiated grid:

| Intent         | Question                                   | Answer surface                                                                   |
| -------------- | ------------------------------------------ | -------------------------------------------------------------------------------- |
| **Quick play** | "We have 10 minutes, pick for us"          | "Choose for me", energy, group size, time, mood → 1 recommended game             |
| **Ritual**     | "What's today's challenge?"                | Daily hub: 12 games, streaks, friend battles                                     |
| **Occasion**   | "It's a birthday / classroom / team retro" | Goal-based filters + curated packs (holiday, teacher, team-building)             |
| **Deep play**  | "We love drawing games"                    | Family/mechanic browsing with filters (players, duration, energy, content level) |

## 4. The identity model (the biggest architectural decision)

**Current:** nickname-only; streaks live in localStorage; leaderboards are name-based and
gameable.

**Proposed, "account-lite":**

- **Players (no account):** join rooms with a nickname, exactly like today. Zero friction
  preserved. Their play is anonymous and ephemeral.
- **Members (optional, one-tap):** a member is a player who pressed "Keep my progress."
  Identity = device-generated key + optional email (for recovery + weekly recap email).
  Membership enables: server-side streaks, XP, badges, friends, play history, personal
  bests, daily-game leaderboards, share cards with their name.
- **Hosts:** members can later pay for workspaces (V3.0), templates, analytics,
  branding. Free tier stays generous.

Why: CrowdParty's research shows the no-account participant is the wedge; but _nobody_
returns without an identity. Account-lite is the reconciliation: **guests play, members
accumulate.** The conversion ask is one button after a daily game ("Keep your streak.
it's free"), not a wall.

## 5. "Choose for me", the recommendation engine

A 5-question wizard (group size, time, energy, mood, content level) that returns **one**
recommended game with an explanation ("Drawing · 4-8 players · 20 min · high energy").
Backed by a game-metadata schema (players, duration, energy, content level, mechanics)
that every game already needs for SEO anyway. No ML required initially, a scored
filter over metadata + play data ("popular with groups like yours").

## 6. The daily hub (see 03_Daily_Games for full spec)

The homepage's second section becomes **Today at TriviaHub**: the 12 daily games,
streak flames, "your friends played today" feed, personal bests, and a share card for
whatever you just finished. This is the retention spine of the product.

## 7. Missing opportunities we will not miss

| Opportunity         | Why it matters                                                                              | Where it lands               |
| ------------------- | ------------------------------------------------------------------------------------------- | ---------------------------- |
| **Friend battles**  | "Beat my score" is the strongest share hook since Wordle                                    | 06 Social, 09 Retention      |
| **Spectating**      | Turns a party into an audience; streamer gold                                               | 06 Social                    |
| **Seasonal events** | Halloween/Diwali/New Year reskins with exclusive badges                                     | 04 Progression, 09 Retention |
| **Teacher mode**    | No-score, no-timer, accessibility-first settings for classrooms                             | 05 UX, 08 SEO                |
| **Printable games** | Classroom/offline reach + SEO surface                                                       | 08 SEO                       |
| **Async play**      | Friends in different time zones can still compete (daily games already are async)           | 06 Social                    |
| **Host workspace**  | Repeat hosts get templates, history, analytics, the CrowdParty gap we exploit               | 06 Social, 11 Roadmap        |
| **Sound design**    | Nobody in this category has tasteful audio; WebAudio buzzers/confetti make rooms feel alive | 05 UX                        |

## 8. What we deliberately will NOT do

- **No participant paywall, ever** (the wedge).
- **No accounts required to play** (the wedge).
- **No copyrighted content** (PRD §13 stands, paraphrased lyrics, CC/PD media, original
  generation only).
- **No AI content without moderation + provenance** (the CrowdParty AI failure is a
  trust lesson, not a feature).
- **No chat without moderation tooling** (host mute, word filters, report flows).

## 9. The one-sentence pitch for every stakeholder

- **Player:** "The daily party that remembers you."
- **Host:** "Start a party in 10 seconds; come back because your group is hooked."
- **Investor:** "Wordle's retention loop applied to the $3B virtual-gathering market,
  with the no-install wedge CrowdParty proved but failed to retain."
