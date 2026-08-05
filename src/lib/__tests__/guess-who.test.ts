import { describe, expect, it } from 'vitest';
import {
  filterLabel,
  GENRE_LABELS,
  guessWhoReducer,
  initialGuessWhoState,
  REGION_LABELS,
  type GuessWhoGameState,
} from '../guess-who';

/**
 * D064 FE1 reducer tests: the lobby region/genre filter is set from the
 * start-ack echo, pool statistics are stored until the server sends them,
 * and the static label maps fall back to raw strings for taxonomy drift.
 */

function guessWhoWith(overrides: Partial<GuessWhoGameState> = {}): GuessWhoGameState {
  return { ...initialGuessWhoState(), myName: 'Me', ...overrides };
}

describe('guessWhoReducer D064 lobby filter (region + genre)', () => {
  it('round-start sets the filter from the start-ack echo', () => {
    const state = guessWhoReducer(guessWhoWith(), {
      type: 'round-start',
      myName: 'Me',
      payload: {
        kind: 'guess-who',
        phase: 'questioning',
        round: 1,
        totalRounds: 5,
        scores: [],
        filter: { region: 'bollywood', genre: 'music' },
      },
    });
    expect(state.filter).toEqual({ region: 'bollywood', genre: 'music' });
  });

  it('round-start without an echo keeps the lobby filter across rounds', () => {
    const state = guessWhoReducer(
      guessWhoWith({ filter: { region: 'hollywood', genre: 'sports' } }),
      {
        type: 'round-start',
        myName: 'Me',
        payload: {
          kind: 'guess-who',
          phase: 'questioning',
          round: 2,
          totalRounds: 5,
          scores: [],
        },
      }
    );
    expect(state.filter).toEqual({ region: 'hollywood', genre: 'sports' });
  });

  it('set-filter applies the host choice optimistically', () => {
    const state = guessWhoReducer(guessWhoWith(), {
      type: 'set-filter',
      filter: { region: 'row', genre: 'cinema' },
    });
    expect(state.filter).toEqual({ region: 'row', genre: 'cinema' });
  });

  it('filter-options stores the pool statistics; null until the server sends them', () => {
    expect(guessWhoWith().filterOptions).toBeNull();
    const state = guessWhoReducer(guessWhoWith(), {
      type: 'filter-options',
      payload: {
        regions: [
          { value: 'all', count: 205 },
          { value: 'bollywood', count: 40 },
        ],
        genres: [
          { value: 'all', count: 205 },
          { value: 'music', count: 30 },
        ],
      },
    });
    expect(state.filterOptions?.regions[0]).toEqual({ value: 'all', count: 205 });
    expect(state.filterOptions?.genres[1]).toEqual({ value: 'music', count: 30 });
  });

  it('reset keeps the pool stats (they only re-emit on join) but clears the filter', () => {
    const state = guessWhoReducer(
      guessWhoWith({
        filter: { region: 'bollywood', genre: 'music' },
        filterOptions: {
          regions: [{ value: 'all', count: 205 }],
          genres: [{ value: 'all', count: 205 }],
        },
      }),
      { type: 'reset' }
    );
    expect(state.filter).toEqual({ region: 'all', genre: 'all' });
    expect(state.filterOptions).toEqual({
      regions: [{ value: 'all', count: 205 }],
      genres: [{ value: 'all', count: 205 }],
    });
  });
});

describe('D064 FE label maps (the counts contract ships values only)', () => {
  it('maps the closed taxonomy to display labels', () => {
    expect(REGION_LABELS.bollywood).toBe('Bollywood');
    expect(REGION_LABELS.hollywood).toBe('Hollywood');
    expect(GENRE_LABELS['art-fashion']).toBe('Art & Fashion');
    expect(GENRE_LABELS.royalty).toBe('Royalty');
  });

  it('falls back to the raw string for unknown values (taxonomy drift)', () => {
    expect(filterLabel('mystery', GENRE_LABELS)).toBe('mystery');
    expect(filterLabel('all', GENRE_LABELS)).toBe('All');
    expect(filterLabel('row', REGION_LABELS)).toBe('RoW');
  });
});
