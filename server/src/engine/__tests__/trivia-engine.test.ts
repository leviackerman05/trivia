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
  it('starts with a question and scores fastest-correct-highest', () => {
    const session = make(RACE);
    expect(session.start(['Alice', 'Bob']).ok).toBe(true);
    expect(session.phaseValue).toBe('question');
    expect(session.currentQuestion?.question).toBe('Q1');

    // Alice answers at 1s → 100 + 10·9 = 190; Bob at 9s → 100 + 10·1 = 110.
    expect(ok2(session.submitAnswer('Alice', 1, 1_000))).toMatchObject({
      points: 190,
      correct: true,
    });
    expect(ok2(session.submitAnswer('Bob', 1, 9_000))).toMatchObject({
      points: 110,
      correct: true,
    });
    // Wrong answer scores 0 in race mode.
    const slow = session.submitAnswer('Cara', 2, 5_000);
    expect(slow.ok).toBe(false); // Cara is not a player
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
      { playerName: 'Alice', points: 190, correct: true },
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
  it('scores wrong answers and punishes the correct one', () => {
    const session = make(WRONG);
    session.start(['Alice', 'Bob']);
    // Alice picks a wrong answer fast → 50 + 10·9 = 140.
    const alice = session.submitAnswer('Alice', 0, 1_000);
    expect(ok2(alice)).toMatchObject({ points: 140, correct: false });
    // Bob picks the correct answer → 0.
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
