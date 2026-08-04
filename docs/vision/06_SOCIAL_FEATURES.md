# Social Features, From Rooms to Relationships

**Task 6 of the Vision 2.0 brief.** Rooms are one-night stands today. This layer turns
TriviaHub into a place where groups have _history_.

---

## 1. Identity & friends

- **Member profiles** (see 01/04): nickname, avatar, title, badges, stats, play
  history (private by default).
- **Friends:** add by nickname code (unique per member, e.g. `ADITI42`), invite link,
  or "recently played with" suggestion. Friend requests are two-way.
- **Following (public):** one-way follow for streamers/teachers, their public activity
  (hosted rooms, daily plays) appears in your feed without needing friendship.
- **Recently played with:** after any room, the lobby offers "add these players".
  the natural conversion moment.

## 2. Friend surfaces

- **Friend feed:** "Aditi beat your Daily Trivia score by 20", "Priyansh won 2 rooms
  tonight", "Your friends played 14 games today."
- **Friend leaderboards:** per game, daily and all-time, with the "challenge" affordance.
- **Battle a friend (async):** pick a game + your best score; friend gets a
  notification ("beat 1,240"); the exchange is visible in the feed. The Wordle
  "I beat you" loop, generalized.

## 3. Recently played & invite history

- **Recently played** (member): last 20 rooms + last 20 daily games, one-tap replay
  (same settings, fresh content).
- **Invite history:** who you invited, who joined, who never did (the "nudge" list).
  host-facing, privacy-respecting.

## 4. Shared rooms & spectator mode

- **Spectator mode:** rooms can be opened to spectators (link-only, no chat unless
  enabled). Spectators see the presenter view with a "this is a spectator" badge.
  Streamers get this free; it also powers the Turing Test / Predict the Chat games.
- **Room types:** private (code only), friends (+friends can join from lobby),
  public (discoverable in "Live now" rail, the livestream-era hook).
- **Live now rail:** public rooms listed with game, player count, host title. This is
  the discovery surface that turns the site into a place to _watch_, and watching
  converts to playing.

## 5. Tournaments

- **Format:** bracket or cumulative-score tournaments over N rooms (host schedules
  rounds; standings accumulate between rooms, a "league" primitive).
- **Types:** friends tournament (invite-only), open tournament (public, daily/weekly),
  streamer tournament (spectator + Predict the Chat integration).
- **Season structure:** monthly tournament = 4 weekly legs + final. Prizes are
  **titles + badges** (no payments), status is the prize.
- **Server design:** tournament = a schedule of rooms + a standings table; each room
  reuses the normal room engine and reports results. No new realtime engine, the
  tournament is _meta_, not a game.

## 6. Party playlists & custom collections

- **Party playlist:** a sequence of games ("warm-up → drawing → voting → finale")
  that runs as one continuous room session, the host clicks "next" and the room
  switches games. This is a _room-level_ feature: same players, cumulative score
  (optional), one share link.
- **Custom collections:** members save favorite games into named collections
  ("work safe", "family night", "spicy NHIE") and share them as links.

## 7. Community challenges

- Weekly community challenge: a global goal ("the world plays 1M trivia questions
  this week") with a progress bar and a participation badge. Cheaper than tournaments,
  still gives the "we're all in this together" feeling.

## 8. Host tools

- Host dashboard per room: player list with connection state, mute/remove, pause,
  skip round, extend timer, report player.
- **Moderation:** word filters (configurable per room), profanity replacement, report
  flow with a queue (V2.0 admin surface), host "safety mode" (blurs/removes
  player-submitted text until approved, needed for NHIE super-dirty rooms and
  classrooms).
- **Template library (member hosts):** save room settings + custom word packs; relaunch
  in one tap ("repeat ritual", the CrowdParty workspace gap we exploit).

## 9. Data model (additive)

```text
Member (UserProfile from 03)
Friend  (requesterId, targetId, status: pending|accepted, @@unique pair)
Follow  (followerId, targetId)
PlayHistory (userId, gameId, roomId?, playedAt, result)   , capped feed
Tournament (id, name, kind: friends|open|streamer, schedule Json, standings Json)
TournamentEntry (tournamentId, userId, score, playedRooms)
PartyPlaylist (id, ownerId, name, gameSlugs[], isPublic)
RoomInvite (id, roomCode, invitedBy, invitedCode?, status, createdAt)
```

## 10. Why this beats the competition

- **CrowdParty:** no friends, no history, no spectating. **Jackbox:** couch-only.
  **Kahoot/Quizizz:** classroom-shaped social. **Sporcle:** no realtime rooms at all.
- TriviaHub's combo, **friends + async battles + spectating + tournaments + host
  templates**, is the only social layer in the category that works for both the couch
  and the remote group.
