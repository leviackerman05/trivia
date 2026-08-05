/**
 * Client-side Guess Who state (M9/M17 + owner redesign 2026-08-06), pure
 * reducer over the server's guess-who events. The celebrity's NAME is hidden
 * from everyone (not even the host sees it): every player gets the traits +
 * facts (the clue) and a Skribbl-style letter pattern that reveals more of
 * the name as the 60s round timer runs; guesses are verified server-side.
 * M17 keeps multi-round play: 5 rounds, +1 per correct guess, celebrity
 * facts revealed between rounds.
 */

export type GuessWhoView = 'questioning' | 'revealed' | 'game-end';

/** D064, market-of-fame region (the design's closed union, mirror of the server). */
export type CelebrityRegion = 'bollywood' | 'hollywood' | 'row';

/** D064, the closed 12-genre fame taxonomy (the server's enum gate freezes it). */
export type CelebrityGenre =
  | 'music'
  | 'cinema'
  | 'television'
  | 'sports'
  | 'politics'
  | 'business'
  | 'science'
  | 'technology'
  | 'literature'
  | 'internet'
  | 'art-fashion'
  | 'royalty';

/** D064 lobby filter: region/genre AND semantics; 'all' = no constraint. */
export interface GuessWhoFilter {
  region: 'all' | CelebrityRegion;
  genre: 'all' | CelebrityGenre;
}

export interface GuessWhoFilterOption {
  value: string;
  count: number;
}

/** D064 pool statistics from the server (counts contract, values only, no labels). */
export interface GuessWhoFilterOptions {
  regions: GuessWhoFilterOption[];
  genres: GuessWhoFilterOption[];
}

/** D064, the hide-empty contract: a chip renders only when its cell can fill a game. */
export const GUESS_WHO_TOTAL_ROUNDS = 5;

/** D064 static FE label maps (the counts contract never ships labels). */
export const REGION_LABELS: Record<string, string> = {
  all: 'All',
  bollywood: 'Bollywood',
  hollywood: 'Hollywood',
  row: 'RoW',
};

export const GENRE_LABELS: Record<string, string> = {
  all: 'All',
  music: 'Music',
  cinema: 'Cinema',
  television: 'Television',
  sports: 'Sports',
  politics: 'Politics',
  business: 'Business',
  science: 'Science',
  technology: 'Technology',
  literature: 'Literature',
  internet: 'Internet',
  'art-fashion': 'Art & Fashion',
  royalty: 'Royalty',
};

/** D064 label fallback: unknown values (taxonomy drift) render as the raw string. */
export function filterLabel(value: string, labels: Record<string, string>): string {
  return labels[value] ?? value;
}

export interface CelebrityView {
  name: string;
  gender: 'm' | 'f';
  alive: boolean;
  profession: string;
  nationality: string;
  ageRange: string;
  hairColor: string;
  famousFor: string;
  /** M17, fun facts revealed after the round. */
  facts: string[];
}

/** Owner redesign: the questioning clue is the traits + facts WITHOUT the
 * name — it goes to every device, host included. */
export type GuessWhoClue = Omit<CelebrityView, 'name'>;

export interface GuessWhoScoreRow {
  playerName: string;
  score: number;
}

export interface GuessWhoGameState {
  view: GuessWhoView;
  myName: string | null;
  /** The traits + facts everyone sees during questioning (no name). */
  clue: GuessWhoClue | null;
  /** Skribbl-style name pattern ("S____ R____"); more letters reveal over
   * time via the round-hint event. */
  namePattern: string | null;
  /** Round deadline (ms epoch); null outside questioning. */
  endsAt: number | null;
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
  /** D064 applied deck filter (set from the start ack; echoed in lobby + round header). */
  filter: GuessWhoFilter;
  /** D064 pool statistics for the lobby chips; null until the server sends them. */
  filterOptions: GuessWhoFilterOptions | null;
}

export function initialGuessWhoState(): GuessWhoGameState {
  return {
    view: 'questioning',
    myName: null,
    clue: null,
    namePattern: null,
    endsAt: null,
    round: 0,
    totalRounds: 5,
    scores: [],
    revealed: null,
    winner: null,
    revealFinished: false,
    feedback: null,
    filter: { region: 'all', genre: 'all' },
    filterOptions: null,
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
        round: number;
        totalRounds: number;
        scores: GuessWhoScoreRow[];
        clue?: GuessWhoClue;
        namePattern?: string;
        endsAt?: number;
        /** D064 echo of the applied deck filter (absent until BE2 lands). */
        filter?: GuessWhoFilter;
      };
    }
  | { type: 'hint'; pattern: string }
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
  | { type: 'filter-options'; payload: GuessWhoFilterOptions }
  | { type: 'set-filter'; filter: GuessWhoFilter }
  | {
      type: 'resync';
      myName: string;
      state: {
        view: GuessWhoView;
        round: number;
        totalRounds: number;
        scores: GuessWhoScoreRow[];
        winner: string | null;
        clue?: GuessWhoClue;
        namePattern?: string;
        endsAt?: number;
        /** D064 echo of the applied deck filter on resync. */
        filter?: GuessWhoFilter;
      };
    };

export function guessWhoReducer(
  state: GuessWhoGameState,
  action: GuessWhoAction
): GuessWhoGameState {
  switch (action.type) {
    case 'reset':
      // The pool stats survive a restart (options re-emit on join, not on
      // restart); the filter itself resets like the charades category.
      return {
        ...initialGuessWhoState(),
        myName: state.myName,
        filterOptions: state.filterOptions,
      };
    case 'filter-options':
      return { ...state, filterOptions: action.payload };
    case 'set-filter':
      // D064, optimistic local update after the host's set-filter ack (the
      // server only echoes the filter again at round start).
      return { ...state, filter: action.filter };
    case 'round-start': {
      const payload = action.payload;
      if (payload.kind !== 'guess-who' || payload.phase !== 'questioning') {
        return state;
      }
      return {
        ...initialGuessWhoState(),
        view: 'questioning',
        myName: action.myName,
        clue: payload.clue ?? null,
        namePattern: payload.namePattern ?? null,
        endsAt: payload.endsAt ?? null,
        round: payload.round,
        totalRounds: payload.totalRounds,
        scores: payload.scores,
        // D064: the start ack echo wins; otherwise carry the lobby filter
        // across rounds (rounds 2-5 may not re-echo it).
        filter: payload.filter ?? state.filter,
        filterOptions: state.filterOptions,
      };
    }
    case 'hint':
      // Skribbl-style: more letters of the name became visible.
      return { ...state, namePattern: action.pattern };
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
        clue: action.state.clue ?? null,
        namePattern: action.state.namePattern ?? null,
        endsAt: action.state.endsAt ?? null,
        round: action.state.round,
        totalRounds: action.state.totalRounds,
        scores: action.state.scores,
        winner: action.state.winner,
        filter: action.state.filter ?? state.filter,
        filterOptions: state.filterOptions,
      };
    default:
      return state;
  }
}
