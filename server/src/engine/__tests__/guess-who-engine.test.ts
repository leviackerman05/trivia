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
    facts: ['Won 32 Grammys', 'Headlined Coachella 2018'],
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
    facts: ['First rapper to win a Grammy', 'Starred in The Fresh Prince of Bel-Air'],
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
    facts: [
      'Only person to win Nobel Prizes in two sciences',
      'Named an element after her homeland',
    ],
  },
];

function make(random: (max: number) => number = (_max) => 0) {
  return new GuessWhoSession(CELEBRITIES, { randomInt: random });
}

describe('GuessWhoSession (PRD §5.17, M17)', () => {
  it('starts with the host as the answerer holding a secret celebrity', () => {
    const session = make();
    const started = session.start(['Alice', 'Bob'], 'Alice');
    expect(started.ok).toBe(true);
    expect(session.answerer).toBe('Alice');
    expect(session.secretCelebrity?.name).toBe('Beyoncé');
    expect(session.phaseValue).toBe('questioning');
    expect(session.totalRoundsValue).toBe(5);
    expect(session.currentRound).toBe(1);
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

  it('M17: a correct guess scores +1, reveals, and advances to the NEXT round', () => {
    const session = make();
    session.start(['Alice', 'Bob'], 'Alice');
    const wrong = session.submitGuess('Bob', 'Rihanna');
    expect(ok2(wrong)).toEqual({ correct: false, finished: false });
    const right = session.submitGuess('Bob', 'Beyoncé');
    // Round 1 of 5 → the game continues after the reveal.
    expect(ok2(right)).toEqual({ correct: true, finished: false });
    expect(session.phaseValue).toBe('revealed');
    expect(session.winnerValue).toBe('Bob');
    expect(session.scoreTable[0]).toEqual({ playerName: 'Bob', score: 1 });
    // The host advances → round 2, answerer rotates to Bob.
    const advanced = session.next();
    expect(ok2(advanced).finished).toBe(false);
    expect(session.phaseValue).toBe('questioning');
    expect(session.currentRound).toBe(2);
    expect(session.answerer).toBe('Bob');
    expect(session.questionCount).toBe(0);
  });

  it('M17: five correct guesses finish the game with a winner and scores', () => {
    const session = make();
    session.start(['Alice', 'Bob'], 'Alice');
    let finished = false;
    // The answerer rotates each round (Alice, Bob, Alice, Bob, Alice), so
    // the non-answerer guesses: Bob on odd rounds, Alice on even rounds.
    for (let round = 1; round <= 5; round += 1) {
      const guesser = round % 2 === 1 ? 'Bob' : 'Alice';
      const guessed = session.submitGuess(guesser, 'Beyoncé');
      if (round < 5) {
        expect(ok2(guessed).finished).toBe(false);
        session.next();
      } else {
        finished = ok2(guessed).finished;
      }
    }
    expect(finished).toBe(true);
    const payload = session.endPayload() as {
      kind: string;
      celebrity: { name: string };
      winner: string;
      scores: { playerName: string; score: number }[];
      rounds: number;
    };
    expect(payload.kind).toBe('guess-who');
    expect(payload.celebrity.name).toBe('Beyoncé');
    expect(payload.winner).toBe('Bob');
    expect(payload.scores[0]).toEqual({ playerName: 'Bob', score: 3 });
    expect(payload.rounds).toBe(5);
  });

  it('reveals after 20 answered questions on any round (no winner)', () => {
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
    // The cap on round 1 reveals but does NOT finish the game.
    expect(finished).toBe(false);
    expect(session.phaseValue).toBe('revealed');
    expect(session.winnerValue).toBeNull();
    const advanced = session.next();
    expect(ok2(advanced).finished).toBe(false);
    expect(session.currentRound).toBe(2);
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
