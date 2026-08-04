# Roadmap, V1.5 → V2.0 → V3.0, Ranked by ROI

> **⚠ Superseded by `12_FINAL_PLAN.md`.** This document remains as the first-pass
> feature scoring; the final plan consolidates its 27 items into 14 systems and 26
> milestones (cuts, merges, and folds are documented in 12 §1-§3).

**Task 11 of the Vision 2.0 brief.** Three horizons, every feature scored on five
axes, ordered by ROI. The rule of this roadmap: **identity first, ritual second,
social third, infinite content fourth**, because each layer unlocks the next.
Nothing here should be built before the layer it depends on.

Scoring: 1-5 per axis (impact = users affected & how much; effort = eng cost;
business = value to the company; replay = returns-per-play; virality = shares
per play). **ROI = (impact + business + replay + virality) / effort.**

---

## Horizon 1, V1.5: Quick wins (1-2 weeks)

Everything here is additive to the existing codebase (19 games, `pnpm verify`
green, deterministic daily seeding, SoloShell, share-canvas). No new engines.

| #   | Feature                                                                                                                                | Imp | Eff | Biz | Rep | Vir | ROI | Why now                                                    |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | --- | --- | --- | --- | --- | --- | ---------------------------------------------------------- |
| 1   | **Account-lite identity + server streaks** (`UserProfile`, `DailyPlay`, `Streak` tables; nickname upgrades to a stored profile)        | 5   | 3   | 5   | 4   | 3   | 5.7 | Unlocks 04/06/09 entirely; kills localStorage streak wipes |
| 2   | **Daily games expansion** (Emoji Plot, WYR, Timeline, Price, Rhyme, Genre Swap/Bender as dailies, reuse SoloShell + existing datasets) | 5   | 2   | 4   | 5   | 4   | 9.0 | 6 more reasons to return; near-zero new engine work        |
| 3   | **Daily landing pages** (`/daily/[slug]` with today's preview + streak stats + JSON-LD)                                                | 4   | 2   | 4   | 3   | 3   | 7.0 | Turns dailies into an SEO + habit surface (08 §3)          |
| 4   | **Share cards v2** (per-daily share images via existing canvas pipeline; streak + PB baked in)                                         | 4   | 2   | 3   | 2   | 5   | 7.0 | The Wordle loop, cheapest virality in the roadmap          |
| 5   | **UX polish batch** (empty states, loading skeletons, confetti on PBs, sound off-by-default, focus states)                             | 4   | 2   | 2   | 3   | 2   | 5.5 | Perceptible quality jump with zero risk (05)               |
| 6   | **Route-integrity CI test** (titles=H1, counts match data, no orphans, canonicals)                                                     | 3   | 1   | 3   | 0   | 0   | 6.0 | The SEO quality gate everything later depends on (08 §1)   |
| 7   | **Leaderboard hardening** (server-side dailies already exist, add lifetime + personal-best rows)                                       | 3   | 2   | 3   | 3   | 1   | 5.0 | Self-competition floor (09 §2.9)                           |

**V1.5 exit criteria:** a guest can become a member in 30 seconds; their streaks
survive browser clears; 8 daily games ship with share cards; CI enforces page
integrity. **This horizon is the foundation for everything below, do not skip
item 1.**

---

## Horizon 2, V2.0: The retention machine (1-3 months)

| #   | Feature                                                                                                       | Imp | Eff | Biz | Rep | Vir | ROI | Depends on |
| --- | ------------------------------------------------------------------------------------------------------------- | --- | --- | --- | --- | --- | --- | ---------- |
| 8   | **Progression system** (XP, levels `floor(sqrt(xp/100))`, 48 achievements, titles, collections, play history) | 5   | 3   | 4   | 5   | 2   | 5.3 | #1         |
| 9   | **Friends + friend battles + recently played** (06 §1-3)                                                      | 5   | 3   | 4   | 5   | 4   | 6.0 | #1         |
| 10  | **All 12 daily games + streak-freeze + personal bests** (03)                                                  | 5   | 3   | 4   | 5   | 4   | 6.0 | #2         |
| 11  | **Content engine v1** (AI-assisted generation, gates, provenance, dedup, community submissions; 07)           | 5   | 4   | 5   | 5   | 2   | 4.3 | ,          |
| 12  | **Weekly challenges + community challenge** (09 §2.3)                                                         | 4   | 2   | 3   | 4   | 2   | 6.5 | #1, #10    |
| 13  | **Seasonal events** (4/year; theme, badges, daily variants, holiday pages; 09 §2.5 + 08 §2.4)                 | 4   | 2   | 4   | 4   | 3   | 7.5 | #10, #11   |
| 14  | **Spectator mode + Live now rail** (06 §4)                                                                    | 4   | 3   | 3   | 3   | 5   | 5.0 | #9         |
| 15  | **Teacher hub + classroom modes** (no-account join, safety tiers, printable packs; 08 §2.5)                   | 4   | 3   | 5   | 3   | 3   | 5.0 | #1         |
| 16  | **Host workspace / template library** (save room settings + custom word packs, relaunch in one tap; 06 §8)    | 4   | 2   | 4   | 3   | 2   | 6.5 | #1         |
| 17  | **Surprise events + in-app notification center** (09 §2.10-2.11)                                              | 3   | 2   | 2   | 3   | 3   | 5.5 | #1         |
| 18  | **SEO category/difficulty/occasion pages** (08 §2.2-2.4)                                                      | 3   | 2   | 4   | 1   | 1   | 4.5 | #6         |

**V2.0 exit criteria:** 12 dailies, server streaks with freeze, friends + battles,
XP/badges/titles, seasonal events, moderated content engine producing gated
content, teacher surface. **This is the "why come back tomorrow" horizon, the
core of the entire strategy.** Order within the horizon: 12 → 9 → 8 → 10 → 13/16
(the habit loop first, then the social layer on top of it).

---

## Horizon 3, V3.0: The platform (6-12 months)

| #   | Feature                                                                                                                              | Imp | Eff | Biz | Rep | Vir | ROI | Depends on |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | --- | --- | --- | --- | --- | --- | ---------- |
| 19  | **Monthly tournaments** (4 weekly legs + final; titles as prizes; 06 §5)                                                             | 4   | 3   | 4   | 5   | 3   | 5.3 | #9         |
| 20  | **Party playlists** (one room, continuous game sequence, cumulative score; 06 §6)                                                    | 5   | 3   | 4   | 5   | 3   | 5.7 | #16        |
| 21  | **PWA + push notifications** (daily reminder, streak-at-risk, battle challenges; 09 §2.11)                                           | 4   | 3   | 3   | 4   | 2   | 4.3 | #1         |
| 22  | **AI-generated game modes** (games that author themselves per room from the engine; 07)                                              | 5   | 4   | 5   | 5   | 4   | 4.8 | #11        |
| 23  | **Async play** (battles, async rooms, "beat your friend's score" without same-time play)                                             | 4   | 3   | 4   | 4   | 3   | 5.0 | #9         |
| 24  | **Team workspaces + monetization** (workspace templates, branding, SSO, analytics, exports, the CrowdParty paid tier, done properly) | 3   | 4   | 5   | 3   | 1   | 3.0 | #16        |
| 25  | **Regional realtime scale-out** (Redis adapter for Socket.io; regional gateways, D017 backlog)                                       | 2   | 4   | 3   | 2   | 0   | 1.8 | ,          |
| 26  | **Community content marketplace** (player-authored questions/packs with credited badges; 07 §4.9)                                    | 4   | 3   | 4   | 4   | 3   | 5.0 | #11        |
| 27  | **Creator/streamer tools** (predict-the-chat, spectator integration, branded rooms)                                                  | 3   | 3   | 4   | 3   | 5   | 5.0 | #14        |

**V3.0 exit criteria:** tournaments, playlists, PWA, AI-generated rooms, async
play, paid workspaces. **Scale-out (#25) is scheduled last on purpose**, it
solves a problem we should not have until daily active users demand it; the
single-node room engine is not today's bottleneck.

---

## The ranked shortlist (highest ROI first, across all horizons)

1. **Daily games expansion** (9.0), days of work, a 6× jump in daily reasons.
2. **Seasonal events** (7.5), cheap, fresh, and feeds SEO.
3. **Daily landing pages + share cards** (7.0), habit + virality + SEO in one.
4. **Weekly/community challenges** (6.5) + **host template library** (6.5).
5. **Route-integrity CI** (6.0), the quality gate.
6. **Friends + battles** (6.0) and **12 dailies + freeze + PBs** (6.0), the V2.0 spine.
7. **Account-lite identity** (5.7), the unlock; **party playlists** (5.7).
8. Everything else follows the table above.

## Sequencing logic (why this order)

1. **Identity before social:** friends without profiles are nicknames; streaks
   without server truth are decorations. #1 is the keystone.
2. **Ritual before content:** 12 dailies create the demand that the content
   engine must feed. Building the engine first would stock a store nobody visits.
3. **Social before tournaments:** tournaments need friends/standings; playlists
   need templates.
4. **Reliability always:** the scale-out item sits last, but the _discipline_
   (server-authoritative rooms, tested sockets) is in every horizon, it is the
   competitive moat from 10 §5.3 and must never regress.

## What this means for the codebase (closing the loop)

- **V1.5 touches:** `schema.prisma` (+3 tables), daily seeding utilities (extend
  the FNV-1a pattern to new dailies), SoloShell reuse, share-canvas, one CI test
  file. The 19-game catalog and room engine are untouched.
- **V2.0 touches:** new tables for XP/achievements/friends/notifications;
  content engine as a service + `ContentItem` table with bundled-JSON baseline
  (07 §3); new pages under `/daily/`, `/category/`, `/audience/`, `/teachers/`.
- **V3.0 touches:** tournaments as meta-tables over the existing room engine
  (06 §5, deliberately no new realtime engine), PWA shell, Redis adapter.
- **Never touched:** the PRD §13 licensing rails, the static-MPA architecture,
  the no-account player promise. Those are identity, not constraints.

---

## Final word

The brief asked: _"Why would someone come back tomorrow?"_ The answer this
roadmap builds is: **because the site knows you, owes you a streak, has a new
daily game, a friend to beat, a challenge to claim, a tournament to win, and a
seasonal badge to earn, all in five minutes, on any device, with no account for
your friends.** Every feature in 01-10 exists to serve that sentence; this
roadmap is the order in which they get built. Nothing about the current codebase
stops us; everything about it (server-authoritative rooms, deterministic dailies,
licensed content, static SEO) is the foundation the strategy stands on.
