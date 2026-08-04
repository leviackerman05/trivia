import { describe, expect, it } from 'vitest';
import {
  daysBetween,
  MAX_FREEZES,
  nextStreakDay,
  seasonKeyOf,
  type StreakState,
} from '../streak-engine.js';

const empty: StreakState = { current: 0, longest: 0, lastDate: '' };

describe('streak engine (Phase 1.5, D048)', () => {
  it('starts a streak on the first play', () => {
    const result = nextStreakDay({
      state: empty,
      today: '2026-08-04',
      freezes: 0,
      restoreUsed: false,
      seasonKey: '2026-Q3',
    });
    expect(result.state).toEqual({ current: 1, longest: 1, lastDate: '2026-08-04' });
    expect(result.freezesEarned).toBe(0);
    expect(result.freezesUsed).toBe(0);
  });

  it('grows on consecutive days and never double-counts the same day', () => {
    let state = empty;
    state = nextStreakDay({
      state,
      today: '2026-08-01',
      freezes: 0,
      restoreUsed: false,
      seasonKey: '2026-Q3',
    }).state;
    state = nextStreakDay({
      state,
      today: '2026-08-02',
      freezes: 0,
      restoreUsed: false,
      seasonKey: '2026-Q3',
    }).state;
    const third = nextStreakDay({
      state,
      today: '2026-08-03',
      freezes: 0,
      restoreUsed: false,
      seasonKey: '2026-Q3',
    });
    expect(third.state.current).toBe(3);
    expect(third.state.longest).toBe(3);

    const sameDay = nextStreakDay({
      state: third.state,
      today: '2026-08-03',
      freezes: 0,
      restoreUsed: false,
      seasonKey: '2026-Q3',
    });
    expect(sameDay.state).toEqual(third.state);
  });

  it('resets to 1 after an unprotected missed day', () => {
    const day1 = nextStreakDay({
      state: empty,
      today: '2026-08-01',
      freezes: 0,
      restoreUsed: true,
      seasonKey: '2026-Q3',
    }).state;
    const day2 = nextStreakDay({
      state: day1,
      today: '2026-08-02',
      freezes: 0,
      restoreUsed: true,
      seasonKey: '2026-Q3',
    }).state;
    const result = nextStreakDay({
      state: day2,
      today: '2026-08-04',
      freezes: 0,
      restoreUsed: true,
      seasonKey: '2026-Q3',
    });
    expect(result.state.current).toBe(1);
    expect(result.state.longest).toBe(2); // history is preserved
  });

  it('consumes a freeze to bridge one missed day', () => {
    const day1 = nextStreakDay({
      state: empty,
      today: '2026-08-01',
      freezes: 1,
      restoreUsed: true,
      seasonKey: '2026-Q3',
    }).state;
    const result = nextStreakDay({
      state: day1,
      today: '2026-08-03',
      freezes: 1,
      restoreUsed: true,
      seasonKey: '2026-Q3',
    });
    expect(result.freezesUsed).toBe(1);
    expect(result.state.current).toBe(2); // streak survived
  });

  it('consumes multiple freezes for a longer gap', () => {
    const day1 = nextStreakDay({
      state: empty,
      today: '2026-08-01',
      freezes: 3,
      restoreUsed: true,
      seasonKey: '2026-Q3',
    }).state;
    const result = nextStreakDay({
      state: day1,
      today: '2026-08-04',
      freezes: 3,
      restoreUsed: true,
      seasonKey: '2026-Q3',
    });
    expect(result.freezesUsed).toBe(2);
    expect(result.state.current).toBe(2);
  });

  it('falls back to the season restore when freezes run out (one missed day)', () => {
    const day1 = nextStreakDay({
      state: empty,
      today: '2026-08-01',
      freezes: 0,
      restoreUsed: false,
      seasonKey: '2026-Q3',
    }).state;
    const result = nextStreakDay({
      state: day1,
      today: '2026-08-03',
      freezes: 0,
      restoreUsed: false,
      seasonKey: '2026-Q3',
    });
    expect(result.restoreUsed).toBe(true);
    expect(result.state.current).toBe(2);
    expect(result.freezesUsed).toBe(0);
  });

  it('does not restore a gap of more than one missed day', () => {
    const day1 = nextStreakDay({
      state: empty,
      today: '2026-08-01',
      freezes: 0,
      restoreUsed: false,
      seasonKey: '2026-Q3',
    }).state;
    const result = nextStreakDay({
      state: day1,
      today: '2026-08-04',
      freezes: 0,
      restoreUsed: false,
      seasonKey: '2026-Q3',
    });
    expect(result.restoreUsed).toBe(false);
    expect(result.state.current).toBe(1);
  });

  it('uses freezes before the restore', () => {
    const day1 = nextStreakDay({
      state: empty,
      today: '2026-08-01',
      freezes: 1,
      restoreUsed: false,
      seasonKey: '2026-Q3',
    }).state;
    const result = nextStreakDay({
      state: day1,
      today: '2026-08-03',
      freezes: 1,
      restoreUsed: false,
      seasonKey: '2026-Q3',
    });
    expect(result.freezesUsed).toBe(1);
    expect(result.restoreUsed).toBe(false); // restore untouched
  });

  it('earns one freeze per 7-day milestone and respects the cap', () => {
    let state = empty;
    let freezes = 0;
    let restoreUsed = false;
    for (let day = 1; day <= 21; day += 1) {
      const key = `2026-08-${String(day).padStart(2, '0')}`;
      const result = nextStreakDay({
        state,
        today: key,
        freezes,
        restoreUsed,
        seasonKey: '2026-Q3',
      });
      state = result.state;
      freezes = Math.min(MAX_FREEZES, freezes + result.freezesEarned - result.freezesUsed);
      restoreUsed = result.restoreUsed;
    }
    expect(state.current).toBe(21);
    expect(freezes).toBe(MAX_FREEZES); // earned at 7, 14, 21, capped at 3
  });

  it('computes day gaps and season keys correctly', () => {
    expect(daysBetween('2026-08-01', '2026-08-03')).toBe(2);
    expect(daysBetween('2026-08-31', '2026-09-02')).toBe(2);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(seasonKeyOf(new Date('2026-08-04T00:00:00Z'))).toBe('2026-Q3');
    expect(seasonKeyOf(new Date('2026-01-01T00:00:00Z'))).toBe('2026-Q1');
    expect(seasonKeyOf(new Date('2026-11-30T00:00:00Z'))).toBe('2026-Q4');
  });
});
