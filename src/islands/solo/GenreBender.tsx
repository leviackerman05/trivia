import { useCallback, useEffect, useState } from 'react';
import SoloShell from './SoloShell';
import TimerPicker from './TimerPicker';
import genreBendersJson from '../../data/genre-benders.json';
import { useCountdown } from '../../lib/use-countdown';
import { readTimerSetting, saveTimerSetting } from '../../lib/solo';
import {
  benderLabel,
  GENRE_BENDER_TOTAL_QUESTIONS,
  genreBenderOptions,
  judgeGenreBender,
  pickGenreBenderQuestions,
  type GenreBenderEntry,
} from '../../lib/genre-bender';
import { dailyGameSeed } from '../../lib/daily';

/**
 * Genre-Bender (M8, PRD §5.10; M14 owner fixes), rap lyrics rewritten as
 * Shakespearean sonnets (paraphrased/original, licensing-safe); name the
 * song + artist from four options. The year clue stays a free hint; the
 * round timer is player-chosen and starts only when the game starts.
 */

const entries = genreBendersJson as GenreBenderEntry[];
const TIMER_OPTIONS = [30, 40, 50, 60, 70];

type Phase = 'setup' | 'playing' | 'done';

interface Props {
  /** Phase A: when set, the day's content is deterministic for everyone. */
  dailyDateKey?: string;
}

export default function GenreBender({ dailyDateKey }: Props) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [timerSeconds, setTimerSeconds] = useState(() => readTimerSetting('genre-bender', 30));
  const [questions, setQuestions] = useState<GenreBenderEntry[]>([]);
  const [index, setIndex] = useState(0);
  const [options, setOptions] = useState<string[]>([]);
  const [showYear, setShowYear] = useState(false);
  const [feedback, setFeedback] = useState<{ correct: boolean; text: string } | null>(null);
  const [locked, setLocked] = useState(false);
  const [score, setScore] = useState(0);
  const [results, setResults] = useState<{ correct: boolean; points: number }[]>([]);

  const question = questions[index];
  const remaining = useCountdown(
    phase === 'playing' && !locked && Boolean(question),
    timerSeconds,
    index
  );

  const start = () => {
    saveTimerSetting('genre-bender', timerSeconds);
    const seed = dailyDateKey
      ? dailyGameSeed(dailyDateKey, 'genre-bender')
      : Math.floor(Math.random() * 1000);
    const picked = pickGenreBenderQuestions(entries, GENRE_BENDER_TOTAL_QUESTIONS, seed);
    setQuestions(picked);
    setOptions(picked[0] ? genreBenderOptions(picked[0], picked) : []);
    setIndex(0);
    setScore(0);
    setResults([]);
    setShowYear(false);
    setFeedback(null);
    setLocked(false);
    setPhase('playing');
  };

  useEffect(() => {
    if (phase === 'playing' && question && remaining === 0 && !locked) {
      setFeedback({ correct: false, text: `Time's up! It was “${benderLabel(question)}”.` });
      setLocked(true);
    }
  }, [remaining, locked, question, phase]);

  const choose = (picked: string) => {
    if (!question || locked) {
      return;
    }
    const elapsedMs = timerSeconds * 1000 - remaining * 1000;
    const verdict = judgeGenreBender(picked, benderLabel(question), elapsedMs);
    setFeedback({
      correct: verdict.correct,
      text: verdict.correct
        ? `“${benderLabel(question)}”, +${verdict.points} points!`
        : `Not quite, it was “${benderLabel(question)}”.`,
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
    setOptions(nextQuestion ? genreBenderOptions(nextQuestion, questions) : []);
    setShowYear(false);
    setFeedback(null);
    setLocked(false);
  }, [index, questions]);

  const playAgain = () => {
    setPhase('setup');
    setIndex(0);
    setScore(0);
    setResults([]);
    setShowYear(false);
    setFeedback(null);
    setLocked(false);
  };

  if (phase === 'setup') {
    return (
      <div className="flex flex-col gap-5 rounded-lg border-2 border-border bg-surface-raised p-6 shadow-sm">
        <h3 className="font-display text-h3 text-ink">Genre-Bender</h3>
        <p className="max-w-xl text-body text-ink-muted">
          A classic lyric rewritten as a Shakespearean sonnet, name the song and artist. Pick your
          round timer; the clock starts when you do.
        </p>
        <TimerPicker value={timerSeconds} onChange={setTimerSeconds} options={TIMER_OPTIONS} />
        <button
          type="button"
          onClick={start}
          className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary-strong px-7 py-3 text-lg font-semibold text-white shadow-coral transition-colors hover:bg-primary-hover sm:self-start"
        >
          Start the game
        </button>
      </div>
    );
  }

  return (
    <SoloShell
      slug="genre-bender"
      name="Genre-Bender"
      phase={phase}
      round={Math.min(index + 1, questions.length)}
      totalRounds={questions.length || GENRE_BENDER_TOTAL_QUESTIONS}
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
          {results.filter((result) => result.correct).length} of {results.length} bangers identified
        </p>
      }
      onPlayAgain={playAgain}
    >
      {question && (
        <>
          <div className="rounded-lg border-2 border-border bg-surface-raised p-6 shadow-sm">
            <p className="text-small font-semibold uppercase tracking-wide text-primary-deep">
              A classic, re-written
            </p>
            <p className="mt-3 font-display text-h3 leading-snug text-ink italic">
              “{question.bent}”
            </p>
            {showYear && (
              <p aria-live="polite" className="mt-2 text-small italic text-ink-muted">
                Clue: released in {question.year}.
              </p>
            )}
          </div>
          {!showYear && !locked && (
            <button
              type="button"
              onClick={() => setShowYear(true)}
              className="self-start rounded-pill border-2 border-border bg-surface-raised px-4 py-2 text-small font-semibold text-ink transition-colors hover:border-primary/50"
            >
              💡 Show year clue
            </button>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {options.map((option) => (
              <button
                key={option}
                type="button"
                disabled={locked}
                onClick={() => choose(option)}
                className="min-h-14 rounded-lg border-3 border-border bg-surface-raised px-5 py-3 text-left text-lg font-semibold text-ink transition-colors hover:border-primary hover:bg-primary/5 disabled:cursor-default"
              >
                {option}
              </button>
            ))}
          </div>
          {feedback && (
            <p
              role="status"
              className={`rounded-md border-2 px-4 py-2 text-body font-semibold ${
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
              className="inline-flex min-h-12 items-center justify-center rounded-pill bg-secondary px-7 py-3 text-lg font-semibold text-white shadow-teal transition-colors hover:bg-secondary-dark sm:self-start"
            >
              {index + 1 >= questions.length ? 'See my score' : 'Next bender'}
            </button>
          )}
        </>
      )}
    </SoloShell>
  );
}
