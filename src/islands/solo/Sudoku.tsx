import { useEffect, useRef, useState } from 'react';
import SoloShell from './SoloShell';
import {
  conflictCount,
  isComplete,
  pickDailySudoku,
  SUDOKU_COMPLETION_POINTS,
  validPlacement,
} from '../../lib/sudoku';
import { dailyDateKey } from '../../lib/trivia';

/**
 * Daily Sudoku (M18 — owner request) — the same seeded puzzle for everyone
 * on the same UTC day, played in the shared SoloShell (streak, leaderboard,
 * share image). Tap a cell, tap a number; wrong entries can be erased.
 * Completing the puzzle scores a flat 200 — the leaderboard is the race.
 */

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

type Phase = 'setup' | 'playing' | 'done';

export default function Sudoku() {
  const [phase, setPhase] = useState<Phase>('setup');
  const [grid, setGrid] = useState<number[]>([]);
  const [given, setGiven] = useState<boolean[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [score, setScore] = useState(0);
  const startedAtRef = useRef(0);
  const [, setTick] = useState(0);

  const dateKey = dailyDateKey(new Date());

  // Elapsed-time ticker (flavor only — scoring is flat).
  useEffect(() => {
    if (phase !== 'playing') {
      return;
    }
    const id = setInterval(() => setTick((tick) => tick + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  const start = () => {
    const picked = pickDailySudoku(new Date())[0]!;
    setGrid([...picked]);
    setGiven(picked.map((digit) => digit !== 0));
    setSelected(null);
    setMistakes(0);
    setScore(0);
    startedAtRef.current = Date.now();
    setPhase('playing');
  };

  const place = (value: number) => {
    if (phase !== 'playing' || selected === null || given[selected]) {
      return;
    }
    const row = Math.floor(selected / 9);
    const col = selected % 9;
    const next = [...grid];
    next[selected] = value;
    setGrid(next);
    if (value !== 0 && !validPlacement(next, row, col, value)) {
      // Flavor only — the player can fix or erase; no game-over.
      setMistakes((previous) => previous + 1);
    }
    // Completion check: full + valid → done.
    if (value !== 0 && isComplete(next)) {
      setScore(SUDOKU_COMPLETION_POINTS);
      setPhase('done');
    }
  };

  const playAgain = () => {
    setPhase('setup');
    setGrid([]);
    setGiven([]);
    setSelected(null);
    setMistakes(0);
    setScore(0);
  };

  if (phase === 'setup') {
    return (
      <div className="flex flex-col gap-5 rounded-lg border-2 border-border bg-surface-raised p-6 shadow-sm">
        <h3 className="font-display text-h3 text-ink">Daily Sudoku</h3>
        <p className="max-w-xl text-body text-ink-muted">
          The same puzzle for everyone today ({dateKey}) — finish it to score{' '}
          {SUDOKU_COMPLETION_POINTS} points on the daily leaderboard. Tap a cell, then tap a number.
        </p>
        <button
          type="button"
          onClick={start}
          className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary-strong px-7 py-3 text-lg font-semibold text-white shadow-coral transition-colors hover:bg-primary-hover sm:self-start"
        >
          Start the puzzle
        </button>
      </div>
    );
  }

  const conflicts = phase === 'playing' ? conflictCount(grid) : 0;

  return (
    <SoloShell
      slug="sudoku"
      name="Daily Sudoku"
      phase={phase}
      round={1}
      totalRounds={1}
      score={score}
      headerExtra={
        phase === 'playing' ? (
          <span className="rounded-pill bg-success-soft px-4 py-1.5 text-xs font-semibold text-success-strong">
            {Math.floor((Date.now() - startedAtRef.current) / 1000)}s
          </span>
        ) : undefined
      }
      resultSummary={
        <p className="text-body text-ink-muted">
          Daily puzzle {dateKey} complete in{' '}
          {Math.max(1, Math.floor((Date.now() - startedAtRef.current) / 1000))} seconds
          {mistakes > 0 && ` — ${mistakes} misplaced ${mistakes === 1 ? 'number' : 'numbers'}`}.
        </p>
      }
      onPlayAgain={playAgain}
    >
      <div className="flex flex-col items-center gap-4">
        <div
          role="grid"
          aria-label="Sudoku grid"
          className="grid w-full max-w-md grid-cols-9 overflow-hidden rounded-lg border-2 border-ink"
        >
          {grid.map((digit, index) => {
            const row = Math.floor(index / 9);
            const col = index % 9;
            const isGiven = given[index];
            const isSelected = selected === index;
            const isConflict =
              digit !== 0 &&
              !validPlacement(
                grid.map((d, i) => (i === index ? 0 : d)),
                row,
                col,
                digit
              );
            return (
              <button
                key={index}
                type="button"
                disabled={phase !== 'playing' || isGiven}
                aria-label={`Row ${row + 1}, column ${col + 1}${digit ? `, ${digit}` : ', empty'}`}
                aria-pressed={isSelected}
                onClick={() => setSelected(index)}
                className={`flex aspect-square items-center justify-center border border-border text-lg font-semibold transition-colors sm:text-xl ${
                  isGiven
                    ? 'bg-surface-muted font-bold text-ink'
                    : isConflict
                      ? 'bg-danger-soft text-danger-strong'
                      : isSelected
                        ? 'bg-primary/20 text-ink'
                        : 'bg-surface-raised text-ink-muted hover:bg-primary/10'
                }`}
              >
                {digit === 0 ? '' : digit}
              </button>
            );
          })}
        </div>

        {phase === 'playing' && (
          <>
            <div className="flex flex-wrap justify-center gap-2">
              {DIGITS.map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => place(digit)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-pill border-2 border-border bg-surface-muted text-lg font-bold text-ink transition-colors hover:border-primary/50 hover:bg-primary/10"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={() => place(0)}
                aria-label="Erase the selected cell"
                className="inline-flex h-11 items-center justify-center rounded-pill border-2 border-danger/50 bg-danger-soft px-4 text-sm font-semibold text-danger-strong transition-colors hover:bg-danger-soft/70"
              >
                ✕ Erase
              </button>
            </div>
            {conflicts > 0 && (
              <p role="status" className="text-small font-semibold text-warning-strong">
                {conflicts} {conflicts === 1 ? 'cell has' : 'cells have'} conflicting numbers — fix
                them to finish.
              </p>
            )}
            <p className="text-small text-ink-muted">
              Hint: given numbers are fixed; conflicting entries are highlighted in red.
            </p>
          </>
        )}
      </div>
    </SoloShell>
  );
}
