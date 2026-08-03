import { describe, expect, it } from 'vitest';
import {
  initialSkribblState,
  skribblReducer,
  type RoundStartPayload,
  type SkribblGameState,
} from '../skribbl';
import type { Stroke } from '../canvas';

function stateWith(overrides: Partial<SkribblGameState> = {}): SkribblGameState {
  return { ...initialSkribblState(), myName: 'Me', ...overrides };
}

const stroke = (strokeId: string): Stroke => ({
  strokeId,
  x: 1,
  y: 1,
  prevX: 0,
  prevY: 0,
  color: '#000000',
  brushSize: 4,
  tool: 'pen',
});

describe('skribblReducer — round lifecycle', () => {
  it('word-select round-start gives the drawer choices and everyone the drawer name', () => {
    const payload: RoundStartPayload = {
      round: 1,
      totalRounds: 6,
      drawerName: 'Me',
      wordLength: null,
      choices: ['apple', 'banana', 'cherry'],
    };
    const state = skribblReducer(stateWith(), { type: 'round-start', payload, myName: 'Me' });
    expect(state.view).toBe('word-select');
    expect(state.choices).toEqual(['apple', 'banana', 'cherry']);
    expect(state.drawerName).toBe('Me');
    expect(state.round).toBe(1);
  });

  it('non-drawers never see choices and switch to drawing on the drawing round-start', () => {
    const select: RoundStartPayload = {
      round: 1,
      totalRounds: 6,
      drawerName: 'Drawer',
      wordLength: null,
    };
    const selected = skribblReducer(stateWith(), {
      type: 'round-start',
      payload: select,
      myName: 'Me',
    });
    expect(selected.view).toBe('word-select');
    expect(selected.choices).toBeNull();

    const drawing: RoundStartPayload = {
      round: 1,
      totalRounds: 6,
      drawerName: 'Drawer',
      wordLength: 5,
      endsAt: 1_750_000_000_000,
    };
    const state = skribblReducer(selected, { type: 'round-start', payload: drawing, myName: 'Me' });
    expect(state.view).toBe('drawing');
    expect(state.wordLength).toBe(5);
    expect(state.endsAt).toBe(1_750_000_000_000);
    expect(state.firstLetter).toBeNull();
  });

  it('a new round clears the canvas, hints, and summary', () => {
    const drawing: RoundStartPayload = {
      round: 2,
      totalRounds: 6,
      drawerName: 'Me',
      wordLength: 4,
      endsAt: 123,
    };
    const state = skribblReducer(
      stateWith({ strokes: [stroke('a')], firstLetter: 'x', summary: null, view: 'round-results' }),
      { type: 'round-start', payload: drawing, myName: 'Me' }
    );
    expect(state.strokes).toEqual([]);
    expect(state.firstLetter).toBeNull();
  });

  it('hints reveal the first and last letter', () => {
    const state = skribblReducer(stateWith(), {
      type: 'round-hint',
      payload: { firstLetter: 'a', lastLetter: null },
    });
    expect(state.firstLetter).toBe('a');
    const revealed = skribblReducer(state, {
      type: 'round-hint',
      payload: { firstLetter: 'a', lastLetter: 'e' },
    });
    expect(revealed.lastLetter).toBe('e');
  });

  it('hints carry game-specific fields (artist, silhouette reveal)', () => {
    const lyric = skribblReducer(stateWith(), {
      type: 'round-hint',
      payload: { artist: 'Baha Men' },
    });
    expect(lyric.artistHint).toBe('Baha Men');
    const shadow = skribblReducer(lyric, {
      type: 'round-hint',
      payload: { silhouette: 'M50 32 Z' },
    });
    expect(shadow.revealedSilhouette).toBe('M50 32 Z');
    expect(shadow.artistHint).toBe('Baha Men');
  });

  it('drawer-only prompt data arrives with the drawing round-start', () => {
    const oneLine: RoundStartPayload = {
      round: 1,
      totalRounds: 4,
      drawerName: 'Me',
      wordLength: 8,
      endsAt: 123,
      object: 'bicycle',
    };
    const state = skribblReducer(stateWith(), {
      type: 'round-start',
      payload: oneLine,
      myName: 'Me',
    });
    expect(state.drawerData.object).toBe('bicycle');
    expect(state.view).toBe('drawing');
  });

  it('stroke-lift deducts time and counts warnings (One Line, One Shape)', () => {
    let state = stateWith({ endsAt: 1_000_000 });
    state = skribblReducer(state, { type: 'stroke-lift', endsAt: 990_000 });
    expect(state.endsAt).toBe(990_000);
    expect(state.liftWarnings).toBe(1);
    state = skribblReducer(state, { type: 'stroke-lift', endsAt: 980_000 });
    expect(state.liftWarnings).toBe(2);
  });

  it('round-timer replaces the deadline (server-authoritative adjustments)', () => {
    const state = skribblReducer(stateWith({ endsAt: 100 }), { type: 'round-timer', endsAt: 90 });
    expect(state.endsAt).toBe(90);
  });
});

describe('skribblReducer — strokes', () => {
  it('appends broadcast strokes, removes by id on undo, clears on clear', () => {
    let state = stateWith();
    state = skribblReducer(state, { type: 'stroke-added', stroke: stroke('a') });
    state = skribblReducer(state, { type: 'stroke-added', stroke: stroke('b') });
    state = skribblReducer(state, { type: 'stroke-added', stroke: stroke('b') });
    expect(state.strokes).toHaveLength(3);
    state = skribblReducer(state, { type: 'stroke-removed', strokeId: 'b' });
    expect(state.strokes).toEqual([stroke('a')]);
    state = skribblReducer(state, { type: 'canvas-cleared' });
    expect(state.strokes).toEqual([]);
  });
});

describe('skribblReducer — results and feedback', () => {
  it('round-end shows the summary and adopts the scoreboard', () => {
    const state = skribblReducer(stateWith({ view: 'drawing' }), {
      type: 'round-end',
      payload: {
        roundNumber: 1,
        word: 'apple',
        drawerName: 'Drawer',
        correct: [{ playerName: 'Me', points: 90 }],
        drawerPoints: 45,
        scores: [
          { playerName: 'Me', score: 90 },
          { playerName: 'Drawer', score: 45 },
        ],
      },
    });
    expect(state.view).toBe('round-results');
    expect(state.summary?.word).toBe('apple');
    expect(state.scores.Me).toBe(90);
    expect(state.scores.Drawer).toBe(45);
  });

  it('game-end shows the podium and winner', () => {
    const state = skribblReducer(stateWith({ view: 'round-results' }), {
      type: 'game-end',
      payload: {
        scores: [
          { playerName: 'Drawer', score: 200 },
          { playerName: 'Me', score: 90 },
        ],
        winner: 'Drawer',
      },
    });
    expect(state.view).toBe('game-end');
    expect(state.winner).toBe('Drawer');
    expect(state.finalScores?.[0]).toEqual({ playerName: 'Drawer', score: 200 });
  });

  it('guess-result sets human-readable feedback for correct, wrong, and repeat guesses', () => {
    const wrong = skribblReducer(stateWith(), { type: 'guess-result', correct: false });
    expect(wrong.guessFeedback).toContain('Wrong');
    const right = skribblReducer(wrong, { type: 'guess-result', correct: true, points: 80 });
    expect(right.guessFeedback).toContain('+80');
    const repeat = skribblReducer(right, {
      type: 'guess-result',
      correct: true,
      alreadyGuessed: true,
    });
    expect(repeat.guessFeedback).toContain('Already');
    expect(repeat.feedbackSeq).toBeGreaterThan(right.feedbackSeq);
  });

  it('guess-result honors an explicit message (transport errors surface visibly)', () => {
    const state = skribblReducer(stateWith(), {
      type: 'guess-result',
      correct: false,
      message: "You're the drawer — you can't guess your own word!",
    });
    expect(state.guessFeedback).toContain("can't guess");
  });
});

describe('skribblReducer — resync and reset', () => {
  it('resync rebuilds the full state for a mid-game join', () => {
    const state = skribblReducer(stateWith({ view: 'drawing', round: 3 }), {
      type: 'resync',
      myName: 'Me',
      state: {
        view: 'drawing',
        round: 4,
        totalRounds: 6,
        drawerName: 'Drawer',
        wordLength: 5,
        choices: null,
        firstLetter: 'a',
        lastLetter: null,
        endsAt: 999,
        scores: { Me: 40, Drawer: 20 },
        strokes: [stroke('x')],
        summary: null,
        finalScores: null,
        winner: null,
      },
    });
    expect(state.round).toBe(4);
    expect(state.strokes).toHaveLength(1);
    expect(state.firstLetter).toBe('a');
    expect(state.scores.Me).toBe(40);
  });

  it('reset clears the game but keeps the player name', () => {
    const state = skribblReducer(stateWith({ round: 5, strokes: [stroke('a')] }), {
      type: 'reset',
    });
    expect(state.round).toBe(0);
    expect(state.strokes).toEqual([]);
    expect(state.myName).toBe('Me');
  });
});
