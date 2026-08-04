/**
 * Client-side voting-game state (M6) — pure reducer over the server's voting
 * events, shared by Would You Rather, Most Likely To, Never Have I Ever, and
 * This or That. Server-authoritative: the server owns prompts, options,
 * tallies, reveals, and final scores; this mirror only displays them.
 *
 * This or That herd streak is cosmetic (derived from each round's majority);
 * the final herd-alignment score comes from the server at game end.
 */

export type VotingKind =
  'would-you-rather' | 'most-likely-to' | 'never-have-i-ever' | 'this-or-that';

export type VotingView = 'statement' | 'voting' | 'revealed' | 'game-end';

export interface VotingOption {
  id: string;
  label: string;
}

export interface VotingTally {
  optionId: string;
  label: string;
  count: number;
}

export interface VotingReveal {
  kind: VotingKind;
  tallies: VotingTally[];
  totalVotes: number;
  winnerId: string | null;
  winnerLabel: string | null;
  /** Never Have I Ever — aggregate (anonymous) reveal. */
  haveCount?: number;
  haveNotCount?: number;
  /** This or That — majority option id (null on a tie). */
  majorityId?: string | null;
}

export interface VotingGameState {
  view: VotingView;
  kind: VotingKind;
  myName: string | null;
  prompt: { title: string | null; subtitle: string | null };
  options: VotingOption[];
  round: number;
  totalRounds: number;
  endsAt: number | null;
  /** Never Have I Ever — whose turn it is to confess. */
  statementBy: string | null;
  statement: string | null;
  /** WYR — player-submitted dilemma from the room queue. */
  custom: boolean;
  myVote: string | null;
  tallies: VotingTally[];
  reveal: VotingReveal | null;
  /** This or That — cosmetic streak; resets when you leave the herd. */
  herdStreak: number;
  /** This or That — server score at game end. */
  herdMatches: number;
  /** Never Have I Ever — server-suggested statements (current turn). */
  suggestions: string[];
  /** M15 — Never Have I Ever — where statements come from (host choice). */
  statementSource: 'provided' | 'own' | 'both';
  /** Never Have I Ever — running wildness tallies. */
  wildness: { playerName: string; count: number }[];
  /** Most Likely To — running crown tallies. */
  crowns: { playerName: string; count: number }[];
  /** Game-end summary (kind-specific). */
  endPayload: Record<string, unknown> | null;
  /** Local feedback (queueing, rejected votes…). */
  feedback: string | null;
}

export function initialVotingState(): VotingGameState {
  return {
    view: 'voting',
    kind: 'would-you-rather',
    myName: null,
    prompt: { title: null, subtitle: null },
    options: [],
    round: 0,
    totalRounds: 0,
    endsAt: null,
    statementBy: null,
    statement: null,
    custom: false,
    myVote: null,
    tallies: [],
    reveal: null,
    herdStreak: 0,
    herdMatches: 0,
    suggestions: [],
    statementSource: 'both',
    wildness: [],
    crowns: [],
    endPayload: null,
    feedback: null,
  };
}

export type VotingAction =
  | { type: 'reset' }
  | {
      type: 'round-start';
      payload: {
        kind: VotingKind;
        phase: 'statement' | 'voting';
        prompt: { title: string | null; subtitle: string | null };
        options: VotingOption[];
        round: number;
        totalRounds: number;
        statementBy: string | null;
        statement: string | null;
        custom: boolean;
        endsAt: number;
        suggestions?: string[];
        statementSource?: 'provided' | 'own' | 'both';
      };
      myName: string;
    }
  | { type: 'vote-update'; tallies: VotingTally[]; totalVotes: number }
  | { type: 'vote-cast'; optionId: string }
  | { type: 'vote-reveal'; reveal: VotingReveal }
  | { type: 'game-end'; payload: Record<string, unknown> }
  | { type: 'feedback'; text: string | null }
  | {
      type: 'resync';
      myName: string;
      state: {
        view: VotingView;
        kind: VotingKind;
        prompt: { title: string | null; subtitle: string | null };
        options: VotingOption[];
        round: number;
        totalRounds: number;
        statementBy: string | null;
        statement: string | null;
        tallies: VotingTally[];
        reveal: VotingReveal | null;
        myVote: string | null;
        endsAt: number | null;
      };
    };

export function votingReducer(state: VotingGameState, action: VotingAction): VotingGameState {
  switch (action.type) {
    case 'reset':
      return { ...initialVotingState(), myName: state.myName };
    case 'round-start': {
      const { payload, myName } = action;
      // This or That has no revealed phase; the streak carries over rounds.
      const streakCarry =
        state.kind === 'this-or-that' && state.view === 'voting' ? state.herdStreak : 0;
      return {
        ...initialVotingState(),
        view: payload.phase === 'statement' ? 'statement' : 'voting',
        kind: payload.kind,
        myName,
        prompt: payload.prompt,
        options: payload.options,
        round: payload.round,
        totalRounds: payload.totalRounds,
        endsAt: payload.endsAt,
        statementBy: payload.statementBy,
        statement: payload.statement,
        custom: payload.custom,
        suggestions: payload.suggestions ?? [],
        statementSource: payload.statementSource ?? 'both',
        wildness: state.wildness,
        crowns: state.crowns,
        herdStreak: streakCarry,
        herdMatches: state.herdMatches,
        feedback: null,
      };
    }
    case 'vote-update':
      return { ...state, tallies: action.tallies, endsAt: state.endsAt };
    case 'vote-cast':
      return { ...state, myVote: action.optionId };
    case 'vote-reveal': {
      const reveal = action.reveal;
      const base = { ...state, view: 'revealed' as VotingView, reveal };
      if (reveal.majorityId !== undefined) {
        const matched =
          reveal.majorityId !== null && state.myVote !== null && reveal.majorityId === state.myVote;
        return {
          ...base,
          herdStreak: matched ? state.herdStreak + 1 : 0,
        };
      }
      return base;
    }
    case 'game-end': {
      const payload = action.payload;
      const wildness = Array.isArray(payload.wildness)
        ? (payload.wildness as { playerName: string; count: number }[])
        : state.wildness;
      const crowns = Array.isArray(payload.crowns)
        ? (payload.crowns as { playerName: string; count: number }[])
        : state.crowns;
      const herdScores = Array.isArray(payload.scores)
        ? (payload.scores as { playerName: string; score: number }[])
        : null;
      const mine = state.myName;
      const myHerd = herdScores?.find((entry) => entry.playerName === mine)?.score ?? null;
      return {
        ...state,
        view: 'game-end',
        endPayload: payload,
        wildness,
        crowns,
        herdMatches: myHerd ?? state.herdMatches,
        tallies: [],
        reveal: null,
        endsAt: null,
      };
    }
    case 'feedback':
      return { ...state, feedback: action.text };
    case 'resync': {
      const { state: snapshot, myName } = action;
      return {
        ...initialVotingState(),
        view: snapshot.view,
        kind: snapshot.kind,
        myName,
        prompt: snapshot.prompt,
        options: snapshot.options,
        round: snapshot.round,
        totalRounds: snapshot.totalRounds,
        endsAt: snapshot.endsAt,
        statementBy: snapshot.statementBy,
        statement: snapshot.statement,
        myVote: snapshot.myVote,
        tallies: snapshot.tallies,
        reveal: snapshot.reveal,
        wildness: state.wildness,
        crowns: state.crowns,
      };
    }
    default:
      return state;
  }
}
