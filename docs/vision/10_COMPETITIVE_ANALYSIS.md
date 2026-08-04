# Competitive Analysis, The Field, and Where We Stand

**Task 10 of the Vision 2.0 brief.** Honest scorekeeping against the seven
competitors in the brief, using the reverse-engineering research (00 §1) as the
evidence base for CrowdParty. No flattering framing: where we lose, we say so,
and the roadmap (11) is ordered to close those gaps first.

---

## 1. The field at a glance

| Competitor            | Core loop                              | Retention architecture            | Social graph           | Content model                    | Live rooms                |
| --------------------- | -------------------------------------- | --------------------------------- | ---------------------- | -------------------------------- | ------------------------- |
| **CrowdParty**        | Host picks themed room → PIN/QR → play | None (event-driven)               | None                   | 219 themes + AI gen, unmoderated | Yes, fragile              |
| **Sporcle**           | Quiz plays + daily games               | Daily games, streaks              | Weak (no friends loop) | 100k+ user quizzes               | No                        |
| **Jackbox**           | Host buys pack → couch play on TV      | None (session)                    | None                   | Hand-authored packs, paid        | Couch/stream only         |
| **Kahoot**            | Teacher-hosted live quizzes            | Class sessions                    | Teacher-student only   | User-made quizzes                | Yes                       |
| **GeoGuessr**         | Solo/duel geography                    | Daily challenge, streaks, leagues | Duels + friends        | 200k+ maps, UGC                  | Duels                     |
| **Quizizz**           | Teacher-hosted live + homework quizzes | Homework/assignments              | Teacher-student        | User-made quizzes                | Yes                       |
| **Gartic Phone**      | Draw → pass → guess chain              | None (session)                    | Friend invites         | UGC drawings                     | Yes                       |
| **TriviaHub (today)** | Host/solo 19 games + 2 dailies         | 2 dailies, localStorage streaks   | None yet               | Hand-curated, licensed           | Yes, server-authoritative |

---

## 2. Where TriviaHub already wins

1. **Reliability posture.** Server-authoritative rooms, tested socket journeys,
   reconnect-aware state (134 server tests). CrowdParty's core loop hung on
   `Loading` in inspection; Kahoot/Quizizz degrade under load; ours is the only
   architecture with a tested recovery story. Reliability is the category's
   biggest unclaimed moat.
2. **Zero-friction entry, no account, without gating features behind login.**
   CrowdParty gates custom rooms behind auth despite promising no-signup.
   TriviaHub runs the whole catalog for guests. This is the same wedge, kept
   honest.
3. **Licensing safety as product quality.** Every dataset is PRD §13-clean:
   paraphrased lyrics, CC-licensed photos with credits, public-domain images.
   Kahoot/Quizizz/Sporcle run on copyrighted-question copyright exposure; our
   catalog is AdSense-safe and legally clean, a real business asset at scale.
4. **Static MPA SEO.** Best crawlability in the category (see 08). Jackbox has no
   SEO; CrowdParty's SPA ships broken previews; Sporcle is the only comparable
   SEO machine and it lacks our live-room surface.
5. **Daily games with real variance.** Daily Sudoku + Trivia today; 12 by V2.0.
   Sporcle and GeoGuessr are the only competitors with a daily beat, and neither
   has a _party_ identity.
6. **Category breadth per dollar.** 19 distinct games (drawing, trivia, voting,
   music, wordplay, solo) with a shared room engine, the "party OS" architecture
   that Jackbox charges per pack for.

## 3. Where TriviaHub loses today (honest list)

| Weakness                    | Who beats us                                                           | Why it hurts                                                                                           |
| --------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **No identity**             | Sporcle, GeoGuessr, Kahoot                                             | No "who am I," no friends, no lifetime stats, the retention layer in 04/06/09 is impossible without it |
| **Content volume**          | Sporcle (100k quizzes), GeoGuessr (200k maps), CrowdParty (219 themes) | Discovery exhausts quickly; dailies would consume the corpus (07 §7)                                   |
| **Brand & network effects** | Jackbox (brand), Kahoot (schools), GeoGuessr (streamers)               | Nobody searches "TriviaHub" yet; every competitor has a tribe                                          |
| **Single-game depth**       | GeoGuessr (duels/leagues), Sporcle (badges per quiz)                   | Power users outgrow breadth without depth                                                              |
| **Creator community**       | Sporcle (user quizzes), Kahoot (quiz marketplace)                      | UGC is our community challenge; without it the catalog is finite                                       |
| **Classroom adoption**      | Kahoot, Quizizz, Blooket                                               | Teachers are the highest-LTV segment in the category and we have no teacher surface yet (08 §2.5)      |
| **Streamer culture**        | Jackbox, GeoGuessr, Gartic                                             | Twitch drives genre virality; no spectator/predict-the-chat features yet (06 §4)                       |

## 4. Missing features vs. the field

| Feature             | Have it              | Competitor benchmark   | TriviaHub plan                       |
| ------------------- | -------------------- | ---------------------- | ------------------------------------ |
| Daily games         | ✅ 2                 | Sporcle, GeoGuessr     | 12 by V2.0 (03)                      |
| Streaks             | ⚠️ localStorage      | Sporcle, GeoGuessr     | Server-side + freeze (09)            |
| Friends/battles     | ❌                   | GeoGuessr duels        | 06, async battles, friend boards     |
| Spectating          | ❌                   | Jackbox streams        | 06, spectator mode + Live now        |
| Tournaments/leagues | ❌                   | GeoGuessr leagues      | 06, monthly tournament               |
| UGC/creator tools   | ❌                   | Sporcle, Kahoot        | 07, community content pipeline       |
| Custom words/packs  | ✅                   | Skribbl                | Deepen into template library (06 §8) |
| Team mode           | ⚠️ rooms only        | Kahoot teams           | First-class team variant per game    |
| Audio/video games   | ⚠️ music games exist | Jackbox                | Music/streamer games in 02           |
| Teacher hub         | ❌                   | Kahoot/Quizizz         | 08 §2.5 + classroom modes            |
| Monetized workspace | ❌                   | Kahoot/Quizizz premium | Host workspace V3.0                  |

## 5. Missing _experiences_ (what nobody in the category offers)

These are the "clearly superior" moves, experiences the field structurally
cannot copy quickly:

1. **The daily ritual layer.** 12 dailies × streaks × PBs × share cards, a
   Wordle-grade habit loop owned by no one in the party category. Sporcle has
   dailies but no social; Wordle has social but one game. TriviaHub = the whole
   loop, party-flavored.
2. **One identity across couch and remote.** Jackbox works on a couch, Kahoot
   in a classroom, CrowdParty in a Zoom, nobody owns _all three rooms_. Friends
   - templates + async battles make TriviaHub the group's _standing_ game night,
     not a one-off.
3. **Server-authoritative reliability as marketing.** "Rooms survive disconnects;
   rejoining is instant" is a claim we can make with tests behind it. Every
   competitor's live room is a fragile black box. Trust is the moat.
4. **Licensed-safe infinite content.** "Infinite, but every item is verified and
   provenance-labeled" (07). Sporcle's UGC is a copyright minefield; CrowdParty's
   AI is visibly unmoderated. Neither can follow us into _safe_ infinity without
   rebuilding.
5. **The party OS, not the game store.** A playlist of games with one room, one
   score, one link (06 §6). CrowdParty's "Party Mix" is mode-rotation; ours is a
   host-authored _evening_ with momentum, where the scoreboard spans the night.
   Jackbox sells packs; we sell _occasions_.

## 6. How we become clearly superior (the short version)

1. **Close the identity gap first** (V1.5): account-lite member profiles + server
   streaks. Without this, nothing else compounds.
2. **Own the daily ritual** (V2.0): 12 dailies + friend battles + share cards.
   the category's only habit loop.
3. **Win the teacher segment** (V2.0): classroom modes + teacher hub, Kahoot's
   turf, taken with a better (privacy-safe, no-account, licensed) product.
4. **Own the streamer surface** (V2.0-V3.0): spectator mode + Predict the Chat.
   Jackbox's growth engine, browser-native.
5. **Never cede the reliability claim.** Every roadmap item must keep rooms
   boringly reliable; that is our differentiator against every live competitor.

## 7. The one-paragraph case

CrowdParty wins the first 30 seconds; Sporcle wins the daily quiz; Jackbox wins
the couch; Kahoot wins the classroom; GeoGuessr wins the stream. **TriviaHub's
target is the intersection none of them hold: the group that wants to play
_tonight_, come back _tomorrow_, and bring their _friends_.** Reliability
(ours, tested), ritual (theirs, missing), and relationships (everyone's, absent)
are the three rails of the strategy, and each roadmap item in 11 exists to lay
one of them deeper.
