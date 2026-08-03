import { randomInt } from 'node:crypto';

/**
 * Copycat Challenge session engine (PRD §5.4) — transport-agnostic.
 * Unique among the drawing games: NO shared canvas and NO guessing. A famous
 * image flashes for 5s, every player draws it from memory on their own
 * private canvas (90s), the gallery is revealed, and the room votes for the
 * Most Recognizable / Funniest / Most Abstract drawing.
 *
 * Phases: idle → image-reveal → drawing → gallery → voting → results.
 * Timers (5s reveal, 90s draw, 30s vote) are owned by the gateway.
 */

export const COPYCAT_REVEAL_MS = 5_000;
export const COPYCAT_DRAW_MS = 90_000;
export const COPYCAT_VOTE_MS = 30_000;
/** dataURL length cap — private canvases are uploaded as PNG data URLs. */
export const COPYCAT_MAX_IMAGE_CHARS = 400_000;

export type CopycatPhase = 'idle' | 'image-reveal' | 'drawing' | 'gallery' | 'voting' | 'results';

export type CopycatAward = 'recognizable' | 'funniest' | 'abstract';

export const COPYCAT_AWARDS: CopycatAward[] = ['recognizable', 'funniest', 'abstract'];

export type CopycatError =
  | 'NOT_STARTED'
  | 'ALREADY_STARTED'
  | 'NOT_PLAYER'
  | 'WRONG_PHASE'
  | 'IMAGE_TOO_LARGE'
  | 'INVALID_VOTE'
  | 'ALREADY_VOTED'
  | 'CANNOT_VOTE_SELF';

export type CopycatResult<T = unknown> =
  { ok: true; value: T } | { ok: false; error: CopycatError };

export interface CopycatImage {
  title: string;
  url: string;
  kind: 'painting' | 'photo';
}

export interface CopycatAwardResult {
  category: CopycatAward;
  winner: string | null;
  votes: { playerName: string; count: number }[];
}

interface PlayerState {
  name: string;
  drawing: string | null;
  votes: Partial<Record<CopycatAward, string>>;
}

export class CopycatSession {
  private readonly images: CopycatImage[];
  private readonly randomIntFn: (max: number) => number;
  private readonly nowFn: () => number;

  private phase: CopycatPhase = 'idle';
  private players: PlayerState[] = [];
  private image: CopycatImage | null = null;
  private imageRevealedAt: number | null = null;
  private drawingStartedAt: number | null = null;
  private votingStartedAt: number | null = null;
  private startedAt = 0;

  constructor(
    images: CopycatImage[],
    options: { randomInt?: (max: number) => number; now?: () => number } = {}
  ) {
    this.images = images;
    this.randomIntFn = options.randomInt ?? ((max) => randomInt(max));
    this.nowFn = options.now ?? (() => Date.now());
  }

  get phaseValue(): CopycatPhase {
    return this.phase;
  }

  get currentImage(): CopycatImage | null {
    return this.image;
  }

  get startedTimestamp(): number {
    return this.startedAt;
  }

  get drawingStartedAtValue(): number | null {
    return this.drawingStartedAt;
  }

  get playerNames(): string[] {
    return this.players.map((player) => player.name);
  }

  /** Submitted drawings keyed by player name (gallery + resync). */
  get drawings(): { playerName: string; image: string }[] {
    return this.players
      .filter((player) => player.drawing !== null)
      .map((player) => ({ playerName: player.name, image: player.drawing! }));
  }

  get allDrawingsSubmitted(): boolean {
    return this.players.every((player) => player.drawing !== null);
  }

  get allVotesCast(): boolean {
    return this.players.every((player) =>
      COPYCAT_AWARDS.every((award) => player.votes[award] !== undefined)
    );
  }

  /** Awards after finish(); null until then. */
  private awards: CopycatAwardResult[] | null = null;

  get finalAwards(): CopycatAwardResult[] | null {
    return this.awards;
  }

  start(playerNames: string[]): CopycatResult<{ image: CopycatImage }> {
    if (this.phase !== 'idle') {
      return { ok: false, error: 'ALREADY_STARTED' };
    }
    const names = [...new Set(playerNames.map((name) => name.trim()))].filter(
      (name) => name.length > 0
    );
    if (names.length === 0) {
      return { ok: false, error: 'NOT_PLAYER' };
    }
    if (names.length > 24) {
      return { ok: false, error: 'NOT_PLAYER' };
    }
    this.players = names.map((name) => ({ name, drawing: null, votes: {} }));
    const image = this.images[this.randomIntFn(this.images.length)];
    if (!image) {
      return { ok: false, error: 'NOT_STARTED' };
    }
    this.image = image;
    this.imageRevealedAt = this.nowFn();
    this.startedAt = this.imageRevealedAt;
    this.phase = 'image-reveal';
    return { ok: true, value: { image } };
  }

  /** Gateway timer: 5s reveal ends → private drawing begins (90s). */
  beginDrawing(): CopycatResult<{ drawingStartedAt: number }> {
    if (this.phase !== 'image-reveal') {
      return { ok: false, error: 'WRONG_PHASE' };
    }
    this.drawingStartedAt = this.nowFn();
    this.phase = 'drawing';
    return { ok: true, value: { drawingStartedAt: this.drawingStartedAt } };
  }

  /** Upload a private canvas as a data URL (gallery source). */
  submitDrawing(
    playerName: string,
    image: string
  ): CopycatResult<{ submitted: boolean; allSubmitted: boolean }> {
    if (this.phase !== 'drawing') {
      return { ok: false, error: 'WRONG_PHASE' };
    }
    const player = this.players.find((p) => p.name === playerName);
    if (!player) {
      return { ok: false, error: 'NOT_PLAYER' };
    }
    if (typeof image !== 'string' || image.length === 0 || image.length > COPYCAT_MAX_IMAGE_CHARS) {
      return { ok: false, error: 'IMAGE_TOO_LARGE' };
    }
    player.drawing = image;
    return { ok: true, value: { submitted: true, allSubmitted: this.allDrawingsSubmitted } };
  }

  /** Gallery → voting phase (gateway timer: 90s or all submitted). Solo
   * rooms (a testing affordance) reach voting with a single drawing — the
   * self-vote guard already keeps the solo player from casting. */
  beginVoting(): CopycatResult<{ startedAt: number }> {
    if (this.phase !== 'drawing') {
      return { ok: false, error: 'WRONG_PHASE' };
    }
    if (this.drawings.length < 1) {
      return { ok: false, error: 'NOT_PLAYER' };
    }
    this.votingStartedAt = this.nowFn();
    this.phase = 'voting';
    return { ok: true, value: { startedAt: this.votingStartedAt } };
  }

  /**
   * Vote for another player's drawing in one of the three award categories.
   * One vote per category per player; self-votes are rejected.
   */
  submitVote(
    playerName: string,
    category: CopycatAward,
    target: string
  ): CopycatResult<{ allVoted: boolean }> {
    if (this.phase !== 'voting') {
      return { ok: false, error: 'WRONG_PHASE' };
    }
    const player = this.players.find((p) => p.name === playerName);
    if (!player) {
      return { ok: false, error: 'NOT_PLAYER' };
    }
    if (!COPYCAT_AWARDS.includes(category)) {
      return { ok: false, error: 'INVALID_VOTE' };
    }
    if (target === playerName) {
      return { ok: false, error: 'CANNOT_VOTE_SELF' };
    }
    if (!this.players.some((p) => p.name === target)) {
      return { ok: false, error: 'INVALID_VOTE' };
    }
    if (player.votes[category] !== undefined) {
      return { ok: false, error: 'ALREADY_VOTED' };
    }
    player.votes[category] = target;
    return { ok: true, value: { allVoted: this.allVotesCast } };
  }

  /** Tally one category (live vote-update) or all three (final awards). */
  tally(category: CopycatAward): { playerName: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const player of this.players) {
      const target = player.votes[category];
      if (target) {
        counts.set(target, (counts.get(target) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .map(([playerName, count]) => ({ playerName, count }))
      .sort((a, b) => b.count - a.count);
  }

  /** End voting → awards ceremony results. */
  finish(): CopycatResult<{ awards: CopycatAwardResult[] }> {
    if (this.phase !== 'voting') {
      return { ok: false, error: 'WRONG_PHASE' };
    }
    const awards: CopycatAwardResult[] = COPYCAT_AWARDS.map((category) => {
      const votes = this.tally(category);
      return { category, winner: votes[0]?.count ? votes[0].playerName : null, votes };
    });
    this.awards = awards;
    this.phase = 'results';
    return { ok: true, value: { awards } };
  }
}
