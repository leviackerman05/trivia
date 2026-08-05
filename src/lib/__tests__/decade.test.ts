import { describe, expect, it } from 'vitest';
import { DECADE_PRESETS, decadeOf, filterByDecade } from '../decade';

describe('decadeOf (R8)', () => {
  it('buckets years into their decade', () => {
    expect(decadeOf(1969)).toBe(1960);
    expect(decadeOf(1970)).toBe(1970);
    expect(decadeOf(1984)).toBe(1980);
    expect(decadeOf(2026)).toBe(2020);
  });
});

describe('filterByDecade (R8)', () => {
  const entries = [
    { id: 'a', year: 1965 },
    { id: 'b', year: 1971 },
    { id: 'c', year: 1969 },
    { id: 'd' }, // no year
  ];
  const yearOf = (entry: { id: string; year?: number }) => entry.year;

  it('returns everything under All, including entries without a year', () => {
    const all = filterByDecade(entries, null, yearOf);
    expect(all).toHaveLength(4);
    expect(all.map((entry) => entry.id).sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('matches only the requested decade', () => {
    const sixties = filterByDecade(entries, 1960, yearOf);
    expect(sixties.map((entry) => entry.id).sort()).toEqual(['a', 'c']);
  });

  it('excludes entries without a year under a filter', () => {
    expect(filterByDecade(entries, 1970, yearOf).map((entry) => entry.id)).toEqual(['b']);
  });

  it('handles the 1969/1970 boundary', () => {
    expect(filterByDecade(entries, 1960, yearOf).map((entry) => entry.id)).toContain('a');
    expect(filterByDecade(entries, 1970, yearOf).map((entry) => entry.id)).not.toContain('c');
  });

  it('returns a new array and never mutates the input', () => {
    const input = [...entries];
    filterByDecade(input, 1960, yearOf);
    expect(input).toHaveLength(4);
    expect(filterByDecade(input, null, yearOf)).not.toBe(input);
  });

  it('has the All + 60s–20s preset slate', () => {
    expect(DECADE_PRESETS).toEqual([null, 1960, 1970, 1980, 1990, 2000, 2010, 2020]);
  });
});
