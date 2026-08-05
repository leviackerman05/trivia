import { randomInt } from 'node:crypto';

/**
 * Guess Who? Celebrity Edition session engine (M9/M17, PRD §5.17, owner
 * redesign 2026-08-06): NOBODY holds the secret name — not even the host.
 * Every player sees the celebrity's traits + facts, a 60s round timer runs,
 * letters of the name reveal progressively (Skribbl-style), and anyone can
 * guess the name (the server verifies). A correct guess scores +1 and
 * reveals the celebrity WITH fun facts (M17); the host advances to the next
 * round. 5 rounds, then the highest scorer wins. Timeout → reveal without a
 * winner.
 *
 * Phases: idle → questioning → revealed → … → game-end.
 */

export type GuessWhoPhase = 'idle' | 'questioning' | 'revealed' | 'game-end';

export type GuessWhoError =
  'NOT_STARTED' | 'ALREADY_STARTED' | 'NOT_PLAYER' | 'WRONG_PHASE' | 'INVALID_INPUT';

export type GuessWhoResult<T = unknown> =
  { ok: true; value: T } | { ok: false; error: GuessWhoError };

/** D064 (GUESS-WHO-DESIGN §2): market of fame, NOT nationality. */
export type CelebrityRegion = 'bollywood' | 'hollywood' | 'row';

/** D064 (GUESS-WHO-DESIGN §2): primary fame domain, exactly one (closed 12). */
export type CelebrityGenre =
  | 'music'
  | 'cinema'
  | 'television'
  | 'sports'
  | 'politics'
  | 'business'
  | 'science'
  | 'technology'
  | 'literature'
  | 'internet'
  | 'art-fashion'
  | 'royalty';

export interface Celebrity {
  name: string;
  gender: 'm' | 'f';
  alive: boolean;
  profession: string;
  nationality: string;
  ageRange: string;
  hairColor: string;
  famousFor: string;
  /** M17, fun facts revealed after the round (more movies, awards, trivia). */
  facts: string[];
  /** D064, server-internal balance metadata (never sent to players). Optional
   * until the L12 backfill lands; the deck builder treats missing region as
   * 'row' and missing difficulty as tier 1. */
  region?: CelebrityRegion;
  genre?: CelebrityGenre;
  difficulty?: 1 | 2 | 3;
}

export const GUESS_WHO_TOTAL_ROUNDS = 5;
/** Owner redesign: one timed round per celebrity, Skribbl-style. */
export const GUESS_WHO_ROUND_MS = 60_000;
/** Letter reveal schedule: first letters of each word now, then more of the
 * name at these round offsets (monotonic — letters never un-reveal). */
export const GUESS_WHO_HINT_1_MS = 20_000;
export const GUESS_WHO_HINT_2_MS = 40_000;
export const GUESS_WHO_REVEAL_LETTERS_1 = 0.4;
export const GUESS_WHO_REVEAL_LETTERS_2 = 0.7;

export class GuessWhoSession {
  private readonly celebrities: Celebrity[];
  private readonly randomIntFn: (max: number) => number;
  private readonly pickMode: 'random' | 'sequential';

  private phase: GuessWhoPhase = 'idle';
  private players: { name: string }[] = [];
  private celebrity: Celebrity | null = null;
  private winnerName: string | null = null;
  private roundStartedAt = 0;
  private roundNumber = 0;
  private totalRounds = GUESS_WHO_TOTAL_ROUNDS;
  private scores = new Map<string, number>();

  constructor(
    celebrities: Celebrity[],
    options: {
      randomInt?: (max: number) => number;
      /** D064: 'sequential' consumes a pre-shuffled deck in order (repeat-free,
       * deterministic); 'random' is the legacy per-round random pick. */
      pickMode?: 'random' | 'sequential';
    } = {}
  ) {
    this.celebrities = celebrities;
    this.randomIntFn = options.randomInt ?? ((max) => randomInt(max));
    this.pickMode = options.pickMode ?? 'random';
  }

  get phaseValue(): GuessWhoPhase {
    return this.phase;
  }

  /** The current celebrity (name + traits). The name NEVER leaves the server
   * during questioning — only the traits go out (see toWireClue). */
  get secretCelebrity(): Celebrity | null {
    return this.celebrity;
  }

  get winnerValue(): string | null {
    return this.winnerName;
  }

  get currentRound(): number {
    return this.roundNumber;
  }

  get totalRoundsValue(): number {
    return this.totalRounds;
  }

  /** M17, running scores (guesser +1 per correct guess). */
  get scoreTable(): { playerName: string; score: number }[] {
    return [...this.scores.entries()]
      .map(([playerName, score]) => ({ playerName, score }))
      .sort((a, b) => b.score - a.score || a.playerName.localeCompare(b.playerName));
  }

  start(playerNames: string[]): GuessWhoResult<{ celebrity: Celebrity }> {
    if (this.phase !== 'idle') {
      return { ok: false, error: 'ALREADY_STARTED' };
    }
    const names = [...new Set(playerNames.map((name) => name.trim()))].filter(
      (name) => name.length > 0
    );
    if (names.length === 0) {
      return { ok: false, error: 'NOT_PLAYER' };
    }
    this.players = names.map((name) => ({ name }));
    this.roundNumber = 0;
    this.beginRound();
    return { ok: true, value: { celebrity: this.celebrity! } };
  }

  /**
   * A guess from any player. Accepted when the normalized guess equals the
   * celebrity's full name OR their last name (accents/“the” ignored).
   * Correct → +1 for the guesser and the round reveals (M17: multi-round).
   */
  submitGuess(
    playerName: string,
    guess: string
  ): GuessWhoResult<{ correct: boolean; finished: boolean }> {
    if (this.phase !== 'questioning') {
      return { ok: false, error: 'WRONG_PHASE' };
    }
    if (!this.players.some((player) => player.name === playerName)) {
      return { ok: false, error: 'NOT_PLAYER' };
    }
    if (!this.celebrity) {
      return { ok: false, error: 'NOT_STARTED' };
    }
    const normalizedGuess = normalize(guess);
    const fullName = normalize(this.celebrity.name);
    const lastName = fullName.split(' ').at(-1) ?? '';
    const correct =
      normalizedGuess === fullName || (lastName.length >= 3 && normalizedGuess === lastName);
    if (correct) {
      this.winnerName = playerName;
      this.scores.set(playerName, (this.scores.get(playerName) ?? 0) + 1);
      this.phase = 'revealed';
      return {
        ok: true,
        value: { correct: true, finished: this.roundNumber >= this.totalRounds },
      };
    }
    return { ok: true, value: { correct: false, finished: false } };
  }

  /** Owner redesign: the round timer expired without a correct guess. */
  revealOnTimeout(): GuessWhoResult<{ finished: boolean }> {
    if (this.phase !== 'questioning') {
      return { ok: false, error: 'WRONG_PHASE' };
    }
    this.winnerName = null;
    this.phase = 'revealed';
    return { ok: true, value: { finished: this.roundNumber >= this.totalRounds } };
  }

  /** M17, host advances after the reveal: next round or game end. */
  next(): GuessWhoResult<{ finished: boolean }> {
    if (this.phase !== 'revealed') {
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
    const top = this.scoreTable[0];
    return {
      kind: 'guess-who',
      celebrity: this.celebrity
        ? { name: this.celebrity.name, famousFor: this.celebrity.famousFor }
        : null,
      winner: top && top.score > 0 ? top.playerName : null,
      scores: this.scoreTable,
      rounds: this.roundNumber,
    };
  }

  /**
   * Skribbl-style name pattern: letters hidden as “_”, spaces/punctuation
   * always visible. Monotonic reveal schedule:
   *   0s       → the first letter of every word
   *   ≥ 20s    → first 40% of the letters (plus the word-first letters)
   *   ≥ 40s    → first 70% of the letters (plus the word-first letters)
   * The full name only appears in the reveal payload, never in a pattern.
   */
  namePatternAt(now: number): string {
    if (!this.celebrity || this.phase === 'idle') {
      return '';
    }
    const elapsed = Math.max(0, now - this.roundStartedAt);
    const chars = [...this.celebrity.name];
    const letterIndexes = chars
      .map((char, index) => ({ char, index }))
      .filter(({ char }) => /[a-z0-9]/i.test(char));
    // The first letter of every word (the always-visible base hint).
    const firstOfWord = new Set<number>();
    for (let index = 0; index < chars.length; index += 1) {
      const prev = index > 0 ? (chars[index - 1] ?? '') : ' ';
      if (/[a-z0-9]/i.test(chars[index]!) && !/[a-z0-9]/i.test(prev)) {
        firstOfWord.add(index);
      }
    }
    let revealCount = 0;
    if (elapsed >= GUESS_WHO_HINT_2_MS) {
      revealCount = Math.ceil(letterIndexes.length * GUESS_WHO_REVEAL_LETTERS_2);
    } else if (elapsed >= GUESS_WHO_HINT_1_MS) {
      revealCount = Math.ceil(letterIndexes.length * GUESS_WHO_REVEAL_LETTERS_1);
    }
    const revealed = new Set<number>(firstOfWord);
    for (const { index } of letterIndexes.slice(0, revealCount)) {
      revealed.add(index);
    }
    return chars
      .map((char, index) => (revealed.has(index) ? char : /[a-z0-9]/i.test(char) ? '_' : char))
      .join('');
  }

  private beginRound(): void {
    this.roundNumber += 1;
    this.winnerName = null;
    this.roundStartedAt = Date.now();
    // D064: sequential consumes the pre-shuffled deck in order — random-looking
    // but repeat-free and deterministic per deck. The legacy path picks per
    // round via the injected randomIntFn (the 205-pool behavior, untouched).
    const celebrity =
      this.pickMode === 'sequential'
        ? this.celebrities[(this.roundNumber - 1) % this.celebrities.length]
        : this.celebrities[this.randomIntFn(this.celebrities.length)];
    if (!celebrity) {
      this.phase = 'game-end';
      return;
    }
    this.celebrity = celebrity;
    this.phase = 'questioning';
  }
}

/** Lowercase, strip accents/punctuation (mirrors the client's normalize). */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
