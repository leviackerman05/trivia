/**
 * Daily Sudoku (M18 — owner request: daily games like other sites) — pure
 * game logic. The puzzle set (400 unique-solution grids, 81 digits each,
 * 0 = empty) is pre-generated offline by scripts/generate-sudoku.mjs; the
 * daily pick is seeded by UTC date so everyone plays the same puzzle.
 * Scoring is flat (M18 philosophy): 200 points for completing the puzzle.
 */

import puzzlesJson from '../data/sudoku-puzzles.json';
import { dailyDateKey, hashString } from './trivia';

export const sudokuPuzzles = puzzlesJson as number[][];

export const SUDOKU_COMPLETION_POINTS = 200;

/** The same puzzle for everyone on the same UTC day. */
export function pickDailySudoku(date: Date, count = 10): number[][] {
  const rand = seededRandom(hashString(dailyDateKey(date)));
  const pool = [...sudokuPuzzles];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const swap = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = swap;
  }
  return pool.slice(0, Math.min(count, pool.length));
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Can `value` go at (row, col) without breaking the row/col/box rules? */
export function validPlacement(grid: number[], row: number, col: number, value: number): boolean {
  for (let i = 0; i < 9; i += 1) {
    if (grid[row * 9 + i] === value || grid[i * 9 + col] === value) {
      return false;
    }
  }
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r += 1) {
    for (let c = boxCol; c < boxCol + 3; c += 1) {
      if (grid[r * 9 + c] === value) {
        return false;
      }
    }
  }
  return true;
}

/** All 81 cells filled AND every placement valid (no conflicts). */
export function isComplete(grid: number[]): boolean {
  if (grid.some((digit) => digit === 0)) {
    return false;
  }
  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const value = grid[row * 9 + col]!;
      const probe = [...grid];
      probe[row * 9 + col] = 0;
      if (!validPlacement(probe, row, col, value)) {
        return false;
      }
    }
  }
  return true;
}

/** Count cells that conflict with the row/col/box rules (for the hint UI). */
export function conflictCount(grid: number[]): number {
  let conflicts = 0;
  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const value = grid[row * 9 + col]!;
      if (value === 0) {
        continue;
      }
      const probe = [...grid];
      probe[row * 9 + col] = 0;
      if (!validPlacement(probe, row, col, value)) {
        conflicts += 1;
      }
    }
  }
  return conflicts;
}
