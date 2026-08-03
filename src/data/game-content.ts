/**
 * Per-game SEO content (M10, PRD §6.2) — unique 150–160-char meta
 * descriptions, 400–600-word body content, and game-specific FAQs with
 * JSON-LD. Keyed by game slug; consumed by /game/[slug].
 */

export interface GameSeoContent {
  /** Unique 150–160 character meta description with the primary keyword. */
  metaDescription: string;
  /** Long-form body sections (how to play, rules, tips, why it's fun, devices). */
  sections: { heading: string; body: string }[];
  /** Game-specific FAQ (JSON-LD FAQPage + visible accordion). */
  faqs: { question: string; answer: string }[];
}

export const gameContent: Record<string, GameSeoContent> = {
  'skribbl-arena': {
    metaDescription:
      'Play Skribbl Arena online free — a fast multiplayer drawing game where you sketch secret words and friends race to guess. A free, better skribbl alternative.',
    sections: [
      {
        heading: 'How to play Skribbl Arena',
        body: "Skribbl Arena is a real-time multiplayer drawing game for up to 24 players. One player is the drawer each round: they pick one of three secret words and sketch it on the shared canvas while everyone else types guesses in the chat. The first player to guess the word correctly wins points, and the drawer earns a cut of every correct guess. After three rounds per player, the final scoreboard crowns the champion. It's the classic play-pictionary-online experience with a fresh, free twist.",
      },
      {
        heading: 'Rules & scoring',
        body: "Each drawing round lasts 60 seconds. Guesses are checked automatically — case and spaces don't matter, so 'pizza' and 'Pizza' both count. The guesser's score depends on speed: the faster the correct guess, the more points (up to 100, minus 2 per second). The drawer earns half of the total points their word generated. If nobody guesses, nobody scores. After 30 seconds the first letter is revealed, and at 45 seconds the last letter appears — the hints keep rounds alive when the drawing is tricky.",
      },
      {
        heading: 'Tips to win',
        body: 'Draw the most recognizable part of the word first — the silhouette or the defining feature — and add details later. Guess early and often: every wrong guess is free, and the first letter hint makes most words guessable by 45 seconds. As the drawer, sketch big and bold; thin lines and tiny details are hard to read on phones. If you host, you can paste a custom word list to match your group — birthday themes, office in-jokes, or classroom vocabulary.',
      },
      {
        heading: 'Why it works for parties, classrooms, and teams',
        body: 'Skribbl Arena needs no setup and no accounts: share a room link and friends join from any device in seconds. It is one of the best free multiplayer drawing games for virtual parties, video calls, classrooms, and team-building breaks, and it scales from two players to a full room of 24.',
      },
      {
        heading: 'Devices & requirements',
        body: 'Play on any modern browser — desktop, laptop, tablet, or phone. The canvas works with mouse, touch, and stylus, and the interface is designed for small screens. There is nothing to install and nothing to download.',
      },
      {
        heading: 'Playing with friends',
        body: 'Getting a game started takes about ten seconds. One person creates a room and shares the six-character code or a link; everyone else opens it on their own device and picks a nickname. Because there are no accounts, guests join with zero friction — which matters when you are herding a group chat onto a video call. Rooms hold up to 24 players, and if someone drops out mid-game, they can rejoin and keep their seat. For smaller groups, two players work fine, and a solo room lets you practice drawing before the real game night.',
      },
    ],
    faqs: [
      {
        question: 'Is Skribbl Arena free to play?',
        answer:
          'Yes — every PartyBrain game is free. No downloads, no accounts, no paywalls. Create a room and share the link.',
      },
      {
        question: 'How many players can join a Skribbl Arena room?',
        answer:
          'Up to 24 players can join one room. Games also work with just two people — or one, if you want to practice drawing.',
      },
      {
        question: 'Can I use my own words?',
        answer:
          'Yes. The host can paste a custom word list in the lobby — 3 to 200 words — and the game uses only those words.',
      },
    ],
  },
  'copycat-challenge': {
    metaDescription:
      'Play Copycat Challenge online free — memorize a famous painting for 5 seconds, draw it from memory, and vote for the funniest copy. Hilarious multiplayer fun.',
    sections: [
      {
        heading: 'How to play Copycat Challenge',
        body: 'Copycat Challenge is the drawing game that proves nobody can actually draw. A famous painting or iconic photo flashes on screen for five seconds — memorize as much as you can. Then it disappears, and every player draws the image from memory on their own private canvas for 90 seconds. Nobody sees your drawing until the gallery reveal. When the time is up, all the copies appear side by side and the room votes for the Most Recognizable, the Funniest, and the Most Abstract masterpiece.',
      },
      {
        heading: 'Rules & scoring',
        body: "There's no guessing and no shared canvas — this game is pure art chaos. Each player votes once per award category, and you can't vote for your own drawing. After the votes land, the awards ceremony crowns three winners: one for accuracy, one for comedy, and one for pure interpretive genius. The bragging rights are the real prize.",
      },
      {
        heading: 'Tips to win (or at least be funny)',
        body: "During the five-second reveal, memorize the image's strongest shapes: the skyline, the smile, the swirls. On your canvas, start with the biggest shapes and fill in details last. If you can't draw it, draw it badly on purpose — the Funniest and Most Abstract awards exist for a reason. The best strategy in a big group is to commit fully to one approach: either a serious tribute or a full cartoon.",
      },
      {
        heading: 'Why it works for parties and classrooms',
        body: 'Copycat Challenge is the perfect icebreaker: it needs no vocabulary, works across languages, and always produces laughter. It is one of the best virtual party games for video calls and one of the most memorable classroom art activities — students memorize, recreate, and critique like museum curators with markers.',
      },
      {
        heading: 'Devices & requirements',
        body: 'Play on any browser on any device. The private canvas supports touch, mouse, and stylus, and the 90-second drawing window is generous enough for phones. Nothing to install.',
      },
      {
        heading: 'Playing with friends',
        body: 'Copycat works beautifully as a room game: create a room, share the link, and every player draws on their own device at the same time. There is no queue and no waiting — everyone is drawing simultaneously, which makes it the fastest drawing game to get going with a big group. Up to 24 players can join, and each one gets a private canvas, so nobody can copy the person next to them (in theory). After the gallery reveal, the voting phase turns the room into a museum of interpretation, and the awards ceremony gives every style its moment.',
      },
    ],
    faqs: [
      {
        question: 'Can I play Copycat Challenge alone?',
        answer:
          'Yes — solo rooms work. You can draw and see your own gallery, and the full flow works with one player for testing or practice.',
      },
      {
        question: 'Where do the images come from?',
        answer:
          'The image bank uses public-domain and freely licensed art and photography from Wikimedia Commons — famous paintings like the Mona Lisa, and iconic photos.',
      },
      {
        question: 'How long does a game take?',
        answer:
          'About two minutes per round: five seconds to memorize, 90 seconds to draw, and 30 seconds to vote. A full game with several rounds fits in a short party break.',
      },
    ],
  },
  'draw-the-lyric': {
    metaDescription:
      'Play Draw the Lyric online free — a song guessing game where one player draws a lyric and everyone races to name the song title. Music + drawing party fun.',
    sections: [
      {
        heading: 'How to play Draw the Lyric',
        body: "Draw the Lyric is the music-nerd drawing game. Each round, one player — the drawer — sees a song lyric in a private banner and has 90 seconds to draw it on the shared canvas. The twist: everyone else guesses the SONG TITLE, not the lyric. If the lyric says 'I see a little silhouetto of a man,' the answer is Bohemian Rhapsody. The drawer sketches, the room shouts titles into the chat, and the first correct guesser scores 100 points while the drawer banks 50.",
      },
      {
        heading: 'Rules & scoring',
        body: "Rounds last 90 seconds. Guesses are matched against the song title automatically — case and punctuation are ignored, and a leading 'The' won't trip you up. The guesser earns a flat 100 points per correct title; the drawer earns 50 per correct guess. After 45 seconds the artist name is revealed as a hint, which turns most rounds into a race. The player with the most points after everyone has drawn wins.",
      },
      {
        heading: 'Tips to win',
        body: 'As the drawer, draw the strongest image in the lyric, not the whole song. A single iconic object — a yellow submarine, a rolling stone — can make the title obvious. As a guesser, watch the artist hint like a hawk: a single name can unlock the answer. If you are stuck, type common words from the lyric itself; the answer checker is looking for the title, but chat is free for brainstorming.',
      },
      {
        heading: 'Why it works for parties',
        body: 'Draw the Lyric is the rare game that rewards both music knowledge and art chaos, and it is one of the best free online trivia games for music fans. It works brilliantly on video calls with friends, at family game nights, and in classrooms as a listening-and-visualization exercise.',
      },
      {
        heading: 'Devices & requirements',
        body: 'Runs in any modern browser on phones, tablets, and desktops. The drawer can sketch with a finger, mouse, or stylus, and guessers just type — the most phone-friendly way to play.',
      },
      {
        heading: 'Playing with friends',
        body: 'This game rewards a room full of music fans, but it works with any group: the drawer does not need to know the song, and the artist hint at 45 seconds gives everyone a fighting chance. Create a room, share the code, and the drawer rotation keeps every player involved — nobody sits out, because each person eventually holds the lyric banner. For game nights, the format is ideal: rounds are short, the reveal is instant, and the arguments about whether the drawing actually captured the lyric last longer than the game itself.',
      },
    ],
    faqs: [
      {
        question: 'Do I need to know the song to play?',
        answer:
          'No — the drawer sees the lyric and the title is the answer. Knowing the song helps, but the artist hint at 45 seconds levels the field.',
      },
      {
        question: 'Are the lyrics real songs?',
        answer:
          'The lyric bank uses paraphrased and original lines only, for licensing safety. The song titles are real and guessable.',
      },
      {
        question: 'How many rounds does a game have?',
        answer:
          'Every player draws once per rotation (three rounds per player in longer games), so a typical game with four players lasts about 15 minutes.',
      },
    ],
  },
  'one-line-one-shape': {
    metaDescription:
      'Play One Line, One Shape online free — draw an object in a single continuous line without lifting the pen, or lose time. The hardest multiplayer drawing game.',
    sections: [
      {
        heading: 'How to play One Line, One Shape',
        body: 'One Line, One Shape is a drawing game with a brutal rule: you may never lift the pen. The drawer gets an object — a bicycle, an elephant, the Eiffel Tower — and must sketch it in one continuous line on the shared canvas. Every time the pen leaves the canvas, ten seconds are deducted from the round. Meanwhile the whole room guesses what the single squiggly line is supposed to be. Rounds last 60 seconds, and the scoring follows the classic formula: fast guessers score up to 100 points, and the drawer earns half of what their word generates.',
      },
      {
        heading: 'Rules & scoring',
        body: "The continuous-line rule is enforced live: lift the pen and the clock loses ten seconds (with a five-second floor so the round never vanishes). Guesses are case-insensitive and whitespace-trimmed, so 'eiffel tower' and 'Eiffel Tower' both count. The round ends when everyone guesses or the timer hits zero. With 220 objects in the bank — from simple shapes to absurd contraptions — no two rounds feel the same.",
      },
      {
        heading: 'Tips to win',
        body: 'Plan the whole drawing before you start: one continuous line means every stroke is a detour you cannot undo with a lift. Start from the bottom of the shape and loop upward so intersections hide mistakes. As a guesser, think in silhouettes — a single continuous line usually traces the outline of the object, so name the outline, not the details.',
      },
      {
        heading: 'Why it works for parties',
        body: 'One Line, One Shape is the ultimate test of composure and the funniest drawing game for game nights. The penalty mechanic turns every near-miss into a group gasp, making it one of the most exciting free multiplayer drawing games for video calls and classrooms alike.',
      },
      {
        heading: 'Devices & requirements',
        body: 'Works on every modern browser. Touch and stylus make continuous lines easier than a mouse, but a careful mouse hand can win too. No downloads, no accounts.',
      },
      {
        heading: 'Playing with friends',
        body: 'One Line, One Shape is at its best with a full room because the guessing crowd makes the pressure real. Rooms support up to 24 players, and the drawer rotation means everyone takes a turn under the continuous-line rule — including the person who bragged they could draw. The live penalty warnings turn every pen lift into a room-wide event, and the scoreboard keeps the competition honest. Two players get a duel format that is just as tense, and solo rooms are perfect for practicing your unbroken lines before showtime.',
      },
    ],
    faqs: [
      {
        question: 'What happens if I lift the pen?',
        answer:
          'Ten seconds are deducted from the round timer, down to a minimum of five seconds. The warning appears on screen so everyone can see the penalty.',
      },
      {
        question: 'Is this game good for beginners?',
        answer:
          'Yes — the object bank includes easy shapes like hearts and stars alongside hard ones, and the continuous-line rule creates laughs even when nobody guesses.',
      },
      {
        question: 'How do I undo a mistake?',
        answer:
          'Use the Undo button — it removes your last line segment without lifting the pen, so you can reroute a bad stroke without a penalty.',
      },
    ],
  },
  'shadow-sketch': {
    metaDescription:
      'Play Shadow Sketch online free — fill in a faint silhouette with details while friends guess what it is. A beautiful twist on multiplayer drawing games.',
    sections: [
      {
        heading: 'How to play Shadow Sketch',
        body: 'Shadow Sketch flips the drawing game formula. The drawer sees a faint gray silhouette — a cat, a Christmas tree, the Statue of Liberty — and must draw the INTERNAL details that make it recognizable: eyes, branches, a torch. The catch: guessers never see the silhouette. They watch only the drawer’s strokes appear on a blank canvas and try to name the shape before the 90-second round ends. At 60 seconds the silhouette is revealed to everyone, turning the final half-minute into a frenzy of obvious answers.',
      },
      {
        heading: 'Rules & scoring',
        body: 'The silhouette layer is visible only to the drawer until the 60-second reveal. Guesses are matched case-insensitively against the silhouette name. The first correct guesser scores up to 100 points based on speed, and the drawer earns half of the total points their drawing produced. With 110 silhouettes in the bank, the round feels different every time.',
      },
      {
        heading: 'Tips to win',
        body: 'The silhouette tells you the outline — your job is the inside. Draw the most identifying features first: the eyes of a cat, the stripes of a zebra, the torch of Lady Liberty. Guessers should name what the shapes suggest rather than what they literally see; a circle with lines is usually a face. When the reveal hits, everyone suddenly knows the answer — the last 30 seconds are pure speed.',
      },
      {
        heading: 'Why it works for parties',
        body: 'Shadow Sketch rewards cleverness over drawing skill and produces genuine “oh, it’s so obvious” moments, making it one of the most satisfying browser party games for friends and one of the best visual-thinking activities for classrooms.',
      },
      {
        heading: 'Devices & requirements',
        body: 'Play on any device with a modern browser. The faint silhouette renders identically on all screens, and touch drawing is fully supported. Nothing to install.',
      },
      {
        heading: 'Playing with friends',
        body: 'Shadow Sketch shines with a mixed group of artists and non-artists: the silhouette guides the drawer, so drawing skill matters less than observation, and the reveal moment gives everyone the same aha. Set up a room, share the link, and rounds rotate the drawer through the whole group. With up to 24 players, guessers stay engaged because the reveal at 60 seconds suddenly makes every stroke obvious. It is also a wonderful classroom game — the silhouette mechanic teaches shape recognition and visual communication better than any lecture, and the simple rules mean even first-time players contribute from round one. The reveal mechanic stays fun for repeat players.',
      },
    ],
    faqs: [
      {
        question: 'Can guessers see the silhouette?',
        answer:
          'Not until the 60-second reveal. Before that, the silhouette is drawn only on the drawer’s canvas, as a faint background layer.',
      },
      {
        question: 'What kinds of silhouettes are in the game?',
        answer:
          'More than 100: animals, objects, landmarks, vehicles, and holiday icons — every silhouette is a simple SVG outline that fits the canvas perfectly.',
      },
      {
        question: 'Is Shadow Sketch good for large groups?',
        answer:
          'Yes — up to 24 players can guess simultaneously, and the reveal mechanic makes late guesses just as fun as early ones.',
      },
    ],
  },
  'would-you-rather': {
    metaDescription:
      'Play Would You Rather online free with friends — vote on outrageous dilemmas, watch live percentages swing, and submit your own questions. Zero wrong answers.',
    sections: [
      {
        heading: 'How to play Would You Rather',
        body: "Would You Rather is the classic dilemma game, digitized for the whole room. A prompt appears — 'Would you rather be able to fly but only three feet off the ground, or teleport only to places you've been?' — and every player votes for option A or option B. The bars animate live as votes land, and after everyone answers or 30 seconds pass, the final percentages are revealed and the arguing begins. Ten rounds later the room has learned more than anyone wanted to share.",
      },
      {
        heading: 'Rules & scoring',
        body: 'Each round offers two options, color-coded blue and red. You get one vote per round, and the live tally updates instantly. When everyone has voted, the reveal shows the split — 60/40, 50/50, or a total landslide. The game also includes a player-submitted question queue: anyone can add their own dilemma, which joins the rotation for future rounds. There are no scores and no winners — the point is the debate.',
      },
      {
        heading: 'Tips for the best game night',
        body: "Bring the energy: the best dilemmas are the ones that split the room almost exactly in half, because that's when the arguments get loud. Read the options out loud if you're on a call — people vote faster when they hear them. Use the submit-your-own feature to personalize the game with your group's inside jokes. And remember: there are no wrong answers, but there are definitely wrong opinions.",
      },
      {
        heading: 'Why it works for any group',
        body: 'Would You Rather is the ultimate icebreaker and one of the best free online party games for large groups, classrooms, and remote teams. It needs zero skill, works with any number of players, and always generates conversation. The one-screen mode is perfect for co-located parties: pass the phone around or project it on the TV.',
      },
      {
        heading: 'Devices & requirements',
        body: 'Play in any browser on any device — phones, tablets, laptops, or a projector. One-screen mode turns a single device into the whole game. No downloads, no accounts.',
      },
      {
        heading: 'Playing with friends',
        body: 'There are two ways to gather: the room mode for distributed groups — create a room, share the code, and vote from your own phones — and the one-screen mode for people in the same room, where a single device or projector becomes the game. Both modes show the live percentages, which is where the magic happens: watching a 50/50 split swing on the last vote is the entire point. Because there is no scoring, late arrivals can jump in mid-game without penalty, and the player-submitted question queue means every group gets its own flavor.',
      },
    ],
    faqs: [
      {
        question: 'How many players can play Would You Rather?',
        answer:
          'Any number. Rooms support up to 24 players online, and the one-screen mode works for a whole party sharing one device.',
      },
      {
        question: 'Can I add my own questions?',
        answer:
          'Yes — any player can submit a dilemma during the game. It joins the room’s queue and appears in a later round.',
      },
      {
        question: 'Is there a winner?',
        answer:
          'No scores, no winners — Would You Rather is about the debates. The percentages are the entertainment.',
      },
    ],
  },
  'most-likely-to': {
    metaDescription:
      'Play Most Likely To online free — vote for who in the room would survive a zombie apocalypse, forget a password, or star in the drama. Hilarious party voting.',
    sections: [
      {
        heading: 'How to play Most Likely To…',
        body: "Most Likely To… is the game that puts your friends on trial. A scenario appears — 'Most likely to survive a zombie apocalypse?' — and every player votes for the person in the room who fits the bill. The options are your friends' names, the votes roll in with live percentage bars, and the reveal ranks the room from most to least guilty, with a crown for the winner. Ten rounds later, everyone knows exactly who would start the group chat drama.",
      },
      {
        heading: 'Rules & scoring',
        body: "Each round offers every connected player as a voting option. You get one vote per round, and you can even vote for yourself (some people are very confident). The reveal shows a full ranking with percentages, and the round's winner collects a crown. Across the game, the crown count builds into a running tally — the room's official 'most likely' champion emerges by the end.",
      },
      {
        heading: 'Tips for maximum chaos',
        body: 'Vote fast and vote honestly — the live bars make every split visible, and the ranking reveal is funnier when people commit. Scenarios cover everything from heroic (survive an apocalypse) to petty (forget their own password), so the room learns who the group trusts and who it absolutely does not. Play with people who can take a joke: this game is affectionate but brutal.',
      },
      {
        heading: 'Why it works for parties and teams',
        body: 'Most Likely To… is one of the best free virtual party games for friend groups, and a surprisingly effective team-building icebreaker — it surfaces group dynamics in a playful way. It works with any room size and needs zero skill, so everyone jumps in immediately.',
      },
      {
        heading: 'Devices & requirements',
        body: 'Any browser, any device. Players vote by tapping their friends’ names, which works perfectly on phones. No downloads, no accounts, no setup.',
      },
      {
        heading: 'Playing with friends',
        body: 'The game gets better the more it knows about your group. Create a room and share the code; every player who joins becomes a voting option, so the options are always exactly the people in the call. Rooms hold up to 24 players, and the crown tally across ten rounds produces a definitive (and debatable) champion. It works equally well with co-workers you barely know and friends you know too well — the scenarios adapt, and the percentages tell the real story about group dynamics. Ten rounds take about six minutes, which makes it an ideal mid-party segment rather than the whole night.',
      },
    ],
    faqs: [
      {
        question: 'Can I vote for myself?',
        answer:
          'Yes — self-votes are allowed. If you genuinely believe you would survive the zombie apocalypse, the game will let you prove it.',
      },
      {
        question: 'How many rounds are there?',
        answer:
          'Ten scenarios per game, each with its own reveal and crown — enough for a full party segment.',
      },
      {
        question: 'Does the game keep score?',
        answer:
          'The crown tally runs through the whole game, and the final screen crowns the room’s most-likely champion.',
      },
    ],
  },
  'never-have-i-ever': {
    metaDescription:
      'Play Never Have I Ever online free — confess, vote I HAVE or I HAVE NOT, and crown the wildest player in the room. The classic party confession game, digitized.',
    sections: [
      {
        heading: 'How to play Never Have I Ever',
        body: "Never Have I Ever takes the classic confession game online with a twist: the game keeps score. Players take turns stating something they have never done — 'Never have I ever gone skydiving' — while everyone else votes I HAVE or I HAVE NOT. The reveal shows exactly how many people have done the thing, and each player's running 'wildness score' climbs with every I HAVE vote against them. By the end, the room knows exactly who is the most innocent and who is the most chaotic.",
      },
      {
        heading: 'Rules & scoring',
        body: "The current player confesses using the text box or one of the suggested statements. Everyone else votes anonymously — the reveal only shows the count, never names, so honesty is safe. The confession author doesn't vote on their own statement. Each I HAVE vote adds one point to that voter's wildness score, and the scoreboard updates live after every round. Turns rotate through the room until everyone has confessed.",
      },
      {
        heading: 'Tips for the best confessions',
        body: "The best statements are specific and surprising — 'never have I ever eaten a crayon' beats 'never have I ever lied.' Use the suggestion bank when you're stuck; it is packed with 200+ conversation starters. The wildness scoreboard turns the game into a friendly competition: play long enough and a clear winner (or loser) emerges.",
      },
      {
        heading: 'Why it works for parties',
        body: 'Never Have I Ever is a legendary party game for adults, and the online version makes it work for video calls, game nights, and get-to-know-you sessions with new groups. The anonymous voting keeps it comfortable, and the scoring gives it a structure the classic game lacks.',
      },
      {
        heading: 'Devices & requirements',
        body: 'Plays in any browser on any device. Voting is one tap, and the statement box is optional — suggestions keep the game moving on phones. No downloads, no accounts.',
      },
      {
        heading: 'Playing with friends',
        body: 'Never Have I Ever is a room game at heart: gather your group, share the code, and the turn rotation walks through everyone in order, so each player gets the spotlight. Rooms support up to 24 players, and the game scales the number of rounds to the group size — small rooms play longer rotations, big rooms get a tighter game. The suggestion bank keeps the pace fast even when players freeze, and the anonymous voting means people confess more than they would out loud. The wildness scoreboard turns the final reveal into the highlight of the night.',
      },
    ],
    faqs: [
      {
        question: 'Are the votes anonymous?',
        answer:
          'Yes — the reveal only shows how many people have done the thing, never who. The only score that attaches to names is the wildness tally.',
      },
      {
        question: 'Can I pick a suggested statement?',
        answer:
          'Yes — the game offers a fresh set of suggestions on every turn, or you can type your own confession.',
      },
      {
        question: 'How is the wildness score calculated?',
        answer:
          "Every time someone votes I HAVE on another player's confession, that voter's wildness score increases by one.",
      },
    ],
  },
  'this-or-that': {
    metaDescription:
      'Play This or That online free — 20 lightning-fast preference battles in two minutes. Tap your side, ride the herd streak, and prove your taste to the room.',
    sections: [
      {
        heading: 'How to play This or That',
        body: "This or That is a rapid-fire taste test. The game serves 20 pairs — 'Sweet or salty?', 'Cats or dogs?', 'Pineapple on pizza: yes or no?' — and you have six seconds to tap your side of each battle. The percentage bars swing live as the room votes, and when the dust settles your 'herd alignment' score shows how often your taste matched the majority. Twenty rounds, two minutes, zero mercy.",
      },
      {
        heading: 'Rules & scoring',
        body: "Each round lasts six seconds — tap instantly, there's no confirmation. Every player who votes with the majority gains a herd streak, and the streak resets the moment you break from the pack. Your final score is the number of rounds where you rode with the herd, out of 20. The leaderboard keeps your herd alignment for the day, so you can compare taste with the whole world.",
      },
      {
        heading: 'Tips to win',
        body: "Speed matters: vote in the first second and move on. There's no penalty for following the crowd — the game literally rewards it. If you want to beat your friends, learn their taste and bet against it: the herd is the majority, not your friends. And yes, pineapple on pizza is always the most controversial round.",
      },
      {
        heading: 'Why it works for parties',
        body: 'This or That is the perfect warm-up game: two minutes, everyone plays, and the arguments start immediately. It is one of the best free browser party games for large groups and classrooms — the fast pace keeps every player engaged, and the final scores create instant rivalries.',
      },
      {
        heading: 'Devices & requirements',
        body: 'Any modern browser, any device. The two-card layout is built for thumbs, so phones are the ideal way to play. No downloads, no accounts.',
      },
      {
        heading: 'Playing with friends',
        body: 'This or That is the ultimate warm-up game for a room: create a room, share the code, and everyone votes from their own phone in real time. Up to 24 players can join, and because rounds last six seconds, nobody waits and nobody gets bored — the game is over before the group chat finishes debating the first pair. The live bars make every vote visible, and the final herd-alignment scores create instant rivalries that carry into the next game of the night. It is also the easiest PartyBrain game to explain, which makes it perfect for mixed groups and classrooms. The two-minute runtime means you can run it twice in a row and compare scores.',
      },
    ],
    faqs: [
      {
        question: 'How long does a game last?',
        answer:
          'About two minutes — 20 rounds at six seconds each, plus a quick reveal at the end.',
      },
      {
        question: 'What is the herd streak?',
        answer:
          'Your streak grows every round your choice matches the majority and resets when you break from the pack. Your final score is your total herd alignment out of 20.',
      },
      {
        question: 'Can I play This or That with a big group?',
        answer:
          'Yes — rooms support up to 24 players, and the majority math gets juicier with every extra vote.',
      },
    ],
  },
  'rhyme-or-crime': {
    metaDescription:
      'Play Rhyme or Crime online free — type a word that rhymes with the prompt AND fits the category. A fast word game with streaks, speed bonuses, and daily scores.',
    sections: [
      {
        heading: 'How to play Rhyme or Crime',
        body: "Rhyme or Crime is a word game with a double rule: the answer must rhyme with the prompt word AND fit the category. The category is 'Fruits' and the prompt is 'witch'? Then 'peach' scores. Five rounds, 60 seconds each, and a streak multiplier that rewards quick, consistent thinking. It sounds easy until the timer is running and every word you know suddenly fails the rhyme test.",
      },
      {
        heading: 'Rules & scoring',
        body: 'A correct answer earns 10 points, plus a 5-point speed bonus when you answer in under 10 seconds. Consecutive correct answers build a streak: triple-streak doubles your points, and five in a row triples them. The categories span fruits, animals, countries, professions, body parts, colors, sports, and foods — with 160 curated prompt-and-answer sets, the game never repeats itself. Your best daily score lands on the leaderboard.',
      },
      {
        heading: 'Tips to win',
        body: "Scan the category before the prompt: preload a short list of category words and test each one against the rhyme in your head. Short words are your friends — 'keys', 'peas', 'bat' — because they rhyme with more things. Answer fast but don't guess blindly: a wrong answer breaks your streak and costs the multiplier, so a confident correct answer is worth more than a lucky one.",
      },
      {
        heading: 'Why it works for word lovers',
        body: 'Rhyme or Crime is one of the best free word games online for vocabulary buffs, classrooms, and anyone who loves wordplay. The daily leaderboard gives you a reason to come back every day, and the streak system makes each round feel like a personal challenge.',
      },
      {
        heading: 'Devices & requirements',
        body: 'A solo game that runs in any browser on any device — typing is easiest on a keyboard, but autofill-friendly input works on phones too. No downloads, no accounts.',
      },
      {
        heading: 'Playing solo — and sharing',
        body: 'Rhyme or Crime is a solo game with a social layer: every finished game can be saved to the daily leaderboard and turned into a shareable score image, so bragging rights travel beyond the browser. The per-game daily streak rewards coming back, and the five-round format is short enough to fit into a lunch break or a classroom warm-up. Since the prompts draw from eight categories and 160 curated sets, no two games feel the same, and the streak multiplier gives you a concrete reason to push for five in a row. Speed matters too — the sub-ten-second bonus rewards players who trust their first instinct.',
      },
    ],
    faqs: [
      {
        question: 'How does the streak multiplier work?',
        answer:
          'Three correct answers in a row doubles your points; five in a row triples them. A wrong answer resets the streak.',
      },
      {
        question: 'Is there a daily leaderboard?',
        answer:
          "Yes — your best score each day is saved to the game's daily leaderboard, and you can also share a score image with friends.",
      },
      {
        question: 'What categories are included?',
        answer:
          'Fruits, animals, countries, professions, body parts, colors, sports, and foods — each with a large bank of rhyming prompt-and-answer pairs.',
      },
    ],
  },
  'emoji-plot': {
    metaDescription:
      'Play Emoji Plot online free — decode movies and books from emoji sequences. Progressive hints, fuzzy answer matching, and a create-your-own challenge mode.',
    sections: [
      {
        heading: 'How to play Emoji Plot',
        body: "Emoji Plot turns famous stories into pictograms. 👦⚡🧙🏰 is Harry Potter; 🦁👑👦🌍 is The Lion King. Ten emoji sequences, 30 seconds each, and one job: type the title before the hints give it away. The year appears at 15 seconds and the first letter at 25, and every unanswered guess costs you points. It's the ultimate pop-culture speed round for movie buffs and bookworms.",
      },
      {
        heading: 'Rules & scoring',
        body: "A correct guess with no hints is worth 100 points; with the year hint, 50; with the first-letter hint, 25. Answer checking is forgiving on purpose: it ignores 'The', tolerates small typos, and accepts partial titles — 'harry potter' counts for 'Harry Potter and the Sorcerer's Stone.' The bank holds 210 movie and book plots, from blockbusters to classics, and the create-your-own mode lets you build a challenge link to send friends.",
      },
      {
        heading: 'Tips to win',
        body: "Name the most iconic element of the emoji set first — the lightning bolt, the crown, the rocket — and let it trigger the title. Type fast when you're confident: every second of hesitation risks the year hint cutting your score in half. If a sequence stumps you, wait for the year; decades narrow most films to a handful of candidates.",
      },
      {
        heading: 'Why it works for pop-culture fans',
        body: 'Emoji Plot is one of the most shareable free trivia games online — the puzzles make perfect group-chat content, and the create-your-own mode turns any movie night into a quiz. It works for classrooms as a literature recap and for parties as a rapid-fire trivia round.',
      },
      {
        heading: 'Devices & requirements',
        body: 'Any browser, any device. Typing works on phones with the on-screen keyboard, and the large emoji display is readable across the room. No downloads, no accounts.',
      },
      {
        heading: 'Playing solo — and sharing',
        body: 'Emoji Plot is built for solo play and for sharing. Every finished game lands on the daily leaderboard with a shareable score image, and the create-your-own mode generates a challenge link you can drop into any group chat — friends open it and try to beat your puzzle. The ten-question format takes about five minutes, and the progressive hints make every round winnable even when you are not a movie buff. The fuzzy answer matching means typos rarely cost you, which keeps the game friendly for casual players. The mix of movies and books also means there is something for every kind of pop-culture fan — the book rounds are sneaky favorites.',
      },
    ],
    faqs: [
      {
        question: 'Are movies and books included?',
        answer:
          'Yes — the bank of 210 plots mixes famous movies and classic books across decades and genres.',
      },
      {
        question: 'Can I create my own emoji plot?',
        answer:
          'Yes — after a game, the create-your-own tool builds a shareable challenge link with a hidden answer.',
      },
      {
        question: 'How forgiving is the answer checker?',
        answer:
          "Very — it ignores 'The', accepts typos within a couple of letters, and accepts partial titles like 'harry potter' for the full title.",
      },
    ],
  },
  'timeline-tussle': {
    metaDescription:
      'Play Timeline Tussle online free — put three historical events in the right order and score big. A fast history trivia game for classrooms and curious minds.',
    sections: [
      {
        heading: 'How to play Timeline Tussle',
        body: "Timeline Tussle is history trivia with a twist: you don't name dates, you order events. Three shuffled cards appear — 'Moon Landing (1969)', 'Fall of Berlin Wall (1989)', 'First iPhone (2007)' — and you tap them in the order you think they happened. Submit, get instant feedback, and learn something whether you're right or wrong. Five rounds, no timer pressure, and a scoring system that rewards near-misses.",
      },
      {
        heading: 'Rules & scoring',
        body: 'A perfect chronological order is worth 100 points. If exactly one pair is swapped but the third card is in place, you still earn 50. Completely wrong orders score zero — but the reveal shows the correct years, so every round teaches you something. The event bank spans 210 moments from ancient history to the modern day, including BCE dates, and no round repeats an event from a previous one.',
      },
      {
        heading: 'Tips to win',
        body: "Anchor each event to a decade you know: if you're sure about two cards, the third one falls into place. Watch for clue words in the event names — 'first', 'invention', 'fall of' — that hint at eras. When two events feel close, think about cause and effect: which one could have influenced the other? That logic beats raw date memorization every time.",
      },
      {
        heading: 'Why it works for classrooms',
        body: 'Timeline Tussle is one of the best free educational games online: it teaches chronology through play, works as a warm-up or a review activity, and its instant feedback makes every wrong answer a lesson. History fans will also find it genuinely hard to stop playing.',
      },
      {
        heading: 'Devices & requirements',
        body: 'Any browser, any device. The tap-to-order interface is built for touch screens, and the large event cards are readable on phones and projectors alike. No downloads, no accounts.',
      },
      {
        heading: 'Playing solo — and sharing',
        body: 'Timeline Tussle is a solo game that works as a group activity too: project it in a classroom and let teams argue each order before submitting. Solo players get the daily leaderboard and shareable score images, and the five-round format fits perfectly into a lesson period. Because every wrong answer reveals the correct years, the game teaches while it entertains — you never lose a round without learning something. The 210-event bank includes BCE dates, so even history buffs find new gaps in their knowledge, and the 50-point near-miss reward keeps close calls from feeling like failures. Either way, every round ends with a fact you will remember.',
      },
    ],
    faqs: [
      {
        question: 'How is scoring calculated?',
        answer:
          '100 points for the perfect order, 50 when exactly one pair is swapped, and 0 otherwise — with the correct years revealed after every submission.',
      },
      {
        question: 'Are ancient events included?',
        answer:
          'Yes — the bank includes BCE events like the invention of writing, so the game spans the full timeline of human history.',
      },
      {
        question: 'Is there a timer?',
        answer:
          'No — Timeline Tussle is a thinking game. Take your time, then submit when you are confident.',
      },
    ],
  },
  'price-is-right': {
    metaDescription:
      'Play Price Is Right online free — guess the real price of weird gadgets, luxury items, and everyday products. 500+ products, exact guesses score double.',
    sections: [
      {
        heading: 'How to play Price Is Right',
        body: 'Price Is Right — E-commerce Edition shows you a real product and asks the oldest question in shopping: what does it cost? A gold-plated paperclip, a self-stirring mug, a smart toaster — every round reveals a product photo and description, and you slide your price guess between $1 and $1,000. Lock it in, and the reveal shows the real price and exactly how far you were. Five rounds, 500+ products, and bragging rights for the closest guesser.',
      },
      {
        heading: 'Rules & scoring',
        body: 'Each correct-enough guess scores 100 minus two points per dollar of error, with a floor of zero — and an exact guess is worth a 200-point bonus. The price range runs from budget gadgets to luxury absurdities, so some rounds are about precision and others are about admitting you have no idea. Your total across five rounds lands on the daily leaderboard.',
      },
      {
        heading: 'Tips to win',
        body: "Anchor with the obvious: everyday items like toasters and kettles cluster in known ranges, while 'pro' gadgets rarely go cheap. Read the description for clues — 'handcrafted', 'titanium', and 'limited' all mean premium. When you have no idea, guess round numbers near the middle of the range; the scoring formula punishes wild swings more than small misses. And remember the slider and the number box stay in sync, so fine-tune with the keyboard.",
      },
      {
        heading: 'Why it works for groups',
        body: "Price Is Right is a natural party game: everyone has an opinion about prices, and the reveals always produce gasps — especially the absurd ones. It's one of the best free online trivia games for game nights and a fun economics warm-up for classrooms.",
      },
      {
        heading: 'Devices & requirements',
        body: 'Any browser, any device — the slider is touch-friendly, and the numeric input works with a keyboard for precision. Product photos are CC-licensed with credits shown under each image. No downloads, no accounts.',
      },
      {
        heading: 'Playing solo — and sharing',
        body: 'Price Is Right is a solo game with group energy: after five rounds, your score hits the daily leaderboard and you can share a score image that dares friends to beat it. The 500+ product bank means you never see the same round twice, and the mix of everyday items and absurd luxury goods keeps the reveals surprising. Because the guess range is $1 to $1,000, every round is winnable in theory and humbling in practice — the exact-guess double points are the ultimate flex. The product photos are real and CC-licensed, which makes each reveal feel like a tiny auction.',
      },
    ],
    faqs: [
      {
        question: 'How many products are in the game?',
        answer:
          'More than 500 curated products — weird gadgets, luxury items, and everyday household goods — with real CC-licensed photos.',
      },
      {
        question: 'What is the scoring formula?',
        answer:
          '100 minus twice the dollar error (minimum 0), with a 200-point bonus for an exact guess.',
      },
      {
        question: 'Can I guess above $1,000?',
        answer:
          'No — the guess range is $1 to $1,000. Some products are priced higher, which makes those rounds a test of humility.',
      },
    ],
  },
  'genre-swap': {
    metaDescription:
      'Play Genre Swap online free — famous movie plots rewritten in wildly wrong genres. Spot the original film from four options before the timer runs out.',
    sections: [
      {
        heading: 'How to play Genre Swap',
        body: "Genre Swap takes a beloved movie plot and rewrites it as something it absolutely should not be. Harry Potter as a gritty crime thriller where the headmaster is a corrupt cop? That's the game. Ten rewritten plots, 20 seconds each, and four options — pick the original movie before the clock runs out. The genre flips range from noir to rom-com, so every round is a double puzzle: decode the plot AND ignore the genre.",
      },
      {
        heading: 'Rules & scoring',
        body: 'Each question shows a genre-swapped description and four movie titles. A correct pick earns 10 points, plus a 5-point speed bonus when you answer in under 10 seconds. The bank holds 150 rewritten plots, and options are drawn fresh every round so the same movie rarely appears twice in a game. Your final score across ten questions is the whole story.',
      },
      {
        heading: 'Tips to win',
        body: "Translate the plot back to its original setting: mentally strip the swapped genre and ask what classic story has these characters and events. The rewrites keep the recognizable bones — a chosen-one orphan, a sunken ship, a haunted house — so listen for the skeleton. When two options both fit, pick the one whose plot matches the DESCRIPTION, not the title's fame.",
      },
      {
        heading: 'Why it works for movie buffs',
        body: 'Genre Swap is a love letter to cinema and one of the most creative free online trivia games for movie nights. It is also a brilliant classroom prompt for creative writing: students read a swapped plot, identify the original, and can even write their own swaps.',
      },
      {
        heading: 'Devices & requirements',
        body: 'Any browser, any device — the four-option layout fits phones perfectly. No downloads, no accounts, and every game is a fresh shuffle of the 150-plot bank.',
      },
      {
        heading: 'Playing solo — and sharing',
        body: 'Genre Swap works as a solo sprint or a group challenge. Solo players get the daily leaderboard and shareable score images, and the ten-question, four-minute format makes it easy to squeeze in a round between meetings or during a movie-night break. In a classroom, the swapped plots double as creative-writing prompts: students identify the original movie, then write their own genre swaps for classmates to solve. The 150-plot bank covers decades of cinema, so every game surfaces a movie you have not thought about in years — and the 20-second timer keeps even a full game feeling snappy. Either way, the reveals always spark conversation.',
      },
    ],
    faqs: [
      {
        question: 'Do the options include the real movie?',
        answer:
          'Yes — every question includes the correct original movie plus three distractors drawn from the bank.',
      },
      {
        question: 'How long is a game?',
        answer: 'Ten questions at 20 seconds each — under four minutes for a complete game.',
      },
      {
        question: 'Is movie knowledge required?',
        answer:
          "The plots are recognizable even from cultural osmosis, but movie buffs will naturally dominate — that's the fun.",
      },
    ],
  },
  'genre-bender': {
    metaDescription:
      'Play Genre-Bender online free — rap lyrics rewritten as Shakespearean sonnets. Name the song and artist behind the Bard-ified banger. Ten bended classics.',
    sections: [
      {
        heading: 'How to play Genre-Bender',
        body: "Genre-Bender takes a chart-topping song and rewrites it as Shakespeare. 'Doth thou possess the currency? I inquire most earnestly, for I dost wish to contact thee regarding thy canine' — that's a bended classic waiting to be named. Ten sonnet-ified lyrics, 20 seconds each, and four options pairing song titles with artists. Pick the original before the timer expires, and use the free year clue when the iambic pentameter defeats you.",
      },
      {
        heading: 'Rules & scoring',
        body: "Each question presents a 'bended' lyric and four title — artist options. A correct answer earns 10 points plus a 5-point speed bonus under 10 seconds. A year clue button reveals the release year with no penalty — it's a lifeline, not a tax. The 70-song bank spans pop, hip-hop, and rock classics, all paraphrased into original verse for licensing safety.",
      },
      {
        heading: 'Tips to win',
        body: "Translate the poetry back to slang: 'dost wish to contact thee regarding thy canine' becomes 'wanna call you about your dog.' The funniest benders are the most literal, so the answer is usually hiding in plain language. If the verse mentions a signature phrase — a title, a chorus hook — type it into your head before reading the options. And when stuck, take the year clue: it halves the field instantly.",
      },
      {
        heading: 'Why it works for music fans',
        body: "Genre-Bender is the most absurd entry in the free online trivia games lineup, and it is a guaranteed laugh for music lovers and English majors alike. It works for parties, classroom poetry units, and anyone who wants to hear a rap lyric say 'thou'.",
      },
      {
        heading: 'Devices & requirements',
        body: 'Any browser, any device. The lyric card is large and readable, and the four-option grid is thumb-friendly. No downloads, no accounts.',
      },
      {
        heading: 'Playing solo — and sharing',
        body: 'Genre-Bender is a solo game designed to be shared: finish a round, save your score to the daily leaderboard, and send the share image to the friend who claims to know every song ever written. The ten-question format takes about four minutes, and the free year clue keeps it approachable for casual music fans. In classrooms, the sonnet-ified lyrics are a sneaky poetry lesson — students translate Shakespeare back into slang and learn about form along the way. The 70-song bank spans decades, so there is always a bender you have not heard yet, and the absurd pairings guarantee at least one laugh per round. It is silly on purpose.',
      },
    ],
    faqs: [
      {
        question: 'Are these real lyrics?',
        answer:
          "The 'bends' are original paraphrases of each song's hook and story — written fresh for the game, so no copyrighted lyrics are reproduced.",
      },
      {
        question: 'What does the year clue do?',
        answer:
          'It reveals the song’s release year as a free hint — no score penalty, available once per question.',
      },
      {
        question: 'Do I need to know the artist too?',
        answer:
          "Yes — the correct option is the full 'title — artist' pair, but the title alone usually gives the pair away.",
      },
    ],
  },
  charades: {
    metaDescription:
      'Play Charades online free — act out Hollywood and Bollywood movie titles while the team shouts guesses. A 60-second pass-the-phone party classic, digitized.',
    sections: [
      {
        heading: 'How to play Charades',
        body: "PartyBrain Charades keeps the classic game exactly as it should be: one actor, one secret movie title, one very enthusiastic team. The actor's device shows the title in large letters — the team cannot see it. The actor mimes, the team shouts, and anyone taps 'Got it!' the moment the title is guessed. Each correct guess in the 60-second window earns the team a point, then the phone passes to the next actor. Hollywood, Bollywood, or Mixed — you pick the category before you start.",
      },
      {
        heading: 'Rules & scoring',
        body: 'The team earns one point per correct title guessed before the 60-second timer runs out. Timeouts score zero and rotate to the next actor anyway. Every player acts once per rotation, and the final team score is the total correct guesses. The movie bank holds 300 titles split between Hollywood and Bollywood — from Marvel blockbusters to Shah Rukh Khan classics.',
      },
      {
        heading: 'Tips to win',
        body: "Agree on signals before you start: the classic finger-count for syllables and the 'sounds like' ear-tug save rounds. Act the title, not the plot — the team needs the words, not the subtext. If a movie stumps you, mime a single iconic scene; one recognizable image beats five vague gestures. And keep the phone angled so the title stays hidden — the team will look.",
      },
      {
        heading: 'Why it works for co-located parties',
        body: 'Charades is the original party game, and the PartyBrain version is built for a single shared screen or pass-the-phone play — perfect for family gatherings, game nights, and classroom drama warm-ups. The Hollywood/Bollywood toggle makes it a hit across cultures.',
      },
      {
        heading: 'Devices & requirements',
        body: 'One device per room is enough — pass the phone between actors. Works in any browser on any device. The timer and scoreboard run automatically, so the only thing you manage is the acting.',
      },
      {
        heading: 'Playing with friends',
        body: 'Charades is built for co-located groups: one device can run the whole game as the phone passes between actors, or everyone can join the room from their own phones. The host picks Hollywood, Bollywood, or Mixed in the lobby, and the actor rotation makes sure everyone gets a turn with the secret title. Because the timer and scoreboard run automatically, the only real work is the acting — and the team scoring means everyone wins or loses together. For remote groups, the room mode works over a video call: the actor holds the phone up, everyone else guesses into the chat, and someone taps Got it!',
      },
    ],
    faqs: [
      {
        question: 'How many players do I need?',
        answer:
          'Two is enough to start — one actor and one guesser — and the game scales to any group size.',
      },
      {
        question: 'Can I choose Hollywood or Bollywood only?',
        answer:
          'Yes — the host picks Hollywood, Bollywood, or Mixed in the lobby before the game starts.',
      },
      {
        question: 'What happens if the timer runs out?',
        answer:
          'The round scores zero and the title is revealed, then the actor role passes to the next player.',
      },
    ],
  },
  'guess-who': {
    metaDescription:
      'Play Guess Who? online free — ask yes/no questions to identify the secret celebrity in just 20 tries. A deduction game for trivia and pop-culture fans.',
    sections: [
      {
        heading: 'How to play Guess Who? Celebrity Edition',
        body: "Guess Who? Celebrity Edition gives one player — the answerer — a secret celebrity and a full trait card: gender, alive or not, profession, nationality, age range, hair color, and what they're famous for. Everyone else asks yes/no questions — 'Are they alive?', 'Are they an actor?', 'Are they male?' — and the answerer clicks Yes or No. The question log grows, the counter ticks toward 20, and at any moment a player can type a name guess. Guess right and you win the round; burn all 20 questions and the secret is revealed.",
      },
      {
        heading: 'Rules & scoring',
        body: 'Only the answerer sees the celebrity and answers questions. Anyone else can ask a question or attempt a guess at any time. A correct guess — matched against the full name or last name, ignoring case and accents — ends the round immediately. After 20 answered questions with no correct guess, the celebrity is revealed and nobody scores. The bank holds 205 celebrities across music, film, sports, science, politics, and history.',
      },
      {
        heading: 'Tips to win',
        body: "Ask elimination questions, not identification questions: 'Are they alive?' halves the board; 'Are they in sports?' quarters it. Save your guess until the field is small — a wrong guess only costs a turn, but a right one wins the round, so go for it when you're down to two or three candidates. Answerers: be honest and fast; the yes/no rhythm is what makes the game tense.",
      },
      {
        heading: 'Why it works for trivia nights',
        body: 'Guess Who? is the thinking player’s party game — part 20 Questions, part pop-culture quiz, and one of the best free online trivia games for groups that like to strategize. It shines in classrooms as a critical-thinking exercise and at parties as the game that gets suspiciously competitive.',
      },
      {
        heading: 'Devices & requirements',
        body: 'Any browser, any device. The answerer’s trait card is large and readable, and questioners just type. No downloads, no accounts, and the host can deal a new celebrity instantly after every round.',
      },
      {
        heading: 'Playing with friends',
        body: 'Guess Who is a natural room game: create a room, share the code, and the host holds the secret while everyone else interrogates them. Up to 24 players can question and guess simultaneously, which makes the question log scroll fast and the tension build quickly. The 20-question cap keeps rounds tight — about five minutes each — so a game night can cycle through several celebrities. After a correct guess or the reveal, the host deals a fresh celebrity and the room goes again, making it one of the most replayable games on the site.',
      },
    ],
    faqs: [
      {
        question: 'Who gets to be the answerer?',
        answer:
          'The host holds the secret celebrity and answers questions. After the round, the host can deal a new celebrity to play again.',
      },
      {
        question: 'How many questions do we get?',
        answer:
          'Twenty answered questions. If nobody guesses correctly by then, the celebrity is revealed.',
      },
      {
        question: 'Can I guess at any time?',
        answer:
          "Yes — any non-answerer can type a name guess whenever they're confident. Correct guesses match the full name or last name.",
      },
    ],
  },
  trivia: {
    metaDescription:
      'Play Trivia online free — 500+ questions in five categories: solo daily challenges or a room race with Wrong Answers Only mode. Fastest correct answers win.',
    sections: [
      {
        heading: 'How to play Trivia',
        body: 'PartyBrain Trivia covers two ways to play. Solo: take on the daily challenge — the same 10 questions everyone else gets that day, 15 seconds each, with a speed bonus for fast answers and a global daily leaderboard to climb. With friends: join a room for a 10-question race where everyone answers the same questions and the fastest correct answer earns the most points, ending in a podium ceremony. Questions span General, Science, History, Pop Culture, and Sports.',
      },
      {
        heading: 'Rules & scoring',
        body: "Solo rounds score 100 points plus 10 per second remaining, so a lightning answer is worth up to 250. Room races give everyone the same 10-second clock, and each question's points depend on your speed. Wrong Answers Only mode flips the game into comedy: pick the most absurd WRONG answer to score, while answering correctly earns nothing. Scores persist to the leaderboards, and the daily challenge resets at midnight UTC.",
      },
      {
        heading: 'Tips to win',
        body: 'Read all four options before you commit — the fastest correct answers usually come from eliminating two instantly. In the room race, answer in the first two seconds: the speed bonus dwarfs the difference between correct and fast-correct. In Wrong Answers Only, resist the urge to be right and pick the option that would make your friends groan loudest. And play the daily challenge every day — streaks count.',
      },
      {
        heading: 'Why it works for everyone',
        body: 'Trivia is the most flexible game on PartyBrain: a solo daily ritual, a classroom review tool, a competitive room race, or a comedy mode for game nights. With 500+ questions across five categories, it is the definitive free online trivia game for groups and solo players alike.',
      },
      {
        heading: 'Devices & requirements',
        body: 'Any browser, any device. The four-option layout is built for thumbs, and the solo mode works entirely in your browser. No downloads, no accounts — just pick a nickname.',
      },
      {
        heading: 'Playing solo and with friends',
        body: 'Trivia covers both modes of play. Solo players get the daily challenge — the same ten questions as everyone else that day, with a speed-bonus scoring system and a global daily leaderboard — plus a per-game streak that rewards daily visits. In a room, up to 24 players race the same questions on the same ten-second clock, and the host can flip the lobby toggle to Wrong Answers Only for a comedy round. The room mode ends with a podium, and every score persists, so the daily leaderboard becomes a habit for competitive groups.',
      },
    ],
    faqs: [
      {
        question: 'What is the daily challenge?',
        answer:
          'Ten questions, the same for every player each UTC day, with a speed-bonus scoring system and a global daily leaderboard.',
      },
      {
        question: 'How does Wrong Answers Only work?',
        answer:
          'The host picks the mode in the lobby. Players score points for choosing an absurd wrong answer, while the correct answer scores zero.',
      },
      {
        question: 'What categories are included?',
        answer:
          'General knowledge, Science, History, Pop Culture, and Sports — 500+ questions in total, refreshed by the daily selection.',
      },
    ],
  },
};
