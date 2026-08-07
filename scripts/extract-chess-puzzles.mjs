#!/usr/bin/env node
/**
 * extract-chess-puzzles.mjs — Lot L11 data pipeline (R19).
 * Reads the Lichess puzzle database (CC0) from STDIN as the decompressed CSV
 * (header: PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,
 * Themes,GameUrl,OpeningTags) and writes server/src/data/chess-puzzles.json.
 *
 * Usage: zstd -dc scripts/.cache/lichess_db_puzzle.csv.zst | node scripts/extract-chess-puzzles.mjs
 *
 * Selection (deterministic):
 *  - Per tier (mate-in-1/2/3 via Lichess theme tags; tactics = non-mate
 *    puzzles carrying a tactical motif tag), keep the top-NbPlays 300 puzzles
 *    from a bounded candidate pool (first 2,000 seen per tier).
 *  - Structure gates run during the scan; failing rows are dropped and counted.
 *  - Dedup by puzzle id and by FEN (normalized board).
 */
import { createInterface } from 'node:readline';
import { writeFileSync } from 'node:fs';

const TIER_TARGET = 300;
const CANDIDATE_CAP = 2000;

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

const MOVE_RE = /^[a-h][1-8][a-h][1-8]$/;
const PIECE_RE = /^[prnbqkPRNBQK1-8]+$/;

/** Board-only structure gates (FEN may carry turn/castling/ep counters). */
function fenGate(fen) {
  if (typeof fen !== 'string' || !fen.includes(' ')) return 'bad-fen-format';
  const board = fen.split(' ')[0];
  const ranks = board.split('/');
  if (ranks.length !== 8) return 'not-8-ranks';
  for (const rank of ranks) {
    if (!PIECE_RE.test(rank)) return 'invalid-piece-chars';
    // no pawns on rank 1/8
    if (/[pP]/.test(rank) && (rank === ranks[0] || rank === ranks[7])) return 'pawn-on-back-rank';
  }
  const kings = (board.match(/[kK]/g) ?? []).length;
  if (kings !== 2) return 'king-count';
  return null;
}

function tierOf(themes) {
  if (themes.includes('mateIn1')) return 'mate1';
  if (themes.includes('mateIn2')) return 'mate2';
  if (themes.includes('mateIn3')) return 'mate3';
  if (themes.some((t) => TACTIC_THEMES.has(t))) return 'tactics';
  return 'other';
}

async function main() {
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  const pools = { mate1: [], mate2: [], mate3: [], tactics: [], other: [] };
  const seenIds = new Set();
  const seenFens = new Set();
  let rows = 0,
    header = true,
    droppedGate = 0,
    droppedId = 0,
    droppedFen = 0;

  for await (const line of rl) {
    if (header) {
      header = false;
      continue;
    } // skip CSV header
    rows++;
    const [id, fen, movesStr, rating, , , nbPlays, themesStr] = line.split(',');
    if (!id || !fen || !movesStr) {
      droppedGate++;
      continue;
    }

    const themes = (themesStr ?? '').split(/[\s,]+/).filter(Boolean); // space- or comma-separated tags
    const tier = tierOf(themes);
    const pool = pools[tier];
    if (!pool || pool.length >= CANDIDATE_CAP) continue; // pool full (tiers we care about)

    // structure gates
    const fg = fenGate(fen);
    const moves = movesStr.split(' ');
    const movesOk = moves.every((m) => MOVE_RE.test(m));
    const ratingN = Number(rating);
    const ratingOk = Number.isInteger(ratingN) && ratingN >= 0 && ratingN <= 4000;
    if (fg || !movesOk || !ratingOk) {
      droppedGate++;
      continue;
    }

    if (seenIds.has(id)) {
      droppedId++;
      continue;
    }
    const fenKey = fen.split(' ')[0];
    if (seenFens.has(fenKey)) {
      droppedFen++;
      continue;
    }
    seenIds.add(id);
    seenFens.add(fenKey);

    pool.push({ id, fen, moves, themes, rating: ratingN, nbPlays: Number(nbPlays ?? 0) });
  }

  // deterministic selection: most-played first within each tier
  const out = [];
  for (const tier of ['mate1', 'mate2', 'mate3', 'tactics']) {
    const picked = pools[tier].sort((a, b) => b.nbPlays - a.nbPlays).slice(0, TIER_TARGET);
    for (const p of picked) {
      out.push({
        id: p.id,
        fen: p.fen,
        moves: p.moves,
        themes: p.themes,
        rating: p.rating,
        credit: 'Lichess (CC0)',
      });
    }
  }

  writeFileSync('server/src/data/chess-puzzles.json', JSON.stringify(out, null, 1) + '\n');

  console.log(`rows read: ${rows}`);
  console.log(`dropped: gate ${droppedGate} | dup-id ${droppedId} | dup-fen ${droppedFen}`);
  console.log(
    'pool sizes:',
    Object.fromEntries(Object.entries(pools).map(([k, v]) => [k, v.length]))
  );
  console.log(`written: ${out.length} puzzles`);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
