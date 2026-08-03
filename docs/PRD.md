You are building a complete, production-ready website called "PartyBrain" — a free online party games hub featuring 18 multiplayer and solo games. The website must be built with Astro.js, use React islands for interactive components, connect to a Node.js + Socket.io backend for real-time games, and be fully optimized for Google SEO and future Google AdSense monetization.

Follow every instruction below precisely. If any detail is unclear, ask before proceeding.

---

## 1. VISION & PURPOSE

PartyBrain is a free website where friends, families, and remote teams can play 18 different party games instantly — no downloads, no accounts required, just share a room link and start playing. It competes with skribbl.io, Jackbox Games, and random browser game hubs, but offers more variety, smoother UX, and better mobile support.

Target audience: US-based users aged 16-35 looking for virtual party games, classroom icebreakers, or streamer audience games.

Monetization: Google AdSense (applied after traffic reaches 10+ daily users). The site must be built with AdSense compliance from day one — proper legal pages, clean content structure, and fast load times.

---

## 2. TECH STACK (DO NOT DEVIATE)

- Frontend Framework: Astro.js (v5+) with static site generation (SSG) for SEO pages and React islands for interactive game components

- Styling: Tailwind CSS v4 (use the tailwind-4-docs skill)

- Design System: Follow Vercel's design aesthetic (clean, minimal, black/white with subtle gradients, rounded cards, sans-serif fonts). Use the @DESIGN.md file and web-design-guidelines skill

- Real-time Communication: Socket.io (client + server)

- Backend: Node.js + Express.js (separate server in /server folder)

- Database: PostgreSQL with Prisma ORM (for scores, room history, daily challenges)

- Hosting: Cloudflare Pages (frontend static export) + Railway/Render (backend server)

- Package Manager: pnpm (preferred) or npm

- Language: TypeScript everywhere (strict mode)

---

## 3. SITE ARCHITECTURE (MPA — Multi-Page Application)

Every game gets its own static route: /game/[game-slug]

Required routes:

- / — Homepage (game grid, hero section, 600-word SEO description)

- /game/skribbl-arena

- /game/rhyme-or-crime

- /game/emoji-plot

- /game/copycat-challenge

- /game/draw-the-lyric

- /game/one-line-one-shape

- /game/timeline-tussle

- /game/price-is-right

- /game/genre-swap

- /game/genre-bender

- /game/shadow-sketch

- /game/charades

- /game/would-you-rather

- /game/most-likely-to

- /game/trivia

- /game/never-have-i-ever

- /game/guess-who

- /privacy-policy

- /terms-and-conditions

- /about-us

- /contact-us

- /faq

- /404 (custom error page)

- /500 (custom error page)

Each game page must have:

- SEO section (static HTML rendered by Astro): page title, meta description, Open Graph tags, 400-600 word game description with rules and tips, game-specific FAQ with JSON-LD structured data

- Interactive section (React island with client:load): the actual playable game

- Internal links to 2-3 related games (e.g., drawing games link to other drawing games)

---

## 4. SHARED COMPONENTS & SYSTEMS (BUILD ONCE, REUSE EVERYWHERE)

You must build these foundational systems first. All games that share a mechanic must reuse the same component, not duplicate code.

### 4.1 Room Engine (powers all 12 multiplayer games)

- Create room with unique 6-character alphanumeric code (e.g., "ABC123")

- Join room via code or shared URL (e.g., partybrain.com/room/ABC123)

- Player management: join, leave, rejoin, host migration

- Generic state machine: lobby → game-setup → in-progress → results → lobby

- Chat system (text input, message list, system notifications like "Alice guessed correctly!")

- Works over Socket.io events

### 4.2 Drawing Canvas Component (powers all 5 drawing games)

- HTML5 Canvas with: pen tool (variable brush sizes), eraser, color picker (12 colors minimum), undo, clear canvas

- Stroke broadcasting via Socket.io (event: 'draw-stroke' with {x, y, prevX, prevY, color, brushSize, tool})

- Canvas replay: when a new player joins mid-round, replay all stored strokes so they see the full drawing

- Mobile touch support: touchstart, touchmove, touchend mapped to mouse events

- Responsive canvas that scales to fit the viewport

### 4.3 Voting/Poll Component (powers 6 voting games)

- Display a question/prompt with 2-6 options

- Players click to vote

- Live percentage bars update in real-time via Socket.io

- Reveal animation when all votes are in or timer expires

- Reusable for: Would You Rather, Most Likely To, This or That, Two Truths & a Lie, Never Have I Ever

### 4.4 Solo Game Template (powers 6 solo games)

- React island that loads game data from static JSON or REST API

- UI pattern: prompt display → user input → score calculation → result display → leaderboard submission → "play again"

- Score submitted to REST endpoint POST /api/scores

- Local streak tracking in localStorage

---

## 5. GAME-BY-GAME SPECIFICATIONS

### 5.1 Skribbl Arena (Real-time | Drawing | Room)

Core Loop: One player draws a randomly assigned word on the shared canvas. Other players type guesses in chat. First correct guesser gets points. Drawer gets points for each correct guess. Round lasts 60 seconds. Game lasts 3 rounds per player. Final scoreboard with podium.

Features:

- Word bank: 500+ words across 5 difficulty levels (easy: "apple", medium: "basketball", hard: "bankruptcy")

- Custom word option: room host can paste a custom word list

- Hints: after 30 seconds, reveal first letter; after 45 seconds, reveal last letter

- Chat with auto-correct guess detection (case-insensitive, trim whitespace)

- Score formula: guesser = 100 - (seconds_elapsed * 2), drawer = sum of all guesser points / 2

- Word selector screen for drawer: shows 3 random words, drawer picks one before drawing starts

UI Screens: Room Lobby → Word Select (drawer only) → Drawing Canvas + Chat → Round Results → Final Podium

### 5.2 Rhyme or Crime (Solo | Word)

Core Loop: Player sees a category and a prompt word. They must type a word that rhymes with the prompt AND fits the category. 60 seconds per round. 5 rounds. Streak-based scoring.

Example: Category = "Fruits", Prompt = "witch" → Correct answer: "peach"

Features:

- Categories: Fruits, Animals, Countries, Professions, Body Parts, Colors, Sports, Foods

- Rhyme validation using CMU Pronouncing Dictionary (static JSON file)

- Category validation using pre-built word lists

- Score: +10 for correct, +5 bonus for speed (under 10 seconds), streak multiplier (x2 after 3 correct, x3 after 5)

- Daily leaderboard

UI: Prompt display → Text input → Timer → Correct/Wrong feedback animation → Next round button → Final score → Share result button (generates image with score)

### 5.3 Emoji Plot (Solo | Pop Culture)

Core Loop: Player sees an emoji sequence representing a movie or book plot. They type their guess. 30 seconds per question. 10 questions per game.

Example: 👦⚡🧙‍♂️🏰 → "Harry Potter"

Example: 🦁👑👦🌍 → "The Lion King"

Features:

- Dataset: 200+ emoji-movie pairs and 100+ emoji-book pairs (stored as static JSON)

- Case-insensitive answer checking with fuzzy matching (accept close answers, ignore "The" prefix)

- Progressive hints: after 15 seconds, show the year; after 25 seconds, show first letter

- Score: +100 for correct with no hint, +50 with year hint, +25 with first letter

- "Create your own" mode: player creates an emoji plot and challenges friends via shareable link

UI: Emoji display (large, centered) → Text input → Timer → Hint buttons → Results summary → Leaderboard

### 5.4 Copycat Challenge (Real-time | Drawing | Room)

Core Loop: A famous painting or photo is shown to all players for 5 seconds. It disappears. All players draw it from memory on their own private canvases (not shared). After 90 seconds, all drawings are revealed in a gallery. Players vote for "Most Recognizable" and "Funniest." No chatting during drawing phase.

Features:

- Image dataset: 50+ famous paintings (Mona Lisa, The Scream, Starry Night) and 50+ iconic photos (public domain only)

- Private canvas per player (drawings not broadcast during drawing phase)

- Voting phase: gallery view with thumbnails, click to enlarge, vote buttons

- Awards: "Most Recognizable," "Funniest," "Most Abstract"

UI: Image reveal (5s countdown) → Private drawing canvas (90s timer) → Gallery view → Voting → Awards ceremony

### 5.5 Draw the Lyric (Real-time | Drawing | Room)

Core Loop: One player is shown a random song lyric. They must draw it on the shared canvas. Others guess the SONG TITLE (not the lyric itself). 90 seconds per round. Correct guesser and drawer both get points.

Features:

- Lyric dataset: 300+ famous lyrics from popular songs across genres (static JSON with lyric text and song title)

- Lyric displayed to drawer only (shown in a banner above the canvas)

- Guessing focuses on song title, but players can type anything

- Hint: after 45 seconds, show the artist name

- Score: guesser gets 100, drawer gets 50 per correct guess

UI: Lyric banner (drawer only) → Shared canvas → Chat/guess input → Timer → Round results

### 5.6 One Line, One Shape (Real-time | Drawing | Room)

Core Loop: One player is given an object to draw (e.g., "bicycle," "elephant," "Eiffel Tower"). They must draw it using ONE continuous line — the pen cannot be lifted (touch end / mouse up). The drawing is shared on canvas. Others guess. 60 seconds.

Features:

- Line detection: track mousedown/mouseup or touchstart/touchend. If the player lifts, show a warning and deduct 10 seconds from timer

- Object dataset: 200+ simple to complex objects

- Scoring: same as Skribbl (guesser gets points based on speed)

UI: Object display (drawer only) → Shared canvas with "CONTINUOUS LINE - DON'T LIFT!" warning → Timer → Chat/guess → Round results

### 5.7 Timeline Tussle (Solo | Trivia)

Core Loop: Three historical events are shown in random order. Player drags them into correct chronological order. 5 rounds. Score based on speed and accuracy.

Example: "Moon Landing (1969)" / "Fall of Berlin Wall (1989)" / "First iPhone (2007)"

Correct order: Moon Landing → Berlin Wall → iPhone

Features:

- Event dataset: 200+ historical events with year (static JSON)

- Drag-and-drop interface (or click-to-select order on mobile)

- Instant feedback: green check for correct, red X for wrong with correct year revealed

- Score: +100 for correct order, +50 if one pair is swapped but others correct, +0 for completely wrong

UI: Three event cards (draggable) → "Submit Order" button → Feedback overlay → Next round → Final score

### 5.8 Price Is Right — E-commerce Edition (Solo | Trivia)

Core Loop: A real product image from Amazon (or generic e-commerce product) is shown with its description. Player guesses the price in USD. Closest guess without going over wins. 5 rounds.

Features:

- Product dataset: 100+ products with image URL, description, actual price (static JSON, manually curated to avoid scraping issues)

- Slider input for price ($1 to $1000) or text input

- After guess: reveal actual price, show how close the player was ($ over/under)

- Score: 100 - (price_difference * 2), minimum 0. Exact guess = 200 points bonus

- Products shown: weird gadgets, luxury items, everyday household goods (wide variety for humor)

UI: Product image → Description → Price guess input → "Submit" → Reveal animation → Score → Next product

### 5.9 Genre Swap (Solo | Word)

Core Loop: A famous movie plot is rewritten in a completely different genre style. Player guesses the original movie. 10 questions.

Example: "A young boy discovers he has magical powers and attends a secret school, but now it's a gritty crime thriller where the headmaster is a corrupt cop." → Harry Potter

Features:

- Dataset: 150+ genre-swapped movie descriptions (pre-written, static JSON)

- Each entry: { original_movie, swapped_genre, description }

- Multiple choice (4 options) or type-in

- Timer: 20 seconds per question

- Score: +10 correct, bonus for speed

UI: Genre-swapped description → 4 option buttons → Timer → Correct/Wrong feedback → Next

### 5.10 Genre‑Bender (Solo | Word)

Core Loop: Lyrics from a famous rap/hip-hop song are rewritten as a Shakespearean sonnet (or other classic literary style). Player guesses the original song and artist. 10 questions.

Example: "Doth thou possess the currency? / I inquire most earnestly / For I dost wish to contact thee / Regarding thy canine, which I doth fancy" → "Who Let the Dogs Out" by Baha Men (or similar absurd pairings)

Features:

- Dataset: 100+ "bended" lyrics (pre-written, static JSON)

- Multiple choice or type-in

- Audio clue (optional): reveal the BPM or year

UI: "Shakespearean" lyric → 4 option buttons → Timer → Feedback

### 5.11 Shadow Sketch (Real-time | Drawing | Room)

Core Loop: One player is shown a silhouette (faint outline) of an object/animal/person on their canvas. They must draw the INTERNAL details to make it recognizable. Other players see ONLY the drawer's additions (no silhouette). Guessers try to identify what it is. 90 seconds.

Features:

- Silhouette dataset: 100+ SVG silhouettes (simple outlines: cat, car, Christmas tree, Statue of Liberty)

- Drawer's canvas: silhouette displayed as a faint gray background layer

- Guessers' canvas: only the drawer's strokes visible (silhouette hidden)

- Hint: after 60 seconds, reveal the silhouette to guessers

- Scoring: same as Skribbl

UI: Drawer sees "Draw inside the shadow!" + canvas with silhouette → Guessers see blank canvas filling with strokes → Chat/guess → Reveal at end

### 5.12 Charades (Real-time | Acting | Room)

Core Loop: One player is the "actor." Their phone/laptop screen shows a movie name (visible only to them). They must act it out physically (in real life, not on screen) while holding their device so others in the same room can see them. Other players in the room (physically present, not online) shout guesses, and someone types them into the chat. OR for remote play: the actor mimes on camera (if using video call alongside).

Important: This game is designed for PHYSICAL co-located play where one person holds the device and acts, while others in the same room guess. The website's role: show the word secretly, provide a timer, and track scores.

Features:

- Movie dataset: 300+ popular Hollywood and Bollywood movies (separate categories, toggle on game setup)

- Hollywood: Marvel movies, Disney classics, Oscar winners, cult favorites

- Bollywood: Shah Rukh Khan hits, Aamir Khan classics, recent blockbusters

- Mode: "Pass the phone" — after correct guess, phone is passed to next actor, new word appears

- Timer: 60 seconds per word

- Score: team earns +1 per correct guess in time

UI: "Choose Category: Hollywood | Bollywood | Mixed" → Word reveal screen (actor only, large text) → Timer countdown → "Correct!" button → Score tally → "Pass to next actor" prompt

### 5.13 Would You Rather (Real-time | Voting | Room)

Core Loop: Host (or system) shows a "Would You Rather" dilemma with two options. All players vote A or B. Live percentages update. After all votes or 30 seconds, final results revealed with percentage breakdown. Discussion ensues. Next question.

Example: "Would you rather... be able to fly but only 3 feet off the ground, OR be able to teleport but only to places you've already been?"

Features:

- Question dataset: 500+ absurd, funny, and thought-provoking dilemmas (static JSON)

- Two-option format: Option A (left, blue) vs Option B (right, red)

- Live percentage bars that animate as votes come in

- "Total votes" counter

- Option to submit your own question to the room's queue

UI: Question display → Two large buttons (A/B) → Live bars → Results screen with percentages → "Next" button (host only or auto-advance)

### 5.14 Most Likely To… (Real-time | Voting | Room)

Core Loop: A scenario is presented. Players vote for WHICH PLAYER in the room is most likely to do that thing. Results revealed with percentages per player.

Example: "Most likely to survive a zombie apocalypse?" → Vote: Alice, Bob, Charlie, etc.

Features:

- Scenario dataset: 200+ "Most likely to..." prompts (static JSON)

- Player names in the room become the voting options

- After voting, show ranking: "1. Alice (60%), 2. Bob (25%), 3. Charlie (15%)"

- Fun animations: crown on the winner's name

UI: Scenario display → Player name buttons → Voting timer → Results ranking → Next scenario

### 5.15 Trivia (Solo or Room | Quiz)

Core Loop: Multiple-choice quiz with 4 options. Can be played solo (daily challenge with leaderboard) or in a room (everyone answers same questions, fastest correct answer gets most points).

Features:

- Question dataset: 500+ trivia questions across categories (General, Science, History, Pop Culture, Sports)

- "Wrong Answers Only" mode: players must intentionally pick the most absurd WRONG answer (comedy mode)

- Daily challenge: 10 new questions every day, global leaderboard

- Room mode: 10 questions, real-time scoring, podium at end

- Timer: 15 seconds per question (solo), 10 seconds (room race mode)

UI: Question → 4 option buttons → Timer → Correct answer reveal (green highlight) → Score tally → Next

### 5.16 Never Have I Ever (Real-time | Voting | Room)

Core Loop: Players take turns stating something they've NEVER done. All other players click "I HAVE" or "I HAVE NOT." Tallies show who's the most innocent/wild.

Example: Alice says "Never have I ever gone skydiving." Bob and Charlie click "I HAVE." Alice clicks nothing (she hasn't). Score: Alice 0, Bob 1, Charlie 1.

Features:

- Player rotation: turns go clockwise

- Each player submits their "Never have I ever..." statement (text input, or pick from suggested list)

- Other players vote: "I HAVE" or "I HAVE NOT" (anonymous or named, toggle in settings)

- After all votes, reveal: "2 out of 5 people have done this!"

- Running tally of each player's "wildness score" (how many things they've done)

UI: Current player's statement → Voting buttons for others → Results bar → Scoreboard → Next player's turn

### 5.17 Guess Who? Celebrity Edition (Real-time | Deduction | Room)

Core Loop: One player is assigned a secret celebrity. Other players take turns asking yes/no questions to narrow it down (e.g., "Are they alive?" "Are they an actor?" "Are they male?"). The answerer clicks Yes/No. After each answer, guessers can attempt to name the celebrity.

Features:

- Celebrity database: 200+ celebrities with traits: gender, alive/dead, profession, nationality, age range, hair color, famous for (static JSON with trait objects)

- Yes/No question tracking: all questions and answers visible in chat

- Attempt counter: how many questions asked so far

- Guessing: at any time, a player can type a name guess. If correct, they win the round

- If no one guesses after 20 questions, the answer is revealed

UI: Secret celebrity (only host/assigned player sees it) → Question log → "Ask Question" input (yes/no format) → Yes/No buttons (host only) → Guess input (all players) → Round result

### 5.18 This or That (Real-time | Voting | Room)

Core Loop: Rapid-fire pair comparisons. A prompt shows two options (images or text). Players tap their preference. Live percentages update instantly. 20 rounds in 2 minutes. "Pineapple on pizza: Yes or No?" "Cats or Dogs?" "Summer or Winter?"

Features:

- Pair dataset: 300+ "This or That" pairs (static JSON)

- Two large image/text cards side by side

- Tap to vote (instant, no confirmation)

- Live percentage bar underneath each option

- Streak: if your choice is the majority, you're "in the herd" — streak counter

UI: Two cards → Tap to vote → Live bars → Auto-advance after 6 seconds → Final "herd alignment" score

---

## 6. SEO REQUIREMENTS (CRITICAL FOR GOOGLE RANKING)

### 6.1 Homepage (/)

- <title>: "Free Online Party Games | Play with Friends Instantly | PartyBrain"

- <meta description>: "Play 18 free online party games with friends — no downloads, no accounts. Drawing games, trivia, word games, and more. Perfect for virtual parties, classrooms, and team building. Start playing in seconds!"

- H1: "Free Online Party Games — Play Instantly with Friends"

- 600-word descriptive content about the website, including keywords: free online party games, browser party games, play pictionary online, virtual party games, multiplayer drawing games, online trivia games, would you rather online, skribbl alternative

- Internal links to all 18 game pages

- FAQ section with JSON-LD (see FAQ section below)

### 6.2 Each Game Page (/game/[slug])

- <title>: "[Game Name] — Play Free Online | PartyBrain" (e.g., "Skribbl Arena — Free Online Drawing & Guessing Game | PartyBrain")

- <meta description>: Unique 150-160 character description per game with primary keyword

- H1: Game name

- 400-600 word content: how to play, rules, tips, why it's fun, device compatibility

- Game-specific FAQ with JSON-LD

- OG image: auto-generated or template-based image with game name and PartyBrain logo

- Internal links to 2-3 related games

### 6.3 FAQ Page (Global)

Questions to answer with JSON-LD structured data:

- How do I play party games online with friends?

- Do I need to download anything to play PartyBrain games?

- Can I play PartyBrain games on my phone?

- Are PartyBrain games free?

- How many players can join a game?

- Do I need to create an account?

- How do I create a private room?

- What are the best party games for large groups?

- Can I play PartyBrain games with people in different countries?

### 6.4 Technical SEO

- robots.txt with sitemap link

- sitemap.xml with all 18 game pages, homepage, legal pages, FAQ

- _headers file for Cloudflare: noindex the .pages.dev preview domain

- All images have descriptive alt text

- Canonical URLs on every page

- Open Graph tags: og:title, og:description, og:image, og:url, og:type for every page

- Twitter Card tags

- Schema.org "WebApplication" markup on game pages

- Breadcrumb structured data

- Hreflang tags (if multi-language later)

---

## 7. ADSENSE PREPARATION

These requirements must be met from day one so AdSense approval is smooth:

- Privacy Policy page (linked in footer): covers data collection, cookies, AdSense usage, third-party services

- Terms & Conditions page: user responsibilities, intellectual property, liability disclaimers

- About Us page: what PartyBrain is, who built it, why it exists

- Contact Us page: email address, contact form (static form that sends to a real email or just displays contact info)

- All four pages accessible from footer on every page

- No copyrighted material (images must be public domain or original)

- Content must be original and substantial (the 400-600 word per game fulfills this)

- Site must be fully functional and navigable

- Google Analytics placeholder: add a GA4 tracking ID placeholder in the <head> (comment: <!-- Replace with real GA4 ID -->)

- AdSense ad unit placeholder: add a div with class "ad-container" on game pages where ads will go (commented out until approved)

- No pop-ups, no auto-redirects, no deceptive content

- Fast load times (<2 seconds) — which Astro static pages guarantee

---

## 8. BACKEND (Node.js + Express + Socket.io + Prisma)

Create this in /server folder:

### 8.1 API Endpoints (REST)

- POST /api/scores — submit score: { gameId, playerName, score }

- GET /api/leaderboard/:gameId — get top scores for a game (daily/weekly/all-time)

- GET /api/daily-challenge — get today's daily challenge data for each solo game

- POST /api/room/create — create a new room: { gameId } → returns { roomCode }

- GET /api/room/:roomCode — get room info (players, game type, status)

### 8.2 Socket.io Events

Room System:

- 'create-room' → server creates room, returns roomCode

- 'join-room' → player joins room

- 'leave-room' → player leaves

- 'start-game' → host starts the game

- 'game-state-update' → server broadcasts current game state to all players in room

Drawing Games:

- 'draw-stroke' → broadcast stroke data to room

- 'clear-canvas' → broadcast clear command

- 'undo-stroke' → broadcast undo

Chat/Guessing:

- 'send-guess' → player submits guess, server checks if correct, broadcasts result

- 'chat-message' → send text message to room

Voting Games:

- 'cast-vote' → player votes, server tallies and broadcasts updated percentages

### 8.3 Database Schema (Prisma)

```prisma

model Game {

  id          String   @id @default(cuid())

  slug        String   @unique

  name        String

  type        String   // "solo" | "multiplayer-realtime" | "multiplayer-voting"

  createdAt   DateTime @default(now())

}

model Room {

  id          String   @id @default(cuid())

  code        String   @unique

  gameId      String

  status      String   @default("lobby") // lobby, in-progress, finished

  createdAt   DateTime @default(now())

  players     RoomPlayer[]

}

model RoomPlayer {

  id        String   @id @default(cuid())

  roomId    String

  room      Room     @relation(fields: [roomId], references: [id])

  playerName String

  joinedAt  DateTime @default(now())

}

model Score {

  id         String   @id @default(cuid())

  gameId     String

  playerName String

  score      Int

  playedAt   DateTime @default(now())

}

model DailyChallenge {

  id        String   @id @default(cuid())

  gameId    String

  date      DateTime

  data      Json     // challenge-specific data (questions, prompts, etc.)

}

9. MOBILE RESPONSIVENESS

    All pages must be fully responsive (320px to 1440px+)

    Drawing canvas must scale and work with touch events

    Game lobby and voting UIs must be thumb-friendly (large tap targets, 48px minimum)

    Charades mode specifically optimized for mobile (single-player holds phone to forehead style)

    Test all games in Chrome DevTools mobile view (iPhone 14, Pixel 7 presets)

10. PERFORMANCE REQUIREMENTS

    Homepage Lighthouse score: 95+ Performance, 100 Accessibility, 100 Best Practices, 100 SEO

    Game pages: 90+ Performance (some JavaScript is unavoidable for interactive games)

    All static pages under 100KB total page weight (excluding game JavaScript bundles)

    Images lazy-loaded, WebP format with fallbacks

    Astro partial hydration: only the specific game island loads its JavaScript

11. DESIGN GUIDELINES

    BounceBox Design System



    Overview



    BounceBox is a bubbly, rainbow-energy design system designed for kids' entertainment and game platforms targeting ages 3-8. Every element is oversized, pill-shaped, and bursting with playful depth through coral, teal, and sunshine yellow. The system prioritizes large touch targets, bold colors, and a joyful visual language that makes interaction feel like play.



    ***

    Colors



    Color Primary (#FF6B6B): Primary actions, main highlights

    Color Secondary (#4ECDC4): Supporting accents, navigation

    Color Tertiary (#FFE66D): Rewards, stars, celebration

    Surface Base (#FFFFFF): Page background

    Color Success (#4ECDC4): Correct, completed

    Color Warning (#FFE66D): Hints, gentle alerts

    Color Error (#FF6B6B): Oops, try again

    Color Info (#60A5FA): New, tips



    Typography



    Headline Font: Titan One

    Body Font: Poppins

    Mono Font: Roboto Mono



    h1: 48px regular, 1.2 line height. Game titles.

    h2: 36px regular, 1.2 line height. Section titles.

    h3: 28px regular, 1.25 line height. Card titles.

    h4: 22px regular, 1.3 line height. Sub-headings.

    body: 18px regular, 1.5 line height. Instructions.

    small: 16px regular, 1.5 line height. Labels.

    xs: 14px semibold, 1.4 line height. Badges.



    ***

    Spacing



    Base unit: 8px with generous padding throughout.

    xs: 4px — Inline icon gaps

    sm: 8px — Minimal internal gaps

    md: 16px — Standard padding

    lg: 24px — Card padding, section gaps

    xl: 32px — Layout margins

    2xl: 48px — Hero spacing

    3xl: 64px — Major section breaks

    All interactive elements receive extra padding (minimum 16px) for easy tapping by small fingers.



    Border Radius



    radius-md (16px): Inputs, smaller elements

    radius-lg (24px): Cards, panels, game boards

    radius-pill (9999px): Buttons, chips, badges, pills

    Everything is very rounded. Buttons and chips are pill-shaped. Cards use 24px radius for a soft, toy-like feel.



    Elevation



    Material shadows for playful depth and tactile feel.

    shadow-sm: Soft 2px vertical, 4px blur, black at 8% opacity. Resting cards.

    shadow-md: Medium 4px vertical, 10px blur, black at 12% opacity. Hovered elements.

    shadow-lg: Strong 8px vertical, 20px blur, black at 15% opacity. Modals, pop-ups.

    shadow-coral: Warm 4px vertical, 14px blur, coral (#FF6B6B) glow at 35% opacity. Primary CTA glow.

    shadow-teal: Cool 4px vertical, 14px blur, teal (#4ECDC4) glow at 35% opacity. Secondary glow.

    shadow-sunny: Bright 4px vertical, 14px blur, yellow (#FFE66D) glow at 40% opacity. Reward glow.



    Components



    Buttons



    All buttons are pill-shaped (9999px radius) with a minimum 44px touch target for small fingers.



    Primary: Coral (#FF6B6B) fill, white (#FFFFFF) text, no border. Hover darkens to #E85D5D. Available in small (16px text, 40px tall, 10px 20px padding), medium (18px text, 48px tall, 12px 28px padding), and large (22px text, 56px tall, 16px 36px padding).

    Secondary: Teal (#4ECDC4) fill, white (#FFFFFF) text, no border. Hover darkens to #3DBEB5.

    Ghost: Transparent fill, coral (#FF6B6B) text, 3px coral (#FF6B6B) border. Hover fills with faint coral (#FF6B6B at 15% opacity).

    Destructive: Red (#EF4444) fill, white (#FFFFFF) text, no border. Hover darkens to #DC2626.



    Disabled buttons drop to 0.4 opacity with a disabled cursor and no hover, focus, or glow effects.



    Cards



    Default: White (#FFFFFF) background with a 2px #E5E7EB border, shadow-sm at rest, 24px rounded corners. On hover the shadow lifts to shadow-md and the border shifts to teal (#4ECDC4). Padding is 24px.

    Elevated: White (#FFFFFF) background with no border, shadow-md at rest, 24px rounded corners. On hover the shadow deepens to shadow-lg. Padding is 24px.



    Inputs



    Inputs sit on a white (#FFFFFF) background with 16px rounded corners, 12px 16px padding, and 18px text in Poppins.



    In the default state the border is 2px #E5E7EB with no shadow. On hover the border strengthens to 2px #A1A1AA. On focus the border thickens to 3px coral (#FF6B6B) with a 4px coral ring at 25% opacity. In the error state the border becomes 3px #EF4444 over a light red (#FFF5F5) background with a 4px red ring at 20% opacity. When disabled the border returns to 2px #E5E7EB, the background fades to #F9FAFB, and opacity drops to 0.5.



    Labels are set in Poppins 16px semibold (600) in content-primary with 6px bottom margin. Helper text is Poppins 14px regular (400) in content-secondary with 6px top margin; error helper text uses color-error.



    Chips



    Filter: Light coral (#FF6B6B at 20% opacity) fill, coral (#FF6B6B) text, 2px border at #FF6B6B 40% opacity, pill-shaped, 14px text, 6px 16px padding.

    Status: Pill-shaped with no border, 14px text, 6px 16px padding. Background and text vary by severity: success is #D1FAE5 background with #166534 text, warning is #FEF9C3 with #854D0E text, error is #FEE2E2 with #991B1B text.



    Lists



    Each row is 56px tall with 0 20px padding, separated by a 2px dashed #E5E7EB divider. Text is Poppins 18px in content-primary. On hover the background tints to #FFF5F5. The active row fills with faint coral (#FF6B6B at 15% opacity) and text turns coral (#FF6B6B).



    Checkboxes



    24px square with 8px rounded corners. Unchecked state shows a 3px #E5E7EB border on a white (#FFFFFF) background. When checked the box fills teal (#4ECDC4) with a thick white checkmark. Focus adds a 4px teal ring at 25% opacity. Labels sit 10px away in Poppins 18px.



    Radio Buttons



    24px circular. Unchecked state shows a 3px #E5E7EB border on a white (#FFFFFF) background. When selected the border becomes 3px teal (#4ECDC4) and a 12px teal inner dot appears. Focus adds a 4px teal ring at 25% opacity. Labels sit 10px away in Poppins 18px.



    Tooltips



    Dark (#2D2D2D) background with white (#FFFFFF) text in Poppins 14px. Padded 8px 16px with 16px rounded corners and an 8px arrow. Maximum width is 220px. Shows after a 400ms delay and hides instantly (longer delay chosen for kids).



    ***

    Do's and Don'ts



    Do make every interactive element at least 44px tall with generous padding for small fingers.

    Do use pill-shaped buttons and rounded cards consistently to maintain the bubbly toy-like feel.

    Do use bright, saturated colors from the palette; muted or pastel tones undermine the energy.

    Don't use small text below 14px anywhere in the interface; legibility for young readers is critical.

    Don't use complex iconography; prefer simple, chunky icons with thick 3px strokes.

    Do use the sunshine yellow for rewards, stars, and celebration animations.

    Don't use harsh error states; frame mistakes as "Oops, try again!" with the coral color gently.

    Do add colored glow shadows to primary CTAs to make them irresistible to tap.

    Don't place more than three interactive options on screen at once for the target age group.

    Do use dashed dividers and thick borders to reinforce the hand-drawn, playful aesthetic.

12. DEPLOYMENT SETUP

    Frontend: Cloudflare Pages (connected to GitHub repo, auto-deploy on push)

    Backend: Railway or Render (Dockerfile in /server)

    Environment variables in .env (backend URL, database URL)

    Deploy script in package.json: "deploy": "astro build && wrangler pages deploy dist"

    README.md with setup instructions

13. WHAT NOT TO DO

    Do NOT use any paid or copyrighted images (all images must be public domain, CC0, or self-created SVGs)

    Do NOT make the site a single-page application (SPA) — Astro MPA only

    Do NOT bundle all game JavaScript on the homepage — each game island loads only on its page

    Do NOT use heavy animation libraries — CSS animations only for performance

    Do NOT include actual AdSense code — use commented placeholders as specified

    Do NOT require user authentication — everything works with just a nickname

    Do NOT scrape Amazon or any external site for Price Is Right — use a manually curated static JSON dataset

    Do NOT use any real celebrity photos for Guess Who — use text descriptions only or public domain images

14. OUTPUT EXPECTATIONS

Generate the COMPLETE codebase. Do not use placeholders or "// TODO" comments. Every file must contain its full implementation. The site should be runnable with npm run dev after generation.

Start by generating:

    Project structure (all folders and config files)

    Astro pages for all routes

    React island components for all games

    Shared components (RoomEngine, DrawingCanvas, VotingComponent, SoloGameTemplate)

    Backend server with all Socket.io handlers and API routes

    Prisma schema and seed script

    All static data files (game datasets in JSON)

    Legal pages

    SEO meta tags and structured data

    Deployment configuration files

Begin building now. Generate the complete website.
```
