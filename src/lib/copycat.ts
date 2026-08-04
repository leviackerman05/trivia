/**
 * Copycat Challenge client state (M5) — pure reducer over the server's
 * Copycat events (image-reveal → drawing → gallery → voting → results).
 * Unlike the shared-canvas games, the private drawing never leaves this
 * device until it is submitted as a flattened PNG data URL.
 */

import type { Stroke } from './canvas';

export type CopycatView = 'image-reveal' | 'drawing' | 'gallery' | 'voting' | 'results';
export type CopycatAward = 'recognizable' | 'funniest' | 'abstract';

export const COPYCAT_AWARD_LABELS: Record<CopycatAward, string> = {
  recognizable: 'Most Recognizable',
  funniest: 'Funniest',
  abstract: 'Most Abstract',
};

export interface CopycatImage {
  title: string;
  url: string;
  kind: 'painting' | 'photo';
}

export interface CopycatDrawing {
  playerName: string;
  image: string;
}

export interface CopycatVoteRow {
  playerName: string;
  count: number;
}

export interface CopycatAwardResult {
  category: CopycatAward;
  winner: string | null;
  votes: CopycatVoteRow[];
}

export interface CopycatGameState {
  view: CopycatView;
  myName: string | null;
  image: CopycatImage | null;
  /** M13 — my device finished loading the reveal image (local flag). */
  imageLoaded: boolean;
  /** Server-clock deadline of the current phase (ms epoch). */
  endsAt: number | null;
  /** My private strokes — local only, never broadcast. */
  strokes: Stroke[];
  submitted: boolean;
  drawings: CopycatDrawing[];
  tallies: Partial<Record<CopycatAward, CopycatVoteRow[]>>;
  /** My votes per category (optimistic once acked). */
  myVotes: Partial<Record<CopycatAward, string>>;
  awards: CopycatAwardResult[] | null;
  /** Local-only feedback ("submitted", "image too complex"). */
  feedback: string | null;
}

export function initialCopycatState(): CopycatGameState {
  return {
    view: 'image-reveal',
    myName: null,
    image: null,
    imageLoaded: false,
    endsAt: null,
    strokes: [],
    submitted: false,
    drawings: [],
    tallies: {},
    myVotes: {},
    awards: null,
    feedback: null,
  };
}

export type CopycatAction =
  | { type: 'reset' }
  | { type: 'image-loaded' }
  | { type: 'round-timer'; endsAt: number }
  | {
      type: 'round-start';
      phase: 'image-reveal' | 'drawing';
      myName: string;
      image?: CopycatImage;
      endsAt: number;
    }
  | { type: 'gallery'; drawings: CopycatDrawing[] }
  | { type: 'vote-start'; endsAt: number }
  | { type: 'vote-update'; category: CopycatAward; votes: CopycatVoteRow[] }
  | { type: 'vote-cast'; category: CopycatAward; target: string }
  | { type: 'vote-reveal'; awards: CopycatAwardResult[] }
  | { type: 'submitted' }
  | { type: 'stroke-added'; stroke: Stroke }
  | { type: 'stroke-removed'; strokeId: string }
  | { type: 'canvas-cleared' }
  | { type: 'feedback'; text: string | null }
  | {
      type: 'resync';
      myName: string;
      state: {
        view: CopycatView;
        image: CopycatImage | null;
        drawings: CopycatDrawing[];
        awards: CopycatAwardResult[] | null;
      };
    };

export function copycatReducer(state: CopycatGameState, action: CopycatAction): CopycatGameState {
  switch (action.type) {
    case 'reset':
      return { ...initialCopycatState(), myName: state.myName };
    case 'image-loaded':
      return { ...state, imageLoaded: true };
    case 'round-timer':
      return { ...state, endsAt: action.endsAt };
    case 'round-start':
      return {
        ...state,
        view: action.phase,
        myName: action.myName,
        image: action.phase === 'image-reveal' ? (action.image ?? state.image) : state.image,
        imageLoaded: false,
        endsAt: action.endsAt,
        strokes: [],
        submitted: false,
        drawings: [],
        tallies: {},
        myVotes: {},
        awards: null,
        feedback: null,
      };
    case 'gallery':
      return { ...state, view: 'gallery', drawings: action.drawings, endsAt: null };
    case 'vote-start':
      return { ...state, view: 'voting', endsAt: action.endsAt };
    case 'vote-update':
      return { ...state, tallies: { ...state.tallies, [action.category]: action.votes } };
    case 'vote-cast':
      return { ...state, myVotes: { ...state.myVotes, [action.category]: action.target } };
    case 'vote-reveal':
      return { ...state, view: 'results', awards: action.awards, endsAt: null };
    case 'submitted':
      return {
        ...state,
        submitted: true,
        feedback: 'Drawing submitted — waiting for the gallery.',
      };
    case 'stroke-added':
      return { ...state, strokes: [...state.strokes, action.stroke] };
    case 'stroke-removed':
      return { ...state, strokes: state.strokes.filter((s) => s.strokeId !== action.strokeId) };
    case 'canvas-cleared':
      return { ...state, strokes: [] };
    case 'feedback':
      return { ...state, feedback: action.text };
    case 'resync':
      return {
        ...initialCopycatState(),
        myName: action.myName,
        ...action.state,
        strokes: [],
      };
    default:
      return state;
  }
}
