import { randomInt } from 'node:crypto';

/**
 * Drawing-game session engine (M5), powers all four shared-canvas drawing
 * games (Skribbl Arena, One Line One Shape, Shadow Sketch, Draw the Lyric)
 * from one configurable state machine. Transport-agnostic like the
 * RoomEngine: no Socket.io types here, timers are owned by the gateway.
 *
 * State machine: idle → word-select | drawing → round-results →
 * (word-select | game-end). Server-authoritative: words, hints, guesses,
 * scores, penalties never leave this class except via gateway payloads.
 */

export const DRAWING_ROUNDS_PER_PLAYER = 3;
export const DRAWING_WORD_SELECT_TIMEOUT_MS = 15_000;
export const DRAWING_MAX_STROKES_PER_ROUND = 5_000;
export const DRAWING_CUSTOM_WORDS_MIN = 3;
export const DRAWING_CUSTOM_WORDS_MAX = 200;

export type DrawingWordMode = 'choices' | 'direct' | 'lyric';
export type DrawingPhase = 'idle' | 'word-select' | 'drawing' | 'round-results' | 'game-end';

export type DrawingGameError =
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

export type DrawingGameResult<T = unknown> =
  { ok: true; value: T } | { ok: false; error: DrawingGameError };

export interface DrawingRoundSummary {
  roundNumber: number;
  word: string;
  drawerName: string;
  correct: { playerName: string; points: number }[];
  drawerPoints: number;
}

export interface DrawingScoreEntry {
  playerName: string;
  score: number;
}

export interface DrawingStroke {
  strokeId: string;
  type?: 'pen' | 'fill';
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  color: string;
  brushSize: number;
  tool: 'pen' | 'eraser';
}

/** One dataset entry the drawer must convey (word, lyric, or silhouette). */
export interface DrawingEntry {
  /** The guess target (object name, silhouette name, or song title). */
  word: string;
  /** Raw entry passed to the drawer's private payload (lyric/silhouette…). */
  data: Record<string, unknown>;
}

export interface DrawingGameConfig {
  gameId: string;
  /** 'choices' = drawer picks 1 of 3; 'direct'/'lyric' = assigned. */
  wordMode: DrawingWordMode;
  roundDurationMs: number;
  roundsPerPlayer?: number;
  /** Letter hints (skribbl: 30s/45s). */
  firstHintMs?: number;
  secondHintMs?: number;
  /** Draw the Lyric: artist name hint. */
  artistHintMs?: number;
  /** Shadow Sketch: reveal the silhouette to guessers. */
  silhouetteRevealMs?: number;
  /** One Line, One Shape: seconds deducted per pen lift. */
  liftPenaltyMs?: number;
  /** Fixed guesser points (lyric: 100). Speed-based scoring when unset. */
  fixedGuesserPoints?: number;
  /** Fixed drawer points per correct guess (lyric: 50). Σ/2 when unset. */
  fixedDrawerPoints?: number;
  /** Skribbl Arena: host-pasted word lists. */
  allowCustomWords?: boolean;
}

interface PlayerState {
  name: string;
  score: number;
  correctGuesses: number;
  roundsDrawn: number;
  guessedThisRound: boolean;
  roundPoints: number;
}

export class DrawingGameSession {
  private readonly entries: DrawingEntry[];
  private readonly config: DrawingGameConfig;
  private readonly roundsPerPlayer: number;
  private readonly randomIntFn: (max: number) => number;
  private readonly nowFn: () => number;

  private phase: DrawingPhase = 'idle';
  private players: PlayerState[] = [];
  private rotation: string[] = [];
  private roundNumber = 0;
  private totalRounds = 0;
  private drawerName: string | null = null;
  private entry: DrawingEntry | null = null;
  private wordChoices: string[] | null = null;
  private roundStartedAt: number | null = null;
  private penaltyMs = 0;
  private strokes: DrawingStroke[] = [];
  private lastSummary: DrawingRoundSummary | null = null;
  private startedAt = 0;

  constructor(
    entries: DrawingEntry[],
    config: DrawingGameConfig,
    options: { randomInt?: (max: number) => number; now?: () => number } = {}
  ) {
    this.entries = entries;
    this.config = config;
    this.roundsPerPlayer = config.roundsPerPlayer ?? DRAWING_ROUNDS_PER_PLAYER;
    this.randomIntFn = options.randomInt ?? ((max) => randomInt(max));
    this.nowFn = options.now ?? (() => Date.now());
  }

  get phaseValue(): DrawingPhase {
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
    return this.entry?.word ?? null;
  }

  /** The full dataset entry (lyric/silhouette/object), drawer payload only. */
  get currentEntry(): DrawingEntry | null {
    return this.entry;
  }

  get wordLength(): number | null {
    return this.entry === null ? null : this.entry.word.length;
  }

  get choices(): string[] | null {
    return this.wordChoices;
  }

  get drawingStartedAt(): number | null {
    return this.roundStartedAt;
  }

  /** Deadline incl. accumulated lift penalties (One Line, One Shape). */
  get roundEndsAt(): number | null {
    if (this.roundStartedAt === null) {
      return null;
    }
    return this.roundStartedAt + this.config.roundDurationMs - this.penaltyMs;
  }

  get strokesLog(): DrawingStroke[] {
    return this.strokes;
  }

  get scores(): Record<string, number> {
    return Object.fromEntries(this.players.map((player) => [player.name, player.score]));
  }

  get lastRoundSummary(): DrawingRoundSummary | null {
    return this.lastSummary;
  }

  get startedTimestamp(): number {
    return this.startedAt;
  }

  get finalScores(): DrawingScoreEntry[] {
    return [...this.players]
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .map((player) => ({ playerName: player.name, score: player.score }));
  }

  get winnerName(): string | null {
    return this.finalScores[0]?.playerName ?? null;
  }

  /** Guess normalization: case-fold + trim + collapse whitespace. */
  static normalizeGuess(text: string): string {
    return text.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  /** Title matching (Draw the Lyric): ignore leading "the" and trailing punctuation. */
  static normalizeTitle(text: string): string {
    const normalized = DrawingGameSession.normalizeGuess(text);
    const stripped = normalized.replace(/^the\s+/, '').replace(/[!?.,;:'"]+$/g, '');
    return stripped.trim();
  }

  /** Start the game (1+ players allowed, solo rooms are a testing affordance). */
  start(playerNames: string[]): DrawingGameResult<{ totalRounds: number }> {
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

  /** Replace the entry pool with a host-pasted list (Skribbl custom words). */
  setCustomWords(rawWords: unknown): DrawingGameResult<{ count: number }> {
    if (!Array.isArray(rawWords)) {
      return { ok: false, error: 'INVALID_WORD_LIST' };
    }
    const seen = new Set<string>();
    const cleaned: DrawingEntry[] = [];
    for (const entry of rawWords) {
      if (typeof entry !== 'string') {
        return { ok: false, error: 'INVALID_WORD_LIST' };
      }
      const word = entry.trim().toLowerCase();
      if (word.length === 0 || word.length > 24) {
        return { ok: false, error: 'INVALID_WORD_LIST' };
      }
      if (!/^[a-z' -]+$/.test(word)) {
        return { ok: false, error: 'INVALID_WORD_LIST' };
      }
      const key = DrawingGameSession.normalizeGuess(word);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      cleaned.push({ word, data: { word } });
    }
    if (cleaned.length < DRAWING_CUSTOM_WORDS_MIN || cleaned.length > DRAWING_CUSTOM_WORDS_MAX) {
      return { ok: false, error: 'INVALID_WORD_LIST' };
    }
    this.entries.length = 0;
    this.entries.push(...cleaned);
    return { ok: true, value: { count: cleaned.length } };
  }

  /** Add a mid-game joiner (they can guess; the rotation is fixed). */
  addPlayer(playerName: string): DrawingGameResult<{ score: number }> {
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

  /** Drawer picks one of the 3 choices (choices mode only) → drawing phase. */
  chooseWord(playerName: string, word: string): DrawingGameResult<{ wordLength: number }> {
    if (this.phase !== 'word-select') {
      return { ok: false, error: 'WRONG_PHASE' };
    }
    if (this.drawerName !== playerName) {
      return { ok: false, error: 'NOT_DRAWER' };
    }
    const normalized = DrawingGameSession.normalizeGuess(word);
    const choice = this.wordChoices?.find(
      (c) => DrawingGameSession.normalizeGuess(c) === normalized
    );
    if (!choice) {
      return { ok: false, error: 'WORD_NOT_IN_CHOICES' };
    }
    const entry = this.entries.find(
      (e) => DrawingGameSession.normalizeGuess(e.word) === normalized
    ) ?? { word: choice, data: { word: choice } };
    this.entry = entry;
    this.wordChoices = null;
    this.beginDrawingPhase();
    return { ok: true, value: { wordLength: choice.length } };
  }

  /** One Line / Shadow / Lyric: the word is assigned directly at round start. */
  assignWordForDirectMode(): DrawingGameResult<{ wordLength: number }> {
    if (this.phase !== 'word-select' || this.config.wordMode === 'choices') {
      return { ok: false, error: 'WRONG_PHASE' };
    }
    const entry = this.entries[this.randomIntFn(this.entries.length)];
    if (!entry) {
      return { ok: false, error: 'NOT_STARTED' };
    }
    this.entry = entry;
    this.wordChoices = null;
    this.beginDrawingPhase();
    return { ok: true, value: { wordLength: entry.word.length } };
  }

  /**
   * Scoring per PRD: speed-based `max(0, 100 − 2·s)` (skribbl family) or
   * fixed points (lyric: guesser 100). Drawer cut: floor(Σ/2) or fixed.
   */
  submitGuess(
    playerName: string,
    text: string,
    at: number
  ): DrawingGameResult<{ correct: boolean; points: number; alreadyGuessed: boolean }> {
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
    if (startedAt === null || at - startedAt >= this.config.roundDurationMs) {
      return { ok: false, error: 'ROUND_OVER' };
    }
    if (player.guessedThisRound) {
      return { ok: false, error: 'ALREADY_GUESSED' };
    }
    const word = this.entry?.word;
    const match =
      this.config.wordMode === 'lyric'
        ? DrawingGameSession.normalizeTitle(text) === DrawingGameSession.normalizeTitle(word ?? '')
        : DrawingGameSession.normalizeGuess(text) === DrawingGameSession.normalizeGuess(word ?? '');
    if (!word || !match) {
      return { ok: true, value: { correct: false, points: 0, alreadyGuessed: false } };
    }
    const points =
      this.config.fixedGuesserPoints ?? Math.max(0, 100 - Math.floor((at - startedAt) / 1000) * 2);
    player.score += points;
    player.roundPoints += points;
    player.correctGuesses += 1;
    player.guessedThisRound = true;
    return { ok: true, value: { correct: true, points, alreadyGuessed: false } };
  }

  /** True when every non-drawer player has guessed (false for solo rooms). */
  allGuessed(): boolean {
    if (this.phase !== 'drawing') {
      return false;
    }
    const guessers = this.players.filter((player) => player.name !== this.drawerName);
    return guessers.length > 0 && guessers.every((player) => player.guessedThisRound);
  }

  /** Letter hints (skribbl), first at 30s, last at 45s. */
  letterHintsAt(now: number): { firstLetter: string | null; lastLetter: string | null } {
    const startedAt = this.roundStartedAt;
    const word = this.entry?.word;
    const first = this.config.firstHintMs;
    const second = this.config.secondHintMs;
    if (startedAt === null || word === undefined || this.phase !== 'drawing' || !first || !second) {
      return { firstLetter: null, lastLetter: null };
    }
    const elapsed = now - startedAt;
    return {
      firstLetter: elapsed >= first ? word[0]! : null,
      lastLetter: elapsed >= second ? word[word.length - 1]! : null,
    };
  }

  /** Lyric artist hint at 45s. */
  artistAt(now: number): string | null {
    const startedAt = this.roundStartedAt;
    const artist = this.entry?.data.artist;
    if (
      startedAt === null ||
      this.phase !== 'drawing' ||
      typeof artist !== 'string' ||
      !this.config.artistHintMs
    ) {
      return null;
    }
    return now - startedAt >= this.config.artistHintMs ? artist : null;
  }

  /** One Line penalty: each lift deducts liftPenaltyMs from the deadline. */
  applyLiftPenalty(): DrawingGameResult<{ endsAt: number }> {
    if (this.phase !== 'drawing' || !this.config.liftPenaltyMs) {
      return { ok: false, error: 'WRONG_PHASE' };
    }
    const endsAt = this.roundEndsAt;
    if (endsAt === null) {
      return { ok: false, error: 'WRONG_PHASE' };
    }
    // Floor at 5 seconds so the round always ends.
    this.penaltyMs = Math.min(
      this.config.roundDurationMs - 5_000,
      this.penaltyMs + this.config.liftPenaltyMs
    );
    return { ok: true, value: { endsAt: this.roundEndsAt! } };
  }

  /** End the drawing phase and produce the round summary (idempotent). */
  endRound(): DrawingGameResult<DrawingRoundSummary> {
    if (this.phase !== 'drawing') {
      return { ok: false, error: 'WRONG_PHASE' };
    }
    const word = this.entry!.word;
    const drawerName = this.drawerName!;
    const correct = this.players
      .filter((player) => player.name !== drawerName && player.guessedThisRound)
      .map((player) => ({ playerName: player.name, points: player.roundPoints }));
    const sum = correct.reduce((total, entry) => total + entry.points, 0);
    const drawerPoints = this.config.fixedDrawerPoints
      ? correct.length * this.config.fixedDrawerPoints
      : Math.floor(sum / 2);
    const drawer = this.players.find((player) => player.name === drawerName);
    if (drawer) {
      drawer.score += drawerPoints;
      drawer.roundsDrawn += 1;
    }
    for (const player of this.players) {
      player.guessedThisRound = false;
      player.roundPoints = 0;
    }
    const summary: DrawingRoundSummary = {
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

  /** Advance from round results: next round, or game end. */
  nextRound(): DrawingGameResult<{ finished: boolean }> {
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
  addStroke(playerName: string, stroke: DrawingStroke): DrawingGameResult<{ strokeId: string }> {
    if (this.phase !== 'drawing') {
      return { ok: false, error: 'WRONG_PHASE' };
    }
    if (this.drawerName !== playerName) {
      return { ok: false, error: 'NOT_DRAWER' };
    }
    if (this.strokes.length >= DRAWING_MAX_STROKES_PER_ROUND) {
      return { ok: false, error: 'STROKE_LIMIT' };
    }
    this.strokes.push(stroke);
    return { ok: true, value: { strokeId: stroke.strokeId } };
  }

  /** Drawer-only undo: drop the last stroke group. */
  undoStroke(playerName: string): DrawingGameResult<{ strokeId: string | null }> {
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
  clearCanvas(playerName: string): DrawingGameResult<{ cleared: boolean }> {
    if (this.phase !== 'drawing') {
      return { ok: false, error: 'WRONG_PHASE' };
    }
    if (this.drawerName !== playerName) {
      return { ok: false, error: 'NOT_DRAWER' };
    }
    this.strokes = [];
    return { ok: true, value: { cleared: true } };
  }

  private beginDrawingPhase(): void {
    this.roundStartedAt = this.nowFn();
    this.penaltyMs = 0;
    this.phase = 'drawing';
  }

  private beginRound(): void {
    this.roundNumber += 1;
    this.drawerName = this.rotation[(this.roundNumber - 1) % this.rotation.length]!;
    this.entry = null;
    this.wordChoices = this.config.wordMode === 'choices' ? this.pickWordChoices() : null;
    this.roundStartedAt = null;
    this.penaltyMs = 0;
    this.strokes = [];
    this.lastSummary = null;
    this.phase = 'word-select';
  }

  private pickWordChoices(): string[] {
    const pool = this.entries;
    const copy = [...pool];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = this.randomIntFn(i + 1);
      const swap = copy[i]!;
      copy[i] = copy[j]!;
      copy[j] = swap;
    }
    return copy.slice(0, 3).map((entry) => entry.word);
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
