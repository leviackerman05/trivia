import { describe, expect, it } from 'vitest';
import {
  GuessWhoSession,
  GUESS_WHO_HINT_1_MS,
  GUESS_WHO_HINT_2_MS,
  type Celebrity,
} from '../guess-who-engine.js';

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

describe('GuessWhoSession (PRD §5.17, owner redesign: hidden name)', () => {
  it('starts a timed round; the secret celebrity exists but the name is never in a pattern', () => {
    const session = make();
    const started = session.start(['Alice', 'Bob']);
    expect(started.ok).toBe(true);
    expect(session.secretCelebrity?.name).toBe('Beyoncé');
    expect(session.phaseValue).toBe('questioning');
    expect(session.totalRoundsValue).toBe(5);
    expect(session.currentRound).toBe(1);
    // The initial pattern reveals only the first letter of each word.
    expect(session.namePatternAt(Date.now())).toBe('B_____é');
  });

  it('namePatternAt reveals more letters monotonically (Skribbl-style)', () => {
    const session = make(() => 1); // Will Smith
    session.start(['Alice', 'Bob']);
    const now = Date.now();
    expect(session.namePatternAt(now)).toBe('W___ S____');
    expect(session.namePatternAt(now + GUESS_WHO_HINT_1_MS)).toBe('W___ S__th');
    expect(session.namePatternAt(now + GUESS_WHO_HINT_2_MS)).toBe('Will S__th');
  });

  it('letter reveals are deterministic per (gameSeed, round) across sessions', () => {
    const first = new GuessWhoSession(CELEBRITIES, { randomInt: () => 1, gameSeed: 42 });
    const second = new GuessWhoSession(CELEBRITIES, { randomInt: () => 1, gameSeed: 42 });
    first.start(['Alice', 'Bob']);
    second.start(['Alice', 'Bob']);
    const now = Date.now();
    // Same seed + same round ⇒ identical pattern at the same elapsed time.
    expect(first.namePatternAt(now + GUESS_WHO_HINT_1_MS)).toBe(
      second.namePatternAt(now + GUESS_WHO_HINT_1_MS)
    );
    expect(first.namePatternAt(now + GUESS_WHO_HINT_2_MS)).toBe(
      second.namePatternAt(now + GUESS_WHO_HINT_2_MS)
    );
  });

  it('different gameSeeds reveal different letter positions at the same elapsed time', () => {
    const first = new GuessWhoSession(CELEBRITIES, { randomInt: () => 1, gameSeed: 1 });
    const second = new GuessWhoSession(CELEBRITIES, { randomInt: () => 1, gameSeed: 2 });
    first.start(['Alice', 'Bob']);
    second.start(['Alice', 'Bob']);
    const now = Date.now();
    const patternA = first.namePatternAt(now + GUESS_WHO_HINT_1_MS);
    const patternB = second.namePatternAt(now + GUESS_WHO_HINT_1_MS);
    expect(patternA).not.toBe(patternB);
    // Both reveal the same number of letters (4 of 9 at 40%), but not the
    // same ones — the word-first W + S are the only guaranteed overlap.
    expect(visibleLetterCount(patternA)).toBe(visibleLetterCount(patternB));
  });

  it('reveals are monotonic: later patterns are supersets, letters never un-reveal', () => {
    const session = make(() => 1); // Will Smith
    session.start(['Alice', 'Bob']);
    const now = Date.now();
    const at0 = visiblePositions(session.namePatternAt(now));
    const at1 = visiblePositions(session.namePatternAt(now + GUESS_WHO_HINT_1_MS));
    const at2 = visiblePositions(session.namePatternAt(now + GUESS_WHO_HINT_2_MS));
    // The always-visible word-first letters still show at 0s.
    expect(session.namePatternAt(now)).toBe('W___ S____');
    for (const position of at0) {
      expect(at1.has(position), `position ${position} un-revealed at 20s`).toBe(true);
    }
    for (const position of at1) {
      expect(at2.has(position), `position ${position} un-revealed at 40s`).toBe(true);
    }
    // The permutation reveals a proper subset at 40%: strictly more letters
    // are visible at 70%, and at least ceil(0.7 × 9) = 7 letters show there
    // (word-first letters may overlap the permutation, so the union can be
    // smaller than 9).
    expect(at1.size).toBeLessThan(at2.size);
    expect(at2.size).toBeGreaterThanOrEqual(7);
  });

  it('anyone can guess; a correct guess scores +1, reveals, and advances to the NEXT round', () => {
    const session = make();
    session.start(['Alice', 'Bob']);
    const wrong = session.submitGuess('Alice', 'Rihanna');
    expect(ok2(wrong)).toEqual({ correct: false, finished: false });
    const right = session.submitGuess('Bob', 'Beyoncé');
    // Round 1 of 5 → the game continues after the reveal.
    expect(ok2(right)).toEqual({ correct: true, finished: false });
    expect(session.phaseValue).toBe('revealed');
    expect(session.winnerValue).toBe('Bob');
    expect(session.scoreTable[0]).toEqual({ playerName: 'Bob', score: 1 });
    // The host advances → round 2 with a fresh pattern.
    const advanced = session.next();
    expect(ok2(advanced).finished).toBe(false);
    expect(session.phaseValue).toBe('questioning');
    expect(session.currentRound).toBe(2);
    expect(session.namePatternAt(Date.now())).toBe('B_____é');
  });

  it('last-name guesses count (accents and punctuation ignored)', () => {
    const session = make();
    session.start(['Alice', 'Bob']);
    expect(ok2(session.submitGuess('Alice', 'beyonce')).correct).toBe(true);

    const smith = make(() => 1);
    smith.start(['Alice', 'Bob']);
    expect(ok2(smith.submitGuess('Bob', 'Smith')).correct).toBe(true);
  });

  it('M17: five correct guesses finish the game with a winner and scores', () => {
    const session = make();
    session.start(['Alice', 'Bob']);
    let finished = false;
    for (let round = 1; round <= 5; round += 1) {
      const guessed = session.submitGuess('Bob', 'Beyoncé');
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
    expect(payload.scores[0]).toEqual({ playerName: 'Bob', score: 5 });
    expect(payload.rounds).toBe(5);
  });

  it('revealOnTimeout reveals without a winner; the host advances', () => {
    const session = make();
    session.start(['Alice', 'Bob']);
    const timedOut = session.revealOnTimeout();
    expect(ok2(timedOut).finished).toBe(false);
    expect(session.phaseValue).toBe('revealed');
    expect(session.winnerValue).toBeNull();
    const advanced = session.next();
    expect(ok2(advanced).finished).toBe(false);
    expect(session.currentRound).toBe(2);
  });

  it('rejects guesses outside questioning and from non-players', () => {
    const session = make();
    session.start(['Alice', 'Bob']);
    expect(session.submitGuess('Carol', 'Beyoncé').ok).toBe(false); // NOT_PLAYER
    expect(ok2(session.submitGuess('Alice', 'Beyoncé')).correct).toBe(true);
    expect(session.submitGuess('Bob', 'Beyoncé').ok).toBe(false); // WRONG_PHASE
  });

  it('D064: pickMode sequential consumes the deck in order, repeat-free', () => {
    const session = new GuessWhoSession(CELEBRITIES, { pickMode: 'sequential' });
    const started = session.start(['Alice', 'Bob']);
    expect(started.ok).toBe(true);
    const seen: string[] = [];
    for (let round = 1; round <= CELEBRITIES.length; round += 1) {
      const celebrity = session.secretCelebrity;
      expect(celebrity).not.toBeNull();
      seen.push(celebrity!.name);
      // Reveal via a correct guess, then advance (host action).
      const guessed = session.submitGuess('Bob', celebrity!.name);
      expect(ok2(guessed).correct).toBe(true);
      const next = session.next();
      expect(ok2(next).finished).toBe(false);
    }
    // Deck order, no repeats, every celebrity used exactly once.
    expect(seen).toEqual(['Beyoncé', 'Will Smith', 'Marie Curie']);
    expect(new Set(seen).size).toBe(CELEBRITIES.length);
  });
});

function ok2<T>(result: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!result.ok) {
    throw new Error(`expected ok, got ${result.error}`);
  }
  return result.value;
}

/** Positions where the pattern shows a real character (letters or spaces). */
function visiblePositions(pattern: string): Set<number> {
  const set = new Set<number>();
  for (let i = 0; i < pattern.length; i += 1) {
    if (pattern[i] !== '_') {
      set.add(i);
    }
  }
  return set;
}

function visibleLetterCount(pattern: string): number {
  return [...pattern].filter((char) => /[a-z]/i.test(char)).length;
}
