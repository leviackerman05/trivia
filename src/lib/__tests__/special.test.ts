import { describe, expect, it } from 'vitest';
import { charadesReducer, initialCharadesState, type CharadesGameState } from '../charades';
import { guessWhoReducer, initialGuessWhoState, type GuessWhoGameState } from '../guess-who';

function charadesWith(overrides: Partial<CharadesGameState> = {}): CharadesGameState {
  return { ...initialCharadesState(), myName: 'Me', ...overrides };
}

describe('charadesReducer (PRD §5.12)', () => {
  it('round-start sets the actor; the movie only reaches the actor', () => {
    const state = charadesReducer(charadesWith(), {
      type: 'round-start',
      myName: 'Me',
      payload: {
        kind: 'charades',
        phase: 'acting',
        category: 'bollywood',
        round: 1,
        totalRounds: 2,
        score: 0,
        endsAt: 123,
        actor: 'Me',
        movie: 'Sholay',
      },
    });
    expect(state.view).toBe('acting');
    expect(state.actor).toBe('Me');
    expect(state.movie).toBe('Sholay');
    // A non-actor never receives the movie field at all.
    const guest = charadesReducer(charadesWith(), {
      type: 'round-start',
      myName: 'Me',
      payload: {
        kind: 'charades',
        phase: 'acting',
        category: 'mixed',
        round: 1,
        totalRounds: 2,
        score: 0,
        endsAt: 123,
        actor: 'Bob',
      },
    });
    expect(guest.movie).toBeNull();
  });

  it('round-end announces the score and next actor; game-end shows the team total', () => {
    let state = charadesWith({ score: 0 });
    state = charadesReducer(state, { type: 'round-end', scored: true, score: 1, nextActor: 'Bob' });
    expect(state.score).toBe(1);
    expect(state.lastRound?.scored).toBe(true);
    state = charadesReducer(state, {
      type: 'game-end',
      payload: { kind: 'charades', category: 'mixed', rounds: 2, score: 1, winner: 'The team' },
    });
    expect(state.view).toBe('game-end');
    expect(state.score).toBe(1);
  });
});

function guessWhoWith(overrides: Partial<GuessWhoGameState> = {}): GuessWhoGameState {
  return { ...initialGuessWhoState(), myName: 'Me', ...overrides };
}

const celebrity = {
  name: 'Beyoncé',
  gender: 'f' as const,
  alive: true,
  profession: 'Singer',
  nationality: 'American',
  ageRange: '40s',
  hairColor: 'blonde',
  famousFor: 'Lemonade',
  facts: ['Won 32 Grammys', 'Headlined Coachella 2018'],
};

describe('guessWhoReducer (PRD §5.17, M17)', () => {
  it('round-start gives the answerer the secret and everyone the log', () => {
    const answerer = guessWhoReducer(guessWhoWith(), {
      type: 'round-start',
      myName: 'Me',
      payload: {
        kind: 'guess-who',
        phase: 'questioning',
        answerer: 'Me',
        questionCount: 0,
        maxQuestions: 20,
        round: 1,
        totalRounds: 5,
        scores: [],
        celebrity,
      },
    });
    expect(answerer.celebrity?.name).toBe('Beyoncé');
    const questioner = guessWhoReducer(guessWhoWith(), {
      type: 'round-start',
      myName: 'Me',
      payload: {
        kind: 'guess-who',
        phase: 'questioning',
        answerer: 'Alice',
        questionCount: 0,
        maxQuestions: 20,
        round: 2,
        totalRounds: 5,
        scores: [{ playerName: 'Bob', score: 1 }],
      },
    });
    expect(questioner.celebrity).toBeNull();
    expect(questioner.round).toBe(2);
    expect(questioner.scores[0]?.score).toBe(1);
  });

  it('questions-updated grows the log with answers', () => {
    const state = guessWhoReducer(guessWhoWith(), {
      type: 'questions-updated',
      payload: {
        questions: [{ playerName: 'Bob', question: 'Alive?', answer: true, at: 1 }],
        questionCount: 1,
        maxQuestions: 20,
        finished: false,
      },
    });
    expect(state.questions[0]?.answer).toBe(true);
    expect(state.questionCount).toBe(1);
  });

  it('M17: reveal shows the celebrity, facts, scores, and the next-round flag', () => {
    const state = guessWhoReducer(guessWhoWith(), {
      type: 'reveal',
      payload: {
        celebrity: { name: 'Beyoncé', famousFor: 'Lemonade', facts: ['Won 32 Grammys'] },
        winner: 'Bob',
        scores: [{ playerName: 'Bob', score: 1 }],
        round: 2,
        totalRounds: 5,
        finished: false,
      },
    });
    expect(state.view).toBe('revealed');
    expect(state.revealed?.facts).toContain('Won 32 Grammys');
    expect(state.revealFinished).toBe(false);
    const last = guessWhoReducer(state, {
      type: 'reveal',
      payload: {
        celebrity: { name: 'Beyoncé', famousFor: 'Lemonade', facts: [] },
        winner: 'Bob',
        scores: [{ playerName: 'Bob', score: 1 }],
        round: 5,
        totalRounds: 5,
        finished: true,
      },
    });
    expect(last.revealFinished).toBe(true);
  });

  it('game-end reveals the celebrity and winner to everyone', () => {
    const state = guessWhoReducer(guessWhoWith({ questionCount: 5 }), {
      type: 'game-end',
      payload: {
        kind: 'guess-who',
        celebrity: { name: 'Beyoncé', famousFor: 'Lemonade' },
        questionsAsked: 5,
        winner: 'Bob',
        scores: [{ playerName: 'Bob', score: 2 }],
      },
    });
    expect(state.view).toBe('game-end');
    expect(state.revealed?.name).toBe('Beyoncé');
    expect(state.winner).toBe('Bob');
    expect(state.scores[0]?.score).toBe(2);
  });

  it('reset clears the secret', () => {
    const state = guessWhoReducer(guessWhoWith({ celebrity }), { type: 'reset' });
    expect(state.celebrity).toBeNull();
    expect(state.myName).toBe('Me');
  });
});
