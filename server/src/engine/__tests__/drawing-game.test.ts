import { describe, expect, it } from 'vitest';
import {
  DrawingGameSession,
  type DrawingEntry,
  type DrawingGameConfig,
  type DrawingGameError,
  type DrawingGameResult,
} from '../drawing-game.js';

/** Narrowing helpers for the DrawingGameResult discriminated union. */
function ok<T>(result: DrawingGameResult<T>): T {
  if (!result.ok) {
    throw new Error(`expected ok, got ${result.error}`);
  }
  return result.value;
}

function expectError<T>(result: DrawingGameResult<T>, expected: DrawingGameError): void {
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

/** Tiny fixed entry pool so tests never depend on the shipped datasets. */
const TEST_ENTRIES: DrawingEntry[] = [
  'apple',
  'banana',
  'cherry',
  'dragon',
  'eagle',
  'flamingo',
  'guitar',
  'harbor',
].map((word) => ({ word, data: { word } }));

const SKRIBBL_CONFIG: DrawingGameConfig = {
  gameId: 'skribbl-arena',
  wordMode: 'choices',
  roundDurationMs: 60_000,
  firstHintMs: 30_000,
  secondHintMs: 45_000,
};

function makeSession(
  overrides: { now?: () => number } = {},
  config: DrawingGameConfig = SKRIBBL_CONFIG
) {
  return new DrawingGameSession(TEST_ENTRIES, config, {
    randomInt: seqRandom(),
    now: overrides.now,
  });
}

/** Starts a session and returns it with the drawer/guesser names derived. */
function startSession(players = ['Alice', 'Bob'], config: DrawingGameConfig = SKRIBBL_CONFIG) {
  const session = makeSession({}, config);
  const started = session.start(players);
  expect(started.ok).toBe(true);
  const drawer = session.currentDrawer!;
  const guessers = players.filter((name) => name !== drawer);
  return { session, drawer, guessers };
}

function reachDrawing({ session, drawer }: { session: DrawingGameSession; drawer: string }) {
  if (session.choices) {
    const word = session.choices[0]!;
    expect(session.chooseWord(drawer, word).ok).toBe(true);
    return word;
  }
  const assigned = session.assignWordForDirectMode();
  expect(assigned.ok).toBe(true);
  return session.currentWord!;
}

describe('DrawingGameSession — lifecycle', () => {
  it('starts with a single player (solo testing) and rejects empty rooms', () => {
    const session = makeSession();
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
    const drawers: string[] = [];
    for (let i = 0; i < 9; i += 1) {
      const drawer = session.currentDrawer;
      expect(drawer).not.toBeNull();
      drawers.push(drawer!);
      reachDrawing({ session, drawer: drawer! });
      ok(session.endRound());
      expect(session.nextRound().ok).toBe(true);
    }
    expect(new Set(drawers).size).toBe(3);
    for (let i = 3; i < drawers.length; i += 1) {
      expect(drawers[i]).toBe(drawers[i % 3]);
    }
    expect(session.phaseValue).toBe('game-end');
  });

  it('offers 3 distinct word choices and picks the chosen one (skribbl)', () => {
    const { session, drawer } = startSession();
    expect(session.phaseValue).toBe('word-select');
    const choices = session.choices!;
    expect(choices).toHaveLength(3);
    expect(new Set(choices).size).toBe(3);
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
    expectError(session.chooseWord(drawer, word), 'WRONG_PHASE');
  });

  it('direct-mode games assign the word without a choice screen', () => {
    const config: DrawingGameConfig = {
      gameId: 'one-line-one-shape',
      wordMode: 'direct',
      roundDurationMs: 60_000,
    };
    const { session, drawer } = startSession(['Alice', 'Bob'], config);
    expect(session.phaseValue).toBe('word-select');
    expect(session.choices).toBeNull();
    const word = reachDrawing({ session, drawer });
    expect(session.currentWord).toBe(word);
    expect(session.phaseValue).toBe('drawing');
  });
});

describe('DrawingGameSession — guesses and scoring', () => {
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
    expectError(session.submitGuess(guesser, word, started + 6_000), 'ALREADY_GUESSED');
    expectError(session.submitGuess(guesser, 'apple', started + 60_000 + 1), 'ROUND_OVER');
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
    for (let i = 0; i < guessers.length; i += 1) {
      const result = ok(
        session.submitGuess(guessers[i]!, word, started + (i === 0 ? 5_000 : 10_000))
      );
      expect(result.points).toBe(i === 0 ? 90 : 80);
    }
    const ended = ok(session.endRound());
    expect(ended).toMatchObject({
      word,
      drawerName: drawer,
      correct: [
        { playerName: guessers[0], points: 90 },
        { playerName: guessers[1], points: 80 },
      ],
      drawerPoints: 85,
    });
    expect(session.scores[drawer]).toBe(85);
    expect(session.scores[guessers[0]!]).toBe(90);
  });

  it('lyric mode: fixed points (guesser 100, drawer 50) and title-style matching', () => {
    const config: DrawingGameConfig = {
      gameId: 'draw-the-lyric',
      wordMode: 'lyric',
      roundDurationMs: 90_000,
      fixedGuesserPoints: 100,
      fixedDrawerPoints: 50,
    };
    // Single entry each so the assigned word is deterministic.
    const session = new DrawingGameSession(
      [
        {
          word: 'Shape of You',
          data: {
            title: 'Shape of You',
            artist: 'Ed Sheeran',
            lyric: 'We found a rhythm in a crowded room.',
          },
        },
      ],
      config,
      { randomInt: () => 0 }
    );
    session.start(['Alice', 'Bob']);
    const drawer = session.currentDrawer!;
    const guesser = drawer === 'Alice' ? 'Bob' : 'Alice';
    ok(session.assignWordForDirectMode());
    const started = session.drawingStartedAt!;

    // Leading "the" and trailing punctuation are ignored when matching titles.
    const result = ok(session.submitGuess(guesser, 'the shape of you!', started + 10_000));
    expect(result).toMatchObject({ correct: true, points: 100 });
    const ended = ok(session.endRound());
    expect(ended.correct).toEqual([{ playerName: guesser, points: 100 }]);
    expect(ended.drawerPoints).toBe(50);

    // A title that starts with "The" matches a guess that includes one "the".
    const session2 = new DrawingGameSession(
      [
        {
          word: 'The Sound of Silence',
          data: {
            title: 'The Sound of Silence',
            artist: 'Simon & Garfunkel',
            lyric: 'A darkness shared in quiet conversation.',
          },
        },
      ],
      config,
      { randomInt: () => 0 }
    );
    session2.start(['Alice', 'Bob']);
    const drawer2 = session2.currentDrawer!;
    const guesser2 = drawer2 === 'Alice' ? 'Bob' : 'Alice';
    ok(session2.assignWordForDirectMode());
    const right = ok(
      session2.submitGuess(guesser2, 'the sound of silence?', session2.drawingStartedAt! + 5_000)
    );
    expect(right).toMatchObject({ correct: true, points: 100 });
  });

  it('never ends a solo round early (allGuessed needs a guesser)', () => {
    const { session, drawer } = startSession(['Only']);
    reachDrawing({ session, drawer });
    expect(session.allGuessed()).toBe(false);
    expect(session.endRound().ok).toBe(true);
  });

  it('lets mid-game joiners guess from the current round (addPlayer)', () => {
    const { session, drawer } = startSession(['Alice', 'Bob']);
    const word = reachDrawing({ session, drawer });
    expect(ok(session.addPlayer('Carol')).score).toBe(0);
    expect(ok(session.addPlayer('Alice')).score).toBeGreaterThanOrEqual(0);
    const result = ok(session.submitGuess('Carol', word, session.drawingStartedAt! + 4_000));
    expect(result).toMatchObject({ correct: true, points: 92 });
    expect(session.scores.Carol).toBe(92);
  });
});

describe('DrawingGameSession — hints', () => {
  it('reveals the first letter at 30s and the last letter at 45s (skribbl)', () => {
    const session = makeSession({ now: () => 0 });
    session.start(['Alice', 'Bob']);
    const drawer = session.currentDrawer!;
    const word = reachDrawing({ session, drawer });

    expect(session.letterHintsAt(0)).toEqual({ firstLetter: null, lastLetter: null });
    expect(session.letterHintsAt(29_999)).toEqual({ firstLetter: null, lastLetter: null });
    expect(session.letterHintsAt(30_000)).toEqual({ firstLetter: word[0], lastLetter: null });
    expect(session.letterHintsAt(45_000)).toEqual({
      firstLetter: word[0],
      lastLetter: word[word.length - 1],
    });
  });

  it('reveals the lyric artist at 45s', () => {
    const config: DrawingGameConfig = {
      gameId: 'draw-the-lyric',
      wordMode: 'lyric',
      roundDurationMs: 90_000,
      artistHintMs: 45_000,
      fixedGuesserPoints: 100,
      fixedDrawerPoints: 50,
    };
    const session = new DrawingGameSession(
      [
        {
          word: 'Shape of You',
          data: {
            title: 'Shape of You',
            artist: 'Ed Sheeran',
            lyric: 'A rhythm found in a crowded room.',
          },
        },
      ],
      config,
      { randomInt: seqRandom(), now: () => 0 }
    );
    session.start(['Alice', 'Bob']);
    reachDrawing({ session, drawer: session.currentDrawer! });
    expect(session.artistAt(44_999)).toBeNull();
    expect(session.artistAt(45_000)).toBe('Ed Sheeran');
  });
});

describe('DrawingGameSession — one-line lift penalty', () => {
  it('deducts 10s per lift with a 5s floor', () => {
    const config: DrawingGameConfig = {
      gameId: 'one-line-one-shape',
      wordMode: 'direct',
      roundDurationMs: 60_000,
      liftPenaltyMs: 10_000,
    };
    const session = makeSession({}, config);
    session.start(['Alice', 'Bob']);
    reachDrawing({ session, drawer: session.currentDrawer! });
    const base = session.roundEndsAt!;
    const first = ok(session.applyLiftPenalty());
    expect(first.endsAt).toBe(base - 10_000);
    const second = ok(session.applyLiftPenalty());
    expect(second.endsAt).toBe(base - 20_000);
    // 6 lifts → floor at 5s remaining.
    for (let i = 0; i < 6; i += 1) {
      session.applyLiftPenalty();
    }
    expect(session.roundEndsAt).toBe(session.drawingStartedAt! + 5_000);
    // Penalties reset each round.
    session.endRound();
    session.nextRound();
    reachDrawing({ session, drawer: session.currentDrawer! });
    expect(session.roundEndsAt).toBe(session.drawingStartedAt! + 60_000);
  });
});

describe('DrawingGameSession — custom word list', () => {
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
    expect(applied.count).toBe(3);
    session.start(['Alice', 'Bob']);
    expect(session.choices!.every((w) => ['pizza', 'astronaut', 'banana'].includes(w))).toBe(true);
  });
});

describe('DrawingGameSession — strokes', () => {
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
    expectError(session.addStroke(drawer, stroke), 'WRONG_PHASE');
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
    session.addStroke(drawer, stroke('b'));
    expect(session.strokesLog).toHaveLength(3);
    const undone = ok(session.undoStroke(drawer));
    expect(undone.strokeId).toBe('b');
    expect(session.strokesLog).toHaveLength(1);
    ok(session.clearCanvas(drawer));
    expect(session.strokesLog).toHaveLength(0);
  });
});
