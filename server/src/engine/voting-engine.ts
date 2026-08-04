import { randomInt } from 'node:crypto';

/**
 * Voting game session engine (M6, PRD §5.13/5.14/5.16/5.18) —
 * transport-agnostic, one session class for all four voting games with
 * kind-specific mechanics:
 *
 * - would-you-rather:    prompt with two dilemma options (a/b), live tallies,
 *                        reveal, host/auto next; players can submit dilemmas
 *                        to the room queue (gateway-owned).
 * - most-likely-to:      prompt + player names as options, ranked reveal with
 *                        a crown for the round winner; self-votes allowed.
 * - never-have-i-ever:   turn rotation — the current player states something
 *                        they've never done (or picks a suggestion), everyone
 *                        else votes I HAVE / I HAVE NOT (aggregate reveal),
 *                        wildness tallies accumulate.
 * - this-or-that:        20 rapid pairs, one vote each, live bars, 6s
 *                        auto-advance, herd streak on majority matches,
 *                        final "herd alignment" score.
 *
 * Phases: idle → (statement) → voting → (revealed) → … → game-end.
 * Timers are owned by the gateway; this class is pure state.
 */

export type VotingGameKind =
  'would-you-rather' | 'most-likely-to' | 'never-have-i-ever' | 'this-or-that';

export type VotingPhase = 'idle' | 'statement' | 'voting' | 'revealed' | 'game-end';

/** M15 — Never Have I Ever content tier (host-chosen; default moderate). */
export type NhieTier = 'boring' | 'moderate' | 'dirty' | 'super-dirty';

/** M15 — where NHIE statements come from (host-chosen; default both). */
export type NhieSource = 'provided' | 'own' | 'both';

export type VotingError =
  | 'NOT_STARTED'
  | 'ALREADY_STARTED'
  | 'NOT_PLAYER'
  | 'WRONG_PHASE'
  | 'ALREADY_VOTED'
  | 'INVALID_OPTION'
  | 'NOT_YOUR_TURN'
  | 'INVALID_STATEMENT';

export type VotingResult<T = unknown> = { ok: true; value: T } | { ok: false; error: VotingError };

export interface VotingOption {
  id: string;
  label: string;
}

export interface VotingTallies {
  optionId: string;
  label: string;
  count: number;
}

export interface VotingReveal {
  kind: VotingGameKind;
  tallies: VotingTallies[];
  totalVotes: number;
  winnerId: string | null;
  winnerLabel: string | null;
  /** Never Have I Ever — aggregate (anonymous) reveal. */
  haveCount?: number;
  haveNotCount?: number;
  /** This or That — majority per round (null on a tie). */
  majorityId?: string | null;
}

export interface VotingConfig {
  kind: VotingGameKind;
  /** Voting phase duration (ms). */
  voteMs: number;
  /** Revealed phase duration (ms) — 0 skips the revealed phase (TOT). */
  revealMs: number;
  /** Never Have I Ever: statement phase duration (ms). */
  statementMs?: number;
  /** Rounds for a given player count (NHIE scales with the room). */
  totalRounds: (playerCount: number) => number;
  /** Most Likely To: voting for yourself is allowed. */
  allowSelfVote: boolean;
}

export interface WyrEntry {
  a: string;
  b: string;
}

export interface MltPrompt {
  prompt: string;
}

export interface NhieSuggestion {
  statement: string;
  /** M15 — content tier; defaults to 'moderate' when absent. */
  tier?: NhieTier;
}

export interface TotPair {
  a: string;
  b: string;
  /** M15 — genre bucket (defaults to 'lifestyle' when absent). */
  genre?: string;
}

interface PlayerState {
  name: string;
}

export class VotingSession {
  private readonly config: VotingConfig;
  private readonly randomIntFn: (max: number) => number;
  private readonly nowFn: () => number;

  private phase: VotingPhase = 'idle';
  private players: PlayerState[] = [];
  private rotationIndex = 0;
  private roundNumber = 0;
  private totalRounds = 0;
  private startedAt = 0;

  // Round content (kind-specific).
  private promptTitle: string | null = null;
  private promptSubtitle: string | null = null;
  private options: VotingOption[] = [];
  private statementBy: string | null = null;
  private statementText: string | null = null;
  private customPrompt = false;

  // Round state.
  private votes = new Map<string, string>(); // playerName → optionId
  private revealed: VotingReveal | null = null;

  // Game-long accumulators.
  private wildness = new Map<string, number>();
  private crowns = new Map<string, number>();
  private herdMatches = new Map<string, number>();
  private herdScores: { playerName: string; score: number }[] | null = null;

  private wyrEntries: WyrEntry[] = [];
  private mltPrompts: MltPrompt[] = [];
  private nhieSuggestions: NhieSuggestion[] = [];
  private totPairs: TotPair[] = [];
  /** WYR: player-submitted dilemma for the next round (useCustomPrompt). */
  private nextWyrEntry: WyrEntry | null = null;
  /** M15 — host-chosen content options, applied for the whole game. */
  private nhieTier: NhieTier = 'moderate';
  private nhieSource: NhieSource = 'both';
  private totGenre: string | null = null;

  constructor(
    config: VotingConfig,
    datasets: {
      wyr?: WyrEntry[];
      mlt?: MltPrompt[];
      nhie?: NhieSuggestion[];
      tot?: TotPair[];
    },
    options: { randomInt?: (max: number) => number; now?: () => number } = {}
  ) {
    this.config = config;
    this.wyrEntries = datasets.wyr ?? [];
    this.mltPrompts = datasets.mlt ?? [];
    this.nhieSuggestions = datasets.nhie ?? [];
    this.totPairs = datasets.tot ?? [];
    this.randomIntFn = options.randomInt ?? ((max) => randomInt(max));
    this.nowFn = options.now ?? (() => Date.now());
  }

  get phaseValue(): VotingPhase {
    return this.phase;
  }

  get currentRound(): number {
    return this.roundNumber;
  }

  get totalRoundsValue(): number {
    return this.totalRounds;
  }

  get startedTimestamp(): number {
    return this.startedAt;
  }

  get roundPrompt(): { title: string | null; subtitle: string | null; custom: boolean } {
    return { title: this.promptTitle, subtitle: this.promptSubtitle, custom: this.customPrompt };
  }

  get roundOptions(): VotingOption[] {
    return this.options;
  }

  get currentStatementBy(): string | null {
    return this.statementBy;
  }

  get currentStatement(): string | null {
    return this.statementText;
  }

  get lastReveal(): VotingReveal | null {
    return this.revealed;
  }

  get tallies(): VotingTallies[] {
    const counts = new Map<string, number>();
    for (const optionId of this.votes.values()) {
      counts.set(optionId, (counts.get(optionId) ?? 0) + 1);
    }
    return this.options
      .map((option) => ({
        optionId: option.id,
        label: option.label,
        count: counts.get(option.id) ?? 0,
      }))
      .sort((a, b) => b.count - a.count);
  }

  get totalVotes(): number {
    return this.votes.size;
  }

  get wildnessScores(): { playerName: string; count: number }[] {
    return [...this.wildness.entries()]
      .map(([playerName, count]) => ({ playerName, count }))
      .sort((a, b) => b.count - a.count);
  }

  get crownCounts(): { playerName: string; count: number }[] {
    return [...this.crowns.entries()]
      .map(([playerName, count]) => ({ playerName, count }))
      .sort((a, b) => b.count - a.count);
  }

  get herdScoresValue(): { playerName: string; score: number }[] | null {
    return this.herdScores;
  }

  get playerNames(): string[] {
    return this.players.map((player) => player.name);
  }

  /** Mid-game joins join the roster so they can vote (D027 pattern). */
  addPlayer(playerName: string): VotingResult<{ name: string }> {
    if (this.phase === 'idle' || this.phase === 'game-end') {
      return { ok: false, error: 'WRONG_PHASE' };
    }
    const name = playerName.trim();
    if (this.players.some((player) => player.name === name)) {
      return { ok: true, value: { name } };
    }
    this.players.push({ name });
    return { ok: true, value: { name } };
  }

  hasVoted(playerName: string): boolean {
    return this.votes.has(playerName);
  }

  /** The option a player voted for this round (null if they haven't). */
  voteOf(playerName: string): string | null {
    return this.votes.get(playerName) ?? null;
  }

  /** WYR: use a player-submitted dilemma for the next round. */
  useCustomPrompt(a: string, b: string): VotingResult<{ queued: boolean }> {
    if (this.config.kind !== 'would-you-rather') {
      return { ok: false, error: 'WRONG_PHASE' };
    }
    this.nextWyrEntry = { a, b };
    return { ok: true, value: { queued: true } };
  }

  /** Suggested statements for the current NHIE turn (pick or write your own).
   * M15: filtered by the host-chosen tier, with a safe fallback — a tier
   * with too few entries tops up from the next-safe tier (super-dirty →
   * dirty → moderate → boring), never the other way. */
  suggestionOptions(count = 4): string[] {
    const order: NhieTier[] = ['boring', 'moderate', 'dirty', 'super-dirty'];
    const start = order.indexOf(this.nhieTier);
    const pool: NhieSuggestion[] = [];
    for (let level = start; level >= 0 && pool.length < 60; level -= 1) {
      pool.push(
        ...this.nhieSuggestions.filter((entry) => (entry.tier ?? 'moderate') === order[level])
      );
    }
    const copy = [...pool];
    const picks: string[] = [];
    while (picks.length < count && copy.length > 0) {
      const index = this.randomIntFn(copy.length);
      const [picked] = copy.splice(index, 1);
      if (picked) {
        picks.push(picked.statement);
      }
    }
    return picks;
  }

  /** M15 — host-chosen content options for this game (before start). */
  setContentOptions(options: {
    nhieTier?: NhieTier;
    nhieSource?: NhieSource;
    totGenre?: string | null;
  }): void {
    if (
      options.nhieTier &&
      ['boring', 'moderate', 'dirty', 'super-dirty'].includes(options.nhieTier)
    ) {
      this.nhieTier = options.nhieTier;
    }
    if (options.nhieSource && ['provided', 'own', 'both'].includes(options.nhieSource)) {
      this.nhieSource = options.nhieSource;
    }
    if (options.totGenre !== undefined) {
      this.totGenre = options.totGenre;
    }
  }

  /** M15 — does the current game use server-provided NHIE suggestions? */
  get usesProvidedSuggestions(): boolean {
    return this.nhieSource !== 'own';
  }

  /** M15 — where NHIE statements come from (drives the statement view). */
  get statementSource(): NhieSource {
    return this.nhieSource;
  }

  start(playerNames: string[]): VotingResult<{ totalRounds: number }> {
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
    this.players = names.map((name) => ({ name }));
    this.totalRounds = this.config.totalRounds(names.length);
    this.startedAt = this.nowFn();
    this.roundNumber = 0;
    this.beginRound();
    return { ok: true, value: { totalRounds: this.totalRounds } };
  }

  /**
   * Advance to the next round (gateway: after the revealed-phase break).
   * Returns { finished } — the gateway emits game-end when true.
   */
  next(): VotingResult<{ finished: boolean }> {
    if (this.phase === 'idle' || this.phase === 'game-end') {
      return { ok: false, error: 'WRONG_PHASE' };
    }
    if (this.roundNumber >= this.totalRounds) {
      this.phase = 'game-end';
      return { ok: true, value: { finished: true } };
    }
    this.beginRound();
    return { ok: true, value: { finished: false } };
  }

  /** NHIE: the current player states something they've never done. */
  submitStatement(
    playerName: string,
    statement: string
  ): VotingResult<{ options: VotingOption[] }> {
    if (this.phase !== 'statement') {
      return { ok: false, error: 'WRONG_PHASE' };
    }
    if (playerName !== this.statementBy) {
      return { ok: false, error: 'NOT_YOUR_TURN' };
    }
    const cleaned = statement.trim();
    if (cleaned.length < 3 || cleaned.length > 120) {
      return { ok: false, error: 'INVALID_STATEMENT' };
    }
    this.statementText = cleaned;
    this.promptTitle = cleaned;
    this.phase = 'voting';
    return { ok: true, value: { options: this.options } };
  }

  submitVote(playerName: string, optionId: string): VotingResult<{ allVoted: boolean }> {
    if (this.phase !== 'voting') {
      return { ok: false, error: 'WRONG_PHASE' };
    }
    if (!this.players.some((player) => player.name === playerName)) {
      return { ok: false, error: 'NOT_PLAYER' };
    }
    if (this.votes.has(playerName)) {
      return { ok: false, error: 'ALREADY_VOTED' };
    }
    // NHIE: the confession author cannot vote on their own statement.
    if (this.config.kind === 'never-have-i-ever' && playerName === this.statementBy) {
      return { ok: false, error: 'NOT_YOUR_TURN' };
    }
    const option = this.options.find((candidate) => candidate.id === optionId);
    if (!option) {
      return { ok: false, error: 'INVALID_OPTION' };
    }
    // MLT options are player names; self-votes are allowed there only.
    if (
      !this.config.allowSelfVote &&
      this.options.some((candidate) => candidate.id === playerName)
    ) {
      if (optionId === playerName) {
        return { ok: false, error: 'INVALID_OPTION' };
      }
    }
    this.votes.set(playerName, optionId);
    const voters =
      this.config.kind === 'never-have-i-ever' ? this.players.length - 1 : this.players.length;
    return { ok: true, value: { allVoted: this.votes.size >= voters } };
  }

  /** End voting → compute the reveal (gateway: timer or all-in). */
  reveal(): VotingResult<{ reveal: VotingReveal }> {
    if (this.phase !== 'voting') {
      return { ok: false, error: 'WRONG_PHASE' };
    }
    const tallies = this.tallies;
    const winner = [...tallies].sort((a, b) => b.count - a.count)[0];
    const reveal: VotingReveal = {
      kind: this.config.kind,
      tallies,
      totalVotes: this.totalVotes,
      winnerId: winner && winner.count > 0 ? winner.optionId : null,
      winnerLabel: winner && winner.count > 0 ? winner.label : null,
    };
    if (this.config.kind === 'never-have-i-ever') {
      reveal.haveCount = tallies.find((row) => row.optionId === 'have')?.count ?? 0;
      reveal.haveNotCount = tallies.find((row) => row.optionId === 'have-not')?.count ?? 0;
      for (const [playerName, optionId] of this.votes) {
        if (optionId === 'have') {
          this.wildness.set(playerName, (this.wildness.get(playerName) ?? 0) + 1);
        }
      }
    }
    if (this.config.kind === 'most-likely-to' && reveal.winnerId) {
      this.crowns.set(reveal.winnerId, (this.crowns.get(reveal.winnerId) ?? 0) + 1);
    }
    if (this.config.kind === 'this-or-that') {
      const majority =
        tallies.length === 2 && tallies[0]!.count > tallies[1]!.count ? tallies[0]!.optionId : null;
      reveal.majorityId = majority;
      for (const [playerName, optionId] of this.votes) {
        if (majority !== null && optionId === majority) {
          this.herdMatches.set(playerName, (this.herdMatches.get(playerName) ?? 0) + 1);
        }
      }
    }
    this.revealed = reveal;
    this.phase = 'revealed';
    return { ok: true, value: { reveal } };
  }

  /** Game-end payload (kind-specific summary). */
  endPayload(): unknown {
    if (this.config.kind === 'this-or-that') {
      const scores = this.players
        .map((player) => ({
          playerName: player.name,
          score: this.herdMatches.get(player.name) ?? 0,
        }))
        .sort((a, b) => b.score - a.score || a.playerName.localeCompare(b.playerName));
      this.herdScores = scores;
      return {
        kind: this.config.kind,
        rounds: this.roundNumber,
        scores,
        winner: scores[0]?.playerName ?? null,
      };
    }
    if (this.config.kind === 'never-have-i-ever') {
      return { kind: this.config.kind, rounds: this.roundNumber, wildness: this.wildnessScores };
    }
    if (this.config.kind === 'most-likely-to') {
      return { kind: this.config.kind, rounds: this.roundNumber, crowns: this.crownCounts };
    }
    return { kind: this.config.kind, rounds: this.roundNumber };
  }

  // --- Round setup ----------------------------------------------------------

  private beginRound(): void {
    this.roundNumber += 1;
    this.votes.clear();
    this.revealed = null;
    this.statementText = null;
    this.customPrompt = false;
    switch (this.config.kind) {
      case 'would-you-rather': {
        const isCustom = this.nextWyrEntry !== null;
        const entry =
          this.nextWyrEntry ?? this.wyrEntries[this.randomIntFn(this.wyrEntries.length)];
        this.nextWyrEntry = null;
        if (entry) {
          this.customPrompt = isCustom;
          this.promptTitle = 'Would you rather…';
          this.promptSubtitle = null;
          this.options = [
            { id: 'a', label: entry.a },
            { id: 'b', label: entry.b },
          ];
        }
        this.phase = 'voting';
        break;
      }
      case 'most-likely-to': {
        const prompt = this.mltPrompts[this.randomIntFn(this.mltPrompts.length)];
        if (prompt) {
          this.promptTitle = `Who is most likely to ${prompt.prompt}?`;
          this.promptSubtitle = null;
          this.options = this.players.map((player) => ({ id: player.name, label: player.name }));
        }
        this.phase = 'voting';
        break;
      }
      case 'never-have-i-ever': {
        const player = this.players[this.rotationIndex % this.players.length];
        if (!player) {
          this.phase = 'game-end';
          return;
        }
        this.rotationIndex += 1;
        this.statementBy = player.name;
        this.promptTitle = `${player.name}, never have I ever…`;
        this.promptSubtitle = 'Share something you have never done — others will vote.';
        this.options = [
          { id: 'have', label: 'I HAVE' },
          { id: 'have-not', label: 'I HAVE NOT' },
        ];
        this.phase = 'statement';
        break;
      }
      case 'this-or-that': {
        // M15 — host-chosen genre, topped up from the full pool when the
        // genre alone is too small to fill the game.
        const pool =
          this.totGenre === null
            ? this.totPairs
            : this.totPairs.filter((pair) => (pair.genre ?? 'lifestyle') === this.totGenre);
        const usable = pool.length >= 20 ? pool : this.totPairs;
        const pair = usable[this.randomIntFn(usable.length)];
        if (pair) {
          this.promptTitle = `Round ${this.roundNumber} of ${this.totalRounds}`;
          this.promptSubtitle = null;
          this.options = [
            { id: 'a', label: pair.a },
            { id: 'b', label: pair.b },
          ];
        }
        this.phase = 'voting';
        break;
      }
    }
  }
}
