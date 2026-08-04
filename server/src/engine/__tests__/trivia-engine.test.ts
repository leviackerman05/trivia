import { describe, expect, it } from 'vitest';
import { TriviaSession, type TriviaConfig, type TriviaQuestion } from '../trivia-engine.js';

function ok2<T>(result: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!result.ok) {
    throw new Error(`expected ok, got ${result.error}`);
  }
  return result.value;
}

const QUESTIONS: TriviaQuestion[] = [
  { category: 'General', question: 'Q1', options: ['A', 'B', 'C', 'D'], answer: 1 },
  { category: 'Science', question: 'Q2', options: ['A', 'B', 'C', 'D'], answer: 2 },
  { category: 'History', question: 'Q3', options: ['A', 'B', 'C', 'D'], answer: 0 },
  { category: 'Sports', question: 'Q4', options: ['A', 'B', 'C', 'D'], answer: 3 },
];

const RACE: TriviaConfig = { mode: 'race', questionMs: 10_000, totalRounds: 4, breakMs: 6_000 };
const WRONG: TriviaConfig = {
  mode: 'wrong-answers',
  questionMs: 10_000,
  totalRounds: 4,
  breakMs: 6_000,
};

function make(config: TriviaConfig, now = 1_000_000) {
  return new TriviaSession(QUESTIONS, config, { randomInt: (_max) => 0, now: () => now });
}

describe('TriviaSession — race mode (PRD §5.15)', () => {
  it('starts with a question and scores flat 10 for correct answers (M18)', () => {
    const session = make(RACE);
    expect(session.start(['Alice', 'Bob']).ok).toBe(true);
    expect(session.phaseValue).toBe('question');
    expect(session.currentQuestion?.question).toBe('Q1');

    // M18: correct = 10 points, regardless of speed.
    expect(ok2(session.submitAnswer('Alice', 1, 1_000))).toMatchObject({
      points: 10,
      correct: true,
    });
    expect(ok2(session.submitAnswer('Bob', 1, 9_000))).toMatchObject({
      points: 10,
      correct: true,
    });
    // A wrong answer scores 0.
    session.addPlayer('Cara');
    const wrong = session.submitAnswer('Cara', 2, 5_000);
    expect(ok2(wrong)).toMatchObject({ points: 0, correct: false });
  });

  it('rejects double answers and invalid options', () => {
    const session = make(RACE);
    session.start(['Alice']);
    expect(session.submitAnswer('Alice', 0, 500).ok).toBe(true);
    expect(session.submitAnswer('Alice', 1, 900).ok).toBe(false);
    expect(session.submitAnswer('Alice', 4, 900).ok).toBe(false);
  });

  it('reveals results and advances until game-end', () => {
    const session = make(RACE);
    session.start(['Alice', 'Bob']);
    session.submitAnswer('Alice', 1, 1_000);
    session.submitAnswer('Bob', 0, 2_000); // wrong
    const revealed = session.reveal();
    expect(ok2(revealed).correctIndex).toBe(1);
    expect(ok2(revealed).results).toEqual([
      { playerName: 'Alice', points: 10, correct: true },
      { playerName: 'Bob', points: 0, correct: false },
    ]);
    expect(session.phaseValue).toBe('revealed');

    let finished = false;
    for (let round = 2; round <= 4; round += 1) {
      session.next();
      session.submitAnswer('Alice', 0, 500);
      session.submitAnswer('Bob', 0, 500);
      session.reveal();
      if (round === 4) {
        const advanced = session.next();
        expect(advanced.ok).toBe(true);
        expect(ok2(advanced).finished).toBe(true);
        finished = true;
      } else {
        session.next();
      }
    }
    expect(finished).toBe(true);
    expect(session.phaseValue).toBe('game-end');
    const payload = session.endPayload() as { scores: { playerName: string; score: number }[] };
    expect(payload.scores[0]?.playerName).toBe('Alice');
  });
});

describe('TriviaSession — Wrong Answers Only mode', () => {
  it('scores wrong answers and punishes the correct one (M18 flat)', () => {
    const session = make(WRONG);
    session.start(['Alice', 'Bob']);
    // M18: a wrong answer scores a flat 10; the correct answer scores 0.
    const alice = session.submitAnswer('Alice', 0, 1_000);
    expect(ok2(alice)).toMatchObject({ points: 10, correct: false });
    const bob = session.submitAnswer('Bob', 1, 1_000);
    expect(ok2(bob)).toMatchObject({ points: 0, correct: true });
  });
});

describe('TriviaSession — guards', () => {
  it('mid-game joiners can answer (D027 pattern)', () => {
    const session = make(RACE);
    session.start(['Alice']);
    expect(session.addPlayer('Bob').ok).toBe(true);
    expect(session.submitAnswer('Bob', 0, 500).ok).toBe(true);
  });

  it('answers only during the question phase', () => {
    const session = make(RACE);
    session.start(['Alice']);
    session.submitAnswer('Alice', 0, 500);
    session.reveal();
    expect(session.submitAnswer('Alice', 1, 500).ok).toBe(false);
  });
});
