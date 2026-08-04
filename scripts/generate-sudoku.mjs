#!/usr/bin/env node
/**
 * M18 — Daily Sudoku puzzle generator. Produces src/data/sudoku-puzzles.json:
 * an array of 400 medium-difficulty puzzles (81 digits each, 0 = empty),
 * each with a UNIQUE solution (verified by a two-solution-counting solver).
 * Deterministic (mulberry32 seeded) so re-running yields identical output.
 *
 * Run: node scripts/generate-sudoku.mjs
 */

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(array, random) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const swap = array[i];
    array[i] = array[j];
    array[j] = swap;
  }
  return array;
}

function fullGrid(random) {
  const grid = Array.from({ length: 9 }, () => Array(9).fill(0));
  const fill = () => {
    for (let row = 0; row < 9; row += 1) {
      for (let col = 0; col < 9; col += 1) {
        if (grid[row][col] !== 0) {
          continue;
        }
        const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], random);
        for (const digit of digits) {
          if (canPlace(grid, row, col, digit)) {
            grid[row][col] = digit;
            if (fill()) {
              return true;
            }
            grid[row][col] = 0;
          }
        }
        return false;
      }
    }
    return true;
  };
  fill();
  return grid;
}

function canPlace(grid, row, col, digit) {
  for (let i = 0; i < 9; i += 1) {
    if (grid[row][i] === digit || grid[i][col] === digit) {
      return false;
    }
  }
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r += 1) {
    for (let c = boxCol; c < boxCol + 3; c += 1) {
      if (grid[r][c] === digit) {
        return false;
      }
    }
  }
  return true;
}

/** Count solutions, stopping at `limit` (1 = unique, 2 = not unique). */
function countSolutions(grid, limit = 2) {
  let count = 0;
  const solve = () => {
    if (count >= limit) {
      return;
    }
    for (let row = 0; row < 9; row += 1) {
      for (let col = 0; col < 9; col += 1) {
        if (grid[row][col] !== 0) {
          continue;
        }
        for (let digit = 1; digit <= 9; digit += 1) {
          if (canPlace(grid, row, col, digit)) {
            grid[row][col] = digit;
            solve();
            if (count >= limit) {
              grid[row][col] = 0;
              return;
            }
            grid[row][col] = 0;
          }
        }
        return;
      }
    }
    count += 1;
  };
  solve();
  return count;
}

/** Remove cells at random while keeping the solution unique. Target: a
 * medium difficulty (28–32 clues). */
function makePuzzle(random) {
  const solution = fullGrid(random);
  const grid = solution.map((row) => [...row]);
  const positions = shuffle(
    Array.from({ length: 81 }, (_, i) => [Math.floor(i / 9), i % 9]),
    random
  );
  let clues = 81;
  const target = 28 + Math.floor(random() * 5); // 28–32 clues
  for (const [row, col] of positions) {
    if (clues <= target) {
      break;
    }
    const backup = grid[row][col];
    grid[row][col] = 0;
    const probe = grid.map((r) => [...r]);
    if (countSolutions(probe, 2) !== 1) {
      grid[row][col] = backup; // removal breaks uniqueness — keep the clue
    } else {
      clues -= 1;
    }
  }
  return { grid: grid.flat(), clues };
}

const COUNT = 400;
const puzzles = [];
const random = mulberry32(0x5eed);
let attempts = 0;
while (puzzles.length < COUNT && attempts < 2000) {
  attempts += 1;
  const { grid, clues } = makePuzzle(random);
  // Sanity: the puzzle is solvable and unique.
  const copy = Array.from({ length: 9 }, (_, r) => grid.slice(r * 9, r * 9 + 9));
  if (countSolutions(copy, 2) === 1) {
    puzzles.push(grid);
  }
  if (puzzles.length % 100 === 0) {
    process.stdout.write(`generated ${puzzles.length}/${COUNT} (clues ${clues})…\n`);
  }
}
if (puzzles.length < COUNT) {
  console.error(`only generated ${puzzles.length} — increase attempts`);
  process.exit(1);
}

writeFileSync(join(root, 'src/data/sudoku-puzzles.json'), JSON.stringify(puzzles) + '\n');
console.log(`sudoku: ${puzzles.length} unique-solution puzzles -> src/data/sudoku-puzzles.json`);
