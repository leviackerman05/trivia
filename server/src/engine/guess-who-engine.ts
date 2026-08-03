import { randomInt } from 'node:crypto';

/**
 * Guess Who? Celebrity Edition session engine (M9, PRD §5.17) —
 * transport-agnostic. The answerer (host) holds a secret celebrity with
 * trait objects; everyone else asks yes/no questions (the ANSWERER judges
 * the answer — the traits help), sees the question log, and can guess the
 * name at any time. 20-question cap → reveal. A correct guess ends the
 * round with the guesser as the winner.
 *
 * Phases: idle → questioning → game-end (single round per game; restart
 * deals a new celebrity).
 */

export type GuessWhoPhase = 'idle' | 'questioning' | 'game-end';

export type GuessWhoError =
  | 'NOT_STARTED'
  | 'ALREADY_STARTED'
  | 'NOT_PLAYER'
  | 'WRONG_PHASE'
  | 'NOT_ANSWERER'
  | 'QUESTION_LIMIT'
  | 'INVALID_INPUT';

export type GuessWhoResult<T = unknown> =
  { ok: true; value: T } | { ok: false; error: GuessWhoError };

export interface Celebrity {
  name: string;
  gender: 'm' | 'f';
  alive: boolean;
  profession: string;
  nationality: string;
  ageRange: string;
  hairColor: string;
  famousFor: string;
}

export interface QuestionEntry {
  playerName: string;
  question: string;
  answer: boolean | null; // null until the answerer responds
  at: number;
}

export const GUESS_WHO_MAX_QUESTIONS = 20;

export class GuessWhoSession {
  private readonly celebrities: Celebrity[];
  private readonly randomIntFn: (max: number) => number;

  private phase: GuessWhoPhase = 'idle';
  private players: { name: string }[] = [];
  private answererName: string | null = null;
  private celebrity: Celebrity | null = null;
  private questions: QuestionEntry[] = [];
  private winnerName: string | null = null;
  private startedAt = 0;

  constructor(celebrities: Celebrity[], options: { randomInt?: (max: number) => number } = {}) {
    this.celebrities = celebrities;
    this.randomIntFn = options.randomInt ?? ((max) => randomInt(max));
  }

  get phaseValue(): GuessWhoPhase {
    return this.phase;
  }

  get answerer(): string | null {
    return this.answererName;
  }

  /** The secret celebrity — ONLY ever sent to the answerer's device (D023). */
  get secretCelebrity(): Celebrity | null {
    return this.celebrity;
  }

  get questionLog(): QuestionEntry[] {
    return [...this.questions];
  }

  get questionCount(): number {
    return this.questions.filter((entry) => entry.answer !== null).length;
  }

  get winnerValue(): string | null {
    return this.winnerName;
  }

  get startedTimestamp(): number {
    return this.startedAt;
  }

  get maxQuestions(): number {
    return GUESS_WHO_MAX_QUESTIONS;
  }

  start(playerNames: string[], answererName: string): GuessWhoResult<{ celebrity: Celebrity }> {
    if (this.phase !== 'idle') {
      return { ok: false, error: 'ALREADY_STARTED' };
    }
    const names = [...new Set(playerNames.map((name) => name.trim()))].filter(
      (name) => name.length > 0
    );
    if (names.length === 0) {
      return { ok: false, error: 'NOT_PLAYER' };
    }
    if (!names.includes(answererName)) {
      return { ok: false, error: 'NOT_ANSWERER' };
    }
    this.players = names.map((name) => ({ name }));
    this.answererName = answererName;
    const celebrity = this.celebrities[this.randomIntFn(this.celebrities.length)];
    if (!celebrity) {
      return { ok: false, error: 'NOT_STARTED' };
    }
    this.celebrity = celebrity;
    this.startedAt = Date.now();
    this.phase = 'questioning';
    return { ok: true, value: { celebrity } };
  }

  /** Anyone except the answerer asks a yes/no question (solo rooms excepted
   * — with one player the answerer is also the questioner, a testing
   * affordance, D026). */
  askQuestion(playerName: string, question: string): GuessWhoResult<{ number: number }> {
    if (this.phase !== 'questioning') {
      return { ok: false, error: 'WRONG_PHASE' };
    }
    if (playerName === this.answererName && this.players.length > 1) {
      return { ok: false, error: 'NOT_ANSWERER' };
    }
    if (!this.players.some((player) => player.name === playerName)) {
      return { ok: false, error: 'NOT_PLAYER' };
    }
    if (this.questionCount >= GUESS_WHO_MAX_QUESTIONS) {
      return { ok: false, error: 'QUESTION_LIMIT' };
    }
    const cleaned = question.trim();
    if (cleaned.length < 3 || cleaned.length > 140) {
      return { ok: false, error: 'INVALID_INPUT' };
    }
    this.questions.push({ playerName, question: cleaned, answer: null, at: Date.now() });
    return { ok: true, value: { number: this.questionCount } };
  }

  /** The answerer answers the LATEST open question (yes/no). */
  answerQuestion(
    answererName: string,
    yes: boolean
  ): GuessWhoResult<{ number: number; finished: boolean }> {
    if (this.phase !== 'questioning') {
      return { ok: false, error: 'WRONG_PHASE' };
    }
    if (answererName !== this.answererName) {
      return { ok: false, error: 'NOT_ANSWERER' };
    }
    const open = [...this.questions].reverse().find((entry) => entry.answer === null);
    if (!open) {
      return { ok: false, error: 'INVALID_INPUT' };
    }
    open.answer = yes;
    const answered = this.questionCount;
    if (answered >= GUESS_WHO_MAX_QUESTIONS) {
      this.phase = 'game-end'; // reveal: nobody guessed in time
      return { ok: true, value: { number: answered, finished: true } };
    }
    return { ok: true, value: { number: answered, finished: false } };
  }

  /**
   * A guess from any non-answerer. Accepted when the normalized guess equals
   * the celebrity's full name OR their last name (accents/“the” ignored).
   */
  submitGuess(
    playerName: string,
    guess: string
  ): GuessWhoResult<{ correct: boolean; finished: boolean }> {
    if (this.phase !== 'questioning') {
      return { ok: false, error: 'WRONG_PHASE' };
    }
    if (playerName === this.answererName && this.players.length > 1) {
      return { ok: false, error: 'NOT_ANSWERER' };
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
      this.phase = 'game-end';
      return { ok: true, value: { correct: true, finished: true } };
    }
    return { ok: true, value: { correct: false, finished: false } };
  }

  endPayload(): unknown {
    return {
      kind: 'guess-who',
      celebrity: this.celebrity
        ? { name: this.celebrity.name, famousFor: this.celebrity.famousFor }
        : null,
      questionsAsked: this.questionCount,
      winner: this.winnerName,
    };
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
