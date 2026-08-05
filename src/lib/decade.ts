/**
 * [R8] Decade filters — the client half (charades is server-side, per the
 * brief). Pure helpers: a decade bucket, the preset slate (All + the
 * 60s–20s), and a pool filter that excludes entries without a `year` under
 * any filter while "All" includes everything.
 */

/** Bucket a year into its decade (1969 → 1960, 1970 → 1970). */
export function decadeOf(year: number): number {
  return Math.floor(year / 10) * 10;
}

/** The preset slate: `null` = All, then the 60s through 20s decades. */
export const DECADE_PRESETS: (number | null)[] = [null, 1960, 1970, 1980, 1990, 2000, 2010, 2020];

/**
 * Filter a pool by decade. `decade === null` (All) returns every entry;
 * otherwise only entries whose `decadeOf(yearOf(entry))` matches. Entries
 * without a year are excluded under a filter, included under All. Always
 * returns a new array; the input is never mutated.
 */
export function filterByDecade<T>(
  entries: readonly T[],
  decade: number | null,
  yearOf: (entry: T) => number | undefined
): T[] {
  if (decade === null) {
    return [...entries];
  }
  return entries.filter((entry) => {
    const year = yearOf(entry);
    return year !== undefined && decadeOf(year) === decade;
  });
}
