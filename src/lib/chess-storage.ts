/**
 * Chess persistence — triviahub:chess:v1
 *
 * Persists the active Chess vs CPU game so refresh / tab-switch /
 * navigation lands back on the same board, move list, difficulty pill and
 * game-over state. Only the explicit "New game" button (or clearing the key
 * manually) returns to the start screen.
 *
 * Shape mirrors the in-memory Chess.tsx state, stored as JSON. Validation is
 * strict: any malformed snapshot is treated as absent (cleared on read) so a
 * corrupt entry never bricks the start screen.
 */

import { Chess } from 'chess.js';

export const CHESS_STORAGE_KEY = 'triviahub:chess:v1';
export const CHESS_NOTATION_KEY = 'triviahub:chess:notation';

export type ChessDifficulty = 'easy' | 'medium' | 'hard';
export type ChessPhase = 'playing' | 'done';
export type ChessNotation = 'simple' | 'algebraic';

export interface ChessSnapshot {
  v: 1;
  difficulty: ChessDifficulty;
  playerColor: 'w' | 'b';
  fen: string;
  history: string[];
  phase: ChessPhase;
  result: { status: string; winner: 'w' | 'b' | null } | null;
  lastMove: { from: string; to: string } | null;
}

const DIFFICULTIES: ChessDifficulty[] = ['easy', 'medium', 'hard'];
const PHASES: ChessPhase[] = ['playing', 'done'];
const SQUARE_RE = /^[a-h][1-8]$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function validFen(fen: unknown): boolean {
  if (typeof fen !== 'string' || fen.length === 0) return false;
  try {
    // Chess validates the whole FEN (piece placement, side, castling, en-passant, clocks).
    new Chess(fen);
    return true;
  } catch {
    return false;
  }
}

export function isValidSnapshot(value: unknown): value is ChessSnapshot {
  if (!isRecord(value)) return false;
  if (value.v !== 1) return false;
  if (!DIFFICULTIES.includes(value.difficulty as ChessDifficulty)) return false;
  if (value.playerColor !== 'w' && value.playerColor !== 'b') return false;
  if (!validFen(value.fen)) return false;
  if (!Array.isArray(value.history) || !value.history.every((entry) => typeof entry === 'string'))
    return false;
  if (!PHASES.includes(value.phase as ChessPhase)) return false;
  if (value.result !== null) {
    if (!isRecord(value.result)) return false;
    const allowed = ['checkmate', 'stalemate', 'draw', 'resign', 'check', 'playing'];
    if (typeof value.result.status !== 'string' || !allowed.includes(value.result.status))
      return false;
    if (value.result.winner !== null && value.result.winner !== 'w' && value.result.winner !== 'b')
      return false;
  }
  if (value.lastMove !== null) {
    if (!isRecord(value.lastMove)) return false;
    if (typeof value.lastMove.from !== 'string' || !SQUARE_RE.test(value.lastMove.from))
      return false;
    if (typeof value.lastMove.to !== 'string' || !SQUARE_RE.test(value.lastMove.to)) return false;
  }
  return true;
}

export function loadChessSnapshot(): ChessSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CHESS_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidSnapshot(parsed)) return null;
    // Cross-check: replay history must be legal and must land on the stored FEN.
    // If the snapshot was hand-edited, treat it as corrupt.
    try {
      const replay = new Chess();
      for (const san of parsed.history) {
        const move = replay.move(san);
        if (!move) throw new Error(`illegal SAN ${san}`);
      }
      if (replay.fen() !== parsed.fen) return null;
    } catch {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveChessSnapshot(snapshot: ChessSnapshot): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CHESS_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Storage blocked — best effort.
  }
}

export function clearChessSnapshot(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(CHESS_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function loadChessNotation(): ChessNotation | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CHESS_NOTATION_KEY);
    if (raw === 'simple' || raw === 'algebraic') return raw;
    return null;
  } catch {
    return null;
  }
}

export function saveChessNotation(value: ChessNotation): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CHESS_NOTATION_KEY, value);
  } catch {
    // ignore
  }
}
