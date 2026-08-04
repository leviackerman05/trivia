import { randomInt } from 'node:crypto';

/**
 * Charades session engine (M9, PRD §5.12), transport-agnostic, co-located
 * play. Rounds rotate the actor (pass-the-phone); the actor's device shows
 * the secret movie title; anyone can press "Correct!" when the team shouts
 * it (self-policed party game); the 60s timer auto-advances with 0 points.
 * Scoring: the team earns +1 per correct guess in time.
 *
 * Phases: idle → acting → … → game-end. The category (hollywood / bollywood
 * / mixed) is chosen by the host at setup; the movie list is filtered and
 * the title is sent ONLY to the actor's device (D023).
 */

export type CharadesPhase = 'idle' | 'acting' | 'game-end';
export type CharadesCategory = 'hollywood' | 'bollywood' | 'mixed';

export type CharadesError =
  'NOT_STARTED' | 'ALREADY_STARTED' | 'NOT_PLAYER' | 'WRONG_PHASE' | 'INVALID_CATEGORY';

export type CharadesResult<T = unknown> =
  { ok: true; value: T } | { ok: false; error: CharadesError };

export interface CharadesMovie {
  title: string;
  category: 'hollywood' | 'bollywood';
}

export interface CharadesConfig {
  roundMs: number;
}

interface PlayerState {
  name: string;
}

export class CharadesSession {
  private readonly movies: CharadesMovie[];
  private readonly config: CharadesConfig;
  private readonly randomIntFn: (max: number) => number;

  private phase: CharadesPhase = 'idle';
  private players: PlayerState[] = [];
  private rotationIndex = 0;
  private roundNumber = 0;
  private totalRounds = 0;
  private startedAt = 0;
  private category: CharadesCategory = 'mixed';
  private movie: CharadesMovie | null = null;
  private actorName: string | null = null;
  private teamScore = 0;

  constructor(
    movies: CharadesMovie[],
    config: CharadesConfig,
    options: { randomInt?: (max: number) => number } = {}
  ) {
    this.movies = movies;
    this.config = config;
    this.randomIntFn = options.randomInt ?? ((max) => randomInt(max));
  }

  get phaseValue(): CharadesPhase {
    return this.phase;
  }

  get currentRound(): number {
    return this.roundNumber;
  }

  get totalRoundsValue(): number {
    return this.totalRounds;
  }

  get currentActor(): string | null {
    return this.actorName;
  }

  get currentMovie(): CharadesMovie | null {
    return this.movie;
  }

  get scoreValue(): number {
    return this.teamScore;
  }

  get categoryValue(): CharadesCategory {
    return this.category;
  }

  get startedTimestamp(): number {
    return this.startedAt;
  }

  start(
    playerNames: string[],
    category: CharadesCategory
  ): CharadesResult<{ totalRounds: number }> {
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
    if (category !== 'hollywood' && category !== 'bollywood' && category !== 'mixed') {
      return { ok: false, error: 'INVALID_CATEGORY' };
    }
    this.players = names.map((name) => ({ name }));
    this.category = category;
    // Pass-the-phone: every player acts once, then the rotation repeats.
    this.totalRounds = Math.max(1, names.length);
    this.startedAt = Date.now();
    this.beginRound();
    return { ok: true, value: { totalRounds: this.totalRounds } };
  }

  /** Anyone can press Correct! (co-located, self-policed). */
  markCorrect(_playerName: string): CharadesResult<{ score: number; finished: boolean }> {
    if (this.phase !== 'acting') {
      return { ok: false, error: 'WRONG_PHASE' };
    }
    this.teamScore += 1;
    return {
      ok: true,
      value: { score: this.teamScore, finished: this.roundNumber >= this.totalRounds },
    };
  }

  /** Timeout or after a correct answer: rotate to the next actor. */
  next(): CharadesResult<{ finished: boolean }> {
    if (this.phase !== 'acting') {
      return { ok: false, error: 'WRONG_PHASE' };
    }
    if (this.roundNumber >= this.totalRounds) {
      this.phase = 'game-end';
      return { ok: true, value: { finished: true } };
    }
    this.beginRound();
    return { ok: true, value: { finished: false } };
  }

  endPayload(): unknown {
    return {
      kind: 'charades',
      category: this.category,
      rounds: this.roundNumber,
      score: this.teamScore,
      winner: this.teamScore > 0 ? 'The team' : null,
    };
  }

  private beginRound(): void {
    this.roundNumber += 1;
    const actor = this.players[this.rotationIndex % this.players.length];
    if (!actor) {
      this.phase = 'game-end';
      return;
    }
    this.rotationIndex += 1;
    this.actorName = actor.name;
    const pool =
      this.category === 'mixed'
        ? this.movies
        : this.movies.filter((movie) => movie.category === this.category);
    this.movie = pool[this.randomIntFn(pool.length)] ?? null;
    this.phase = 'acting';
  }
}
