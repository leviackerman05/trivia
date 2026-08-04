/**
 * Client-side Trivia room state (M8), pure reducer over the server's trivia
 * events (question → revealed → game-end). Server-authoritative: the server
 * owns questions, timing, scoring, and the final podium; the correct answer
 * index only ever arrives in the round-reveal (never in the question).
 */

export type TriviaView = 'question' | 'revealed' | 'game-end';
export type TriviaMode = 'race' | 'wrong-answers';

export interface TriviaQuestionView {
  category: string;
  question: string;
  options: string[];
}

export interface TriviaRoundResult {
  playerName: string;
  points: number;
  correct: boolean;
}

export interface TriviaScoreRow {
  playerName: string;
  score: number;
}

export interface TriviaGameState {
  view: TriviaView;
  mode: TriviaMode;
  myName: string | null;
  question: TriviaQuestionView | null;
  round: number;
  totalRounds: number;
  endsAt: number | null;
  myAnswer: number | null;
  /** Points banked for my answer (from the ack, shown on reveal). */
  myPoints: number | null;
  correctIndex: number | null;
  results: TriviaRoundResult[];
  scores: TriviaScoreRow[];
  finalScores: TriviaScoreRow[] | null;
  winner: string | null;
  /** Feedback for my answer ("Correct! +150"). */
  feedback: string | null;
}

export function initialTriviaState(): TriviaGameState {
  return {
    view: 'question',
    mode: 'race',
    myName: null,
    question: null,
    round: 0,
    totalRounds: 0,
    endsAt: null,
    myAnswer: null,
    myPoints: null,
    correctIndex: null,
    results: [],
    scores: [],
    finalScores: null,
    winner: null,
    feedback: null,
  };
}

export type TriviaAction =
  | { type: 'reset' }
  | {
      type: 'question-start';
      myName: string;
      payload: {
        mode: TriviaMode;
        question: TriviaQuestionView;
        round: number;
        totalRounds: number;
        endsAt: number;
      };
    }
  | { type: 'answered'; optionIndex: number; points: number; correct: boolean }
  | {
      type: 'reveal';
      payload: { correctIndex: number; results: TriviaRoundResult[]; scores: TriviaScoreRow[] };
    }
  | { type: 'game-end'; payload: Record<string, unknown> }
  | { type: 'feedback'; text: string | null }
  | {
      type: 'resync';
      myName: string;
      state: {
        view: TriviaView;
        mode: TriviaMode;
        question: TriviaQuestionView | null;
        round: number;
        totalRounds: number;
        myAnswer: { optionIndex: number; points: number } | null;
        reveal: { correctIndex: number; results: TriviaRoundResult[] } | null;
        scores: TriviaScoreRow[];
      };
    };

export function triviaRoomReducer(state: TriviaGameState, action: TriviaAction): TriviaGameState {
  switch (action.type) {
    case 'reset':
      return { ...initialTriviaState(), myName: state.myName };
    case 'question-start':
      return {
        ...initialTriviaState(),
        view: 'question',
        mode: action.payload.mode,
        myName: action.myName,
        question: action.payload.question,
        round: action.payload.round,
        totalRounds: action.payload.totalRounds,
        endsAt: action.payload.endsAt,
        scores: state.scores,
      };
    case 'answered':
      // The server rejects a second answer; the reducer mirrors that (the
      // first pick and its banked points always win).
      if (state.myAnswer !== null) {
        return state;
      }
      return {
        ...state,
        myAnswer: action.optionIndex,
        myPoints: action.points,
        feedback:
          action.correct && state.mode === 'race'
            ? `Correct! +${action.points} points`
            : action.correct
              ? 'Correct answer, but this is Wrong Answers Only! +0'
              : `Wrong answer, the room approves! +${action.points} points`,
      };
    case 'reveal':
      return {
        ...state,
        view: 'revealed',
        correctIndex: action.payload.correctIndex,
        results: action.payload.results,
        scores: action.payload.scores,
        endsAt: null,
      };
    case 'game-end': {
      const scores = Array.isArray(action.payload.scores)
        ? (action.payload.scores as TriviaScoreRow[])
        : state.scores;
      return {
        ...state,
        view: 'game-end',
        finalScores: scores,
        winner: typeof action.payload.winner === 'string' ? action.payload.winner : null,
        endsAt: null,
        correctIndex: null,
        results: [],
      };
    }
    case 'feedback':
      return { ...state, feedback: action.text };
    case 'resync': {
      const snapshot = action.state;
      return {
        ...initialTriviaState(),
        view: snapshot.view,
        mode: snapshot.mode,
        myName: action.myName,
        question: snapshot.question,
        round: snapshot.round,
        totalRounds: snapshot.totalRounds,
        myAnswer: snapshot.myAnswer?.optionIndex ?? null,
        myPoints: snapshot.myAnswer?.points ?? null,
        correctIndex: snapshot.reveal?.correctIndex ?? null,
        results: snapshot.reveal?.results ?? [],
        scores: snapshot.scores,
      };
    }
    default:
      return state;
  }
}
