# Contributing to TriviaHub

> How engineers work in this repository (v2, 2026-08-04, regenerated against
> `docs/PRD.md`). Living document, propose changes via PR.

## Core Principles

1. **The PRD is the source of truth.** PRD §2 says "DO NOT DEVIATE" on the
   stack. Any proposed stack/architecture change requires a PRD amendment
   first, recorded in `docs/DECISIONS.md`.
2. **Correctness over speed.** Reviews are thorough.
3. **Small, reviewable changes.** One logical unit of work per PR.
4. **Build once, reuse everywhere (PRD §4).** New games configure the shared
   Room Engine / Drawing Canvas / Voting / Solo Template, never duplicate them.
5. **Server-authoritative.** Clients send intents; the server decides scores,
   guesses, votes, and timers. This is a correctness property.
6. **SEO & AdSense are engineering requirements.** Every page ships with its
   meta/OG/canonical/JSON-LD; content is original; placeholders stay
   commented until real IDs exist (PRD §6, §7).
7. **Documentation follows code.** Update `docs/PROJECT_STATE.md` with every
   PR; append `docs/DECISIONS.md` for architecture choices.

## Coding Standards

- **Language:** TypeScript strict everywhere (Astro islands, `/server`,
  scripts). No `any` without documented justification.
- **Formatting/Linting:** Prettier + ESLint (repo-level config). Run
  `pnpm format` / `pnpm lint` before pushing.
- **Validation:** every inbound boundary (REST body, socket payload, query
  param) is validated server-side. Malformed input is rejected and logged.
- **Socket events:** names and payloads come from the shared event constants
  (`src/lib/events.ts` ↔ `server/src/lib/events.ts`), never string literals
  invented inline. PRD §8.2 names are verbatim.
- **Tests:** new logic requires tests. See [TESTING_STRATEGY.md](docs/TESTING_STRATEGY.md).
- **Logging:** structured logs (pino) in the server; no `console.log` in
  committed code.
- **Content:** datasets must be public-domain/CC0/self-created (PRD §7, §13).
  New datasets need a licensing header + integrity test entry. If content
  might be copyrighted (lyrics, celebrity photos, scraped images), stop and
  flag it; it is a review blocker.

## Folder Conventions

```
src/pages/       Astro routes (file = route), /, /game/[slug], legal, /faq, /404, /500
src/islands/     React islands, room/, drawing/, voting/, solo/, trivia/
src/components/  Astro components, SEOHead, GameCard, FAQSection…
src/data/        Static JSON datasets (game content)
src/lib/         api client, socket client, event constants, game registry
server/src/      Express + Socket.io, routes/, socket/, engine/, lib/
server/prisma/   schema.prisma (PRD §8.3), migrations, seed
public/          robots.txt, sitemap.xml, _headers, assets
```

- Feature-first inside `src/islands/` and `server/src/`.
- Shared code lives once, copy-paste across games is a review blocker.

## Naming Rules

| Thing         | Convention                 | Example                                       |
| ------------- | -------------------------- | --------------------------------------------- |
| Game slugs    | PRD routes verbatim        | `skribbl-arena`, `price-is-right`             |
| Files/folders | kebab-case                 | `room-engine.ts`, `drawing-canvas.tsx`        |
| React islands | PascalCase                 | `SkribblArena.tsx`, `SoloGameTemplate.tsx`    |
| Socket events | PRD verbatim via constants | `draw-stroke`, `game-state-update`            |
| Prisma models | PRD §8.3 verbatim          | `RoomPlayer`, `DailyChallenge`                |
| Datasets      | snake_case JSON            | `skribbl-words.json`, `would-you-rather.json` |
| DB columns    | camelCase (Prisma default) | `playerName`, `playedAt`                      |
| Branches      | `type/scope`               | `feat/room-engine`, `feat/skribbl`            |
| PR titles     | Conventional Commits       | `feat(drawing): add canvas replay`            |

## Git Workflow

GitHub Flow with trunk-based principles:

1. `main` is always deployable and protected, no direct pushes.
2. Branch from `main`: `feat/<scope>`, `fix/<scope>`, `chore/<scope>`,
   `docs/<scope>`, `refactor/<scope>`, `test/<scope>`.
3. Small commits with Conventional Commits:
   `feat(drawing): add stroke replay for late joiners`.
4. Open a PR early (draft if incomplete); CI must pass: format → lint →
   typecheck → unit → integration → build (→ E2E + Lighthouse for UI/game PRs).
5. Squash-merge with a Conventional Commit message; delete the branch.

**Never** push to `main`, force-push shared branches, or rewrite history.

## Commit Style

- `type(scope): subject`, e.g., `feat(voting): live percentage bars`,
  `fix(engine): reject late guesses`, `docs(state): update project state after M4`.
- Imperative subject, ≤ 72 chars, lowercase; body explains **why**.
- Reference issues: `Closes #42`.

## Code Review Expectations

- ≥ 1 approving review from a maintainer for every PR.
- Reviewer checks: correctness, security, performance, test coverage, docs
  impact, **PRD conformance** (does this match PRD §5 specs / §8 contract?),
  licensing of new datasets, and shared-system reuse (no duplicated canvas/
  voting/room logic).
- Author responds to every comment. Green CI is necessary but not sufficient.

## Testing Expectations

- Unit tests for all scoring math, validation, and engine transitions.
- Integration tests for REST + sockets against a real DB (testcontainers).
- E2E journeys for every game added to the forever-green list.
- Dataset integrity tests for every new/modified dataset.
- No merges with failing tests; coverage regressions need justification.
- Full details: [TESTING_STRATEGY.md](docs/TESTING_STRATEGY.md).

## Documentation Expectations

- `docs/PROJECT_STATE.md` updated after every behavior-changing PR.
- `docs/DECISIONS.md` appended for architecture decisions (never edit history).
- `docs/TODO.md` tasks checked off as they land.
- SEO copy / user-facing text changes update the relevant page content and any
  referenced docs.
- "Docs required" is a valid review comment and a merge blocker.

## Getting Help

- Read `docs/DEVELOPMENT_GUIDE.md` first.
- Ask with: what you tried, the error, what you expect.
