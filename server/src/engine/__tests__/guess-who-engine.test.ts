import { describe, expect, it } from 'vitest';
import { GuessWhoSession, type Celebrity } from '../guess-who-engine.js';

const CELEBRITIES: Celebrity[] = [
  {
    name: 'Beyoncé',
    gender: 'f',
    alive: true,
    profession: 'Singer',
    nationality: 'American',
    ageRange: '40s',
    hairColor: 'blonde',
    famousFor: 'Lemonade',
  },
  {
    name: 'Will Smith',
    gender: 'm',
    alive: true,
    profession: 'Actor',
    nationality: 'American',
    ageRange: '50s',
    hairColor: 'black',
    famousFor: 'Men in Black',
  },
  {
    name: 'Marie Curie',
    gender: 'f',
    alive: false,
    profession: 'Scientist',
    nationality: 'Polish',
    ageRange: '60s',
    hairColor: 'brown',
    famousFor: 'Radioactivity',
  },
];

function make(random: (max: number) => number = (_max) => 0) {
  return new GuessWhoSession(CELEBRITIES, { randomInt: random });
}

describe('GuessWhoSession (PRD §5.17)', () => {
  it('starts with the host as the answerer holding a secret celebrity', () => {
    const session = make();
    const started = session.start(['Alice', 'Bob'], 'Alice');
    expect(started.ok).toBe(true);
    expect(session.answerer).toBe('Alice');
    expect(session.secretCelebrity?.name).toBe('Beyoncé');
    expect(session.phaseValue).toBe('questioning');
  });

  it('questioners ask, the answerer answers, and the log grows', () => {
    const session = make();
    session.start(['Alice', 'Bob'], 'Alice');
    const asked = session.askQuestion('Bob', 'Are they alive?');
    expect(asked.ok).toBe(true);
    // The answerer cannot ask.
    expect(session.askQuestion('Alice', 'Am I famous?').ok).toBe(false);
    // The answerer answers the latest open question.
    const answered = session.answerQuestion('Alice', true);
    expect(answered.ok).toBe(true);
    expect(session.questionLog[0]).toMatchObject({ question: 'Are they alive?', answer: true });
    expect(session.questionCount).toBe(1);
    // Non-answerers cannot answer.
    expect(session.answerQuestion('Bob', false).ok).toBe(false);
  });

  it('a correct guess ends the round with the guesser as winner (last name ok)', () => {
    const session = make();
    session.start(['Alice', 'Bob'], 'Alice');
    const wrong = session.submitGuess('Bob', 'Rihanna');
    expect(ok2(wrong)).toEqual({ correct: false, finished: false });
    const right = session.submitGuess('Bob', 'Beyoncé');
    expect(ok2(right)).toEqual({ correct: true, finished: true });
    expect(session.phaseValue).toBe('game-end');
    expect(session.winnerValue).toBe('Bob');
    // Last-name matching: Will Smith → "smith" (randomInt 1 → Will Smith).
    const session2 = make(() => 1);
    session2.start(['Alice', 'Bob'], 'Alice');
    expect(ok2(session2.submitGuess('Bob', 'smith')).correct).toBe(true);
  });

  it('reveals after 20 answered questions', () => {
    const session = make();
    session.start(['Alice', 'Bob'], 'Alice');
    let finished = false;
    for (let round = 1; round <= 20; round += 1) {
      session.askQuestion('Bob', `Question ${round}?`);
      const answered = session.answerQuestion('Alice', round % 2 === 0);
      if (ok2(answered).finished) {
        finished = true;
      }
    }
    expect(finished).toBe(true);
    expect(session.phaseValue).toBe('game-end');
    expect(session.winnerValue).toBeNull();
    const payload = session.endPayload() as { kind: string; celebrity: { name: string } };
    expect(payload.kind).toBe('guess-who');
    expect(payload.celebrity.name).toBe('Beyoncé');
  });

  it('rejects the 21st question and solo rooms let the answerer participate', () => {
    const session = make();
    session.start(['Alice', 'Bob'], 'Alice');
    for (let round = 1; round <= 20; round += 1) {
      session.askQuestion('Bob', `Question number ${round}?`);
      session.answerQuestion('Alice', false);
    }
    expect(session.askQuestion('Bob', 'One more question?').ok).toBe(false); // QUESTION_LIMIT

    const solo = make();
    solo.start(['Solo'], 'Solo');
    // Solo testing affordance (D026): the answerer may ask and guess.
    expect(solo.askQuestion('Solo', 'Am I famous?').ok).toBe(true);
    expect(solo.submitGuess('Solo', 'Beyoncé').ok).toBe(true);
  });
});

function ok2<T>(result: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!result.ok) {
    throw new Error(`expected ok, got ${result.error}`);
  }
  return result.value;
}
