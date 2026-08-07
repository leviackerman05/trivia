import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import {
  allLegalMoves,
  applyUciMove,
  createChessGame,
  gameStatus,
  indexToSquare,
  legalMovesForSquare,
  parseFen,
  randomLegalMove,
  resultText,
  squareIndex,
  toSimpleSAN,
} from '../chess';
import chessPuzzlesJson from '../../../server/src/data/chess-puzzles.json';

interface ChessPuzzleRow {
  id: string;
  fen: string;
  moves: string[];
  themes: string[];
  rating: number;
  credit: string;
}

// L11 contract: flat array (Lichess CC0). Server-only data — imported here
// purely as the dormant dataset QA gate, never bundled into the client.
const puzzles = chessPuzzlesJson as ChessPuzzleRow[];

describe('parseFen / validateFen (dormant dataset QA, kept from R19)', () => {
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

  it('requires exactly 6 fields and 8 ranks summing to 8 squares', () => {
    const base = '8/8/8/8/8/8/8/K6k w - - 0 1';
    expect(parseFen(base).ok).toBe(true);
    expect(parseFen(base.split(' ').slice(0, 5).join(' ')).ok).toBe(false);
    expect(parseFen('7/8/8/8/8/8/8/K6k w - - 0 1').ok).toBe(false);
    expect(parseFen('8/8/8/8/8/8/8/XK5k w - - 0 1').ok).toBe(false);
  });

  it('requires exactly one king per side', () => {
    expect(parseFen('8/8/8/8/8/8/8/K7 w - - 0 1').ok).toBe(false);
    expect(parseFen('k7/8/8/8/8/8/8/K7 w - - 0 1').ok).toBe(true);
  });
});

describe('chess.js rules layer (D067, the game rules source)', () => {
  it('exposes legal moves per square from the starting position', () => {
    const game = createChessGame();
    const e2 = legalMovesForSquare(game, 'e2').map((move) => move.to);
    expect(e2.sort()).toEqual(['e3', 'e4']);
    expect(
      legalMovesForSquare(game, 'b1')
        .map((move) => move.to)
        .sort()
    ).toEqual(['a3', 'c3']);
    expect(legalMovesForSquare(game, 'a1')).toHaveLength(0); // blocked pawn
    expect(legalMovesForSquare(game, 'e7')).toHaveLength(0); // black to move is white's turn
  });

  it('highlights castling as a king move with its flag', () => {
    const game = createChessGame('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    const moves = legalMovesForSquare(game, 'e1');
    expect(moves.some((move) => move.to === 'g1' && move.isCastle)).toBe(true);
    expect(moves.some((move) => move.to === 'c1' && move.isCastle)).toBe(true);
    expect(moves.some((move) => move.san === 'O-O')).toBe(true);
  });

  it('applies legal UCI moves and rejects illegal ones', () => {
    const game = createChessGame();
    const ok = applyUciMove(game, 'e2e4');
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.move.san).toBe('e4');
    expect(applyUciMove(game, 'd2d4').ok).toBe(false); // white tries on black's turn
    expect(applyUciMove(game, 'e4e6').ok).toBe(false); // double push from a non-start rank
    expect(applyUciMove(game, 'notamove').ok).toBe(false);
  });

  it('handles promotion moves (explicit piece required)', () => {
    const game = createChessGame('8/4P3/8/8/8/8/8/K6k w - - 0 1');
    expect(applyUciMove(game, 'e7e8').ok).toBe(false); // missing promotion piece
    const promoted = applyUciMove(game, 'e7e8q');
    expect(promoted.ok).toBe(true);
    if (!promoted.ok) return;
    expect(promoted.move.promotion).toBe(true);
    expect(promoted.move.san).toBe('e8=Q');
    expect(game.fen()).toContain('4Q3');
  });

  it('detects check, checkmate, stalemate, and draw states', () => {
    const check = createChessGame('8/8/8/8/8/8/8/K3q2k w - - 0 1');
    expect(gameStatus(check)).toBe('check');

    // Fool's mate.
    const mate = createChessGame();
    applyUciMove(mate, 'f2f3');
    applyUciMove(mate, 'e7e5');
    applyUciMove(mate, 'g2g4');
    applyUciMove(mate, 'd8h4');
    expect(gameStatus(mate)).toBe('checkmate');
    expect(resultText(gameStatus(mate), 'b')).toContain('black wins');

    // Classic stalemate: black king h8, queen f7, king g6; no moves, not in check.
    const stalemate = createChessGame('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    expect(gameStatus(stalemate)).toBe('stalemate');

    const draw = createChessGame('8/8/8/8/8/8/8/K6k w - - 0 1'); // kings only
    expect(gameStatus(draw)).toBe('draw');
  });

  it('picks a uniformly legal random move for the Easy-mode blunder path', () => {
    const game = createChessGame();
    for (let i = 0; i < 10; i += 1) {
      const move = randomLegalMove(game);
      expect(move).not.toBeNull();
      const check = applyUciMove(game, `${move!.from}${move!.to}`);
      expect(check.ok).toBe(true);
      game.undo();
    }
    expect(allLegalMoves(game).length).toBe(20);
  });

  it('round-trips FENs through the engine', () => {
    const game = createChessGame();
    expect(game.fen()).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    expect(indexToSquare(squareIndex('h1')!)).toBe('h1');
    expect(indexToSquare(squareIndex('a8')!)).toBe('a8');
  });
});

describe('toSimpleSAN (move list casual notation)', () => {
  it('maps the designer examples', () => {
    expect(toSimpleSAN('Qxb5')).toBe('Queen captures B5');
    expect(toSimpleSAN('Nf3')).toBe('Knight to F3');
  });

  it('drops the piece word for pawn moves and keeps captures', () => {
    expect(toSimpleSAN('e4')).toBe('E4');
    expect(toSimpleSAN('exd5')).toBe('captures D5');
    expect(toSimpleSAN('axb5')).toBe('captures B5');
  });

  it('maps every piece letter and castling', () => {
    expect(toSimpleSAN('Bb5')).toBe('Bishop to B5');
    expect(toSimpleSAN('Re8')).toBe('Rook to E8');
    expect(toSimpleSAN('Qd7')).toBe('Queen to D7');
    expect(toSimpleSAN('Kf2')).toBe('King to F2');
    expect(toSimpleSAN('O-O')).toBe('Castle');
    expect(toSimpleSAN('O-O-O')).toBe('Castle long');
  });

  it('keeps check, checkmate, and promotion suffixes', () => {
    expect(toSimpleSAN('Qh4#')).toBe('Queen to H4 Checkmate');
    expect(toSimpleSAN('Bb5+')).toBe('Bishop to B5 Check');
    expect(toSimpleSAN('e8=Q')).toBe('E8 promotes to Queen');
    expect(toSimpleSAN('e8=Q#')).toBe('E8 promotes to Queen Checkmate');
    expect(toSimpleSAN('axb5+')).toBe('captures B5 Check');
  });

  it('drops disambiguation letters from the target square', () => {
    expect(toSimpleSAN('Nbd7')).toBe('Knight to D7');
    expect(toSimpleSAN('R1e2')).toBe('Rook to E2');
    expect(toSimpleSAN('Nexd5')).toBe('Knight captures D5');
  });
});

describe('chess-puzzles.json dormant dataset (Lichess CC0, server-only)', () => {
  it('has 1,000+ puzzles with unique ids (L11 lot)', () => {
    expect(puzzles.length).toBeGreaterThanOrEqual(1000);
    expect(new Set(puzzles.map((puzzle) => puzzle.id)).size).toBe(puzzles.length);
  });

  it('every puzzle FEN loads in both the grammar validator and chess.js', () => {
    for (const puzzle of puzzles) {
      expect(parseFen(puzzle.fen).ok, puzzle.id).toBe(true);
      expect(() => new Chess(puzzle.fen), puzzle.id).not.toThrow();
    }
  });

  it('every puzzle first move is legal in its position (chess.js cross-check)', () => {
    for (const puzzle of puzzles) {
      const first = puzzle.moves[0]!;
      const game = new Chess(puzzle.fen);
      expect(
        () => game.move({ from: first.slice(0, 2), to: first.slice(2, 4) }),
        `${puzzle.id}: ${first}`
      ).not.toThrow();
    }
  });

  it('every puzzle carries moves, themes, rating, and CC0 credit', () => {
    for (const puzzle of puzzles) {
      expect(puzzle.moves.length, puzzle.id).toBeGreaterThan(0);
      expect(Array.isArray(puzzle.themes), puzzle.id).toBe(true);
      expect(typeof puzzle.rating, puzzle.id).toBe('number');
      expect(puzzle.credit, puzzle.id).toContain('CC0');
    }
  });
});
