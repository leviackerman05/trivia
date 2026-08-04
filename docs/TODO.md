# TriviaHub, Roadmap (TODO)

> One backlog, one definition of done. Phases ship user value with exit
> criteria; cross-cutting standards (SEO, a11y, docs, design system) are
> standing requirements enforced by CI, not phases. Revised sequencing
> adopted 2026-08-04 per CTO review (D051): the earlier pasted phase list
> duplicated workstreams and ignored existing systems (the game engine and
> multiplayer platform already ship). The vision docs (12_FINAL_PLAN) remain
> the strategy; this file is the plan.

---

## Phase A, Daily expansion ✅ (2026-08-04)

Goal: eight live daily games, zero new engines. Success metric: % of DAU
playing a daily.

- [x] Daily mode for six existing solo engines (Emoji Plot, Timeline Tussle,
      Price Is Right, Rhyme or Crime, Genre Swap, Genre-Bender): islands take
      a `dailyDateKey` prop and select content with `dailyGameSeed`
      (deterministic per UTC date + game, D050)
- [x] Registry + server `LIVE_DAILY_GAMES` extended to 8; lockstep test;
      `/api/daily/:gameId/submit` accepts the new games (streaks, history,
      personal bests all work for members)
- [x] `/daily/[slug]` pages render the new games in daily mode; hub and
      homepage strips updated; sitemap + smoke checks extended
- [x] Deterministic seeding unit tests (same day stable, days differ)
- [x] `pnpm verify` green (144 client + 154 server tests)

**Exit criteria:** 8 dailies live, same content for everyone per UTC day,
members' runs recorded, homepage under the 100 KB budget.

---

## Phase B, Retention loop (2-3 weeks)

Goal: identity accumulates value. Success metrics: D7 retention, streak
survival.

- [ ] XP + levels on top of `UserProfile` (vision 04 economy, level curve)
- [ ] Personal best celebrations on results screens
- [ ] First event: weekly challenge (single-goal event, vision 09)
- [ ] Share card polish for the daily games (streak + percentile baked in)

**Depends on:** Phase 1.5 identity. **Unlocks:** the "come back tomorrow" layer.

---

## Phase C, Social (3-4 weeks)

Goal: the virality loop. Success metrics: shares per session, friend adds.

- [ ] Friends, friend battles, activity feed (vision 06)
- [ ] Spectator mode + public rooms (Live now rail)
- [ ] Friend leaderboard scope for daily games (D049 deferred item)

**Depends on:** identity + streaks.

---

## Phase D, Content engine v1 (3-4 weeks)

Goal: the catalog stops dying of consumption. Success metrics: new content
per week, report rate.

- [ ] Pipelines for trivia, emoji plots, WYR, NHIE, MLT (vision 07)
- [ ] Dedup, difficulty calibration, licensing gates, provenance
- [ ] Admin review queue

**Depends on:** Phase A (demand).

---

## Phase E, Game engine contract (ongoing, incremental)

Goal: every future game is a thin config. Done as a standard, not a phase:
formalize `GameDefinition` (rules, prompts, scoring, UI) and retrofit games
as they are touched. The RoomEngine, SoloShell, and voting engines already
ship; this formalizes the shared boundary (vision 12 §2).

---

## Phase F, Launch (in progress, M11)

Goal: real users. The highest-value item on the board.

- [x] Deploy artifacts: `server/Dockerfile` (multi-stage, non-root,
      healthchecked), `wrangler.toml` + wrangler devDependency,
      `docs/DEPLOYMENT.md` runbook (D052)
- [x] Host decision: Cloudflare Pages + Railway (D052); Render fallback
- [ ] Cloudflare Pages project + custom domain (owner account action)
- [ ] Railway service + Postgres + env vars (owner account action)
- [ ] Production DB migrated + seeded
- [ ] Live smoke + Search Console submission
- [ ] AdSense application + GA4 real ID
- [ ] Production review checklist (vision 12 Phase 7)

---

## Backlog (from the approved vision, picked per Phase B-D needs)

- Games wave A/B: Flag Rush, Anagram Rush, Simon Sequence, Memory Market,
  Numberline, Mastermind, Word Ops, Two Truths, Bracketology
- Dailies to 11: Guess Who, Geography (World Peek), Movie
- Events engine: seasonal events, tournaments, community challenges
- Progression UI: titles, badges, collections
- PWA + push, party playlists, AI-native games (vision 12 V3.0)
