#!/usr/bin/env node
/**
 * validate-chess-puzzles.mjs — Lot L11 structure gates + tier quotas (R19).
 * Runs the schema/structure gates over server/src/data/chess-puzzles.json and
 * prints tier counts. Exit code 1 on any failure (CI-friendly).
 *
 * Usage: node scripts/validate-chess-puzzles.mjs
 */
import { readFileSync } from 'node:fs';

const PATH = 'server/src/data/chess-puzzles.json';
const TIER_MIN = 150;
const TOTAL_MIN = 1000;
const MOVE_RE = /^[a-h][1-8][a-h][1-8]$/;
const PIECE_RE = /^[prnbqkPRNBQK1-8]+$/;

const TACTIC_THEMES = new Set([
  'fork',
  'pin',
  'skewer',
  'discoveredAttack',
  'deflection',
  'intermezzo',
  'hangingPiece',
  'sacrifice',
  'trappedPiece',
  'doubleCheck',
  'xRayAttack',
  'zwischenzug',
  'exposedCheck',
  'capturingDefender',
  'trade',
  'attraction',
  'clearance',
  'quietMove',
  'defensiveMove',
]);

const puzzles = JSON.parse(readFileSync(PATH, 'utf8'));
const _errors = [];

// ---- structure gates ----
const ids = new Set();
const fens = new Set();
let pawnOnBackRank = 0,
  badRanks = 0,
  badPieces = 0,
  badKings = 0,
  badMoves = 0,
  badRating = 0,
  badCredit = 0,
  dupId = 0,
  dupFen = 0,
  badCount = 0;

for (const p of puzzles) {
  if (typeof p.id !== 'string' || p.id.length === 0) badCount++;
  if (ids.has(p.id)) dupId++;
  ids.add(p.id);

  const board = (p.fen ?? '').split(' ')[0];
  if (fens.has(board)) dupFen++;
  fens.add(board);

  const ranks = board.split('/');
  if (ranks.length !== 8) {
    badRanks++;
    continue;
  }
  for (const rank of ranks) {
    if (!PIECE_RE.test(rank)) badPieces++;
    if (/[pP]/.test(rank) && (rank === ranks[0] || rank === ranks[7])) pawnOnBackRank++;
  }
  const kings = (board.match(/[kK]/g) ?? []).length;
  if (kings !== 2) badKings++;

  if (!Array.isArray(p.moves) || !p.moves.every((m) => MOVE_RE.test(m))) badMoves++;
  if (!Number.isInteger(p.rating) || p.rating < 0 || p.rating > 4000) badRating++;
  if (p.credit !== 'Lichess (CC0)') badCredit++;
}

// ---- tier counts ----
const tier = { mate1: 0, mate2: 0, mate3: 0, tactics: 0, other: 0 };
for (const p of puzzles) {
  const themes = new Set(p.themes ?? []);
  if (themes.has('mateIn1')) tier.mate1++;
  else if (themes.has('mateIn2')) tier.mate2++;
  else if (themes.has('mateIn3')) tier.mate3++;
  else if ([...themes].some((t) => TACTIC_THEMES.has(t))) tier.tactics++;
  else tier.other++;
}

const gateFail =
  badCount +
  dupId +
  dupFen +
  badRanks +
  badPieces +
  badKings +
  pawnOnBackRank +
  badMoves +
  badRating +
  badCredit;
const quotas =
  tier.mate1 >= TIER_MIN &&
  tier.mate2 >= TIER_MIN &&
  tier.mate3 >= TIER_MIN &&
  tier.tactics >= TIER_MIN &&
  puzzles.length >= TOTAL_MIN;

console.log('=== chess-puzzles.json validation ===');
console.log(`total puzzles: ${puzzles.length}`);
console.log(
  `tier counts: mate-in-1 ${tier.mate1} | mate-in-2 ${tier.mate2} | mate-in-3 ${tier.mate3} | tactics ${tier.tactics} | other ${tier.other}`
);
console.log('structure gates:');
console.log(`  unique ids: ${dupId === 0 ? 'OK' : 'FAIL (' + dupId + ' dupes)'}`);
console.log(`  unique fens: ${dupFen === 0 ? 'OK' : 'FAIL (' + dupFen + ' dupes)'}`);
console.log(`  8 ranks: ${badRanks === 0 ? 'OK' : 'FAIL (' + badRanks + ')'}`);
console.log(`  valid piece chars: ${badPieces === 0 ? 'OK' : 'FAIL (' + badPieces + ')'}`);
console.log(`  exactly 2 kings: ${badKings === 0 ? 'OK' : 'FAIL (' + badKings + ')'}`);
console.log(
  `  no pawns on rank 1/8: ${pawnOnBackRank === 0 ? 'OK' : 'FAIL (' + pawnOnBackRank + ')'}`
);
console.log(`  moves are 4-char UCI: ${badMoves === 0 ? 'OK' : 'FAIL (' + badMoves + ')'}`);
console.log(`  rating 0-4000: ${badRating === 0 ? 'OK' : 'FAIL (' + badRating + ')'}`);
console.log(`  credit field: ${badCredit === 0 ? 'OK' : 'FAIL (' + badCredit + ')'}`);
console.log(`tier quotas (>= ${TIER_MIN} each, total >= ${TOTAL_MIN}): ${quotas ? 'OK' : 'FAIL'}`);

if (gateFail > 0 || !quotas) {
  console.error('VALIDATION FAILED');
  process.exit(1);
}
console.log('VALIDATION PASSED');
