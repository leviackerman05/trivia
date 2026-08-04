# New Games, 32 Concepts Beyond the PRD

**Task 2 of the Vision 2.0 brief.** Not minor variations, genuinely new mechanics.
Each entry: format · players · gameplay · rules · scoring · replayability ·
implementation difficulty · reusable systems. Difficulty: S (<1 wk), M (1-2 wks),
L (2-4 wks), XL (4+ wks).

Legend for reusable systems: **RT** = existing room timer/reveal/score runtime ·
**VOTE** = voting engine · **DRAW** = canvas/round engine · **SOLO** = SoloShell/daily
engine · **AI** = content pipeline (07) · **MEDIA** = CC media pipeline · **MAP** =
map widget · **AUDIO** = WebAudio synth (licensing-safe).

---

## A. Deduction & bluffing

### 1. The Chameleon

- **Format:** social deduction · 3-8 · 15 min · **Difficulty: M** · Systems: RT, AI
- **Gameplay:** everyone sees a secret category word (e.g., "pizza toppings"); one player
  (the chameleon) sees only the category. Each player says a word related to the secret.
  The chameleon tries to blend; the group votes who the chameleon is.
- **Rules:** one word per player per round, no repeats of previous words. If the group
  votes correctly, players who voted right score; if the chameleon survives the vote,
  they score. The chameleon can attempt a guess of the word to steal extra points.
- **Scoring:** voters +10 if chameleon caught; chameleon +50 if not caught, +25 bonus if
  they guess the word. 8 rounds, rotating chameleon.
- **Replayability:** infinite via the AI word pipeline; the social tension is the hook.
- **Why unique:** pure lying-in-plain-sight deduction, no components, browser-native.

### 2. Fake News

- **Format:** bluffing trivia · 3-10 · 20 min · **Difficulty: M** · Systems: RT, VOTE, AI
- **Gameplay:** three headlines are real, one is AI-fabricated. Players vote which is
  fake, then the fabricator reveals and explains their lie.
- **Rules:** 10 rounds; per-round reader rotates. Fabricated headline must be plausible.
- **Scoring:** voters +20 if they spot the fake; fabricator +40 per player fooled.
- **Replayability:** the AI pipeline generates infinite headline sets (news-adjacent,
  clearly marked "funny fake", no real current events to avoid misinformation risk).
- **Why unique:** fact-checking as a party game, trivia's brain with bluffing's soul.

### 3. Imposter Trivia

- **Format:** hidden-role quiz · 4-10 · 20 min · **Difficulty: M** · Systems: RT, AI
- **Gameplay:** everyone gets the same question, except the imposter, who gets a
  _different_ (but same-shaped) question. Everyone answers out loud; the group votes who
  had the different question.
- **Rules:** 8 rounds, secret imposter role rotates. Imposter must answer plausibly to
  blend; correct answers still score normally.
- **Scoring:** correct answer +10; catching the imposter +25 split among correct voters;
  imposter +50 per round survived.
- **Replayability:** "Among Us meets trivia", infinite content, repeatable social loop.

### 4. Fictionary (Balderdash-style)

- **Format:** creative bluffing · 4-10 · 30 min · **Difficulty: M** · Systems: RT, VOTE, AI
- **Gameplay:** a rare word is shown. The reader writes the real definition; everyone
  else writes a fake one. All definitions shuffle; players vote for the real one.
- **Rules:** 8 rounds. Definitions ≤ 140 chars, no copying.
- **Scoring:** +30 if your fake fools someone; +50 if you pick the real definition;
  reader +20 per fooled player.
- **Replayability:** the rare-word dictionary is a dataset (extensible), and AI can
  generate plausible fake definitions, but real ones come from a curated PD dictionary.
- **Why unique:** the most "everyone writes something" game, pure creativity + poker face.

### 5. Liar's Dice

- **Format:** probabilistic bluffing · 3-6 · 20 min · **Difficulty: M** · Systems: RT
- **Gameplay:** each player secretly rolls 5 dice (server-animated). Players bid on the
  total number of a face across all dice ("eight 4s"). The next player raises or calls
  "liar."
- **Rules:** server verifies; called bluff reveals all dice. Classic bidding rules.
- **Scoring:** correct call +50; wrong call −25 to caller, +25 to bluffer. Elimination
  optional (party mode keeps everyone, points-only).
- **Replayability:** pure social probability, no content needed, infinite replay.
- **Why unique:** the only pure dice-bluff in the catalog; works brilliantly on a shared
  screen.

### 6. Codenames-style: Word Ops

- **Format:** clue-giving deduction · 4-10 (2 teams) · 25 min · **Difficulty: L** ·
  Systems: RT, AI
- **Gameplay:** a 5×5 grid of words; each team's spymaster gives one-word clues
  ("fruit: 2") and agents tap the words they believe are theirs. Avoid the assassin word.
- **Rules:** standard Codenames rules; server shuffles teams each game; no proper nouns
  as clues (AI/wordlist validates).
- **Scoring:** first team to reveal all their words wins; hitting the assassin loses
  instantly (or −100 in party mode).
- **Replayability:** the word-grid generator (AI + curated wordlist) makes every board
  fresh; it's a top-5 party game genre we're missing.
- **Why unique:** fills the biggest genre gap in the catalog (team wordplay).

---

## B. Drawing & creativity

### 7. Sketch or Sketchy

- **Format:** drawing + bluffing · 4-10 · 25 min · **Difficulty: L** · Systems: DRAW, RT
- **Gameplay:** one player gets a secret prompt and draws it. Everyone else gets a
  _category_ and draws a decoy of their own invention. The group votes which drawing was
  the real prompt.
- **Rules:** 60s draw; decoys must plausibly match the category; 10 rounds.
- **Scoring:** real artist +30 per voter fooled; decoy artists +20 each; correct voters
  +25.
- **Replayability:** infinite via the prompt pipeline; the bluff layer makes bad artists
  powerful.
- **Why unique:** flips "who drew this well" into "who drew the truth", drawing games
  for people who can't draw.

### 8. Exquisite Corpse

- **Format:** collaborative drawing · 3-8 · 15 min · **Difficulty: M** · Systems: DRAW
- **Gameplay:** a shared canvas; each player adds 10 seconds of strokes, then the canvas
  passes (server-authoritative stroke log, like Skribbl). After 6 passes, the group
  votes on the best name for the monstrosity.
- **Rules:** no erasing others' work; naming round at the end.
- **Scoring:** +10 per round participated; +40 for the name the group picks.
- **Replayability:** every game is a unique artifact, shareable PNG at the end
  (existing share-image system).
- **Why unique:** the only _cooperative_ art game; produces souvenirs.

### 9. Emoji Charades

- **Format:** acting + guessing · 4-10 · 20 min · **Difficulty: M** · Systems: RT, AI
- **Gameplay:** like Charades, but the secret is an emoji sequence (e.g., 🐝📦 →
  "Bee Movie"). Actors can point, mime, and "air-type" but not speak.
- **Rules:** reuse the Charades engine (actor-only secret, team scoring); emoji prompts
  come from a movie/title pipeline.
- **Scoring:** +1 per correct guess in time (team), actor bonus for 5+ word titles.
- **Replayability:** emoji datasets are cheap to generate; the charades engine already
  exists (M9).
- **Why unique:** charades with a twist that plays better on phones (no text needed).

### 10. Caption This

- **Format:** meme/caption contest · 4-12 · 15 min · **Difficulty: M** · Systems: VOTE, MEDIA
- **Gameplay:** a CC-licensed image (or AI-generated scene) is shown; everyone writes a
  caption; the group votes anonymously.
- **Rules:** captions ≤ 100 chars; 6 rounds; images from the MEDIA pipeline (CC/PD or
  AI-generated, moderated).
- **Scoring:** +40 per best-caption vote; +10 participation.
- **Replayability:** infinite images; it's the lowest-effort, highest-laugh game.
- **Why unique:** makes the "meme game" category our own with licensed-safe images.

---

## C. Music & audio (licensing-safe, WebAudio-synthesized)

### 11. Song Interpolation (working title: "Hum It Back")

- **Format:** music guessing · 4-12 · 20 min · **Difficulty: L** · Systems: AUDIO, RT
- **Gameplay:** a melody is synthesized via WebAudio (original arrangement, no
  copyrighted recordings), and players type the song title.
- **Rules:** 10 rounds, 20s each; a "genre + year" clue unlocks at 10s; players may
  retry with penalties.
- **Scoring:** +100 first try, +50 after clue, +20 later; wrong answers −0 but lock for
  5s.
- **Replayability:** melody pipeline (see 07) generates arrangements from a licensed
  song-metadata dataset (title/artist/year are facts, not copyrighted works).
- **Why unique:** solves the music-game licensing trap with synthesis; works with sound
  off via lyric/title anagrams fallback mode.

### 12. Reverse Playlist

- **Format:** music trivia · 3-10 · 15 min · **Difficulty: M** · Systems: RT, AI
- **Gameplay:** a sequence of 3 song titles is shown; players pick which artist appears
  twice, or which song is from the wrong decade.
- **Rules:** pattern questions generated from the song-metadata dataset.
- **Scoring:** +10 per correct + speed bonus; 12 rounds.
- **Replayability:** the metadata dataset yields combinatorially many patterns.

---

## D. Geography

### 13. World Peek

- **Format:** GeoGuessr-style · 2-12 · 20 min · **Difficulty: L** · Systems: MEDIA, MAP
- **Gameplay:** a CC photo (or AI scene) is shown; players drop a pin on a map. Closer
  = more points.
- **Rules:** 5 rounds; scoring = max(0, 5000 × (1 − distance/maxDistance)); reveal shows
  the location + a fun fact.
- **Scoring:** distance-based, as above; daily mode reuses the same photo for everyone.
- **Replayability:** the MEDIA pipeline curates location photos (Commons/Openverse
  geotagged); every game is a new place.
- **Why unique:** the geography genre we're missing entirely; also becomes a daily game.

### 14. Border Blitz

- **Format:** geography rapid-fire · 2-10 · 15 min · **Difficulty: M** · Systems: RT, MAP
- **Gameplay:** a country is shown; players list its land neighbors. Correct neighbors
  score; wrong guesses lock you out for that country.
- **Rules:** 10 countries, 30s each, typing with autocomplete of country names.
- **Scoring:** +20 per correct neighbor; +30 bonus for all neighbors of a small country.
- **Replayability:** deterministic dataset (country borders are facts), infinite rounds.

### 15. Flag Rush

- **Format:** flag recognition · 2-12 · 15 min · **Difficulty: S** · Systems: RT
- **Gameplay:** a flag image is shown; players pick the country from 4 (or type it).
- **Rules:** 15 flags, 10s each; difficulty tiers (popular → obscure flags).
- **Scoring:** +10 each, +5 speed bonus under 3s; streak multiplier ×2 at 5.
- **Replayability:** 200+ flags; difficulty tiers scale for classrooms.

---

## E. Word & puzzle

### 16. Anagram Rush

- **Format:** word puzzle · 1-12 · 15 min · **Difficulty: S** · Systems: SOLO/RT
- **Gameplay:** an anagram of a common word is shown; players unscramble it by typing.
- **Rules:** 12 rounds, 15s each; hints (first letter) cost points.
- **Scoring:** +10 base, +5 speed under 5s, −3 per hint.
- **Replayability:** the wordlist is huge and difficulty-tiered.

### 17. Mind Meld

- **Format:** improv word game · 3-10 · 15 min · **Difficulty: S** · Systems: RT
- **Gameplay:** two players count "3-2-1" and each say a word. The group must find a
  word that connects both ("dog" + "space" → "laika" or "moon"). Repeat until match or
  timeout.
- **Rules:** 8 rounds; any player can call a match and the group votes if it's valid.
- **Scoring:** the melding pair +30; first valid match caller +20.
- **Replayability:** zero content, pure improv energy, infinite.
- **Why unique:** the fastest, most laugh-dense word game; a classic that's never been
  done well in browser.

### 18. Letter Ladder (Scattergories-style)

- **Format:** category word game · 2-12 · 20 min · **Difficulty: M** · Systems: RT, AI
- **Gameplay:** a letter + category ("B + fruit"). Players type answers; unique answers
  score, duplicates score nothing.
- **Rules:** 8 rounds, 60s each; the server dedupes and validates category fit via the
  word pipeline.
- **Scoring:** +25 per unique valid answer; +50 for a "double letter" round.
- **Replayability:** category pipeline makes it infinite; classic paper game digitized
  with server-side dedup (kills the cheating problem).

### 19. Bomb Squad (pass-the-bomb)

- **Format:** hot-potato word game · 3-10 · 15 min · **Difficulty: M** · Systems: RT
- **Gameplay:** a category is shown; players take turns saying a valid word before the
  fuse runs out (random 5-15s), then pass the bomb.
- **Rules:** repeats and invalid words explode; explosion = −20 and skip.
- **Scoring:** +10 per safe pass; survive-all bonus +50.
- **Replayability:** high tension, zero content (category list exists).

### 20. Mastermind

- **Format:** code-breaking · 2-8 · 15 min · **Difficulty: M** · Systems: RT
- **Gameplay:** one player (or the server, in solo/duel mode) sets a 4-color code;
  others guess and get peg feedback (correct position / correct color).
- **Rules:** 8 guesses max; the code-setter can be a player (with a "you can't tell"
  constraint) or the server for async play.
- **Scoring:** solver +50 per code cracked; setter +20 per failed guess; fastest crack
  bonus.
- **Replayability:** combinatorial; duel mode (two solvers race) is the party version.

### 21. Simon Sequence

- **Format:** memory pattern · 1-12 · 10 min · **Difficulty: S** · Systems: SOLO/RT
- **Gameplay:** a pattern of tones/colors plays; players repeat it, one element longer
  each round. Elimination-style or score-based.
- **Rules:** 3 strikes and out (party) or score-only (classroom mode).
- **Scoring:** +10 per element repeated correctly; perfect-run bonus ×2.
- **Replayability:** pure skill ceiling; also a daily game candidate.

---

## F. Social & party

### 22. Two Truths and a Lie

- **Format:** self-disclosure · 4-12 · 25 min · **Difficulty: M** · Systems: RT, VOTE
- **Gameplay:** per round, a player submits two truths + one lie; the group votes the
  lie.
- **Rules:** statements ≤ 140 chars; 1 truth must be verifiable by the group (no "I once
  breathed"); 10 rounds.
- **Scoring:** author +40 per fooled voter; voters +30 if they find the lie.
- **Replayability:** it's the PRD's missing game (#4 in Open Questions), the most
  requested classic we don't have. Moderation: skip/replace + report flows.

### 23. Bracketology

- **Format:** tournament voting · 4-16 · 20 min · **Difficulty: M** · Systems: VOTE
- **Gameplay:** a 16-item bracket ("best snack", "best movie villain"); the group votes
  pairwise; items advance until a champion.
- **Rules:** 15 matchups, 20s votes; host can seed or randomize.
- **Scoring:** pick-the-champion sweepstakes: +100 if your pre-tournament pick wins.
- **Replayability:** bracket datasets (snacks, villains, songs) are cheap; streamers
  love the audience-vote format.
- **Why unique:** the "argument generator", structure for the debates the group already
  wants to have.

### 24. Deadline (trivia with elimination stakes)

- **Format:** survival trivia · 4-12 · 25 min · **Difficulty: M** · Systems: RT, AI
- **Gameplay:** classic trivia, but the slowest correct answer each round is "voted off"
  (party) or loses a life (classroom mode).
- **Rules:** 10 rounds; lives: 3 in classroom mode, elimination in party mode.
- **Scoring:** +10 per correct; final survivor ×2 multiplier.
- **Replayability:** trivia content pipeline + the elimination tension.

### 25. Story Forge

- **Format:** collaborative storytelling · 3-10 · 20 min · **Difficulty: M** · Systems: RT
- **Gameplay:** a first sentence is shown; each player adds one sentence in turn; after
  8 turns, the group votes the best sentence and the best overall story.
- **Rules:** sentences ≤ 160 chars; no killing characters without a vote; 3 stories.
- **Scoring:** +20 per "best sentence" vote; +40 for the winning story's top contributor.
- **Replayability:** every story is unique; shareable text card at the end.

### 26. Icebreaker Rooms (conversation mode)

- **Format:** low-game social · 3-30 · 15 min · **Difficulty: S** · Systems: RT, AI
- **Gameplay:** not a scored game, a room with curated question decks (first day at
  work, first date, reunion), a timer per question, and optional anonymous "everyone
  answers" reveal.
- **Rules:** host picks a deck; each question shows for 90s; optional voting on the best
  answer.
- **Scoring:** none by default (classroom/team-building mode), this is the
  "no-score" first-class variant the research demanded.
- **Replayability:** the question pipeline (07) makes decks infinite; it's the
  onboarding game for new teams.

### 27. Auction House

- **Format:** bidding bluff · 3-8 · 25 min · **Difficulty: L** · Systems: RT
- **Gameplay:** mystery items are auctioned one by one; each player has a secret budget
  and a secret valuation; players bid, then the item's true value is revealed.
- **Rules:** 8 items; overpaying is the sin (score = value − price paid, or zero if
  outbid); bluff bids are allowed.
- **Scoring:** highest total portfolio wins; double-points item as a comeback mechanic.
- **Replayability:** economic bluffing, no content needed; the math creates drama.
- **Why unique:** the only economy game in the catalog; teaches bidding in 25 minutes.

---

## G. Streamer & AI-native

### 28. Turing Test

- **Format:** AI-vs-human · 4-12 · 20 min · **Difficulty: L** · Systems: AI, RT
- **Gameplay:** one player is secretly a bot (server-driven, using a canned answer
  model). Everyone answers the same prompt ("what's your spirit animal and why"); the
  group votes who the bot is.
- **Rules:** 6 rounds, 3 bots total; bot answers come from the content engine with a
  "plausible human" style.
- **Scoring:** +40 for spotting the bot; bot-in-disguise +50 if it survives.
- **Replayability:** infinite prompts; the meta-game ("can you tell?") is the draw.
- **Why unique:** the only game where the server plays; streamer chat can vote via the
  same interface.

### 29. Predict the Chat (streamer mode)

- **Format:** audience prediction · 1 host + unlimited · 20 min · **Difficulty: L** ·
  Systems: RT, VOTE
- **Gameplay:** the streamer answers a question; viewers predict the answer via the room
  link; closest prediction wins.
- **Rules:** 10 questions; host-only answers; viewers get one locked prediction each.
- **Scoring:** viewer +50 for exact, +20 within one; leaderboard resets weekly.
- **Replayability:** streamer-specific retention (weekly leaderboard), a wedge into the
  creator market.

---

## H. Classroom & family

### 30. Memory Market (family)

- **Format:** memory + prices · 2-10 · 15 min · **Difficulty: S** · Systems: SOLO
- **Gameplay:** a grid of product cards flips briefly; players remember prices and pick
  the cheapest/most expensive.
- **Rules:** 8 rounds; grid size scales with age.
- **Scoring:** +20 correct, +50 for the exact price (reuses price-product dataset).
- **Replayability:** the 536-product dataset is ready today.

### 31. Numberline (family/classroom)

- **Format:** estimation · 2-12 · 10 min · **Difficulty: S** · Systems: RT
- **Gameplay:** "Where does 1970 fall between 1900 and 2000?", players drag a marker;
  distance scores points. Variants: lengths, weights, populations.
- **Rules:** 10 rounds; 30s each; closest wins the round.
- **Scoring:** 100 − distance×2; exact = 200 (reuses price-engine scoring).
- **Replayability:** the estimation dataset is cheap; great for classrooms (math
  intuition without worksheets).

### 32. Quiz Show (classroom mode)

- **Format:** structured team quiz · 2-6 teams · 30 min · **Difficulty: M** ·
  Systems: RT, AI
- **Gameplay:** teams answer rounds (multiple choice, buzzer, picture, lightning);
  teacher/host controls pacing, difficulty, and reveals.
- **Rules:** 4 round types; team captain submits; wrong answers can be stolen by the
  next team.
- **Scoring:** per-round rules; no-score mode for younger classrooms.
- **Replayability:** the content pipeline + "build a quiz from a chapter topic" flow
  (teacher's core ask).

---

## Summary table

| #   | Game               | Genre            | Difficulty | Reuses       | Daily candidate |
| --- | ------------------ | ---------------- | ---------- | ------------ | --------------- |
| 1   | The Chameleon      | Deduction        | M          | RT, AI       | ,               |
| 2   | Fake News          | Bluffing/trivia  | M          | RT, VOTE, AI | ,               |
| 3   | Imposter Trivia    | Hidden role      | M          | RT, AI       | ,               |
| 4   | Fictionary         | Creative bluff   | M          | RT, VOTE, AI | ,               |
| 5   | Liar's Dice        | Dice bluff       | M          | RT           | ,               |
| 6   | Word Ops           | Team deduction   | L          | RT, AI       | ,               |
| 7   | Sketch or Sketchy  | Drawing bluff    | L          | DRAW, RT     | ,               |
| 8   | Exquisite Corpse   | Co-op drawing    | M          | DRAW         | ,               |
| 9   | Emoji Charades     | Acting           | M          | RT, AI       | ,               |
| 10  | Caption This       | Caption contest  | M          | VOTE, MEDIA  | ,               |
| 11  | Hum It Back        | Music            | L          | AUDIO, RT    | ✅              |
| 12  | Reverse Playlist   | Music trivia     | M          | RT, AI       | ✅              |
| 13  | World Peek         | Geography        | L          | MEDIA, MAP   | ✅              |
| 14  | Border Blitz       | Geography        | M          | RT, MAP      | ✅              |
| 15  | Flag Rush          | Geography        | S          | RT           | ✅              |
| 16  | Anagram Rush       | Word puzzle      | S          | SOLO/RT      | ✅              |
| 17  | Mind Meld          | Improv words     | S          | RT           | ,               |
| 18  | Letter Ladder      | Category words   | M          | RT, AI       | ✅              |
| 19  | Bomb Squad         | Hot potato       | M          | RT           | ,               |
| 20  | Mastermind         | Code-breaking    | M          | RT           | ✅              |
| 21  | Simon Sequence     | Memory           | S          | SOLO/RT      | ✅              |
| 22  | Two Truths & a Lie | Self-disclosure  | M          | RT, VOTE     | ,               |
| 23  | Bracketology       | Tournament votes | M          | VOTE         | ,               |
| 24  | Deadline           | Survival trivia  | M          | RT, AI       | ,               |
| 25  | Story Forge        | Storytelling     | M          | RT           | ,               |
| 26  | Icebreaker Rooms   | Social           | S          | RT, AI       | ,               |
| 27  | Auction House      | Economy bluff    | L          | RT           | ,               |
| 28  | Turing Test        | AI-native        | L          | AI, RT       | ,               |
| 29  | Predict the Chat   | Streamer         | L          | RT, VOTE     | ,               |
| 30  | Memory Market      | Family           | S          | SOLO         | ✅              |
| 31  | Numberline         | Family/classroom | S          | RT           | ✅              |
| 32  | Quiz Show          | Classroom        | M          | RT, AI       | ,               |

**Build priority (see 11 Roadmap):** S-difficulty games first (Flag Rush, Anagram Rush,
Mind Meld, Simon Sequence, Memory Market, Numberline), they ride existing engines and
become daily games immediately. Then the two genre-gap fills (Word Ops, World Peek),
then the social hooks (Two Truths, Bracketology, Chameleon).
