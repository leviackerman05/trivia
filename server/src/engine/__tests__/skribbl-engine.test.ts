import { describe, expect, it } from 'vitest';
import {
  SKRIBBL_FIRST_HINT_MS,
  SKRIBBL_ROUND_DURATION_MS,
  SKRIBBL_SECOND_HINT_MS,
  SKRIBBL_WORD_CHOICES,
  SkribblSession,
  type SkribblError,
  type SkribblResult,
  type SkribblWord,
} from '../skribbl-engine.js';

/** Narrowing helpers for the SkribblResult discriminated union. */
function ok<T>(result: SkribblResult<T>): T {
  if (!result.ok) {
    throw new Error(`expected ok, got ${result.error}`);
  }
  return result.value;
}

function expectError<T>(result: SkribblResult<T>, expected: SkribblError): void {
  expect(result.ok).toBe(false);
  if (result.ok) {
    return;
  }
  expect(result.error).toBe(expected);
}

/** Deterministic RNG: cycles 0..max-1 so pickWordChoices yields distinct words. */
function seqRandom(): (max: number) => number {
  let state = 0;
  return (max) => state++ % max;
}

/** Tiny fixed word bank so tests never depend on the shipped dataset. */
const TEST_WORDS: SkribblWord[] = [
  'apple',
  'banana',
  'cherry',
  'dragon',
  'eagle',
  'flamingo',
  'guitar',
  'harbor',
].map((word) => ({ word, difficulty: 'easy' as const }));

function makeSession(overrides: { now?: () => number } = {}) {
  return new SkribblSession({ words: TEST_WORDS, randomInt: seqRandom(), now: overrides.now });
}

/** Starts a session and returns it with the drawer/guesser names derived. */
function startSession(players = ['Alice', 'Bob']) {
  const session = makeSession();
  const started = session.start(players);
  expect(started.ok).toBe(true);
  const drawer = session.currentDrawer!;
  const guessers = players.filter((name) => name !== drawer);
  return { session, drawer, guessers };
}

function reachDrawing({ session, drawer }: { session: SkribblSession; drawer: string }) {
  const word = session.choices![0]!;
  expect(session.chooseWord(drawer, word).ok).toBe(true);
  return word;
}

describe('SkribblSession — lifecycle', () => {
  it('starts with a single player (solo testing) and rejects empty rooms', () => {
    const session = makeSession();
    // 1 player × 3 rounds per player — solo rooms are a testing affordance.
    expect(ok(session.start(['Solo'])).totalRounds).toBe(3);
    const empty = makeSession();
    expectError(empty.start([]), 'NOT_PLAYER');
    expectError(empty.start(['  ']), 'NOT_PLAYER');
  });

  it('allows only one start per session', () => {
    const session = makeSession();
    expect(ok(session.start(['A', 'B'])).totalRounds).toBe(6);
    expectError(session.start(['A', 'B']), 'ALREADY_STARTED');
  });

  it('runs rounds-per-player × players rounds with a rotating drawer', () => {
    const { session } = startSession(['Alice', 'Bob', 'Cara']);
    expect(session.totalRoundsValue).toBe(9);
    expect(session.currentRound).toBe(1);
    const drawers: string[] = [];
    for (let i = 0; i < 9; i += 1) {
      const drawer = session.currentDrawer;
      expect(drawer).not.toBeNull();
      drawers.push(drawer!);
      reachDrawing({ session, drawer: drawer! });
      ok(session.endRound());
      expect(session.nextRound().ok).toBe(true);
    }
    // The drawer rotation is a fixed cycle through a shuffle of the players.
    expect(new Set(drawers).size).toBe(3);
    for (let i = 3; i < drawers.length; i += 1) {
      expect(drawers[i]).toBe(drawers[i % 3]);
    }
    expect(session.phaseValue).toBe('game-end');
  });

  it('offers 3 distinct word choices during word-select and picks the chosen one', () => {
    const { session, drawer } = startSession();
    expect(session.phaseValue).toBe('word-select');
    const choices = session.choices!;
    expect(choices).toHaveLength(SKRIBBL_WORD_CHOICES);
    expect(new Set(choices).size).toBe(SKRIBBL_WORD_CHOICES);
    expect(session.currentWord).toBeNull();

    const chosen = choices[1]!;
    expect(ok(session.chooseWord(drawer, chosen.toUpperCase())).wordLength).toBe(chosen.length);
    expect(session.currentWord).toBe(chosen);
    expect(session.phaseValue).toBe('drawing');
  });

  it('rejects non-drawers, words outside the choices, and picks in the wrong phase', () => {
    const { session, drawer, guessers } = startSession();
    const word = session.choices![0]!;
    expectError(session.chooseWord(guessers[0]!, word), 'NOT_DRAWER');
    expectError(session.chooseWord(drawer, 'not-an-option'), 'WORD_NOT_IN_CHOICES');
    ok(session.chooseWord(drawer, word));
    // Choices are consumed once the word is picked; a second pick is a phase error.
    expectError(session.chooseWord(drawer, word), 'WRONG_PHASE');
  });
});

describe('SkribblSession — guesses and scoring (PRD §5.1)', () => {
  it('matches guesses case-insensitively with whitespace trimmed', () => {
    const { session, drawer, guessers } = startSession();
    const word = reachDrawing({ session, drawer });
    const started = session.drawingStartedAt!;
    const guesser = guessers[0]!;

    const wrong = ok(session.submitGuess(guesser, '  something else  ', started + 1_000));
    expect(wrong).toMatchObject({ correct: false, points: 0 });

    const right = ok(session.submitGuess(guesser, ` ${word.toUpperCase()} `, started + 1_000));
    expect(right).toMatchObject({ correct: true, points: 98 });
  });

  it('scores guesser = 100 − seconds×2 (floored at 0) and awards once', () => {
    const { session, drawer, guessers } = startSession();
    const word = reachDrawing({ session, drawer });
    const started = session.drawingStartedAt!;
    const guesser = guessers[0]!;

    expect(ok(session.submitGuess(guesser, word, started + 5_000))).toMatchObject({
      correct: true,
      points: 90,
    });
    // Second correct guess is rejected as already-guessed.
    expectError(session.submitGuess(guesser, word, started + 6_000), 'ALREADY_GUESSED');
    // Late guesses after the 60s window are rejected.
    expectError(
      session.submitGuess(guesser, 'apple', started + SKRIBBL_ROUND_DURATION_MS + 1),
      'ROUND_OVER'
    );
    // The drawer can never guess their own word.
    const second = startSession();
    const word2 = reachDrawing(second);
    expectError(
      second.session.submitGuess(second.drawer, word2, second.session.drawingStartedAt! + 1_000),
      'DRAWER_CANNOT_GUESS'
    );
  });

  it('gives the drawer floor(sum of guesser points / 2) at round end', () => {
    const { session, drawer, guessers } = startSession(['Alice', 'Bob', 'Cara']);
    const word = reachDrawing({ session, drawer });
    const started = session.drawingStartedAt!;
    const points = [90, 80];
    for (let i = 0; i < guessers.length; i += 1) {
      const result = ok(
        session.submitGuess(guessers[i]!, word, started + (i === 0 ? 5_000 : 10_000))
      );
      expect(result.points).toBe(points[i]);
    }
    const ended = ok(session.endRound());
    expect(ended).toMatchObject({
      word,
      drawerName: drawer,
      correct: [
        { playerName: guessers[0], points: 90 },
        { playerName: guessers[1], points: 80 },
      ],
      drawerPoints: 85, // floor((90 + 80) / 2)
    });
    expect(session.scores[drawer]).toBe(85);
    expect(session.scores[guessers[0]!]).toBe(90);
    expect(session.scores[guessers[1]!]).toBe(80);
  });

  it('never ends a solo round early (allGuessed needs a guesser)', () => {
    const { session, drawer } = startSession(['Only']);
    reachDrawing({ session, drawer });
    expect(session.allGuessed()).toBe(false);
    // The round runs its full 60s unless the host ends it manually.
    expect(session.endRound().ok).toBe(true);
  });

  it('lets mid-game joiners guess from the current round (addPlayer)', () => {
    const { session, drawer } = startSession(['Alice', 'Bob']);
    const word = reachDrawing({ session, drawer });
    // Carol joins mid-round.
    expect(ok(session.addPlayer('Carol')).score).toBe(0);
    // Idempotent for existing players (rejoins).
    expect(ok(session.addPlayer('Alice')).score).toBeGreaterThanOrEqual(0);
    // The new player can guess and win points.
    const result = ok(session.submitGuess('Carol', word, session.drawingStartedAt! + 4_000));
    expect(result).toMatchObject({ correct: true, points: 92 });
    expect(session.scores.Carol).toBe(92);
  });

  it('rejects addPlayer once the game is over', () => {
    const session = makeSession();
    session.start(['Alice', 'Bob']);
    const drawer = session.currentDrawer!;
    reachDrawing({ session, drawer });
    session.endRound();
    session.nextRound();
    // Fast-forward: mark every round as drawn to reach game-end.
    for (let i = 2; i <= session.totalRoundsValue; i += 1) {
      if (session.phaseValue !== 'game-end') {
        const current = session.currentDrawer!;
        reachDrawing({ session, drawer: current });
        session.endRound();
        session.nextRound();
      }
    }
    expect(session.phaseValue).toBe('game-end');
    expectError(session.addPlayer('Late'), 'WRONG_PHASE');
  });

  it('reports allGuessed and ends the round early when everyone solved it', () => {
    const { session, drawer, guessers } = startSession(); // 2 players
    const word = reachDrawing({ session, drawer });
    expect(session.allGuessed()).toBe(false);
    ok(session.submitGuess(guessers[0]!, word, session.drawingStartedAt! + 2_000));
    expect(session.allGuessed()).toBe(true);
    expect(session.endRound().ok).toBe(true);
    // Idempotent: a second endRound is a no-op error.
    expect(session.endRound().ok).toBe(false);
  });

  it('produces an empty correct list and a podium after a winless round', () => {
    const { session, drawer } = startSession(['Alice', 'Bob', 'Cara']);
    reachDrawing({ session, drawer });
    const summary = ok(session.endRound());
    expect(summary.correct).toEqual([]);
    expect(summary.drawerPoints).toBe(0);
    const final = session.finalScores;
    expect(final).toHaveLength(3);
    expect(final[0]!.score).toBe(0);
  });
});

describe('SkribblSession — hints (PRD §5.1)', () => {
  it('reveals the first letter at 30s and the last letter at 45s', () => {
    const session = new SkribblSession({ words: TEST_WORDS, randomInt: seqRandom(), now: () => 0 });
    session.start(['Alice', 'Bob']);
    const drawer = session.currentDrawer!;
    const word = session.choices![0]!;
    session.chooseWord(drawer, word);

    expect(session.hintsAt(0)).toEqual({ firstLetter: null, lastLetter: null });
    expect(session.hintsAt(SKRIBBL_FIRST_HINT_MS - 1)).toEqual({
      firstLetter: null,
      lastLetter: null,
    });
    expect(session.hintsAt(SKRIBBL_FIRST_HINT_MS)).toEqual({
      firstLetter: word[0],
      lastLetter: null,
    });
    expect(session.hintsAt(SKRIBBL_SECOND_HINT_MS)).toEqual({
      firstLetter: word[0],
      lastLetter: word[word.length - 1],
    });
  });

  it('returns no hints outside the drawing phase', () => {
    const { session } = startSession();
    expect(session.hintsAt(1_000_000)).toEqual({ firstLetter: null, lastLetter: null });
  });
});

describe('SkribblSession — custom word list (PRD §5.1)', () => {
  it('validates and dedupes the host-pasted list', () => {
    const session = makeSession();
    expectError(session.setCustomWords(['a', 'b']), 'INVALID_WORD_LIST');
    expectError(session.setCustomWords('not an array'), 'INVALID_WORD_LIST');
    expectError(
      session.setCustomWords(['ok word', 'ok-word', 'bad!', 'fine']),
      'INVALID_WORD_LIST'
    );
    const applied = ok(
      session.setCustomWords(['Pizza', ' pizza ', 'Astronaut', 'PIZZA', 'Banana'])
    );
    expect(applied.count).toBe(3); // duplicates collapse
    session.start(['Alice', 'Bob']);
    const choices = session.choices!;
    expect(choices.every((word) => ['pizza', 'astronaut', 'banana'].includes(word))).toBe(true);
  });
});

describe('SkribblSession — strokes', () => {
  it('accepts drawer strokes, rejects non-drawers and out-of-phase strokes', () => {
    const { session, drawer, guessers } = startSession();
    const stroke = {
      strokeId: 's1',
      x: 10,
      y: 10,
      prevX: 0,
      prevY: 0,
      color: '#000000',
      brushSize: 4,
      tool: 'pen' as const,
    };
    expectError(session.addStroke(drawer, stroke), 'WRONG_PHASE'); // word-select
    reachDrawing({ session, drawer });
    expect(session.addStroke(drawer, { ...stroke, strokeId: 's2' }).ok).toBe(true);
    expect(session.strokesLog).toHaveLength(1);
    expectError(session.addStroke(guessers[0]!, stroke), 'NOT_DRAWER');
  });

  it('undo removes the last stroke group and clear empties the log', () => {
    const { session, drawer } = startSession();
    const stroke = (strokeId: string) => ({
      strokeId,
      x: 1,
      y: 1,
      prevX: 0,
      prevY: 0,
      color: '#000000',
      brushSize: 4,
      tool: 'pen' as const,
    });
    reachDrawing({ session, drawer });
    session.addStroke(drawer, stroke('a'));
    session.addStroke(drawer, stroke('b'));
    session.addStroke(drawer, stroke('b')); // same group: second segment
    expect(session.strokesLog).toHaveLength(3);
    const undone = session.undoStroke(drawer);
    expect(undone.ok).toBe(true);
    if (undone.ok) {
      expect(undone.value.strokeId).toBe('b');
    }
    expect(session.strokesLog).toHaveLength(1);
    expect(session.clearCanvas(drawer).ok).toBe(true);
    expect(session.strokesLog).toHaveLength(0);
  });
});
