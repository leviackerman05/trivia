import { describe, expect, it } from 'vitest';
import { parseFen, validateFen } from '../chess';
import chessPuzzlesJson from '../../../server/src/data/chess-puzzles.json';

interface ChessPuzzle {
  id: string;
  fen: string;
  moves: string[];
  themes: string[];
  source: { site: string; id: string; license: string };
  attribution: string;
}

const puzzles = (chessPuzzlesJson as { puzzles: ChessPuzzle[] }).puzzles;

describe('parseFen / validateFen (R19, pure validator, no engine)', () => {
  it('accepts a full valid FEN and parses all six fields', () => {
    const result = parseFen('rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.ranks).toHaveLength(8);
    expect(result.value.sideToMove).toBe('w');
    expect(result.value.castling).toBe('KQkq');
    expect(result.value.enPassant).toBe('f6');
    expect(result.value.halfmoveClock).toBe(0);
    expect(result.value.fullmoveNumber).toBe(3);
  });

  it('rejects non-strings and empty FENs', () => {
    expect(parseFen('').ok).toBe(false);
    expect(parseFen('   ').ok).toBe(false);
    expect(parseFen(42 as unknown as string).ok).toBe(false);
  });

  it('requires exactly 6 fields', () => {
    const base = '8/8/8/8/8/8/8/K6k w - - 0 1';
    expect(parseFen(base).ok).toBe(true);
    expect(parseFen(base.split(' ').slice(0, 5).join(' ')).ok).toBe(false);
    expect(parseFen(`${base} extra`).ok).toBe(false);
  });

  it('requires 8 ranks, each summing to exactly 8 squares', () => {
    expect(parseFen('8/8/8/8/8/8/8/K6k w - - 0 1').ok).toBe(true);
    // 7 ranks.
    expect(parseFen('8/8/8/8/8/8/K6k w - - 0 1').ok).toBe(false);
    // Rank sums to 7.
    expect(parseFen('7/8/8/8/8/8/8/K6k w - - 0 1').ok).toBe(false);
    // Rank sums to 9.
    expect(parseFen('9/8/8/8/8/8/8/K6k w - - 0 1').ok).toBe(false);
    // Garbage piece character.
    expect(parseFen('8/8/8/8/8/8/8/XK5k w - - 0 1').ok).toBe(false);
  });

  it('requires exactly one king per side', () => {
    expect(parseFen('8/8/8/8/8/8/8/K7 w - - 0 1').ok).toBe(false); // no black king
    expect(parseFen('8/8/8/8/8/8/8/KK6 w - - 0 1').ok).toBe(false); // two white kings
    expect(parseFen('k7/8/8/8/8/8/8/K7 w - - 0 1').ok).toBe(true);
  });

  it('validates side to move, castling, and en passant fields', () => {
    const base = '8/8/8/8/8/8/8/K6k w - - 0 1';
    expect(parseFen(base).ok).toBe(true);
    expect(parseFen(base.replace(' w ', ' x ')).ok).toBe(false);
    expect(parseFen(base.replace(' - - ', ' - - ')).ok).toBe(true);
    expect(parseFen(base.replace(' - - ', ' KQkq - ')).ok).toBe(true);
    expect(parseFen(base.replace(' - - ', ' KQkK - ')).ok).toBe(false); // dupes
    expect(parseFen(base.replace(' - - ', ' kk - ')).ok).toBe(false); // dupes
    expect(parseFen(base.replace(' - - ', ' XYZ - ')).ok).toBe(false);
    expect(parseFen(base.replace(' - - ', ' - e4 ')).ok).toBe(false); // ep only on rank 3/6
    expect(parseFen(base.replace(' - - ', ' - f6 ')).ok).toBe(true);
  });

  it('validates the clocks', () => {
    const base = '8/8/8/8/8/8/8/K6k w - -';
    expect(parseFen(`${base} 0 1`).ok).toBe(true);
    expect(parseFen(`${base} -1 1`).ok).toBe(false);
    expect(parseFen(`${base} 0 0`).ok).toBe(false);
    expect(parseFen(`${base} 0 -2`).ok).toBe(false);
    expect(parseFen(`${base} abc 1`).ok).toBe(false);
    expect(parseFen(`${base} 0 x`).ok).toBe(false);
  });
});

describe('chess-puzzles.json dataset (R19 skeleton, Lichess CC0)', () => {
  it('has a non-empty skeleton and unique puzzle ids', () => {
    expect(puzzles.length).toBeGreaterThan(0);
    expect(new Set(puzzles.map((puzzle) => puzzle.id)).size).toBe(puzzles.length);
  });

  it('every puzzle FEN is valid (dataset QA gate)', () => {
    for (const puzzle of puzzles) {
      const result = parseFen(puzzle.fen);
      expect(result.ok, `${puzzle.id}: ${puzzle.fen} → ${result.ok ? '' : result.error}`).toBe(
        true
      );
    }
  });

  it('every puzzle carries UCI solution moves, themes, source, and attribution', () => {
    for (const puzzle of puzzles) {
      expect(puzzle.moves.length, puzzle.id).toBeGreaterThan(0);
      for (const move of puzzle.moves) {
        expect(move, puzzle.id).toMatch(/^[a-h][1-8][a-h][1-8]$/);
      }
      expect(Array.isArray(puzzle.themes), puzzle.id).toBe(true);
      expect(puzzle.source.site, puzzle.id).toBe('lichess');
      expect(puzzle.source.license, puzzle.id).toBe('CC0-1.0');
      expect(puzzle.attribution.length, puzzle.id).toBeGreaterThan(0);
      expect(puzzle.attribution, puzzle.id).toContain('CC0');
    }
  });

  it('validateFen agrees with parseFen on every dataset FEN', () => {
    for (const puzzle of puzzles) {
      expect(validateFen(puzzle.fen)).toBe(true);
    }
  });
});
