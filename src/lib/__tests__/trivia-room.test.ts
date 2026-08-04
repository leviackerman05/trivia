import { describe, expect, it } from 'vitest';
import { initialTriviaState, triviaRoomReducer, type TriviaGameState } from '../trivia-room';

function stateWith(overrides: Partial<TriviaGameState> = {}): TriviaGameState {
  return { ...initialTriviaState(), myName: 'Me', ...overrides };
}

const questionStart = {
  type: 'question-start' as const,
  myName: 'Me',
  payload: {
    mode: 'race' as const,
    question: { category: 'Science', question: 'Q?', options: ['A', 'B', 'C', 'D'] },
    round: 1,
    totalRounds: 10,
    endsAt: 1_750_000_000_000,
  },
};

describe('triviaRoomReducer, question flow (PRD §5.15)', () => {
  it('question-start resets the round state and shows the question', () => {
    const state = triviaRoomReducer(
      stateWith({ view: 'revealed', scores: [{ playerName: 'X', score: 1 }] }),
      questionStart
    );
    expect(state.view).toBe('question');
    expect(state.question?.options).toHaveLength(4);
    expect(state.round).toBe(1);
    expect(state.myAnswer).toBeNull();
  });

  it('answered locks my pick and reports race feedback', () => {
    let state = triviaRoomReducer(stateWith(), questionStart);
    state = triviaRoomReducer(state, {
      type: 'answered',
      optionIndex: 2,
      points: 150,
      correct: true,
    });
    expect(state.myAnswer).toBe(2);
    expect(state.feedback).toContain('+150');
    state = triviaRoomReducer(state, {
      type: 'answered',
      optionIndex: 1,
      points: 0,
      correct: false,
    });
    // A second answer is rejected by the server, but the reducer keeps the first.
    expect(state.myAnswer).toBe(2);
  });

  it('wrong-answers mode feedback celebrates the wrong pick', () => {
    let state = triviaRoomReducer(stateWith(), {
      ...questionStart,
      payload: { ...questionStart.payload, mode: 'wrong-answers' },
    });
    state = triviaRoomReducer(state, {
      type: 'answered',
      optionIndex: 0,
      points: 140,
      correct: false,
    });
    expect(state.feedback).toContain('+140');
    state = triviaRoomReducer(state, {
      type: 'answered',
      optionIndex: 1,
      points: 0,
      correct: true,
    });
    expect(state.myAnswer).toBe(0); // first pick stays
  });

  it('reveal highlights the correct index and adopts the scoreboard', () => {
    let state = triviaRoomReducer(stateWith({ myAnswer: 0 }), questionStart);
    state = triviaRoomReducer(state, {
      type: 'reveal',
      payload: {
        correctIndex: 2,
        results: [
          { playerName: 'Me', points: 150, correct: false },
          { playerName: 'Bob', points: 0, correct: true },
        ],
        scores: [
          { playerName: 'Bob', score: 190 },
          { playerName: 'Me', score: 150 },
        ],
      },
    });
    expect(state.view).toBe('revealed');
    expect(state.correctIndex).toBe(2);
    expect(state.scores[0]?.playerName).toBe('Bob');
  });

  it('game-end shows the podium and winner', () => {
    const state = triviaRoomReducer(stateWith({ view: 'revealed' }), {
      type: 'game-end',
      payload: {
        kind: 'trivia',
        mode: 'race',
        rounds: 10,
        scores: [
          { playerName: 'Bob', score: 900 },
          { playerName: 'Me', score: 700 },
        ],
        winner: 'Bob',
      },
    });
    expect(state.view).toBe('game-end');
    expect(state.winner).toBe('Bob');
    expect(state.finalScores?.[0]).toEqual({ playerName: 'Bob', score: 900 });
  });
});

describe('triviaRoomReducer, resync and reset', () => {
  it('resync rebuilds state without exposing the answer before reveal', () => {
    const state = triviaRoomReducer(stateWith({ round: 3 }), {
      type: 'resync',
      myName: 'Me',
      state: {
        view: 'revealed',
        mode: 'race',
        question: { category: 'History', question: 'Q', options: ['A', 'B', 'C', 'D'] },
        round: 4,
        totalRounds: 10,
        myAnswer: { optionIndex: 1, points: 120 },
        reveal: { correctIndex: 1, results: [{ playerName: 'Me', points: 120, correct: true }] },
        scores: [{ playerName: 'Me', score: 120 }],
      },
    });
    expect(state.round).toBe(4);
    expect(state.myAnswer).toBe(1);
    expect(state.correctIndex).toBe(1);
  });

  it('reset clears the game but keeps my name', () => {
    const state = triviaRoomReducer(stateWith({ round: 9, view: 'game-end' }), { type: 'reset' });
    expect(state.round).toBe(0);
    expect(state.myName).toBe('Me');
  });
});
