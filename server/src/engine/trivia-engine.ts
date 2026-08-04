import { randomInt } from 'node:crypto';

/**
 * Trivia room session engine (M8, PRD §5.15; M18 scoring) —
 * transport-agnostic. 10 questions, everyone answers the same question
 * within 10s, the reveal shows the correct answer and per-player points,
 * and the game ends with a podium. Modes (M18: simple flat scoring —
 * 10 for a correct answer, 0 for a wrong one):
 *
 * - race: correct answers score 10; wrong or missing score 0.
 * - wrong-answers ("Wrong Answers Only" comedy mode): a WRONG answer
 *   scores 10; the correct answer scores 0.
 *
 * Phases: idle → question → revealed → … → game-end. Timers (10s question,
 * 6s break) are owned by the gateway.
 */

export type TriviaPhase = 'idle' | 'question' | 'revealed' | 'game-end';
export type TriviaMode = 'race' | 'wrong-answers';

export type TriviaError =
  | 'NOT_STARTED'
  | 'ALREADY_STARTED'
  | 'NOT_PLAYER'
  | 'WRONG_PHASE'
  | 'ALREADY_ANSWERED'
  | 'INVALID_ANSWER';

export type TriviaResult<T = unknown> = { ok: true; value: T } | { ok: false; error: TriviaError };

export interface TriviaQuestion {
  category: string;
  question: string;
  options: string[];
  answer: number;
}

export interface TriviaScoreRow {
  playerName: string;
  score: number;
}

export interface TriviaRoundResult {
  playerName: string;
  points: number;
  correct: boolean;
}

export interface TriviaConfig {
  mode: TriviaMode;
  questionMs: number;
  totalRounds: number;
  breakMs: number;
}

interface PlayerState {
  name: string;
  score: number;
}

export class TriviaSession {
  private readonly questions: TriviaQuestion[];
  private readonly config: TriviaConfig;
  private readonly randomIntFn: (max: number) => number;
  private readonly nowFn: () => number;

  private phase: TriviaPhase = 'idle';
  private players: PlayerState[] = [];
  private roundNumber = 0;
  private startedAt = 0;
  private question: TriviaQuestion | null = null;
  private questionStartedAt: number | null = null;
  private answers = new Map<string, { optionIndex: number; elapsedMs: number; points: number }>();
  private revealedResults: TriviaRoundResult[] | null = null;
  private roundScores: Record<string, number> | null = null;
  private finalScores: TriviaScoreRow[] | null = null;

  constructor(
    questions: TriviaQuestion[],
    config: TriviaConfig,
    options: { randomInt?: (max: number) => number; now?: () => number } = {}
  ) {
    this.questions = questions;
    this.config = config;
    this.randomIntFn = options.randomInt ?? ((max) => randomInt(max));
    this.nowFn = options.now ?? (() => Date.now());
  }

  get phaseValue(): TriviaPhase {
    return this.phase;
  }

  get currentRound(): number {
    return this.roundNumber;
  }

  get totalRoundsValue(): number {
    return this.config.totalRounds;
  }

  get currentQuestion(): TriviaQuestion | null {
    return this.question;
  }

  get questionStartedAtValue(): number | null {
    return this.questionStartedAt;
  }

  get startedTimestamp(): number {
    return this.startedAt;
  }

  get mode(): TriviaMode {
    return this.config.mode;
  }

  get lastReveal(): { correctIndex: number; results: TriviaRoundResult[] } | null {
    if (!this.revealedResults || this.question === null) {
      return null;
    }
    return { correctIndex: this.question.answer, results: this.revealedResults };
  }

  get scoreboard(): TriviaScoreRow[] {
    return [...this.players]
      .map((player) => ({ playerName: player.name, score: player.score }))
      .sort((a, b) => b.score - a.score || a.playerName.localeCompare(b.playerName));
  }

  get finalScoresValue(): TriviaScoreRow[] | null {
    return this.finalScores;
  }

  hasAnswered(playerName: string): boolean {
    return this.answers.has(playerName);
  }

  /** My answer for the current question (optionIndex + banked points). */
  answerOf(playerName: string): { optionIndex: number; points: number } | null {
    const answer = this.answers.get(playerName);
    return answer ? { optionIndex: answer.optionIndex, points: answer.points } : null;
  }

  start(playerNames: string[]): TriviaResult<{ totalRounds: number }> {
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
    this.players = names.map((name) => ({ name, score: 0 }));
    this.startedAt = this.nowFn();
    this.beginQuestion();
    return { ok: true, value: { totalRounds: this.config.totalRounds } };
  }

  /** Mid-game joins join the roster so they can answer (D027 pattern). */
  addPlayer(playerName: string): TriviaResult<{ name: string }> {
    if (this.phase === 'idle' || this.phase === 'game-end') {
      return { ok: false, error: 'WRONG_PHASE' };
    }
    const name = playerName.trim();
    if (this.players.some((player) => player.name === name)) {
      return { ok: true, value: { name } };
    }
    this.players.push({ name, score: 0 });
    return { ok: true, value: { name } };
  }

  submitAnswer(
    playerName: string,
    optionIndex: number,
    elapsedMs: number
  ): TriviaResult<{ points: number; correct: boolean; allAnswered: boolean }> {
    if (this.phase !== 'question') {
      return { ok: false, error: 'WRONG_PHASE' };
    }
    if (!this.players.some((player) => player.name === playerName)) {
      return { ok: false, error: 'NOT_PLAYER' };
    }
    if (this.answers.has(playerName)) {
      return { ok: false, error: 'ALREADY_ANSWERED' };
    }
    if (
      !this.question ||
      !Number.isInteger(optionIndex) ||
      optionIndex < 0 ||
      optionIndex >= this.question.options.length
    ) {
      return { ok: false, error: 'INVALID_ANSWER' };
    }
    const clamped = Math.min(this.config.questionMs, Math.max(0, elapsedMs));
    const correct = optionIndex === this.question.answer;
    let points: number;
    if (this.config.mode === 'race') {
      // M18: flat scoring — 10 for correct, 0 otherwise (owner request).
      points = correct ? 10 : 0;
    } else {
      // Wrong Answers Only: the most absurd wrong answer wins.
      points = correct ? 0 : 10;
    }
    const player = this.players.find((entry) => entry.name === playerName);
    if (player) {
      player.score += points;
    }
    this.answers.set(playerName, { optionIndex, elapsedMs: clamped, points });
    return {
      ok: true,
      value: { points, correct, allAnswered: this.answers.size >= this.players.length },
    };
  }

  /** End the question → per-player reveal (gateway: timer or all answered). */
  reveal(): TriviaResult<{ correctIndex: number; results: TriviaRoundResult[] }> {
    if (this.phase !== 'question') {
      return { ok: false, error: 'WRONG_PHASE' };
    }
    if (!this.question) {
      return { ok: false, error: 'NOT_STARTED' };
    }
    const results: TriviaRoundResult[] = this.players.map((player) => {
      const answer = this.answers.get(player.name);
      const correct = answer !== undefined && answer.optionIndex === this.question!.answer;
      return { playerName: player.name, points: answer?.points ?? 0, correct };
    });
    this.revealedResults = results;
    this.roundScores = Object.fromEntries(
      this.players.map((player) => [player.name, player.score])
    );
    this.phase = 'revealed';
    return { ok: true, value: { correctIndex: this.question.answer, results } };
  }

  /** Advance (gateway: after the break). Returns { finished }. */
  next(): TriviaResult<{ finished: boolean }> {
    if (this.phase !== 'revealed') {
      return { ok: false, error: 'WRONG_PHASE' };
    }
    if (this.roundNumber >= this.config.totalRounds) {
      this.phase = 'game-end';
      this.finalScores = this.scoreboard;
      return { ok: true, value: { finished: true } };
    }
    this.beginQuestion();
    return { ok: true, value: { finished: false } };
  }

  endPayload(): unknown {
    return {
      kind: 'trivia',
      mode: this.config.mode,
      rounds: this.roundNumber,
      scores: this.finalScores ?? this.scoreboard,
      winner: (this.finalScores ?? this.scoreboard)[0]?.playerName ?? null,
    };
  }

  private beginQuestion(): void {
    this.roundNumber += 1;
    this.question = this.questions[this.randomIntFn(this.questions.length)] ?? null;
    this.questionStartedAt = this.nowFn();
    this.answers.clear();
    this.revealedResults = null;
    this.roundScores = null;
    this.phase = 'question';
  }
}
