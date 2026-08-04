# Final Implementation Plan, The Consolidated Build Order

**Supersedes the feature list in 11 Roadmap.** Documents 01-10 remain the _specs_;
this document is the _plan_. It does three things the earlier docs did not:
(1) audits every idea across all 12 docs for duplication, (2) merges overlapping
systems into single engines, (3) cuts features whose value does not justify their
cost. **Nothing here is additive to 01-10 without an explicit reason.**

---

## 1. The duplication map (what merged into what)

| Idea                                                                                   | Appeared in                                      | Merged into                                                                                                                                         |
| -------------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Per-game streaks, grand streak, freeze tokens, season restore                          | 03 §4 · 09 §2.2                                  | **One Streak system** (see §2)                                                                                                                      |
| Weekly streaks, group streaks                                                          | 09 §2.3, §2.7                                    | **Deleted as systems**, weekly streak is a derived view of `DailyRun` rows; group streak is the friend feed showing individual streaks side by side |
| Daily rewards, first-game bonus                                                        | 09 §2.1-2.2 · 04 §1                              | **Deleted**, the XP table already rewards daily play (25 XP + 15 warmup). A separate reward system would double-count                               |
| Weekly challenges, community challenges, seasonal events, tournaments, surprise events | 06 §5, §7 · 09 §2.3-2.5, §2.10 · 04 §6 · 08 §2.4 | **One Events engine**, all five are an event window + goals + rewards + leaderboard + theme. Tournaments add a standings subtype                    |
| Collections, completion percentage, mastery                                            | 04 §4 · 09 §2.8                                  | **Progression** (one completion/collection system)                                                                                                  |
| Personal bests                                                                         | 09 §2.9 · 03 §7 · 04 §5                          | **A query over `PlayHistory`/`DailyRun`**, not a system                                                                                             |
| Friend feed, play history, recently played, live room ticker, invite history           | 06 §1-3 · 04 §5 · 05 §4 · 09 §2.7                | **One Activity feed** (anonymizable for the public ticker)                                                                                          |
| Friend battles, async play                                                             | 06 §2 · 11 #23                                   | **Battles**, "async rooms" were a solution in search of a problem; dailies + battles already cover time-zone play                                   |
| Daily game leaderboards, global, friend, lifetime                                      | 03 §3 · 09 §2.6 · 06 §2                          | **One Leaderboard system**, scope (global/friends/self) and period are query parameters                                                             |
| In-app notification center, PWA push, weekly recap email                               | 09 §2.11 · 03 §7 · 11 #21                        | **One Notification system**, transports (in-app → email → push) are pluggable                                                                       |
| Share cards, results share, OG images                                                  | 03 §8 · 05 results · 08 §4                       | **One Share pipeline** (extends the existing canvas share-image)                                                                                    |
| Host workspace, template library, team workspaces                                      | 06 §8 · 11 #16, #24 · 01 §7                      | **One Workspace system**, free tier (templates) → paid tier (analytics/branding)                                                                    |
| AI pipelines, community submissions, moderation                                        | 07 entire · 06 §8 · 09 §2.11                     | **One Content engine** (already consolidated in 07; room-moderation and catalog-moderation share one policy classifier)                             |
| "Choose for me", filters, card metadata, category/difficulty SEO                       | 01 §5 · 05 cards · 08 §2                         | **One game-metadata schema** powering discovery + SEO (already framed that way in 01)                                                               |
| 48 achievements, badge shelves, title loadout                                          | 04 §2-3                                          | **One Progression system**; launch set trimmed 48 → 24 (§3)                                                                                         |

## 2. The consolidated system list (the actual build units)

Exactly **14 systems** replace the ~30 feature-groups in 11. Each is one engine,
one data model, one test surface, reusable everywhere it's needed.

| #   | System                  | Absorbs                                                                                                              | Primary spec                           | Horizon                     |
| --- | ----------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | --------------------------- |
| S1  | **Identity**            | member profiles, streaks (per-game/grand/freeze/restore), leaderboard identity, guest→member conversion              | 01 §4 · 03 §4                          | V1.5                        |
| S2  | **Daily engine**        | all daily games, tiers, server-seeded content, idempotent submission, leaderboard scopes, daily hub + landing pages  | 03                                     | V1.5 → V2.0                 |
| S3  | **Share pipeline**      | share cards, results share, OG images (one canvas pipeline)                                                          | 03 §8 · 05                             | V1.5                        |
| S4  | **Discovery**           | game-metadata schema, filters, "choose for me", category/difficulty pages                                            | 01 §5 · 08 §2                          | V1.5 schema → V2.0 surfaces |
| S5  | **Progression**         | XP, levels, 24 achievements, titles, badges, collections, completion, stats, PBs (derived)                           | 04                                     | V2.0                        |
| S6  | **Social graph**        | friends, follows, battles, friend leaderboards, activity feed, recently played                                       | 06 §1-3                                | V2.0                        |
| S7  | **Events engine**       | weekly + seasonal + community + surprise events, tournaments (standings subtype), seasonal skins                     | 06 §5, §7 · 09 §2.3-2.5, §2.10 · 04 §6 | V2.0 → V3.0                 |
| S8  | **Content engine**      | all generation pipelines, gates, provenance, calibration, community submissions, moderation queue                    | 07                                     | V2.0 → V3.0                 |
| S9  | **Room extensions**     | spectator mode, public rooms, Live now, host tools, conversation mode, classroom-mode suite, (V3.0: party playlists) | 06 §4, §8 · 05 lobby                   | V2.0 → V3.0                 |
| S10 | **Notification center** | in-app feed → email recap → PWA push (transports plug in)                                                            | 09 §2.11                               | V2.0 → V3.0                 |
| S11 | **Workspace**           | templates, recent rooms (free); analytics, branding (paid)                                                           | 06 §8 · 01 §7                          | V2.0 → V3.0                 |
| S12 | **SEO & integrity**     | route-integrity CI, programmatic pages, teacher hub, printables, blog clusters                                       | 08                                     | V1.5 CI → V2.0 pages        |
| S13 | **UX system**           | motion, sound, states, a11y, theming, one design pass applied to every surface                                       | 05                                     | V1.5 → V3.0                 |
| S14 | **Scale-out**           | Redis adapter, regional gateways                                                                                     | 00 · 11                                | V3.0                        |

## 3. Cuts & folds (what we removed, and why)

### Cut entirely

| Feature                                                    | Why                                                                                                                                                                            |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Fake News** (02 #2)                                      | Bluffing trivia already covered by Imposter Trivia + Fictionary; the name and premise carry misinformation optics risk for classrooms, AdSense, and press, asymmetric downside |
| **Reverse Playlist** (02 #12)                              | Weakest music concept; the music-trivia niche is already served by Trivia + Genre Swap/Bender. Its only real asset (song-metadata dataset) is retained and feeds Hum It Back   |
| **Border Blitz** (02 #14)                                  | Third geography game. Flag Rush (cheap) + World Peek (genre-gap) cover the genre; a countries-knowledge variant adds breadth without value                                     |
| **Weekly streaks** (09)                                    | Derived from `DailyRun` rows for free, not a system                                                                                                                            |
| **Group streaks** (09 §2.7)                                | The friend feed already shows friends' streaks side by side; a shared counter adds a table and semantics for marginal value                                                    |
| **Daily reward tokens / collectible currencies** (09 §2.2) | XP + badges are the reward; a second currency is complexity with no user-visible benefit                                                                                       |
| **Async rooms** (11 #23)                                   | Dailies and battles already cover async competition; a separate async room mode is unproven demand                                                                             |
| **Weekly recap email** (03 §7)                             | In-app recap first (notification center); email infra deferred to V3.0 push work                                                                                               |
| **"Reel or Fake" Daily Movie as a separate game**          | Daily Movie stays, but as a **content type on the trivia engine** (yes/no synopsis questions), not a new game. Same for the daily "Movie" entry                                |

### Folded into existing systems (not built as new products)

| Feature                                | Becomes                                                                                                                                                    |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Emoji Charades (02 #9)                 | An **emoji prompt pack** in the existing Charades game                                                                                                     |
| Deadline (02 #24)                      | **Survival mode** of the existing Trivia game                                                                                                              |
| Icebreaker Rooms (02 #26)              | **Conversation mode**, a room setting (no-score + question decks from the content engine), not a game                                                      |
| Quiz Show (02 #32)                     | Part of the **classroom-mode suite** on the shared room runtime (buzzer rounds, team captains, steal), the teacher surface stays, the standalone game goes |
| Predict the Chat (02 #29)              | Ships with **streamer tools** in V3.0 (depends on spectator mode + voting engine)                                                                          |
| 48 achievements (04 §2)                | **24 at launch** (6 per family × 4 families); the schema supports more, quality over checklist                                                             |
| Streak freeze + season restore (03 §4) | One **streak-protection** feature (freeze tokens earned weekly + one mercy restore per season)                                                             |

### Challenged and kept (with reasons)

- **12 daily games**, brief-mandated; the grand streak means users needn't play all 12, and the content engine (S8) makes content cost linear-to-cheap. Kept, but sequenced by engine availability (V1.5: 6, V2.0: 11, V3.0: 12, see §4).
- **Daily Drawing community vote**, the only daily that can't self-score becomes the social daily; reuses existing Copycat upload + voting engines. Kept.
- **Turing Test** (02 #28), the only game where the server plays; unique and cheap once S8 exists. Kept (V3.0).
- **Word Ops / World Peek**, the two real genre gaps (team wordplay, geography). Kept.
- **Spectator mode**, expensive-ish (room permission + presenter render) but it is the dependency for Live now, streamer tools, and the "watch → play" conversion loop. Kept in V2.0.

## 4. The final implementation plan

### Phase V1.5, Identity & ritual foundation (1-2 weeks)

**Goal: the habit loop works and survives a browser clear. Zero new games, zero new engines.**

| Milestone                                  | Scope                                                                                                                                                                                                                                                           | Exit criteria                                                                                                       |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **M1.5.1 Identity (S1)**                   | `UserProfile` (memberKey, email optional), `DailyRun` (idempotent clientKey), `Streak` tables; guest→member one-tap conversion after a daily; server-side streaks + protection (freeze/restore); leaderboard scope param; submit/leaderboard endpoints hardened | Streak survives browser clear + device change; duplicate submissions rejected; guests still play with zero friction |
| **M1.5.2 Daily expansion (S2)**            | 6 dailies from **existing engines**: Trivia, Sudoku, Emoji Plot, Timeline, Price Guess, Rhyme, server-served content, Easy/Normal/Hard tiers, daily hub page, `/daily/[slug]` landing pages with JSON-LD                                                        | 6 dailies live; same-day-same-content verified; tier-weighted global board + raw friend board                       |
| **M1.5.3 Share pipeline (S3)**             | Daily share cards (score, tier, streak, invite code) via the existing canvas pipeline; results share gets the same treatment                                                                                                                                    | Share actions measured (target 8% of daily plays)                                                                   |
| **M1.5.4 UX pass (S13)**                   | Empty/loading/error states everywhere, confetti on PBs, motion system, WebAudio sounds off-by-default, focus/reduced-motion audit                                                                                                                               | 0 unhandled loading states; Lighthouse a11y ≥ 90                                                                    |
| **M1.5.5 Integrity & discovery (S12, S4)** | Route-integrity CI (title=H1, counts match data, canonicals, no orphans); game-metadata schema (players/duration/energy/content/mechanics) in `games.json`                                                                                                      | CI blocks broken pages; metadata powers filters + "choose for me" (logic only, UI in V2.0)                          |
| **M1.5.6 Leaderboard hardening**           | Lifetime leaderboard + personal-best rows (derived queries over `Score`/`DailyRun`)                                                                                                                                                                             | PBs shown on profile and daily hub                                                                                  |

**Not in V1.5 (deliberate):** new games, XP, friends, events, notifications, content engine.

### Phase V2.0, The retention machine (1-3 months)

**Goal: "why come back tomorrow" is fully answerable, 11 dailies, progression, friends, events, and the content engine feeding them.**

| Milestone                                                                                                                                                                                                                                     | Scope                                                                                                                                                                                                                               | Depends on |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **M2.0.1 Games wave A** (daily-enabling, S-difficulty): Flag Rush, Anagram Rush, Simon Sequence, Memory Market, Numberline, Mastermind                                                                                                        | Daily Logic rotation (Sudoku/Mastermind/Numberline/Memory Market) + Daily Memory go live                                                                                                                                            | ,          |
| **M2.0.2 Dailies to 11** (S2): Daily Guess Who (server-served celebrity, clue-by-clue scoring, existing 205-celeb dataset), Daily Geography via **World Peek** (wave B), Daily Movie (yes/no content type on the trivia engine, seeded by S8) | 11 dailies + Daily Drawing vote loop (community submissions, 24h verdict, winner announcement)                                                                                                                                      | M2.0.1, S8 |
| **M2.0.3 Progression (S5)**                                                                                                                                                                                                                   | XP economy (04 §1 table), level curve, 24 achievements, titles, badges, collections, completion rings on catalog cards, stats profile                                                                                               | M1.5.1     |
| **M2.0.4 Social (S6)**                                                                                                                                                                                                                        | Friends, follows, battles, friend boards, activity feed (also powers the anonymized hero ticker), recently played                                                                                                                   | M1.5.1     |
| **M2.0.5 Events engine (S7)**                                                                                                                                                                                                                 | `Event` table (kind: weekly/seasonal/community/surprise), one claim flow, event skins via theme tokens; ship **season 1** (Halloween or Diwali, Indian-first audience)                                                              | M2.0.3     |
| **M2.0.6 Content engine v1 (S8)**                                                                                                                                                                                                             | Pipelines for daily-critical types (trivia, WYR, NHIE, MLT, emoji plots, rhyme, movie synopses); gates (schema, dedup, tier classifier, licensing), provenance labels, community submissions; replaces hand-written future datasets | ,          |
| **M2.0.7 Room extensions (S9)**                                                                                                                                                                                                               | Conversation mode; classroom-mode suite (no-score, buzzer, teams, steal, incl. Trivia Survival mode); spectator mode + public rooms + Live now rail; host tools (mute/remove/pause/report)                                          | ,          |
| **M2.0.8 Workspace v1 + notifications (S11, S10)**                                                                                                                                                                                            | Template library (save room settings + packs, relaunch in one tap), recent rooms; in-app notification center (battles, streak-at-risk, event deadlines)                                                                             | M1.5.1     |
| **M2.0.9 Games wave B** (genre gaps + social hooks): **Word Ops**, **Two Truths and a Lie**, **Bracketology**                                                                                                                                 | Fills the two genre gaps + the most-requested classic                                                                                                                                                                               | ,          |
| **M2.0.10 SEO surfaces (S12)**                                                                                                                                                                                                                | Category/difficulty/occasion pages, teacher hub + printables, blog clusters; every new game ships with the full SEO stack                                                                                                           | M1.5.5     |

**V2.0 exit criteria:** 11 dailies + drawing vote; server streaks with protection; XP/titles/badges live; friends + battles + feed; first seasonal event shipped; content engine producing gated content with provenance; spectator + classroom modes live; every new game SEO-complete.

### Phase V3.0, The platform (6-12 months)

| Milestone                                | Scope                                                                                                                                                                                                                                                                                                                 | Depends on     |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| **M3.0.1 Daily Music**                   | **Hum It Back** (WebAudio-synthesized melodies) completes the 12-daily lineup                                                                                                                                                                                                                                         | AUDIO pipeline |
| **M3.0.2 Games wave C**                  | The Chameleon, Fictionary, Liar's Dice, Imposter Trivia, Caption This, Letter Ladder, Bomb Squad, Exquisite Corpse, Sketch or Sketchy, Mind Meld, Story Forge, Auction House, prioritized by genre balance: bluffing family (Chameleon, Fictionary, Liar's Dice) → creativity (Caption This, Exquisite Corpse) → rest | S8             |
| **M3.0.3 Tournaments (S7 v2)**           | Monthly cadence (4 weekly legs + final), standings subtype, title prizes                                                                                                                                                                                                                                              | M2.0.4, M2.0.5 |
| **M3.0.4 Party playlists (S9)**          | One room, continuous game sequence, cumulative score, one share link                                                                                                                                                                                                                                                  | M2.0.8         |
| **M3.0.5 PWA + push (S10)**              | Installable shell, push transports, email recap                                                                                                                                                                                                                                                                       | M2.0.8         |
| **M3.0.6 AI-native games**               | Turing Test; AI-generated rooms (games that author themselves per room from S8)                                                                                                                                                                                                                                       | S8 v2          |
| **M3.0.7 Community marketplace (S8 v2)** | Player-authored questions/packs with credited badges, review queue                                                                                                                                                                                                                                                    | M2.0.6         |
| **M3.0.8 Workspaces paid (S11)**         | Analytics, branding, team seats, the monetization layer (participant play stays free forever)                                                                                                                                                                                                                         | M2.0.8         |
| **M3.0.9 Streamer tools (S9)**           | Predict the Chat, branded spectator rooms                                                                                                                                                                                                                                                                             | M2.0.7         |
| **M3.0.10 Scale-out (S14)**              | Redis adapter, regional gateways, **only when DAU demands it** (single-node room engine is not today's bottleneck)                                                                                                                                                                                                    | ,              |

## 5. Ranked priority (ROI across the merged plan)

Scored on impact / effort / business / replay / virality; **ROI = (imp+biz+rep+vir)/effort**.

| Rank | Work                                                           | Imp | Eff | Biz | Rep | Vir | ROI |
| ---- | -------------------------------------------------------------- | --- | --- | --- | --- | --- | --- |
| 1    | **M1.5.2, 6 dailies from existing engines**                    | 5   | 2   | 4   | 5   | 4   | 9.0 |
| 2    | **M1.5.1, Identity + server streaks**                          | 5   | 3   | 5   | 4   | 3   | 5.7 |
| 3    | **M1.5.3, Share cards**                                        | 4   | 2   | 3   | 2   | 5   | 7.0 |
| 4    | **M2.0.5, Events engine + season 1** (merges 4 systems into 1) | 4   | 2   | 4   | 4   | 3   | 7.5 |
| 5    | **M2.0.3, Progression**                                        | 5   | 3   | 4   | 5   | 2   | 5.3 |
| 6    | **M2.0.4, Friends + battles + feed**                           | 5   | 3   | 4   | 5   | 4   | 6.0 |
| 7    | **M2.0.6, Content engine v1**                                  | 5   | 4   | 5   | 5   | 2   | 4.3 |
| 8    | **M1.5.5, Integrity CI + metadata**                            | 3   | 1   | 3   | 0   | 0   | 6.0 |
| 9    | **M2.0.7, Room extensions** (conversation/classroom/spectator) | 4   | 3   | 4   | 3   | 3   | 4.7 |
| 10   | **M2.0.9, Games wave B** (Word Ops, Two Truths, Bracketology)  | 4   | 3   | 3   | 4   | 3   | 4.7 |

Sequencing rule: **identity → ritual → social → content**, each layer unlocks the
next, and the keystone (M1.5.1) stays first. Reliability discipline (server-authoritative
rooms, tested sockets) is a constraint on every milestone, never a feature.

## 6. Consolidated additive schema (the full data delta)

```text
UserProfile     id, memberKey (unique), email?, nickname, avatarEmoji, xp, level,
                titleId?, preferences Json (sound/motion/tier defaults), createdAt, lastSeenAt
DailyRun        id, userId?, gameId, dateKey, tier, score, durationMs, correctCount,
                totalCount, clientKey (unique)          @@unique([userId, gameId, dateKey, tier])
DailyContent    id, gameId, dateKey, tier, data Json    @@unique([gameId, dateKey, tier])
Streak          id, userId, scope ('grand'|gameId), current, longest, lastPlayedDate,
                freezeTokens, restoreUsedSeason         @@unique([userId, scope])
AchievementUnlock  id, userId, achievementId, unlockedAt     @@unique([userId, achievementId])
PlayHistory     id, userId, gameId, roomId?, mode, result Json, playedAt , feed + PBs derived
ActivityEvent   id, type, userId?, payload Json, privacy, createdAt
Friend          id, requesterId, targetId, status         @@unique([requesterId, targetId])
Follow          id, followerId, targetId                  @@unique([followerId, targetId])
Battle          id, challengerId, targetId, gameId, challengerScore, targetScore?, status, createdAt
Event           id, kind (weekly|seasonal|tournament|community|surprise), definition Json,
                startsAt, endsAt, theme?
EventEntry      id, eventId, userId, value, claimedAt     @@unique([eventId, userId])
ContentItem     id, gameType, payload Json, tags, difficulty, provenance Json,
                license Json, state, usage Json, version
Report          id, targetType, targetId, reason, status, createdAt
Template        id, ownerId, name, gameSlug?, settings Json, customPacks Json, updatedAt
Notification    id, userId, kind, payload Json, readAt, createdAt
```

Existing tables (`Game`, `Room`, `RoomPlayer`, `Score`, `DailyChallenge`) are
unchanged; `DailyChallenge` is superseded by `DailyContent` (same upsert pattern).

## 7. What this changes vs. the earlier docs

- **11 Roadmap's 27 items → 14 systems + 26 milestones.** Items 12/13/17/19 (events,
  seasons, tournaments, surprises) became one engine; items 9/23 (battles, async)
  became one social layer; item 21's email recap moved behind the notification center.
- **Games: 32 concepts → 24 shipped concepts** (4 cut, 4 folded into modes/packs).
- **Achievements: 48 → 24 at launch.**
- **Dailies: 12 stays, but honestly sequenced**, 6 in V1.5 (existing engines),
  11 in V2.0, 12 in V3.0 (Hum It Back).
- **Unchanged and load-bearing:** account-lite identity, no participant paywall, PRD §13
  licensing rails, static-MPA SEO, server-authoritative rooms, deterministic on-read
  seeding (no cron).
