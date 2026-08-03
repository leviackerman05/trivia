/**
 * Client-side Charades state (M9) — pure reducer over the server's charades
 * events. The movie title only ever arrives on the ACTOR's device (D023).
 */

export type CharadesView = 'acting' | 'game-end';

export interface CharadesGameState {
  view: CharadesView;
  myName: string | null;
  actor: string | null;
  /** Actor-only secret (null for everyone else). */
  movie: string | null;
  category: 'hollywood' | 'bollywood' | 'mixed';
  round: number;
  totalRounds: number;
  endsAt: number | null;
  score: number;
  /** Announcement from the previous round ("Correct! +1"). */
  lastRound: { scored: boolean; nextActor: string | null } | null;
  winner: string | null;
}

export function initialCharadesState(): CharadesGameState {
  return {
    view: 'acting',
    myName: null,
    actor: null,
    movie: null,
    category: 'mixed',
    round: 0,
    totalRounds: 0,
    endsAt: null,
    score: 0,
    lastRound: null,
    winner: null,
  };
}

export type CharadesAction =
  | { type: 'reset' }
  | {
      type: 'round-start';
      myName: string;
      payload: {
        kind: string;
        phase: string;
        category: 'hollywood' | 'bollywood' | 'mixed';
        round: number;
        totalRounds: number;
        score: number;
        endsAt: number;
        actor?: string;
        movie?: string;
      };
    }
  | { type: 'round-end'; scored: boolean; score: number; nextActor: string | null }
  | { type: 'game-end'; payload: Record<string, unknown> }
  | {
      type: 'resync';
      myName: string;
      state: {
        view: CharadesView;
        category: 'hollywood' | 'bollywood' | 'mixed';
        round: number;
        totalRounds: number;
        actor: string | null;
        score: number;
        movie: string | null;
      };
    };

export function charadesReducer(
  state: CharadesGameState,
  action: CharadesAction
): CharadesGameState {
  switch (action.type) {
    case 'reset':
      return { ...initialCharadesState(), myName: state.myName };
    case 'round-start': {
      const payload = action.payload;
      if (payload.kind !== 'charades' || payload.phase !== 'acting') {
        return state;
      }
      return {
        ...initialCharadesState(),
        view: 'acting',
        myName: action.myName,
        actor: payload.actor ?? null,
        movie: payload.movie ?? null,
        category: payload.category,
        round: payload.round,
        totalRounds: payload.totalRounds,
        endsAt: payload.endsAt,
        score: payload.score,
      };
    }
    case 'round-end':
      return {
        ...state,
        score: action.score,
        lastRound: { scored: action.scored, nextActor: action.nextActor },
      };
    case 'game-end':
      return {
        ...state,
        view: 'game-end',
        endsAt: null,
        score: typeof action.payload.score === 'number' ? action.payload.score : state.score,
        winner: typeof action.payload.winner === 'string' ? action.payload.winner : null,
      };
    case 'resync':
      return {
        ...initialCharadesState(),
        view: action.state.view,
        myName: action.myName,
        actor: action.state.actor,
        movie: action.state.movie,
        category: action.state.category,
        round: action.state.round,
        totalRounds: action.state.totalRounds,
        score: action.state.score,
      };
    default:
      return state;
  }
}
