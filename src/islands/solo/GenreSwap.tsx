import { useCallback, useEffect, useRef, useState } from 'react';
import SoloShell from './SoloShell';
import TimerPicker from './TimerPicker';
import genreSwapsJson from '../../data/genre-swaps.json';
import { useCountdown } from '../../lib/use-countdown';
import { readTimerSetting, saveTimerSetting } from '../../lib/solo';
import {
  GENRE_SWAP_TOTAL_QUESTIONS,
  genreSwapOptions,
  judgeGenreSwap,
  pickGenreSwapQuestions,
  type GenreSwapEntry,
} from '../../lib/genre-swap';
import { dailyGameSeed } from '../../lib/daily';
import { optionSeed } from '../../lib/pick';
import { seededRandom } from '../../lib/trivia';
import { DECADE_PRESETS, filterByDecade } from '../../lib/decade';
import DecadeChips from '../../components/DecadeChips';

/**
 * Genre Swap (M8, PRD §5.9; M14 owner fixes), a famous movie plot rewritten
 * in a wildly wrong genre; pick the original from four options. The timer is
 * player-chosen (30-70s presets) and only starts when the game starts.
 */

const entries = genreSwapsJson as GenreSwapEntry[];
const allOriginals = entries.map((entry) => entry.original);
const TIMER_OPTIONS = [30, 40, 50, 60, 70];

// [R8] genre-swaps.json has no `year` until the L10 backfill lands, so every
// decade preset filters to an empty pool and the empty-decade guard hides
// all presets; "All" always works. Self-healing once content lands.
const yearOf = (entry: GenreSwapEntry): number | undefined =>
  (entry as GenreSwapEntry & { year?: number }).year;

type Phase = 'setup' | 'playing' | 'done';

interface Props {
  /** Phase A: when set, the day's content is deterministic for everyone. */
  dailyDateKey?: string;
}

export default function GenreSwap({ dailyDateKey }: Props) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [timerSeconds, setTimerSeconds] = useState(() => readTimerSetting('genre-swap', 30));
  const [decade, setDecade] = useState<number | null>(null);
  const [questions, setQuestions] = useState<GenreSwapEntry[]>([]);
  const [index, setIndex] = useState(0);
  const [options, setOptions] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{ correct: boolean; text: string } | null>(null);
  const [locked, setLocked] = useState(false);
  const [score, setScore] = useState(0);
  const [results, setResults] = useState<{ correct: boolean; points: number }[]>([]);
  // [R7] the round's option shuffle must stay seeded per round in daily mode.
  const seedRef = useRef(0);

  const question = questions[index];
  const remaining = useCountdown(
    phase === 'playing' && !locked && Boolean(question),
    timerSeconds,
    index
  );

  // [R8] hide decade presets whose filtered pool can't fill a round; "All"
  // always renders. Deterministic and self-healing as content lands.
  const availablePresets = DECADE_PRESETS.filter(
    (preset) =>
      preset === null ||
      filterByDecade(entries, preset, yearOf).length >= GENRE_SWAP_TOTAL_QUESTIONS
  );

  const start = () => {
    saveTimerSetting('genre-swap', timerSeconds);
    const seed = dailyDateKey
      ? dailyGameSeed(dailyDateKey, 'genre-swap')
      : Math.floor(Math.random() * 1000);
    seedRef.current = seed;
    // [R8] filter BEFORE seeding: same (day, filter) ⇒ same rounds.
    const pool = filterByDecade(entries, decade, yearOf);
    const picked = pickGenreSwapQuestions(pool, GENRE_SWAP_TOTAL_QUESTIONS, seed);
    setQuestions(picked);
    setOptions(
      picked[0]
        ? genreSwapOptions(
            picked[0],
            allOriginals,
            dailyDateKey ? seededRandom(optionSeed(seed, 0)) : undefined
          )
        : []
    );
    setIndex(0);
    setScore(0);
    setResults([]);
    setFeedback(null);
    setLocked(false);
    setPhase('playing');
  };

  useEffect(() => {
    if (phase === 'playing' && question && remaining === 0 && !locked) {
      setFeedback({
        correct: false,
        text: `Time's up! It was “${question.original}” (as a ${question.genre.toLowerCase()} tale).`,
      });
      setLocked(true);
    }
  }, [remaining, locked, question, phase]);

  const choose = (picked: string) => {
    if (!question || locked) {
      return;
    }
    const elapsedMs = timerSeconds * 1000 - remaining * 1000;
    const verdict = judgeGenreSwap(picked, question.original, elapsedMs);
    setFeedback({
      correct: verdict.correct,
      text: verdict.correct
        ? `“${question.original}”, +${verdict.points} points!`
        : `Not quite, it was “${question.original}”.`,
    });
    setScore((previous) => previous + verdict.points);
    setResults((previous) => [...previous, { correct: verdict.correct, points: verdict.points }]);
    setLocked(true);
  };

  const next = useCallback(() => {
    if (index + 1 >= questions.length) {
      setPhase('done');
      return;
    }
    setIndex((previous) => previous + 1);
    const nextQuestion = questions[index + 1];
    setOptions(
      nextQuestion
        ? genreSwapOptions(
            nextQuestion,
            allOriginals,
            dailyDateKey ? seededRandom(optionSeed(seedRef.current, index + 1)) : undefined
          )
        : []
    );
    setFeedback(null);
    setLocked(false);
  }, [index, questions]);

  const playAgain = () => {
    setPhase('setup');
    setIndex(0);
    setScore(0);
    setResults([]);
    setFeedback(null);
    setLocked(false);
  };

  if (phase === 'setup') {
    return (
      <div className="flex flex-col gap-5 rounded-lg border border-border bg-surface-raised p-4 sm:p-6 shadow-sm">
        <h3 className="text-lg font-bold tracking-tight text-ink">Genre Swap</h3>
        <p className="max-w-xl text-body text-ink-muted">
          A famous movie plot rewritten in a wildly wrong genre, spot the original. Pick your round
          timer; the clock starts when you do.
        </p>
        <TimerPicker value={timerSeconds} onChange={setTimerSeconds} options={TIMER_OPTIONS} />
        {/* [R8] decade filter (both modes); presets hidden when the pool is thin. */}
        <DecadeChips presets={availablePresets} value={decade} onChange={setDecade} />
        <button
          type="button"
          onClick={start}
          className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary px-7 py-3 text-lg font-semibold text-white  transition-colors hover:bg-primary-hover sm:self-start"
        >
          Start the game
        </button>
      </div>
    );
  }

  return (
    <SoloShell
      slug="genre-swap"
      name="Genre Swap"
      phase={phase}
      round={Math.min(index + 1, questions.length)}
      totalRounds={questions.length || GENRE_SWAP_TOTAL_QUESTIONS}
      score={score}
      headerExtra={
        phase === 'playing' ? (
          <span
            aria-live="polite"
            className={`rounded-pill px-4 py-1.5 font-mono text-sm font-semibold ${
              remaining <= 5
                ? 'bg-danger-soft text-danger-strong'
                : 'bg-success-soft text-success-strong'
            }`}
          >
            {remaining}s
          </span>
        ) : undefined
      }
      resultSummary={
        <p className="text-body text-ink-muted">
          {results.filter((result) => result.correct).length} of {results.length} movies spotted
        </p>
      }
      onPlayAgain={playAgain}
    >
      {question && (
        <>
          <div className="rounded-lg border border-border bg-surface-raised p-4 sm:p-6 shadow-sm">
            <p className="text-small font-semibold uppercase tracking-wide text-primary-deep">
              Now a {question.genre.toLowerCase()} story
            </p>
            <p className="mt-3 font-display text-h3 leading-snug text-ink">
              {question.description}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {options.map((option) => {
              const isCorrect = feedback?.correct === true && option === question.original;
              return (
                <button
                  key={option}
                  type="button"
                  disabled={locked}
                  onClick={() => choose(option)}
                  className={`min-h-14 rounded-lg border px-5 py-3 text-left text-lg font-semibold transition-colors disabled:cursor-default ${
                    isCorrect
                      ? 'border-success bg-success-soft text-success-strong'
                      : 'border-border bg-surface-raised text-ink hover:border-primary hover:bg-primary/5'
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
          {feedback && (
            <p
              role="status"
              className={`rounded-md border px-4 py-2 text-body font-semibold ${
                feedback.correct
                  ? 'border-success/50 bg-success-soft text-success-strong'
                  : 'border-danger/50 bg-danger-soft text-danger-strong'
              }`}
            >
              {feedback.text}
            </p>
          )}
          {locked && (
            <button
              type="button"
              onClick={next}
              className="inline-flex min-h-12 items-center justify-center rounded-pill bg-secondary px-7 py-3 text-lg font-semibold text-white  transition-colors hover:bg-secondary-dark sm:self-start"
            >
              {index + 1 >= questions.length ? 'See my score' : 'Next plot'}
            </button>
          )}
        </>
      )}
    </SoloShell>
  );
}
