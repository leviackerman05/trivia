import { describe, expect, it } from 'vitest';
import { copycatReducer, initialCopycatState, type CopycatGameState } from '../copycat';
import type { Stroke } from '../canvas';

function stateWith(overrides: Partial<CopycatGameState> = {}): CopycatGameState {
  return { ...initialCopycatState(), myName: 'Me', ...overrides };
}

const image = { title: 'Mona Lisa', url: '/images/mona-lisa.jpg', kind: 'painting' as const };
const drawing = (name: string) => ({ playerName: name, image: 'data:image/png;base64,AA==' });

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

describe('copycatReducer — phase flow', () => {
  it('image-reveal shows the image and the deadline', () => {
    const state = copycatReducer(stateWith(), {
      type: 'round-start',
      phase: 'image-reveal',
      myName: 'Me',
      image,
      endsAt: 1_750_000_000_000,
    });
    expect(state.view).toBe('image-reveal');
    expect(state.image?.title).toBe('Mona Lisa');
    expect(state.endsAt).toBe(1_750_000_000_000);
    // M13 — the reveal waits for the image to load, then the server's 10s
    // countdown updates the deadline.
    expect(state.imageLoaded).toBe(false);
    const loaded = copycatReducer(state, { type: 'image-loaded' });
    expect(loaded.imageLoaded).toBe(true);
    const timed = copycatReducer(loaded, { type: 'round-timer', endsAt: 1_750_000_010_000 });
    expect(timed.endsAt).toBe(1_750_000_010_000);
  });

  it('drawing phase resets the private canvas and keeps the image', () => {
    const withStrokes = stateWith({
      view: 'image-reveal',
      image,
      strokes: [stroke('a')],
      submitted: true,
    });
    const state = copycatReducer(withStrokes, {
      type: 'round-start',
      phase: 'drawing',
      myName: 'Me',
      endsAt: 123,
    });
    expect(state.view).toBe('drawing');
    expect(state.strokes).toEqual([]);
    expect(state.submitted).toBe(false);
    expect(state.image?.title).toBe('Mona Lisa');
  });

  it('gallery reveals all drawings, voting tallies update live, votes are one per category', () => {
    let state = copycatReducer(stateWith({ view: 'drawing' }), {
      type: 'gallery',
      drawings: [drawing('Alice'), drawing('Bob')],
    });
    expect(state.view).toBe('gallery');
    expect(state.drawings).toHaveLength(2);

    state = copycatReducer(state, { type: 'vote-start', endsAt: 999 });
    expect(state.view).toBe('voting');

    state = copycatReducer(state, {
      type: 'vote-update',
      category: 'funniest',
      votes: [{ playerName: 'Alice', count: 2 }],
    });
    expect(state.tallies.funniest?.[0]).toEqual({ playerName: 'Alice', count: 2 });

    state = copycatReducer(state, { type: 'vote-cast', category: 'funniest', target: 'Alice' });
    expect(state.myVotes.funniest).toBe('Alice');
  });

  it('vote-reveal lands on results with the awards', () => {
    const state = copycatReducer(stateWith({ view: 'voting' }), {
      type: 'vote-reveal',
      awards: [
        {
          category: 'recognizable',
          winner: 'Alice',
          votes: [
            { playerName: 'Alice', count: 2 },
            { playerName: 'Bob', count: 1 },
          ],
        },
      ],
    });
    expect(state.view).toBe('results');
    expect(state.awards?.[0].winner).toBe('Alice');
  });

  it('submitted marks the drawing as sent and clears on reset', () => {
    const state = copycatReducer(stateWith({ view: 'drawing' }), { type: 'submitted' });
    expect(state.submitted).toBe(true);
    const reset = copycatReducer(state, { type: 'reset' });
    expect(reset.submitted).toBe(false);
    expect(reset.myName).toBe('Me');
  });
});

describe('copycatReducer — private canvas', () => {
  it('strokes stay local (add/remove/clear never touch the server log)', () => {
    let state = stateWith();
    state = copycatReducer(state, { type: 'stroke-added', stroke: stroke('a') });
    state = copycatReducer(state, { type: 'stroke-added', stroke: stroke('b') });
    state = copycatReducer(state, { type: 'stroke-removed', strokeId: 'a' });
    expect(state.strokes).toEqual([stroke('b')]);
    state = copycatReducer(state, { type: 'canvas-cleared' });
    expect(state.strokes).toEqual([]);
  });
});

describe('copycatReducer — resync', () => {
  it('rebuilds view, image, drawings, and awards for a mid-game join', () => {
    const state = copycatReducer(stateWith({ view: 'drawing' }), {
      type: 'resync',
      myName: 'Me',
      state: {
        view: 'voting',
        image,
        drawings: [drawing('Alice')],
        awards: null,
      },
    });
    expect(state.view).toBe('voting');
    expect(state.drawings).toHaveLength(1);
    expect(state.image?.title).toBe('Mona Lisa');
    expect(state.myName).toBe('Me');
  });
});
