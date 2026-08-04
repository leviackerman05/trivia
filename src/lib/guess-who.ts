/**
 * Client-side Guess Who state (M9/M17) — pure reducer over the server's
 * guess-who events. The secret celebrity only ever arrives on the
 * ANSWERER's device (D023); everyone else sees the question log. M17 adds
 * multi-round play: 5 rounds, rotating answerer, +1 per correct guess,
 * celebrity facts revealed between rounds.
 */

export type GuessWhoView = 'questioning' | 'revealed' | 'game-end';

export interface CelebrityView {
  name: string;
  gender: 'm' | 'f';
  alive: boolean;
  profession: string;
  nationality: string;
  ageRange: string;
  hairColor: string;
  famousFor: string;
  /** M17 — fun facts revealed after the round. */
  facts: string[];
}

export interface QuestionEntry {
  playerName: string;
  question: string;
  answer: boolean | null;
  at: number;
}

export interface GuessWhoScoreRow {
  playerName: string;
  score: number;
}

export interface GuessWhoGameState {
  view: GuessWhoView;
  myName: string | null;
  answerer: string | null;
  /** Answerer-only secret (null for everyone else). */
  celebrity: CelebrityView | null;
  questions: QuestionEntry[];
  questionCount: number;
  maxQuestions: number;
  round: number;
  totalRounds: number;
  /** Running scores (+1 per correct guess). */
  scores: GuessWhoScoreRow[];
  /** Revealed after each round (celebrity + facts) for everyone. */
  revealed: { name: string; famousFor: string; facts: string[] } | null;
  winner: string | null;
  /** True when the reveal was the final round (host sees final results). */
  revealFinished: boolean;
  feedback: string | null;
}

export function initialGuessWhoState(): GuessWhoGameState {
  return {
    view: 'questioning',
    myName: null,
    answerer: null,
    celebrity: null,
    questions: [],
    questionCount: 0,
    maxQuestions: 20,
    round: 0,
    totalRounds: 5,
    scores: [],
    revealed: null,
    winner: null,
    revealFinished: false,
    feedback: null,
  };
}

export type GuessWhoAction =
  | { type: 'reset' }
  | {
      type: 'round-start';
      myName: string;
      payload: {
        kind: string;
        phase: string;
        answerer: string;
        questionCount: number;
        maxQuestions: number;
        round: number;
        totalRounds: number;
        scores: GuessWhoScoreRow[];
        celebrity?: CelebrityView;
      };
    }
  | {
      type: 'questions-updated';
      payload: {
        questions: QuestionEntry[];
        questionCount: number;
        maxQuestions: number;
        finished: boolean;
      };
    }
  | {
      type: 'reveal';
      payload: {
        celebrity: { name: string; famousFor: string; facts: string[] } | null;
        winner: string | null;
        scores: GuessWhoScoreRow[];
        round: number;
        totalRounds: number;
        finished: boolean;
      };
    }
  | { type: 'game-end'; payload: Record<string, unknown> }
  | { type: 'feedback'; text: string | null }
  | {
      type: 'resync';
      myName: string;
      state: {
        view: GuessWhoView;
        answerer: string | null;
        questionCount: number;
        maxQuestions: number;
        questions: QuestionEntry[];
        winner: string | null;
        round: number;
        totalRounds: number;
        scores: GuessWhoScoreRow[];
        celebrity: CelebrityView | null;
      };
    };

export function guessWhoReducer(
  state: GuessWhoGameState,
  action: GuessWhoAction
): GuessWhoGameState {
  switch (action.type) {
    case 'reset':
      return { ...initialGuessWhoState(), myName: state.myName };
    case 'round-start': {
      const payload = action.payload;
      if (payload.kind !== 'guess-who' || payload.phase !== 'questioning') {
        return state;
      }
      return {
        ...initialGuessWhoState(),
        view: 'questioning',
        myName: action.myName,
        answerer: payload.answerer,
        celebrity: payload.celebrity ?? null,
        questionCount: payload.questionCount,
        maxQuestions: payload.maxQuestions,
        round: payload.round,
        totalRounds: payload.totalRounds,
        scores: payload.scores,
      };
    }
    case 'questions-updated':
      return {
        ...state,
        questions: action.payload.questions,
        questionCount: action.payload.questionCount,
        maxQuestions: action.payload.maxQuestions,
      };
    case 'reveal':
      return {
        ...state,
        view: 'revealed',
        revealed: action.payload.celebrity,
        winner: action.payload.winner,
        scores: action.payload.scores,
        round: action.payload.round,
        totalRounds: action.payload.totalRounds,
        revealFinished: action.payload.finished === true,
        feedback: null,
      };
    case 'game-end': {
      const celebrity = action.payload.celebrity as { name: string; famousFor: string } | undefined;
      const scores = Array.isArray(action.payload.scores)
        ? (action.payload.scores as GuessWhoScoreRow[])
        : state.scores;
      return {
        ...state,
        view: 'game-end',
        revealed: celebrity ? { ...celebrity, facts: [] } : state.revealed,
        winner: typeof action.payload.winner === 'string' ? action.payload.winner : null,
        scores,
      };
    }
    case 'feedback':
      return { ...state, feedback: action.text };
    case 'resync':
      return {
        ...initialGuessWhoState(),
        view: action.state.view,
        myName: action.myName,
        answerer: action.state.answerer,
        celebrity: action.state.celebrity,
        questions: action.state.questions,
        questionCount: action.state.questionCount,
        maxQuestions: action.state.maxQuestions,
        round: action.state.round,
        totalRounds: action.state.totalRounds,
        scores: action.state.scores,
        winner: action.state.winner,
      };
    default:
      return state;
  }
}
