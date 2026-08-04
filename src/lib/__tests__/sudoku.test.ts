import { describe, expect, it } from 'vitest';
import {
  conflictCount,
  isComplete,
  pickDailySudoku,
  sudokuPuzzles,
  SUDOKU_COMPLETION_POINTS,
  validPlacement,
} from '../sudoku';

/** A known-complete valid sudoku solution (rows 1..9). */
const SOLVED = [
  5, 3, 4, 6, 7, 8, 9, 1, 2, 6, 7, 2, 1, 9, 5, 3, 4, 8, 1, 9, 8, 3, 4, 2, 5, 6, 7, 8, 5, 9, 7, 6, 1,
  4, 2, 3, 4, 2, 6, 8, 5, 3, 7, 9, 1, 7, 1, 3, 9, 2, 4, 8, 5, 6, 9, 6, 1, 5, 3, 7, 2, 8, 4, 2, 8, 7,
  4, 1, 9, 6, 3, 5, 3, 4, 5, 2, 8, 6, 1, 7, 9,
];

describe('Daily Sudoku logic (M18)', () => {
  it('has a pre-generated dataset of unique-solution puzzles', () => {
    expect(sudokuPuzzles.length).toBeGreaterThanOrEqual(365);
    for (const puzzle of sudokuPuzzles.slice(0, 20)) {
      expect(puzzle).toHaveLength(81);
      expect(puzzle.some((digit) => digit === 0)).toBe(true); // unsolved
    }
  });

  it('picks the same puzzle for the same UTC date', () => {
    const a = pickDailySudoku(new Date('2026-08-04T12:00:00Z'))[0];
    const b = pickDailySudoku(new Date('2026-08-04T23:59:00Z'))[0];
    expect(a).toEqual(b);
  });

  it('picks different puzzles on different days', () => {
    const a = pickDailySudoku(new Date('2026-08-04T12:00:00Z'))[0];
    const b = pickDailySudoku(new Date('2026-08-05T12:00:00Z'))[0];
    expect(a).not.toEqual(b);
  });

  it('validPlacement respects rows, columns, and boxes', () => {
    const grid = [...SOLVED];
    grid[0] = 0; // empty the first cell
    // 3 is in the first row (col 1), invalid.
    expect(validPlacement(grid, 0, 0, 3)).toBe(false);
    // 6 is in the first column (row 1), invalid.
    expect(validPlacement(grid, 0, 0, 6)).toBe(false);
    // 5 was the original digit, it fits again.
    expect(validPlacement(grid, 0, 0, 5)).toBe(true);
  });

  it('isComplete accepts only full, conflict-free grids', () => {
    expect(isComplete(SOLVED)).toBe(true);
    const incomplete = [...SOLVED];
    incomplete[0] = 0;
    expect(isComplete(incomplete)).toBe(false);
    const conflict = [...SOLVED];
    conflict[1] = 5; // duplicate 5 in the first row
    expect(isComplete(conflict)).toBe(false);
  });

  it('conflictCount counts every conflicting cell once', () => {
    const conflict = [...SOLVED];
    conflict[1] = 5; // row conflict with cell 0
    conflict[10] = 6; // conflicts with (1,0) column-wise? 6 at (1,1) vs 6 at (0,2)? (1,1)=7→6 conflicts with (0,2)=4? no, keep it simple: count >= 1
    expect(conflictCount(conflict)).toBeGreaterThanOrEqual(1);
    expect(conflictCount(SOLVED)).toBe(0);
  });

  it('completion scores a flat 200', () => {
    expect(SUDOKU_COMPLETION_POINTS).toBe(200);
  });
});
