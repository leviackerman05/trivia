import { useCallback, useEffect, useRef, useState } from 'react';
import SoloShell from '../solo/SoloShell';
import { dailyDateKey } from '../../lib/trivia';
import {
  letterStates,
  pickDailyWord,
  wordleScore,
  WORDLE_MAX_GUESSES,
  WORDLE_WORD_LENGTH,
  type LetterState,
} from '../../lib/wordle';

/**
 * [R20] Daily Wordle (owner-mandated name; our own word list and visual
 * treatment, no NYT art). The same five-letter word for everyone per UTC
 * day (D050 seeded pool). Six guesses with letter-state tiles and an
 * on-screen + physical keyboard. Scoring per D066: 100/85/70/55/40/25 by
 * attempt, 0 on a failed solve. No daily leaderboard (scores are per-
 * attempt, not a race), so the done view hides the leaderboard form while
 * keeping the streak, personal best, and share card (SoloShell).
 */

const KEYBOARD_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const WORDLE_PB_KEY = 'triviahub:wordle:pb:v1';

function readBest(): number {
  if (typeof window === 'undefined') {
    return 0;
  }
  try {
    const raw = localStorage.getItem(WORDLE_PB_KEY);
    const parsed = raw === null ? NaN : Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function writeBest(score: number): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(WORDLE_PB_KEY, String(score));
  } catch {
    // Storage full/blocked, best-effort.
  }
}

type Phase = 'setup' | 'playing' | 'done';

const STATE_PRIORITY: Record<LetterState, number> = { correct: 3, 'wrong-position': 2, absent: 1 };

export default function WordleDaily({ dailyDateKey: dateKeyProp }: { dailyDateKey?: string }) {
  const dateKey = dateKeyProp ?? dailyDateKey(new Date());
  const [phase, setPhase] = useState<Phase>('setup');
  const [word, setWord] = useState('');
  const [guesses, setGuesses] = useState<string[]>([]);
  const [current, setCurrent] = useState('');
  const [keyStates, setKeyStates] = useState<Record<string, LetterState>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => readBest());
  const messageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submittedRef = useRef(false);

  const flash = useCallback((text: string) => {
    setMessage(text);
    if (messageTimerRef.current) {
      clearTimeout(messageTimerRef.current);
    }
    messageTimerRef.current = setTimeout(() => setMessage(null), 1800);
  }, []);

  const start = () => {
    setWord(pickDailyWord(dateKey));
    setGuesses([]);
    setCurrent('');
    setKeyStates({});
    setMessage(null);
    setScore(0);
    submittedRef.current = false;
    setPhase('playing');
  };

  const submitGuess = useCallback(() => {
    if (phase !== 'playing' || submittedRef.current) {
      return;
    }
    const guess = current.toLowerCase();
    if (guess.length < WORDLE_WORD_LENGTH) {
      flash('Not enough letters');
      return;
    }
    const feedback = letterStates(guess, word);
    const nextKeyStates = { ...keyStates };
    for (let i = 0; i < guess.length; i += 1) {
      const letter = guess[i]!;
      const state = feedback.states[i]!;
      if (
        !nextKeyStates[letter] ||
        STATE_PRIORITY[state] > STATE_PRIORITY[nextKeyStates[letter]!]
      ) {
        nextKeyStates[letter] = state;
      }
    }
    const nextGuesses = [...guesses, guess];
    submittedRef.current = true;
    setKeyStates(nextKeyStates);
    setGuesses(nextGuesses);
    setCurrent('');
    if (feedback.solved) {
      const finalScore = wordleScore(nextGuesses.length);
      setScore(finalScore);
      if (finalScore > readBest()) {
        writeBest(finalScore);
        setBest(finalScore);
      }
      setPhase('done');
    } else if (nextGuesses.length >= WORDLE_MAX_GUESSES) {
      setScore(0);
      setPhase('done');
    }
  }, [phase, current, word, guesses, keyStates, flash]);

  // Physical keyboard: letters type, Backspace erases, Enter submits.
  useEffect(() => {
    if (phase !== 'playing') {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (/^[a-z]$/.test(key)) {
        setCurrent((value) => (value.length < WORDLE_WORD_LENGTH ? value + key : value));
      } else if (key === 'backspace') {
        event.preventDefault();
        setCurrent((value) => value.slice(0, -1));
      } else if (key === 'enter') {
        event.preventDefault();
        submitGuess();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, submitGuess]);

  const tileClass = (state: LetterState | undefined, hasLetter: boolean) => {
    if (state === 'correct') {
      return 'bg-success-soft text-success-strong';
    }
    if (state === 'wrong-position') {
      return 'bg-warning-soft text-warning-strong';
    }
    if (hasLetter) {
      return 'bg-surface-strong text-ink-muted';
    }
    return 'border border-border bg-surface-raised text-ink';
  };

  const keyClass = (state: LetterState | undefined) => {
    if (state === 'correct') {
      return 'bg-success-soft text-success-strong';
    }
    if (state === 'wrong-position') {
      return 'bg-warning-soft text-warning-strong';
    }
    if (state === 'absent') {
      return 'bg-surface-strong text-ink-muted';
    }
    return 'bg-surface-muted text-ink';
  };

  if (phase === 'setup') {
    return (
      <div className="flex flex-col gap-5 rounded-lg border border-border bg-surface-raised p-4 sm:p-6 shadow-sm">
        <h3 className="text-lg font-bold tracking-tight text-ink">Daily Wordle</h3>
        <p className="max-w-xl text-body text-ink-muted">
          The same five-letter word for everyone today ({dateKey}). Six guesses, and each one colors
          the tiles: green for right place, amber for wrong place, gray for not in the word. Solve
          in fewer guesses for a higher score.
        </p>
        <button
          type="button"
          onClick={start}
          className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary px-7 py-3 text-lg font-semibold text-white transition-colors hover:bg-primary-hover sm:self-start"
        >
          Start today's word
        </button>
      </div>
    );
  }

  const attempts = guesses.length;
  const attemptsLabel = `${attempts} ${attempts === 1 ? 'guess' : 'guesses'}`;

  return (
    <>
      <style>{`@keyframes pb-flip {
  from { transform: rotateX(88deg); opacity: 0.4; }
  to { transform: rotateX(0deg); opacity: 1; }
}
.pb-flip { animation: pb-flip 0.35s ease-out; }`}</style>
      <SoloShell
        slug="wordle"
        name="Daily Wordle"
        phase={phase}
        round={1}
        totalRounds={1}
        score={score}
        hideLeaderboard
        headerExtra={
          phase === 'playing' ? (
            <span className="rounded-pill bg-tertiary/40 px-4 py-1.5 text-xs font-semibold text-ink">
              Guess {Math.min(attempts + 1, WORDLE_MAX_GUESSES)} of {WORDLE_MAX_GUESSES}
            </span>
          ) : undefined
        }
        resultSummary={
          <div className="flex flex-col gap-1">
            <p className="text-body text-ink-muted">
              The word was <strong className="font-semibold text-ink">{word}</strong>.
              {score > 0 ? ` Solved in ${attemptsLabel}.` : ' Better luck tomorrow.'}
            </p>
            {best > 0 && <p className="text-small text-ink-muted">Personal best: {best} points.</p>}
          </div>
        }
        onPlayAgain={start}
      >
        {phase === 'playing' && (
          <div className="flex flex-col items-center gap-4">
            <div
              role="grid"
              aria-label="Wordle board"
              className="grid w-full gap-1.5"
              style={{ maxWidth: '20rem' }}
            >
              {Array.from({ length: WORDLE_MAX_GUESSES }, (_, rowIndex) => {
                const guess = guesses[rowIndex];
                const isCurrentRow = rowIndex === guesses.length;
                const letters = guess ? guess.split('') : isCurrentRow ? current.split('') : [];
                const states = guess ? letterStates(guess, word).states : null;
                return (
                  <div key={rowIndex} role="row" className="grid grid-cols-5 gap-1.5">
                    {Array.from({ length: WORDLE_WORD_LENGTH }, (_, colIndex) => {
                      const letter = letters[colIndex] ?? '';
                      const state = states?.[colIndex];
                      const isRevealed = state !== undefined;
                      return (
                        <span
                          key={colIndex}
                          role="gridcell"
                          aria-label={letter ? `${letter}, ${state ?? 'empty'}` : 'empty'}
                          className={`flex aspect-square items-center justify-center rounded text-xl font-bold uppercase transition-colors ${
                            isRevealed
                              ? `pb-flip ${tileClass(state, true)}`
                              : tileClass(undefined, letter !== '')
                          }`}
                        >
                          {letter}
                        </span>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <div
              className="flex w-full flex-col gap-1.5"
              aria-label="Keyboard"
              style={{ maxWidth: '22.5rem' }}
            >
              {KEYBOARD_ROWS.map((row, rowIndex) => (
                <div key={row} className="flex justify-center gap-1.5">
                  {rowIndex === 2 && (
                    <button
                      type="button"
                      onClick={() => submitGuess()}
                      className="min-h-12 rounded-md bg-surface-muted px-2 text-xs font-semibold text-ink transition-colors hover:bg-surface-strong focus:outline-none focus:ring-2 focus:ring-ink"
                    >
                      Enter
                    </button>
                  )}
                  {row.split('').map((letter) => (
                    <button
                      key={letter}
                      type="button"
                      aria-label={`Letter ${letter}`}
                      onClick={() =>
                        setCurrent((value) =>
                          value.length < WORDLE_WORD_LENGTH ? value + letter : value
                        )
                      }
                      className={`min-h-12 flex-1 rounded-md text-sm font-semibold uppercase transition-colors focus:outline-none focus:ring-2 focus:ring-ink ${keyClass(
                        keyStates[letter]
                      )}`}
                    >
                      {letter}
                    </button>
                  ))}
                  {rowIndex === 2 && (
                    <button
                      type="button"
                      aria-label="Backspace"
                      onClick={() => setCurrent((value) => value.slice(0, -1))}
                      className="min-h-12 rounded-md bg-surface-muted px-2 text-xs font-semibold text-ink transition-colors hover:bg-surface-strong focus:outline-none focus:ring-2 focus:ring-ink"
                    >
                      ⌫
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="h-6 text-center">
              {message ? (
                <p role="status" className="text-small font-semibold text-warning-strong">
                  {message}
                </p>
              ) : (
                <p className="text-small text-ink-muted">
                  Type with your keyboard or tap the keys. Enter submits a guess.
                </p>
              )}
            </div>
          </div>
        )}
      </SoloShell>
    </>
  );
}
