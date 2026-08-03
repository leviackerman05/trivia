import wordsJson from '../data/skribbl-words.json' with { type: 'json' };
import { randomInt } from 'node:crypto';

/**
 * Skribbl Arena session engine (PRD §5.1) — transport-agnostic like the
 * RoomEngine: no Socket.io types here, timers are owned by the gateway.
 *
 * State machine: idle → word-select → drawing → round-results → (word-select | game-end).
 * Server-authoritative: words, hints, guesses, and scores never leave this
 * class except through the gateway's typed payloads.
 */

export const SKRIBBL_ROUNDS_PER_PLAYER = 3;
export const SKRIBBL_ROUND_DURATION_MS = 60_000;
export const SKRIBBL_WORD_SELECT_TIMEOUT_MS = 15_000;
export const SKRIBBL_FIRST_HINT_MS = 30_000;
export const SKRIBBL_SECOND_HINT_MS = 45_000;
export const SKRIBBL_BREAK_MS = 10_000;
export const SKRIBBL_WORD_CHOICES = 3;
export const SKRIBBL_MAX_STROKES_PER_ROUND = 5_000;
export const SKRIBBL_CUSTOM_WORDS_MIN = 3;
export const SKRIBBL_CUSTOM_WORDS_MAX = 200;

export type SkribblDifficulty = 'easy' | 'medium' | 'hard' | 'expert' | 'master';

export interface SkribblWord {
  word: string;
  difficulty: SkribblDifficulty;
}

export type SkribblPhase = 'idle' | 'word-select' | 'drawing' | 'round-results' | 'game-end';

export type SkribblError =
  | 'NOT_STARTED'
  | 'ALREADY_STARTED'
  | 'NOT_PLAYER'
  | 'NOT_DRAWER'
  | 'DRAWER_CANNOT_GUESS'
  | 'WRONG_PHASE'
  | 'ALREADY_GUESSED'
  | 'ROUND_OVER'
  | 'WORD_NOT_IN_CHOICES'
  | 'INVALID_WORD_LIST'
  | 'STROKE_LIMIT'
  | 'INVALID_STROKE';

export type SkribblResult<T = unknown> =
  { ok: true; value: T } | { ok: false; error: SkribblError };

export interface SkribblRoundSummary {
  roundNumber: number;
  word: string;
  drawerName: string;
  correct: { playerName: string; points: number }[];
  drawerPoints: number;
}

export interface SkribblScoreEntry {
  playerName: string;
  score: number;
}

export interface SkribblStroke {
  strokeId: string;
  /** Additive: "fill" flood-fills the region at (x, y); default "pen" segment. */
  type?: 'pen' | 'fill';
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  color: string;
  brushSize: number;
  tool: 'pen' | 'eraser';
}

export interface SkribblSessionOptions {
  words?: SkribblWord[];
  roundsPerPlayer?: number;
  randomInt?: (max: number) => number;
  now?: () => number;
}

interface SkribblPlayerState {
  name: string;
  score: number;
  correctGuesses: number;
  roundsDrawn: number;
  guessedThisRound: boolean;
  /** Points earned this round (banked at guess time, read at round end). */
  roundPoints: number;
}

export class SkribblSession {
  private readonly words: SkribblWord[];
  private readonly roundsPerPlayer: number;
  private readonly randomIntFn: (max: number) => number;
  private readonly nowFn: () => number;

  private phase: SkribblPhase = 'idle';
  private players: SkribblPlayerState[] = [];
  private rotation: string[] = [];
  private roundNumber = 0;
  private totalRounds = 0;
  private drawerName: string | null = null;
  private word: string | null = null;
  private wordChoices: string[] | null = null;
  private roundStartedAt: number | null = null;
  private strokes: SkribblStroke[] = [];
  private lastSummary: SkribblRoundSummary | null = null;
  private startedAt = 0;

  constructor(options: SkribblSessionOptions = {}) {
    this.words = options.words ?? (wordsJson as SkribblWord[]);
    this.roundsPerPlayer = options.roundsPerPlayer ?? SKRIBBL_ROUNDS_PER_PLAYER;
    this.randomIntFn = options.randomInt ?? ((max) => randomInt(max));
    this.nowFn = options.now ?? (() => Date.now());
  }

  get phaseValue(): SkribblPhase {
    return this.phase;
  }

  get currentRound(): number {
    return this.roundNumber;
  }

  get totalRoundsValue(): number {
    return this.totalRounds;
  }

  get currentDrawer(): string | null {
    return this.drawerName;
  }

  get currentWord(): string | null {
    return this.word;
  }

  /** The 3 candidate words during word-select (drawer only — gateway gates). */
  get choices(): string[] | null {
    return this.wordChoices;
  }

  get wordLength(): number | null {
    return this.word === null ? null : this.word.length;
  }

  /** Drawing-phase start timestamp (gateway computes hints/deadlines from it). */
  get drawingStartedAt(): number | null {
    return this.roundStartedAt;
  }

  get strokesLog(): SkribblStroke[] {
    return this.strokes;
  }

  get scores(): Record<string, number> {
    return Object.fromEntries(this.players.map((player) => [player.name, player.score]));
  }

  get lastRoundSummary(): SkribblRoundSummary | null {
    return this.lastSummary;
  }

  get startedTimestamp(): number {
    return this.startedAt;
  }

  get finalScores(): SkribblScoreEntry[] {
    return [...this.players]
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .map((player) => ({ playerName: player.name, score: player.score }));
  }

  get winnerName(): string | null {
    const final = this.finalScores;
    return final[0]?.playerName ?? null;
  }

  /** Normalize a guess: trim + case-fold + collapse whitespace (PRD §5.1). */
  static normalizeGuess(text: string): string {
    return text.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  /**
   * Start a game for the given players (1+ allowed since M4.1 — solo rooms
   * are a testing affordance and a friend can join mid-game). Builds a
   * shuffled drawer rotation; total rounds = players × roundsPerPlayer.
   */
  start(playerNames: string[]): SkribblResult<{ totalRounds: number }> {
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
    this.players = names.map((name) => ({
      name,
      score: 0,
      correctGuesses: 0,
      roundsDrawn: 0,
      guessedThisRound: false,
      roundPoints: 0,
    }));
    this.rotation = this.shuffle(names);
    this.totalRounds = names.length * this.roundsPerPlayer;
    this.startedAt = this.nowFn();
    this.phase = 'word-select';
    this.beginRound();
    return { ok: true, value: { totalRounds: this.totalRounds } };
  }

  /** Replace the word bank with a host-pasted list (validated). */
  setCustomWords(rawWords: unknown): SkribblResult<{ count: number }> {
    if (!Array.isArray(rawWords)) {
      return { ok: false, error: 'INVALID_WORD_LIST' };
    }
    const seen = new Set<string>();
    const cleaned: SkribblWord[] = [];
    for (const entry of rawWords) {
      if (typeof entry !== 'string') {
        return { ok: false, error: 'INVALID_WORD_LIST' };
      }
      const word = entry.trim().toLowerCase();
      if (word.length === 0 || word.length > 24) {
        return { ok: false, error: 'INVALID_WORD_LIST' };
      }
      // Letters, spaces, hyphens, apostrophes only — keeps payloads safe.
      if (!/^[a-z' -]+$/.test(word)) {
        return { ok: false, error: 'INVALID_WORD_LIST' };
      }
      const key = SkribblSession.normalizeGuess(word);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      cleaned.push({ word, difficulty: 'medium' });
    }
    if (cleaned.length < SKRIBBL_CUSTOM_WORDS_MIN || cleaned.length > SKRIBBL_CUSTOM_WORDS_MAX) {
      return { ok: false, error: 'INVALID_WORD_LIST' };
    }
    this.words.length = 0;
    this.words.push(...cleaned);
    return { ok: true, value: { count: cleaned.length } };
  }

  /** Drawer picks one of the 3 choices → drawing phase begins. */
  chooseWord(playerName: string, word: string): SkribblResult<{ wordLength: number }> {
    if (this.phase !== 'word-select') {
      return { ok: false, error: 'WRONG_PHASE' };
    }
    if (this.drawerName !== playerName) {
      return { ok: false, error: 'NOT_DRAWER' };
    }
    const normalized = SkribblSession.normalizeGuess(word);
    const choice = this.wordChoices?.find((c) => SkribblSession.normalizeGuess(c) === normalized);
    if (!choice) {
      return { ok: false, error: 'WORD_NOT_IN_CHOICES' };
    }
    this.word = choice;
    this.wordChoices = null;
    this.roundStartedAt = this.nowFn();
    this.phase = 'drawing';
    return { ok: true, value: { wordLength: choice.length } };
  }

  /**
   * PRD §5.1 scoring: guesser = 100 − (seconds elapsed × 2), floored at 0.
   * First correct guess in the round awards points; drawer earns Σ/2 at
   * round end. Repeat correct guesses → ALREADY_GUESSED.
   */
  submitGuess(
    playerName: string,
    text: string,
    at: number
  ): SkribblResult<{ correct: boolean; points: number; alreadyGuessed: boolean }> {
    if (this.phase !== 'drawing') {
      return { ok: false, error: 'WRONG_PHASE' };
    }
    if (this.drawerName === playerName) {
      return { ok: false, error: 'DRAWER_CANNOT_GUESS' };
    }
    const player = this.players.find((p) => p.name === playerName);
    if (!player) {
      return { ok: false, error: 'NOT_PLAYER' };
    }
    const startedAt = this.roundStartedAt;
    if (startedAt === null || at - startedAt >= SKRIBBL_ROUND_DURATION_MS) {
      return { ok: false, error: 'ROUND_OVER' };
    }
    if (player.guessedThisRound) {
      return { ok: false, error: 'ALREADY_GUESSED' };
    }
    const word = this.word;
    if (!word || SkribblSession.normalizeGuess(text) !== SkribblSession.normalizeGuess(word)) {
      return { ok: true, value: { correct: false, points: 0, alreadyGuessed: false } };
    }
    const seconds = Math.floor((at - startedAt) / 1000);
    const points = Math.max(0, 100 - seconds * 2);
    player.score += points;
    player.roundPoints += points;
    player.correctGuesses += 1;
    player.guessedThisRound = true;
    return { ok: true, value: { correct: true, points, alreadyGuessed: false } };
  }

  /**
   * Add a player who joined after the game started (mid-game joins can
   * guess from the current round on; they never draw — the rotation is
   * fixed). Idempotent: rejoins return the existing player. Total rounds
   * are not extended (the rotation was fixed at start).
   */
  addPlayer(playerName: string): SkribblResult<{ score: number }> {
    if (this.phase === 'idle' || this.phase === 'game-end') {
      return { ok: false, error: 'WRONG_PHASE' };
    }
    const existing = this.players.find((player) => player.name === playerName);
    if (existing) {
      return { ok: true, value: { score: existing.score } };
    }
    if (this.players.length >= 24) {
      return { ok: false, error: 'NOT_PLAYER' };
    }
    this.players.push({
      name: playerName,
      score: 0,
      correctGuesses: 0,
      roundsDrawn: 0,
      guessedThisRound: false,
      roundPoints: 0,
    });
    return { ok: true, value: { score: 0 } };
  }

  /** True when every non-drawer player has guessed. With no guessers (solo
   * room) this must stay false, or the round would end the instant it starts.
   */
  allGuessed(): boolean {
    if (this.phase !== 'drawing') {
      return false;
    }
    const guessers = this.players.filter((player) => player.name !== this.drawerName);
    return guessers.length > 0 && guessers.every((player) => player.guessedThisRound);
  }

  /** Hints per PRD §5.1: first letter at 30s, last letter at 45s. */
  hintsAt(now: number): { firstLetter: string | null; lastLetter: string | null } {
    const startedAt = this.roundStartedAt;
    const word = this.word;
    if (startedAt === null || word === null || this.phase !== 'drawing') {
      return { firstLetter: null, lastLetter: null };
    }
    const elapsed = now - startedAt;
    return {
      firstLetter: elapsed >= SKRIBBL_FIRST_HINT_MS ? word[0]! : null,
      lastLetter: elapsed >= SKRIBBL_SECOND_HINT_MS ? word[word.length - 1]! : null,
    };
  }

  /** End the drawing phase and produce the round summary (idempotent). */
  endRound(): SkribblResult<SkribblRoundSummary> {
    if (this.phase !== 'drawing') {
      return { ok: false, error: 'WRONG_PHASE' };
    }
    const word = this.word!;
    const drawerName = this.drawerName!;
    const correct = this.players
      .filter((player) => player.name !== drawerName && player.guessedThisRound)
      .map((player) => ({ playerName: player.name, points: player.roundPoints }));
    const sum = correct.reduce((total, entry) => total + entry.points, 0);
    const drawerPoints = Math.floor(sum / 2);
    const drawer = this.players.find((player) => player.name === drawerName);
    if (drawer) {
      drawer.score += drawerPoints;
      drawer.roundsDrawn += 1;
    }
    for (const player of this.players) {
      player.guessedThisRound = false;
      player.roundPoints = 0;
    }
    const summary: SkribblRoundSummary = {
      roundNumber: this.roundNumber,
      word,
      drawerName,
      correct,
      drawerPoints,
    };
    this.lastSummary = summary;
    this.phase = 'round-results';
    return { ok: true, value: summary };
  }

  /** Advance from round results: next round's word-select, or game end. */
  nextRound(): SkribblResult<{ finished: boolean }> {
    if (this.phase !== 'round-results') {
      return { ok: false, error: 'WRONG_PHASE' };
    }
    if (this.roundNumber >= this.totalRounds) {
      this.phase = 'game-end';
      return { ok: true, value: { finished: true } };
    }
    this.beginRound();
    return { ok: true, value: { finished: false } };
  }

  /** Drawer-only stroke append (drawing phase, capped per round). */
  addStroke(playerName: string, stroke: SkribblStroke): SkribblResult<{ strokeId: string }> {
    if (this.phase !== 'drawing') {
      return { ok: false, error: 'WRONG_PHASE' };
    }
    if (this.drawerName !== playerName) {
      return { ok: false, error: 'NOT_DRAWER' };
    }
    if (this.strokes.length >= SKRIBBL_MAX_STROKES_PER_ROUND) {
      return { ok: false, error: 'STROKE_LIMIT' };
    }
    this.strokes.push(stroke);
    return { ok: true, value: { strokeId: stroke.strokeId } };
  }

  /** Drawer-only undo: drop the last stroke group. */
  undoStroke(playerName: string): SkribblResult<{ strokeId: string | null }> {
    if (this.phase !== 'drawing') {
      return { ok: false, error: 'WRONG_PHASE' };
    }
    if (this.drawerName !== playerName) {
      return { ok: false, error: 'NOT_DRAWER' };
    }
    const last = this.strokes[this.strokes.length - 1];
    if (!last) {
      return { ok: true, value: { strokeId: null } };
    }
    this.strokes = this.strokes.filter((stroke) => stroke.strokeId !== last.strokeId);
    return { ok: true, value: { strokeId: last.strokeId } };
  }

  /** Drawer-only clear. */
  clearCanvas(playerName: string): SkribblResult<{ cleared: boolean }> {
    if (this.phase !== 'drawing') {
      return { ok: false, error: 'WRONG_PHASE' };
    }
    if (this.drawerName !== playerName) {
      return { ok: false, error: 'NOT_DRAWER' };
    }
    this.strokes = [];
    return { ok: true, value: { cleared: true } };
  }

  private beginRound(): void {
    this.roundNumber += 1;
    this.drawerName = this.rotation[(this.roundNumber - 1) % this.rotation.length]!;
    this.word = null;
    this.wordChoices = this.pickWordChoices();
    this.roundStartedAt = null;
    this.strokes = [];
    this.lastSummary = null;
    this.phase = 'word-select';
  }

  private pickWordChoices(): string[] {
    // Shuffle and take the first N: always distinct, works for small pools
    // (custom lists can be as small as 3 words).
    const pool = [...this.words];
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = this.randomIntFn(i + 1);
      const swap = pool[i]!;
      pool[i] = pool[j]!;
      pool[j] = swap;
    }
    return pool.slice(0, SKRIBBL_WORD_CHOICES).map((entry) => entry.word);
  }

  private shuffle(values: string[]): string[] {
    const copy = [...values];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = this.randomIntFn(i + 1);
      const swap = copy[i]!;
      copy[i] = copy[j]!;
      copy[j] = swap;
    }
    return copy;
  }
}
