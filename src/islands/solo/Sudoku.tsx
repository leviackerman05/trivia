import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import SoloShell from './SoloShell';
import {
  conflictCount,
  isComplete,
  pickDailySudoku,
  SUDOKU_COMPLETION_POINTS,
  validPlacement,
} from '../../lib/sudoku';
import { dailyDateKey } from '../../lib/trivia';
import { nextCellIndex, sanitizeDigitInput, type ArrowKey } from '../../lib/sudoku-input';

/**
 * Daily Sudoku (M18, owner request), the same seeded puzzle for everyone
 * on the same UTC day, played in the shared SoloShell (streak, leaderboard,
 * share image). [R9] All 81 cells are real inputs: tap to select, then use
 * the native numeric keypad (mobile) or the keyboard (desktop) — arrows
 * navigate with wrap, Backspace/Delete erase. Given cells are disabled
 * inputs (uniform grid semantics; tab order skips them). Completing the
 * puzzle scores a flat 200, the leaderboard is the race.
 */

type Phase = 'setup' | 'playing' | 'done';

const ARROW_KEYS: ArrowKey[] = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];

export default function Sudoku() {
  const [phase, setPhase] = useState<Phase>('setup');
  const [grid, setGrid] = useState<number[]>([]);
  const [given, setGiven] = useState<boolean[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [score, setScore] = useState(0);
  const startedAtRef = useRef(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [, setTick] = useState(0);

  const dateKey = dailyDateKey(new Date());

  // Elapsed-time ticker (flavor only, scoring is flat).
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

  const place = (value: number, cellIndex: number) => {
    if (phase !== 'playing' || given[cellIndex]) {
      return;
    }
    const row = Math.floor(cellIndex / 9);
    const col = cellIndex % 9;
    const next = [...grid];
    next[cellIndex] = value;
    setGrid(next);
    if (value !== 0 && !validPlacement(next, row, col, value)) {
      // Flavor only, the player can fix or erase; no game-over.
      setMistakes((previous) => previous + 1);
    }
    // Completion check: full + valid → done.
    if (value !== 0 && isComplete(next)) {
      setScore(SUDOKU_COMPLETION_POINTS);
      setPhase('done');
    }
  };

  // [R9] digit input: sanitize (multi-char paste keeps the last digit) and
  // write through the existing place() path; place(0) erases.
  const handleChange = (event: ChangeEvent<HTMLInputElement>, cellIndex: number) => {
    const value = sanitizeDigitInput(event.target.value);
    setSelected(cellIndex);
    place(value, cellIndex);
  };

  // [R9] keyboard navigation: arrows move selection with 9×9 wrap (Tab
  // passes through untouched); Backspace/Delete erase the cell; digits
  // 1–9 type normally and reach handleChange.
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>, cellIndex: number) => {
    if (ARROW_KEYS.includes(event.key as ArrowKey)) {
      event.preventDefault();
      const next = nextCellIndex(cellIndex, event.key as ArrowKey);
      setSelected(next);
      inputRefs.current[next]?.focus();
      return;
    }
    if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      place(0, cellIndex);
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
      <div className="flex flex-col gap-5 rounded-lg border border-border bg-surface-raised p-4 sm:p-6 shadow-sm">
        <h3 className="text-lg font-bold tracking-tight text-ink">Daily Sudoku</h3>
        <p className="max-w-xl text-body text-ink-muted">
          The same puzzle for everyone today ({dateKey}), finish it to score{' '}
          {SUDOKU_COMPLETION_POINTS} points on the daily leaderboard. Tap a cell, then type a
          number.
        </p>
        <button
          type="button"
          onClick={start}
          className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary px-7 py-3 text-lg font-semibold text-white  transition-colors hover:bg-primary-hover sm:self-start"
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
          {mistakes > 0 && `, ${mistakes} misplaced ${mistakes === 1 ? 'number' : 'numbers'}`}.
        </p>
      }
      onPlayAgain={playAgain}
    >
      <div className="flex flex-col items-center gap-4">
        <div
          role="grid"
          aria-label="Sudoku grid"
          className="grid w-full max-w-md grid-cols-9 overflow-hidden rounded-lg border border-ink"
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
              <input
                key={index}
                type="text"
                inputMode="numeric"
                pattern="[1-9]"
                maxLength={1}
                autoComplete="off"
                disabled={phase !== 'playing' || isGiven}
                aria-label={`Row ${row + 1}, column ${col + 1}${digit ? `, ${digit}` : ', empty'}`}
                value={digit === 0 ? '' : String(digit)}
                ref={(element) => {
                  inputRefs.current[index] = element;
                }}
                onChange={(event) => handleChange(event, index)}
                onKeyDown={(event) => handleKeyDown(event, index)}
                onFocus={() => setSelected(index)}
                className={`aspect-square border border-border text-center text-lg font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 sm:text-xl ${
                  isGiven
                    ? 'bg-surface-muted font-bold text-ink'
                    : isConflict
                      ? 'bg-danger-soft text-danger-strong'
                      : isSelected
                        ? 'bg-primary/20 text-ink'
                        : 'bg-surface-raised text-ink-muted hover:bg-primary/10'
                }`}
              />
            );
          })}
        </div>

        {phase === 'playing' && (
          <>
            {conflicts > 0 && (
              <p role="status" className="text-small font-semibold text-warning-strong">
                {conflicts} {conflicts === 1 ? 'cell has' : 'cells have'} conflicting numbers, fix
                them to finish.
              </p>
            )}
            <p className="text-small text-ink-muted">
              Hint: given numbers are fixed; conflicting entries are highlighted in red. Use the
              arrow keys to move between cells.
            </p>
          </>
        )}
      </div>
    </SoloShell>
  );
}
