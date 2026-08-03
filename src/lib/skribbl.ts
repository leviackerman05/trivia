/**
 * Client-side Skribbl Arena game state (PRD §5.1).
 * A pure reducer over the server's additive round events — the island
 * dispatches actions and renders. Server-authoritative: the server owns
 * phases, timers, words, and scores; this mirror only displays them.
 */

import type { Stroke } from './canvas';

export type SkribblView = 'word-select' | 'drawing' | 'round-results' | 'game-end';

export interface SkribblScoreEntry {
  playerName: string;
  score: number;
}

export interface SkribblRoundSummary {
  roundNumber: number;
  word: string;
  drawerName: string;
  correct: { playerName: string; points: number }[];
  drawerPoints: number;
  scores: SkribblScoreEntry[];
}

/** Payload of the additive round-start event (choices are drawer-only). */
export interface RoundStartPayload {
  round: number;
  totalRounds: number;
  drawerName: string;
  wordLength: number | null;
  choices?: string[];
  endsAt?: number;
}

export interface SkribblGameState {
  view: SkribblView;
  myName: string | null;
  drawerName: string | null;
  round: number;
  totalRounds: number;
  wordLength: number | null;
  /** The 3 word options — only the drawer ever sees these. */
  choices: string[] | null;
  firstLetter: string | null;
  lastLetter: string | null;
  /** Server-clock deadline of the drawing phase (ms epoch). */
  endsAt: number | null;
  scores: Record<string, number>;
  strokes: Stroke[];
  summary: SkribblRoundSummary | null;
  finalScores: SkribblScoreEntry[] | null;
  winner: string | null;
  /** Feedback for my last guess ("Wrong…", "Correct! +80"). */
  guessFeedback: string | null;
  /** Monotonic id so repeated feedback still re-renders. */
  feedbackSeq: number;
}

export function initialSkribblState(): SkribblGameState {
  return {
    view: 'word-select',
    myName: null,
    drawerName: null,
    round: 0,
    totalRounds: 0,
    wordLength: null,
    choices: null,
    firstLetter: null,
    lastLetter: null,
    endsAt: null,
    scores: {},
    strokes: [],
    summary: null,
    finalScores: null,
    winner: null,
    guessFeedback: null,
    feedbackSeq: 0,
  };
}

export type SkribblAction =
  | { type: 'reset' }
  | { type: 'round-start'; payload: RoundStartPayload; myName: string }
  | { type: 'round-hint'; firstLetter: string | null; lastLetter: string | null }
  | { type: 'stroke-added'; stroke: Stroke }
  | { type: 'stroke-removed'; strokeId: string }
  | { type: 'canvas-cleared' }
  | { type: 'round-end'; payload: SkribblRoundSummary }
  | { type: 'game-end'; payload: { scores: SkribblScoreEntry[]; winner: string } }
  | {
      type: 'guess-result';
      correct: boolean;
      points?: number;
      alreadyGuessed?: boolean;
      /** Server/transport error text (e.g. late guess) — overrides the defaults. */
      message?: string;
    }
  | {
      type: 'resync';
      myName: string;
      state: {
        view: SkribblView;
        round: number;
        totalRounds: number;
        drawerName: string | null;
        wordLength: number | null;
        choices: string[] | null;
        firstLetter: string | null;
        lastLetter: string | null;
        endsAt: number | null;
        scores: Record<string, number>;
        strokes: Stroke[];
        summary: SkribblRoundSummary | null;
        finalScores: SkribblScoreEntry[] | null;
        winner: string | null;
      };
    };

export function skribblReducer(state: SkribblGameState, action: SkribblAction): SkribblGameState {
  switch (action.type) {
    case 'reset':
      return { ...initialSkribblState(), myName: state.myName };
    case 'round-start': {
      // Word-select events carry no deadline; drawing events do. Choices are
      // drawer-only, so endsAt is the reliable discriminator for everyone.
      const isWordSelect = action.payload.endsAt === undefined;
      return {
        ...state,
        view: isWordSelect ? 'word-select' : 'drawing',
        myName: action.myName,
        drawerName: action.payload.drawerName,
        round: action.payload.round,
        totalRounds: action.payload.totalRounds,
        wordLength: action.payload.wordLength,
        choices: action.payload.choices ?? null,
        endsAt: action.payload.endsAt ?? null,
        firstLetter: null,
        lastLetter: null,
        summary: null,
        guessFeedback: null,
        // Fresh round → fresh canvas (drawer already cleared locally; others
        // must not keep the previous round's picture).
        strokes: [],
      };
    }
    case 'round-hint':
      return { ...state, firstLetter: action.firstLetter, lastLetter: action.lastLetter };
    case 'stroke-added':
      return { ...state, strokes: [...state.strokes, action.stroke] };
    case 'stroke-removed':
      return { ...state, strokes: state.strokes.filter((s) => s.strokeId !== action.strokeId) };
    case 'canvas-cleared':
      return { ...state, strokes: [] };
    case 'round-end':
      return {
        ...state,
        view: 'round-results',
        summary: action.payload,
        scores: Object.fromEntries(action.payload.scores.map((s) => [s.playerName, s.score])),
        guessFeedback: null,
      };
    case 'game-end':
      return {
        ...state,
        view: 'game-end',
        finalScores: action.payload.scores,
        winner: action.payload.winner,
        summary: null,
      };
    case 'guess-result': {
      let feedback: string;
      if (action.message) {
        feedback = action.message;
      } else if (action.alreadyGuessed) {
        feedback = 'Already guessed it — the word is yours!';
      } else if (action.correct) {
        feedback = `Correct! +${action.points ?? 0} points`;
      } else {
        feedback = 'Wrong — keep guessing!';
      }
      return { ...state, guessFeedback: feedback, feedbackSeq: state.feedbackSeq + 1 };
    }
    case 'resync':
      return { ...initialSkribblState(), myName: action.myName, ...action.state };
    default:
      return state;
  }
}
