# TriviaHub

**Free online party games, play instantly with friends. No downloads. No accounts.**

TriviaHub is a free online party games hub featuring **18 multiplayer and solo
games**: drawing games, trivia, word games, voting games, charades, and more.
Share a room link (or just open a game) and start playing in seconds, perfect
for virtual parties, classrooms, and remote teams.

> **Product spec:** [`docs/PRD.md`](docs/PRD.md) is the source of truth
> (stack is fixed, "DO NOT DEVIATE", PRD §2). All engineering docs below are
> aligned to it.

## The 18 Games

| Drawing             | Voting            | Solo            | Special / Quiz               |
| ------------------- | ----------------- | --------------- | ---------------------------- |
| Skribbl Arena       | Would You Rather  | Rhyme or Crime  | Trivia (solo or room)        |
| Copycat Challenge   | Most Likely To…   | Emoji Plot      | Charades                     |
| Draw the Lyric      | Never Have I Ever | Timeline Tussle | Guess Who? Celebrity Edition |
| One Line, One Shape | This or That      | Price Is Right  |                              |
| Shadow Sketch       |                   | Genre Swap      |                              |
|                     |                   | Genre-Bender    |                              |

## Third-party engine licenses

- **chess.js** (MIT) powers move legality and rules in the Chess vs CPU game.
- **Stockfish** (GPLv3) is the CPU opponent, compiled to WebAssembly and
  self-hosted in `public/stockfish/` (loaded only when a game starts). Its
  license and source are at <https://github.com/official-stockfish>; the game
  page credits the engine under the board.

## Tech Stack (per PRD §2, DO NOT DEVIATE)

- **Frontend:** Astro v5 (MPA, static export) + React islands + Tailwind CSS v4
- **Backend:** Node.js + Express.js + Socket.io (`/server`)
- **Database:** PostgreSQL + Prisma ORM
- **Hosting:** Cloudflare Pages (frontend) + Railway/Render (backend)
- **Language:** TypeScript strict everywhere · pnpm preferred

## Repo Layout

```
triviahub/
├── src/                 # Astro app
│   ├── pages/           # /, /game/[18 slugs], legal pages, /faq, /404, /500
│   ├── islands/         # React islands: room/ · drawing/ · voting/ · solo/ · trivia/
│   ├── components/      # Astro components (SEOHead, GameCard, FAQSection…)
│   ├── data/            # Static game datasets (JSON)
│   └── lib/             # api client, socket client, event constants, game registry
├── server/              # Express + Socket.io backend + Prisma
├── public/              # robots.txt, sitemap.xml, _headers, assets
└── docs/                # Engineering documentation
```

## Documentation

- [PRD.md](docs/PRD.md), product requirements (source of truth)
- [ARCHITECTURE.md](docs/ARCHITECTURE.md), system design
- [API.md](docs/API.md), REST + Socket.io API reference
- [PROJECT_STATE.md](docs/PROJECT_STATE.md), project memory (read first)
- [TODO.md](docs/TODO.md), milestone roadmap
- [DECISIONS.md](docs/DECISIONS.md), decision log (append-only)
- [TESTING_STRATEGY.md](docs/TESTING_STRATEGY.md), testing approach
- [DEVELOPMENT_GUIDE.md](docs/DEVELOPMENT_GUIDE.md), setup & workflows
- [CONTRIBUTING.md](CONTRIBUTING.md), contribution standards

## Status

| Phase                                         | State                                       |
| --------------------------------------------- | ------------------------------------------- |
| PRD                                           | ✅ Complete (`docs/PRD.md`)                 |
| Engineering foundation (docs v2, PRD-aligned) | ✅ Complete                                 |
| M1, Astro MPA Scaffold                        | ✅ Complete (verified: `pnpm verify` green) |
| M2, Design System + Global Shell              | ⏳ Next milestone                           |

## Setup (M1+)

```bash
pnpm install       # workspace install (Astro app + @triviahub/server)
pnpm dev           # Astro dev server → http://localhost:4321
pnpm --filter @triviahub/server dev   # Express + Socket.io → http://localhost:3000
```

Requires Node 22.12+, pnpm 11+, and Docker for local PostgreSQL. See
[DEVELOPMENT_GUIDE.md](docs/DEVELOPMENT_GUIDE.md) for the full setup,
including the database and deployment.

## Open Questions

Product decisions still needing owner confirmation (design system
contradiction, lyrics licensing, remote Charades, and more) are tracked in
[PROJECT_STATE.md](docs/PROJECT_STATE.md#open-product-questions).
