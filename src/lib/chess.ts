/**
 * R19 (M21): pure FEN validator for the Daily Chess puzzle dataset.
 *
 * No engine, no chess.js — the no-new-deps gate (PLAN-SCOPE §6.9, Architect
 * ruling recorded in D055). Validates the FEN grammar plus the board-sanity
 * rules the dataset QA gate needs: 8 ranks of 8 squares, one king per side,
 * legal side-to-move / castling / en-passant fields, sane clocks. The move
 * checking itself is dataset-driven (solution-move comparison), not
 * engine-driven.
 */

export type FenParseResult = { ok: true; value: ParsedFen } | { ok: false; error: string };

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

const RANK_PATTERN = /^[1-8KQRBNPkqrbnp]+$/;
const EN_PASSANT_PATTERN = /^[a-h][36]$/;
const CASTLING_PATTERN = /^[KQkq]+$/;

/** Parse + validate a FEN. Rejects malformed grammar and illegal board states. */
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

/** Convenience predicate for dataset QA. */
export function validateFen(fen: string): boolean {
  return parseFen(fen).ok;
}
