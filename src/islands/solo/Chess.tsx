import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import {
  applyUciMove,
  createChessGame,
  gameStatus,
  indexToSquare,
  legalMovesForSquare,
  randomLegalMove,
  resultText,
  squareIndex,
  toSimpleSAN,
  type ChessColor,
  type GameStatus,
  type SquareMove,
} from '../../lib/chess';
import { clearChessSnapshot, loadChessSnapshot, saveChessSnapshot } from '../../lib/chess-storage';

/**
 * [D067] Chess vs CPU: a full game against Stockfish WASM (GPLv3,
 * self-hosted in public/stockfish/, loaded only when a game starts).
 * chess.js (MIT) is the rules layer: legal moves, check/mate, FEN.
 *
 * Flow: difficulty → color → board (tap or drag, legal-move dots, move
 * list, check pill) → end state (checkmate/stalemate/draw/resign) →
 * rematch or new game. Easy blunders 30% of its moves with a random legal
 * move (chess.js) so beginners get a chance; Medium and Hard use Stockfish
 * skill levels with capped think time.
 */

type Difficulty = 'easy' | 'medium' | 'hard';
type Phase = 'setup' | 'playing' | 'done';
type ColorChoice = ChessColor | 'random';
/** Game-end states plus the player-initiated resign. */
type EndStatus = GameStatus | 'resign';

/** [Designer] the CPU "thinking" beat before the engine reply, so a move
 * never feels instant. The pill stays visible the whole time. */
const CPU_DELAY_MS = 1800;

// [D067] Tuning table, single source of truth for the CPU strength bands.
const DIFFICULTY: Record<
  Difficulty,
  { label: string; rating: string; skill: number; movetime: number; blunderChance: number }
> = {
  easy: { label: 'Easy', rating: '200-600', skill: 1, movetime: 150, blunderChance: 0.3 },
  medium: { label: 'Medium', rating: '800-1200', skill: 9, movetime: 250, blunderChance: 0 },
  hard: { label: 'Hard', rating: '1200+', skill: 17, movetime: 500, blunderChance: 0 },
};

const STOCKFISH_URL = '/stockfish/stockfish.js';

interface GameResult {
  status: EndStatus;
  winner: ChessColor | null;
}

// [Cburnett] Classic set shipped as 12 self-contained SVGs under
// public/images/chess/pieces/{w|b}-{k,q,r,b,n,p}.svg (Wikimedia Commons
// "Chess cdt45" series by Colin M.L. Burnett, tri-licensed GFDL / CC BY-SA
// 3.0 / GPL — credited under the board). Colors are baked per file; render
// as <img> and never recolor. All files share viewBox 0 0 45 45.
const PIECE_URL = (key: string) => `/images/chess/pieces/${key}.svg`;

interface PieceProps {
  char: string;
  isWhite: boolean;
}

const PieceGlyph = memo(function PieceGlyph({ char, isWhite }: PieceProps) {
  const src = PIECE_URL(`${isWhite ? 'w' : 'b'}-${char.toLowerCase()}`);
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      className="pointer-events-none block select-none"
      style={{ width: '80%', height: '80%', objectFit: 'contain' }}
    />
  );
});

const PIECE_NAMES: Record<string, string> = {
  k: 'king',
  q: 'queen',
  r: 'rook',
  b: 'bishop',
  n: 'knight',
  p: 'pawn',
};

/** a–h files, index = file number; rank labels are just rankIndex + 1. */
const FILE_LABELS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

export default function ChessGame() {
  const [phase, setPhase] = useState<Phase>('setup');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [colorChoice, setColorChoice] = useState<ColorChoice>('w');
  const [playerColor, setPlayerColor] = useState<ChessColor>('w');
  const [selected, setSelected] = useState<string | null>(null);
  const [legalTargets, setLegalTargets] = useState<SquareMove[]>([]);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [cpuThinking, setCpuThinking] = useState(false);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(
    null
  );
  const [result, setResult] = useState<GameResult | null>(null);
  const [engineError, setEngineError] = useState(false);
  const [, setTick] = useState(0);

  const chessRef = useRef<Chess>(createChessGame());
  const workerRef = useRef<Worker | null>(null);
  const playerColorRef = useRef<ChessColor>('w');
  const difficultyRef = useRef<Difficulty>('medium');
  const thinkingRef = useRef(false);
  // Pointer-press bookkeeping: a press selects a piece (tap-tap to move, or
  // drag), and a second press on the already-selected square deselects it.
  const pressSquareRef = useRef<string | null>(null);
  const wasSelectedRef = useRef(false);
  const dragMovedRef = useRef(false);
  const hydratedRef = useRef(false);

  const rerender = () => setTick((tick) => tick + 1);

  const setThinking = (value: boolean) => {
    thinkingRef.current = value;
    setCpuThinking(value);
  };

  const finishIfOver = useCallback((): boolean => {
    const game = chessRef.current;
    const status = gameStatus(game);
    if (status === 'checkmate' || status === 'stalemate' || status === 'draw') {
      const winner = status === 'checkmate' ? (game.turn() === 'w' ? 'b' : 'w') : null;
      setResult({ status, winner });
      setSelected(null);
      setLegalTargets([]);
      setPhase('done');
      return true;
    }
    return false;
  }, []);

  /** Apply a move (player or CPU), record it, and check the end state. */
  const applyMove = useCallback(
    (from: string, to: string, promotion?: string) => {
      const game = chessRef.current;
      const outcome = applyUciMove(game, `${from}${to}${promotion ?? ''}`);
      if (!outcome.ok) {
        return false;
      }
      setLastMove({ from, to });
      setSelected(null);
      setLegalTargets([]);
      rerender();
      return !finishIfOver();
    },
    [finishIfOver]
  );

  const applyEngineMove = useCallback(
    (uci: string | null) => {
      if (!uci || uci === '(none)') {
        // Engine resigned or produced nothing: play any legal move.
        const fallback = randomLegalMove(chessRef.current);
        if (fallback) {
          applyMove(fallback.from, fallback.to);
        }
        setThinking(false);
        return;
      }
      applyMove(uci.slice(0, 2), uci.slice(2, 4), uci.length === 5 ? uci[4] : undefined);
      setThinking(false);
    },
    [applyMove]
  );

  const cpuMove = useCallback(() => {
    const game = chessRef.current;
    if (game.isGameOver()) {
      return;
    }
    const settings = DIFFICULTY[difficultyRef.current];
    setThinking(true);

    // Easy blunders: a random legal move instead of the engine's choice.
    if (settings.blunderChance > 0 && Math.random() < settings.blunderChance) {
      const blunder = randomLegalMove(game);
      if (blunder) {
        window.setTimeout(() => {
          applyMove(blunder.from, blunder.to);
          setThinking(false);
        }, 200);
      } else {
        setThinking(false);
      }
      return;
    }

    const worker = workerRef.current;
    if (worker && !engineError) {
      worker.postMessage(`position fen ${game.fen()}`);
      worker.postMessage(`go movetime ${settings.movetime}`);
    } else {
      // Engine unavailable: a random legal move keeps the game playable.
      const fallback = randomLegalMove(game);
      if (fallback) {
        window.setTimeout(() => {
          applyMove(fallback.from, fallback.to);
          setThinking(false);
        }, 250);
      } else {
        setThinking(false);
      }
    }
  }, [applyMove, engineError]);

  // Stockfish worker: created only when a game starts; reused across
  // rematches, terminated on new-game and unmount.
  const ensureWorker = useCallback(() => {
    if (workerRef.current) {
      return workerRef.current;
    }
    try {
      const worker = new Worker(STOCKFISH_URL);
      worker.onmessage = (event: MessageEvent) => {
        const line = typeof event.data === 'string' ? event.data.trim() : '';
        if (line.startsWith('bestmove')) {
          const uci = line.split(/\s+/)[1] ?? null;
          if (thinkingRef.current) {
            applyEngineMove(uci);
          }
        }
      };
      worker.onerror = () => {
        setEngineError(true);
        setThinking(false);
      };
      worker.postMessage('uci');
      workerRef.current = worker;
      return worker;
    } catch {
      setEngineError(true);
      return null;
    }
  }, []);

  /** [Designer] visible 1.8s thinking beat, then the engine moves. */
  const scheduleCpuMove = useCallback(() => {
    setThinking(true);
    window.setTimeout(() => cpuMove(), CPU_DELAY_MS);
  }, [cpuMove]);

  const start = () => {
    const color = colorChoice === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : colorChoice;
    playerColorRef.current = color;
    difficultyRef.current = difficulty;
    setPlayerColor(color);
    chessRef.current = createChessGame();
    setSelected(null);
    setLegalTargets([]);
    setLastMove(null);
    setResult(null);
    setEngineError(false);
    setPhase('playing');
    rerender();

    const worker = ensureWorker();
    if (worker && !engineError) {
      const settings = DIFFICULTY[difficulty];
      worker.postMessage(`setoption name Skill Level value ${settings.skill}`);
    }
    // Black plays second: the CPU opens as white (same thinking beat).
    if (color === 'b') {
      scheduleCpuMove();
    }
  };

  const quitWorker = () => {
    if (workerRef.current) {
      try {
        workerRef.current.postMessage('quit');
        workerRef.current.terminate();
      } catch {
        // Already dead.
      }
      workerRef.current = null;
    }
  };

  useEffect(() => quitWorker, []);

  const resign = () => {
    setThinking(false);
    setResult({ status: 'resign', winner: playerColor === 'w' ? 'b' : 'w' });
    setPhase('done');
  };

  /** Back to the setup screen: stop the engine and forget the saved match. */
  const newGame = () => {
    quitWorker();
    clearChessSnapshot();
    setPhase('setup');
    setResult(null);
  };

  const tapSquare = (square: string) => {
    if (phase !== 'playing' || thinkingRef.current || pendingPromotion) {
      return;
    }
    const game = chessRef.current;
    const index = squareIndex(square)!;
    const piece = game.board()[Math.floor(index / 8)]![index % 8];
    if (!selected) {
      if (
        piece &&
        piece.color === playerColorRef.current &&
        game.turn() === playerColorRef.current
      ) {
        setSelected(square);
        setLegalTargets(legalMovesForSquare(game, square));
      }
      return;
    }
    if (selected === square) {
      // A second press on the selected square deselects; the press that
      // just selected it keeps the selection (tap-tap needs the first tap
      // to stick).
      if (wasSelectedRef.current) {
        setSelected(null);
        setLegalTargets([]);
      }
      return;
    }
    const target = legalTargets.find((move) => move.to === square);
    if (!target) {
      // Picking another own piece re-selects it.
      if (piece && piece.color === playerColorRef.current) {
        setSelected(square);
        setLegalTargets(legalMovesForSquare(game, square));
      } else {
        setSelected(null);
        setLegalTargets([]);
      }
      return;
    }
    setSelected(null);
    setLegalTargets([]);
    if (target.promotion) {
      setPendingPromotion({ from: target.from, to: target.to });
      return;
    }
    if (applyMove(target.from, target.to)) {
      scheduleCpuMove();
    }
  };

  const choosePromotion = (pieceChar: string) => {
    if (!pendingPromotion) {
      return;
    }
    const { from, to } = pendingPromotion;
    setPendingPromotion(null);
    if (applyMove(from, to, pieceChar)) {
      scheduleCpuMove();
    }
  };

  // ── Persistence (resume after refresh, per the verification spec) ────────
  // On mount, restore an active game so refresh never drops to start (owner).
  useEffect(() => {
    const id = window.setTimeout(() => {
      const snap = loadChessSnapshot();
      if (!snap) {
        hydratedRef.current = true;
        return;
      }
      try {
        const restored = new Chess();
        for (const san of snap.history) {
          const move = restored.move(san);
          if (!move) throw new Error(`illegal SAN ${san}`);
        }
        if (restored.fen() !== snap.fen) throw new Error('fen mismatch');
        const isCpuToMove = snap.phase === 'playing' && restored.turn() !== snap.playerColor;
        chessRef.current = restored;
        setDifficulty(snap.difficulty as Difficulty);
        difficultyRef.current = snap.difficulty as Difficulty;
        setPlayerColor(snap.playerColor as ChessColor);
        playerColorRef.current = snap.playerColor as ChessColor;
        setLastMove(snap.lastMove);
        if (snap.result) {
          setResult(snap.result as GameResult);
        }
        setPhase(snap.phase as Phase);
        if (isCpuToMove && !restored.isGameOver()) {
          const worker = ensureWorker();
          const skill = DIFFICULTY[snap.difficulty as Difficulty]?.skill;
          if (worker) {
            worker.postMessage(`setoption name Skill Level value ${skill}`);
          }
          scheduleCpuMove();
        }
        hydratedRef.current = true;
        rerender();
      } catch {
        clearChessSnapshot();
        hydratedRef.current = true;
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, [ensureWorker, scheduleCpuMove]);

  // Save the active game after every meaningful change.
  // historyLength is derived from chessRef, so track it via the tick + result.
  const historyLength = chessRef.current.history().length;
  useEffect(() => {
    if (!hydratedRef.current || phase === 'setup') {
      return;
    }
    saveChessSnapshot({
      v: 1,
      difficulty,
      playerColor,
      fen: chessRef.current.fen(),
      history: [...chessRef.current.history()],
      phase: phase as 'playing' | 'done',
      result,
      lastMove,
    } as never);
  }, [phase, difficulty, playerColor, result, lastMove, historyLength]);

  const status = phase === 'playing' ? gameStatus(chessRef.current) : null;
  const game = chessRef.current;
  const history = game.history();
  const board = game.board();

  if (phase === 'setup') {
    return (
      <div className="flex flex-col gap-6 rounded-lg border border-border bg-surface-raised p-4 shadow-sm sm:p-6">
        <div>
          <h3 className="text-lg font-bold tracking-tight text-ink">Chess vs CPU</h3>
          <p className="mt-1 max-w-xl text-body text-ink-muted">
            A full game of chess against Stockfish. Pick a level and a color, then play like you
            would on a real board: legal moves are highlighted, and the game ends on checkmate,
            stalemate, or draw.
          </p>
        </div>

        <div>
          <h4 className="mb-2 text-small font-semibold text-ink">Difficulty</h4>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Difficulty">
            {(Object.keys(DIFFICULTY) as Difficulty[]).map((level) => (
              <button
                key={level}
                type="button"
                aria-pressed={difficulty === level}
                onClick={() => setDifficulty(level)}
                className={`min-h-12 rounded-md border px-5 py-2.5 text-small font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ink ${
                  difficulty === level
                    ? 'border-primary bg-primary/15 text-primary-deep'
                    : 'border-border bg-surface-raised text-ink hover:border-primary/50'
                }`}
              >
                {DIFFICULTY[level].label}
                <span className="block text-xs font-normal text-ink-muted">
                  {DIFFICULTY[level].rating}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <h4 className="mb-2 text-small font-semibold text-ink">Play as</h4>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Color">
            {(['w', 'b', 'random'] as ColorChoice[]).map((choice) => (
              <button
                key={choice}
                type="button"
                aria-pressed={colorChoice === choice}
                onClick={() => setColorChoice(choice)}
                className={`min-h-12 rounded-md border px-6 py-2.5 text-small font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ink ${
                  colorChoice === choice
                    ? 'border-primary bg-primary/15 text-primary-deep'
                    : 'border-border bg-surface-raised text-ink hover:border-primary/50'
                }`}
              >
                {choice === 'w' ? 'White' : choice === 'b' ? 'Black' : 'Random'}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={start}
          className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary px-7 py-3 text-lg font-semibold text-white transition-colors hover:bg-primary-hover sm:self-start"
        >
          Start game
        </button>
        <EngineCredit />
      </div>
    );
  }

  const flipped = playerColor === 'b';
  const checkPill = status === 'check' || status === 'checkmate';
  const resultLine = result
    ? result.status === 'resign'
      ? 'You resigned. The CPU wins.'
      : result.status === 'checkmate' && result.winner
        ? result.winner === playerColor
          ? 'You win by checkmate. Nice finish.'
          : 'The CPU wins by checkmate.'
        : `${resultText(result.status, result.winner)}.`
    : null;
  const kingInCheckSquare = (() => {
    if (status !== 'check' && status !== 'checkmate') return null;
    const kingColor = game.turn();
    for (let r = 0; r < 8; r += 1) {
      for (let f = 0; f < 8; f += 1) {
        const piece = board[r]![f];
        if (piece && piece.type === 'k' && piece.color === kingColor) {
          return indexToSquare(r * 8 + f);
        }
      }
    }
    return null;
  })();

  return (
    <div className="pb-chess-root pb-chess-fit flex flex-col gap-5">
      <style>{`
        .pb-chess-root.pb-chess-fit { min-height: calc(100dvh - 80px - 3rem); }
        .pb-chess-layout { display: grid; gap: 1.5rem; }
        @media (min-width: 1024px) {
          .pb-chess-layout { grid-template-columns: minmax(0, 1fr) 340px; align-items: start; }
        }
        .pb-chess-moves { max-height: 20rem; overflow-y: auto; overscroll-behavior: contain; }
      `}</style>
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-pill bg-tertiary/40 px-4 py-1.5 text-xs font-semibold text-ink">
          Difficulty: {DIFFICULTY[difficulty].label}
        </span>
        <span className="rounded-pill bg-success-soft px-4 py-1.5 text-xs font-semibold text-success-strong">
          You play {playerColor === 'w' ? 'white' : 'black'}
        </span>
        {checkPill && (
          <span
            role="status"
            className="rounded-pill bg-warning-soft px-4 py-1.5 text-xs font-semibold text-warning-strong"
          >
            {status === 'checkmate' ? 'Checkmate' : 'Check!'}
          </span>
        )}
        {cpuThinking && (
          <span
            role="status"
            className="rounded-pill bg-surface-muted px-4 py-1.5 text-xs font-semibold text-ink-muted"
          >
            CPU thinking…
          </span>
        )}
      </div>

      {engineError && (
        <p role="alert" className="text-small font-semibold text-warning-strong">
          The chess engine could not load, so the CPU is playing random moves. Check your connection
          and start a new game to retry.
        </p>
      )}

      {phase === 'done' && result && (
        <div
          role="status"
          className="flex flex-col gap-4 rounded-lg border border-primary/40 bg-primary/15 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
        >
          <p className="text-base font-bold text-ink sm:text-lg">{resultLine}</p>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={start}
              className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary px-6 py-2.5 text-small font-semibold text-white transition-colors hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-ink"
            >
              Rematch
            </button>
            <button
              type="button"
              onClick={newGame}
              className="inline-flex min-h-12 items-center justify-center rounded-pill border border-primary/50 px-6 py-2.5 text-small font-semibold text-primary-strong transition-colors hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-ink"
            >
              New game
            </button>
          </div>
        </div>
      )}

      <div className="pb-chess-layout">
        <div className="min-w-0">
          <div
            role="grid"
            aria-label="Chess board"
            className="mx-auto grid w-full overflow-hidden rounded-[10px] border shadow-sm"
            style={{
              maxWidth: '30rem',
              borderColor: 'var(--chess-board-border, rgba(0,0,0,0.12))',
              aspectRatio: '1 / 1',
              gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
              gridTemplateRows: 'repeat(8, minmax(0, 1fr))',
            }}
          >
            {Array.from({ length: 64 }, (_, displayIndex) => {
              const displayRow = Math.floor(displayIndex / 8);
              const displayCol = displayIndex % 8;
              const rankIndex = flipped ? 7 - displayRow : displayRow;
              const file = flipped ? 7 - displayCol : displayCol;
              const square = indexToSquare(rankIndex * 8 + file);
              const piece = board[rankIndex]![file];
              const isLight = (file + rankIndex) % 2 === 0;
              const isSelected = selected === square;
              const isLastMove = lastMove !== null && lastMove.to === square;
              const target = legalTargets.find((move) => move.to === square);
              const isOwnPiece = piece !== null && piece.color === playerColorRef.current;
              // Coordinates on the player's bottom edge (files) and left
              // edge (ranks); the flip already maps display edges to the
              // correct physical square, so labels stay right-side-up.
              const showFileLabel = displayRow === 7;
              const showRankLabel = displayCol === 0;
              return (
                <button
                  key={square}
                  type="button"
                  role="gridcell"
                  aria-label={`${square}${piece ? `, ${PIECE_NAMES[piece.type]}${piece.color === 'w' ? ' white' : ' black'}` : ', empty'}`}
                  onPointerDown={() => {
                    // Start a potential drag: select the piece now so the
                    // pointerup target can attempt the move.
                    pressSquareRef.current = square;
                    wasSelectedRef.current = selected === square;
                    if (isOwnPiece && !wasSelectedRef.current) {
                      setSelected(square);
                      setLegalTargets(legalMovesForSquare(chessRef.current, square));
                    }
                  }}
                  onPointerUp={() => {
                    // Dropped on a different square: treat it as the move
                    // target, and swallow the synthetic click that follows.
                    if (pressSquareRef.current && pressSquareRef.current !== square) {
                      dragMovedRef.current = true;
                      tapSquare(square);
                    }
                    pressSquareRef.current = null;
                  }}
                  onClick={() => {
                    // Tap-tap and keyboard (Enter/Space) both land here;
                    // pointer drags are already handled above.
                    if (dragMovedRef.current) {
                      dragMovedRef.current = false;
                      return;
                    }
                    tapSquare(square);
                  }}
                  style={{
                    background:
                      square === kingInCheckSquare
                        ? 'var(--chess-check, rgba(255, 107, 107, 0.35))'
                        : isSelected
                          ? 'var(--chess-selected, #f6e58d)'
                          : isLastMove
                            ? 'var(--chess-last, #cdd26b)'
                            : isLight
                              ? 'var(--chess-light, #EEEED2)'
                              : 'var(--chess-dark, #769656)',
                    // Coordinate labels paint under pieces via negative z.
                    isolation: 'isolate',
                  }}
                  className={`pb-chess-square relative flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-ink focus:ring-inset ${piece ? 'cursor-pointer' : ''}`}
                >
                  {showRankLabel && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute left-0.5 top-0.5 select-none text-[10px] font-semibold leading-none"
                      style={{ color: 'var(--chess-coord, rgba(0, 0, 0, 0.5))', zIndex: -1 }}
                    >
                      {rankIndex + 1}
                    </span>
                  )}
                  {showFileLabel && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute bottom-0.5 left-0.5 select-none text-[10px] font-semibold leading-none"
                      style={{ color: 'var(--chess-coord, rgba(0, 0, 0, 0.5))', zIndex: -1 }}
                    >
                      {FILE_LABELS[file]}
                    </span>
                  )}
                  {piece ? <PieceGlyph char={piece.type} isWhite={piece.color === 'w'} /> : null}
                  {target &&
                    (target.isCapture ? (
                      <span
                        className="pointer-events-none absolute inset-0.5 rounded-full border-[3px]"
                        style={{ borderColor: 'var(--chess-ring, rgba(0,0,0,0.45))' }}
                      />
                    ) : (
                      <span
                        className="pointer-events-none absolute rounded-full"
                        style={{
                          width: '26%',
                          height: '26%',
                          background: 'var(--chess-dot, rgba(0,0,0,0.22))',
                        }}
                      />
                    ))}
                </button>
              );
            })}
          </div>

          {pendingPromotion && (
            <div
              role="dialog"
              aria-label="Choose promotion piece"
              className="mt-3 flex items-center justify-center gap-2 rounded-lg border border-border bg-surface-raised p-3"
            >
              <span className="text-small font-semibold text-ink">Promote to</span>
              {(['q', 'r', 'b', 'n'] as const).map((char) => (
                <button
                  key={char}
                  type="button"
                  aria-label={`Promote to ${PIECE_NAMES[char]}`}
                  onClick={() => choosePromotion(char)}
                  className="flex h-14 w-14 items-center justify-center rounded-md border border-border bg-surface-muted transition-colors hover:border-primary focus:outline-none focus:ring-2 focus:ring-ink"
                >
                  <PieceGlyph char={char} isWhite={playerColor === 'w'} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex w-full flex-col gap-3">
          {phase === 'playing' && (
            <div className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-surface/80 lg:static lg:z-auto lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={resign}
                  className="inline-flex min-h-11 items-center justify-center rounded-md border border-danger px-5 text-small font-semibold text-danger-strong transition-colors hover:bg-danger-soft focus:outline-none focus:ring-2 focus:ring-ink"
                >
                  Resign
                </button>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-border bg-surface-raised p-3">
            <h4 className="mb-2 text-small font-semibold text-ink">Moves</h4>
            {history.length === 0 ? (
              <p className="text-small text-ink-muted">
                {playerColor === 'b' ? 'The CPU opens as white.' : 'Your move, play white.'}
              </p>
            ) : (
              <div className="pb-chess-moves">
                <ol
                  className="grid gap-x-2 gap-y-0.5 text-small"
                  style={{ gridTemplateColumns: '2.5rem 1fr 1fr' }}
                >
                  {Array.from({ length: Math.ceil(history.length / 2) }, (_, pairIndex) => {
                    const whiteSan = history[pairIndex * 2] ?? '';
                    const blackSan = history[pairIndex * 2 + 1] ?? '';
                    const whiteChar =
                      whiteSan && /^[KQRBN]/.test(whiteSan) ? whiteSan[0]!.toLowerCase() : 'p';
                    const blackChar =
                      blackSan && /^[KQRBN]/.test(blackSan) ? blackSan[0]!.toLowerCase() : 'p';
                    const renderSimple = (san: string, glyph: string, isWhiteCell: boolean) => {
                      if (!san) {
                        return null;
                      }
                      const label = toSimpleSAN(san);
                      return (
                        <span className="flex min-w-0 items-center gap-1.5 truncate font-semibold text-ink">
                          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
                            <PieceGlyph char={glyph} isWhite={isWhiteCell} />
                          </span>
                          <span className="truncate text-xs">{label}</span>
                        </span>
                      );
                    };
                    return (
                      <li key={pairIndex} className="contents" aria-label={`Move ${pairIndex + 1}`}>
                        <span className="text-ink-muted">{pairIndex + 1}.</span>
                        <span className="min-w-0 truncate">
                          {whiteSan ? renderSimple(whiteSan, whiteChar, true) : ''}
                        </span>
                        <span className="min-w-0 truncate">
                          {blackSan ? renderSimple(blackSan, blackChar, false) : ''}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
          </div>
        </div>
      </div>

      <EngineCredit />
    </div>
  );
}

/** [D067] GPL compliance (engine) + [Cburnett] piece-set attribution. */
function EngineCredit() {
  return (
    <div className="flex flex-col gap-1 text-xs text-ink-muted">
      <p>
        Engine: Stockfish (GPLv3,{' '}
        <a
          href="https://github.com/official-stockfish"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-primary-strong underline"
        >
          github.com/official-stockfish
        </a>
        )
      </p>
      <p>Chess piece set by Colin M.L. Burnett (GFDL / CC BY-SA 3.0 / GPL)</p>
    </div>
  );
}
