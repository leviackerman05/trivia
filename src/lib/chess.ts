/**
 * Chess rules layer (D067, owner 2026-08-07): the full CPU chess game runs
 * on chess.js (MIT, approved dependency) for move legality, check/mate
 * detection, and FEN handling, with Stockfish WASM (GPLv3, self-hosted in
 * public/stockfish/) as the opponent. This file replaces the earlier
 * hand-rolled validator as the game's rules source.
 *
 * The pure FEN grammar validator (parseFen/validateFen) is kept for the
 * dormant Lichess CC0 puzzle dataset QA gate (server/src/data/chess-puzzles
 * .json, not bundled, not served). Square math helpers stay dependency-free
 * for the board renderer.
 */

import { Chess } from 'chess.js';
import type { Move, Square } from 'chess.js';

export type ChessColor = 'w' | 'b';

export type GameStatus = 'playing' | 'check' | 'checkmate' | 'stalemate' | 'draw';

export interface ParsedFen {
  /** 8 ranks, rank 8 first (as in the FEN string). */
  ranks: string[];
  sideToMove: 'w' | 'b';
  /** '-' or a subset of KQkq. */
  castling: string;
  /** '-' or a square like 'f6'. */
  enPassant: string;
  halfmoveClock: number;
  fullmoveNumber: number;
}

export type FenParseResult = { ok: true; value: ParsedFen } | { ok: false; error: string };

const RANK_PATTERN = /^[1-8KQRBNPkqrbnp]+$/;
const EN_PASSANT_PATTERN = /^[a-h][36]$/;
const CASTLING_PATTERN = /^[KQkq]+$/;

/** Parse + validate a FEN's grammar (dormant dataset QA; the game itself
 * uses chess.js, which throws on invalid FENs). */
export function parseFen(fen: string): FenParseResult {
  if (typeof fen !== 'string' || fen.trim().length === 0) {
    return { ok: false, error: 'FEN must be a non-empty string' };
  }
  const fields = fen.trim().split(/\s+/);
  if (fields.length !== 6) {
    return { ok: false, error: `FEN must have 6 fields, got ${fields.length}` };
  }
  const [placement, sideToMove, castling, enPassant, halfmove, fullmove] = fields as [
    string,
    string,
    string,
    string,
    string,
    string,
  ];

  const ranks = placement.split('/');
  if (ranks.length !== 8) {
    return { ok: false, error: `piece placement must have 8 ranks, got ${ranks.length}` };
  }
  let whiteKings = 0;
  let blackKings = 0;
  for (const [offset, rank] of ranks.entries()) {
    if (!RANK_PATTERN.test(rank)) {
      return { ok: false, error: `invalid piece character in rank ${8 - offset}` };
    }
    let squares = 0;
    for (const char of rank) {
      if (char >= '1' && char <= '8') {
        squares += Number(char);
      } else {
        squares += 1;
        if (char === 'K') whiteKings += 1;
        if (char === 'k') blackKings += 1;
      }
    }
    if (squares !== 8) {
      return { ok: false, error: `rank ${8 - offset} sums to ${squares}, expected 8` };
    }
  }
  if (whiteKings !== 1 || blackKings !== 1) {
    return {
      ok: false,
      error: `exactly one king per side required (white ${whiteKings}, black ${blackKings})`,
    };
  }

  if (sideToMove !== 'w' && sideToMove !== 'b') {
    return { ok: false, error: "side to move must be 'w' or 'b'" };
  }
  if (castling !== '-') {
    if (!CASTLING_PATTERN.test(castling)) {
      return { ok: false, error: 'invalid castling field' };
    }
    if (new Set(castling).size !== castling.length) {
      return { ok: false, error: 'duplicate castling rights' };
    }
  }
  if (enPassant !== '-' && !EN_PASSANT_PATTERN.test(enPassant)) {
    return { ok: false, error: 'invalid en passant square' };
  }
  if (!/^\d+$/.test(halfmove) || Number(halfmove) > 1000) {
    return { ok: false, error: 'invalid halfmove clock' };
  }
  if (!/^\d+$/.test(fullmove) || Number(fullmove) < 1) {
    return { ok: false, error: 'invalid fullmove number' };
  }

  return {
    ok: true,
    value: {
      ranks,
      sideToMove: sideToMove as 'w' | 'b',
      castling,
      enPassant,
      halfmoveClock: Number(halfmove),
      fullmoveNumber: Number(fullmove),
    },
  };
}

/** Convenience predicate for the dormant dataset QA. */
export function validateFen(fen: string): boolean {
  return parseFen(fen).ok;
}

/* ── Square math (dependency-free UI helpers) ─────────────────────────── */

const FILES = 'abcdefgh';

/** 'e2' → 52 (board index 0 = a8, 63 = h1, matching chess.js board()). */
export function squareIndex(square: string): number | null {
  if (!/^[a-h][1-8]$/.test(square)) {
    return null;
  }
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);
  return (8 - rank) * 8 + file;
}

export function indexToSquare(index: number): string {
  const file = index % 8;
  const rank = 8 - Math.floor(index / 8);
  return `${FILES[file]!}${rank}`;
}

/* ── Rules layer on chess.js (D067) ───────────────────────────────────── */

export interface SquareMove {
  from: string;
  to: string;
  san: string;
  /** Set when the move needs a promotion choice (pawn reaches the last rank). */
  promotion?: boolean;
  isCapture: boolean;
  isCastle: boolean;
}

export function createChessGame(fen?: string): Chess {
  return fen ? new Chess(fen) : new Chess();
}

function toSquareMove(move: Move): SquareMove {
  return {
    from: move.from,
    to: move.to,
    san: move.san,
    promotion: move.promotion !== undefined,
    isCapture: move.flags.includes('c') || move.flags.includes('e'),
    isCastle: move.flags.includes('k') || move.flags.includes('q'),
  };
}

/** Legal moves from one square ([] for empty/opponent squares). */
export function legalMovesForSquare(game: Chess, square: string): SquareMove[] {
  try {
    return game
      .moves({ square: square as Square, verbose: true })
      .map((move) => toSquareMove(move));
  } catch {
    return [];
  }
}

/** Every legal move in the position (used by the Easy-mode blunder pick). */
export function allLegalMoves(game: Chess): SquareMove[] {
  return game.moves({ verbose: true }).map((move) => toSquareMove(move));
}

/** One uniformly random legal move, or null when the game is over. */
export function randomLegalMove(game: Chess): SquareMove | null {
  const moves = allLegalMoves(game);
  if (moves.length === 0) {
    return null;
  }
  return moves[Math.floor(Math.random() * moves.length)]!;
}

/** Apply a UCI move ('e2e4', or 'e7e8q' for promotions). Illegal moves are
 * rejected with a reason, never thrown. */
export function applyUciMove(
  game: Chess,
  uci: string
): { ok: true; move: SquareMove } | { ok: false; error: string } {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) {
    return { ok: false, error: 'Enter a move like e2e4' };
  }
  const from = uci.slice(0, 2) as Square;
  const to = uci.slice(2, 4) as Square;
  const promotion = uci.length === 5 ? uci[4] : undefined;
  try {
    const move = game.move({ from, to, promotion });
    return { ok: true, move: toSquareMove(move) };
  } catch {
    return { ok: false, error: 'that move is not legal' };
  }
}

/**
 * Current status: checkmate / stalemate / draw (any of the draw rules,
 * including insufficient material, 50-move, and threefold) / check / playing.
 */
export function gameStatus(game: Chess): GameStatus {
  if (game.isCheckmate()) {
    return 'checkmate';
  }
  if (game.isStalemate()) {
    return 'stalemate';
  }
  if (game.isDraw()) {
    return 'draw';
  }
  return game.inCheck() ? 'check' : 'playing';
}

/** Human result line for the end state. `winner` is the color that won. */
export function resultText(status: GameStatus, winner: ChessColor | null): string {
  if (status === 'checkmate') {
    return winner === 'w' ? 'Checkmate, white wins' : 'Checkmate, black wins';
  }
  if (status === 'stalemate') {
    return 'Draw by stalemate';
  }
  if (status === 'draw') {
    return 'Draw';
  }
  return '';
}

/** Piece glyph letters → display names (shared by toSimpleSAN and the UI). */
export const PIECE_DISPLAY_NAMES: Record<string, string> = {
  K: 'King',
  Q: 'Queen',
  R: 'Rook',
  B: 'Bishop',
  N: 'Knight',
};

/**
 * Convert a chess.js SAN like 'Qxb5' into casual notation for the move list
 * ('Queen captures B5'). Pawn moves carry no piece word ('e4' → 'E4');
 * castling becomes 'Castle' / 'Castle long'; disambiguation letters (Nbd7)
 * are dropped; check/checkmate and promotions keep their suffixes. The
 * algebraic SAN from chess.js history stays the source of truth.
 */
export function toSimpleSAN(san: string): string {
  if (san === 'O-O' || san === 'O-O-O') {
    return san === 'O-O-O' ? 'Castle long' : 'Castle';
  }

  let body = san;
  let pieceName = '';
  const first = body[0]!;
  if (first >= 'A' && first <= 'Z') {
    pieceName = PIECE_DISPLAY_NAMES[first] ?? '';
    body = body.slice(1);
  }

  let suffix = '';
  if (body.endsWith('#')) {
    suffix = 'Checkmate';
    body = body.slice(0, -1);
  } else if (body.endsWith('+')) {
    suffix = 'Check';
    body = body.slice(0, -1);
  }

  let promotion = '';
  const eq = body.indexOf('=');
  if (eq !== -1) {
    const piece = body[eq + 1] ?? '';
    promotion = `promotes to ${PIECE_DISPLAY_NAMES[piece] ?? piece}`;
    body = body.slice(0, eq);
  }

  // SAN always ends with the destination square; everything before it is
  // the moving piece, disambiguation, and an optional 'x' capture marker.
  const target = body.slice(-2).toUpperCase();
  const prefix = body.slice(0, -2);
  const isCapture = prefix.includes('x');

  // Pawn moves carry no piece word: 'e4' → 'E4', 'exd5' → 'captures D5'.
  const parts: string[] = [];
  if (pieceName) {
    parts.push(pieceName, isCapture ? 'captures' : 'to', target);
  } else if (isCapture) {
    parts.push('captures', target);
  } else {
    parts.push(target);
  }
  if (promotion) {
    parts.push(promotion);
  }
  if (suffix) {
    parts.push(suffix);
  }
  return parts.join(' ');
}
