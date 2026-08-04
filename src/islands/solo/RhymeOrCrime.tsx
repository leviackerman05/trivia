import { useCallback, useEffect, useState, type SyntheticEvent } from 'react';
import SoloShell from './SoloShell';
import TimerPicker from './TimerPicker';
import rhymesJson from '../../data/rhymes.json';
import { useCountdown } from '../../lib/use-countdown';
import { readTimerSetting, saveTimerSetting } from '../../lib/solo';
import {
  applyMultiplier,
  isKnownWord,
  judgeRhymeAnswer,
  pickRhymeRounds,
  RHYME_TOTAL_ROUNDS,
  type RhymeEntry,
} from '../../lib/rhyme-or-crime';
import { dailyGameSeed } from '../../lib/daily';

/**
 * Rhyme or Crime (M7, PRD §5.2; M14 owner fixes), type a word that rhymes
 * with the prompt. Judging is two-tier: dataset answers (puns included) or
 * any CMU-verified rhyme ("hi" rhymes with "pie"). M14: a setup phase lets
 * the player pick the category (or Auto) and the round timer, the clock
 * only starts when they hit Start; wrong answers are retryable until the
 * timer runs out; Play again resets the input and returns to setup.
 */

const entries = rhymesJson as RhymeEntry[];
const categories = [...new Set(entries.map((entry) => entry.category))].sort();
const TIMER_OPTIONS = [30, 40, 50, 60, 70];

type Phase = 'setup' | 'playing' | 'done';

interface Props {
  /** Phase A: when set, the day's content is deterministic for everyone. */
  dailyDateKey?: string;
}

export default function RhymeOrCrime({ dailyDateKey }: Props) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [category, setCategory] = useState<string>('auto');
  const [timerSeconds, setTimerSeconds] = useState(() => readTimerSetting('rhyme-or-crime', 60));
  const [rounds, setRounds] = useState<RhymeEntry[]>([]);
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState('');
  const [feedback, setFeedback] = useState<{ correct: boolean; text: string } | null>(null);
  const [locked, setLocked] = useState(false);
  const [score, setScore] = useState(0);
  const [consecutive, setConsecutive] = useState(0);
  const [results, setResults] = useState<{ correct: boolean; points: number }[]>([]);

  const entry = rounds[index];
  const remaining = useCountdown(
    phase === 'playing' && !locked && Boolean(entry),
    timerSeconds,
    index
  );

  const start = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    saveTimerSetting('rhyme-or-crime', timerSeconds);
    setRounds(
      pickRhymeRounds(
        entries,
        RHYME_TOTAL_ROUNDS,
        dailyDateKey
          ? dailyGameSeed(dailyDateKey, 'rhyme-or-crime')
          : Math.floor(Math.random() * 1000),
        category === 'auto' ? null : category
      )
    );
    setIndex(0);
    setScore(0);
    setConsecutive(0);
    setResults([]);
    setFeedback(null);
    setLocked(false);
    setDraft('');
    setPhase('playing');
  };

  // Timeout → reveal and move on.
  useEffect(() => {
    if (phase === 'playing' && entry && remaining === 0 && !locked) {
      const reveal = entry.answers[0] ?? entry.prompt;
      setFeedback({ correct: false, text: `Time's up! A rhyme could be “${reveal}”.` });
      setLocked(true);
    }
  }, [remaining, locked, entry, phase]);

  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!entry || locked) {
      return;
    }
    const guess = draft;
    if (!guess.trim()) {
      return;
    }
    const elapsedMs = timerSeconds * 1000 - remaining * 1000;
    const verdict = judgeRhymeAnswer(entry, guess, elapsedMs);
    if (verdict.correct) {
      const nextConsecutive = consecutive + 1;
      const applied = applyMultiplier(verdict, nextConsecutive);
      setFeedback({
        correct: true,
        text: `“${guess.trim()}” rhymes with “${entry.prompt}”! +${applied.points} points`,
      });
      setConsecutive(nextConsecutive);
      setScore((previous) => previous + applied.points);
      setResults((previous) => [...previous, { correct: true, points: applied.points }]);
      setLocked(true);
      return;
    }
    // Wrong → retryable until the timer runs out (M14 owner fix).
    setFeedback({
      correct: false,
      text: isKnownWord(guess)
        ? `“${guess.trim()}” doesn't rhyme with “${entry.prompt}”. Try another word!`
        : `I don't know “${guess.trim()}”, try a common word that rhymes with “${entry.prompt}”.`,
    });
    setDraft('');
  };

  const next = useCallback(() => {
    if (index + 1 >= rounds.length) {
      setPhase('done');
      return;
    }
    setIndex((previous) => previous + 1);
    setDraft('');
    setFeedback(null);
    setLocked(false);
  }, [index, rounds.length]);

  const playAgain = () => {
    setPhase('setup');
    setIndex(0);
    setScore(0);
    setConsecutive(0);
    setResults([]);
    setFeedback(null);
    setLocked(false);
    setDraft('');
  };

  if (phase === 'setup') {
    return (
      <form
        onSubmit={start}
        className="flex flex-col gap-5 rounded-lg border border-border bg-surface-raised p-4 sm:p-6 shadow-sm"
      >
        <h3 className="text-lg font-bold tracking-tight text-ink">Rhyme or Crime</h3>
        <p className="max-w-xl text-body text-ink-muted">
          Type a word that rhymes with the prompt. Pick a category (or Auto for a mixed set) and
          your round timer, the clock starts when you do.
        </p>
        <div className="flex flex-col gap-2">
          <span className="text-small font-semibold text-ink">Category</span>
          <div role="group" aria-label="Category" className="flex flex-wrap gap-2">
            {['auto', ...categories].map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={category === option}
                onClick={() => setCategory(option)}
                className={`inline-flex min-h-11 items-center justify-center rounded-pill border px-4 py-2 text-small font-semibold transition-colors ${
                  category === option
                    ? 'border-primary bg-primary/15 text-primary-deep'
                    : 'border-border bg-surface-muted text-ink-muted hover:border-primary/50 hover:text-ink'
                }`}
              >
                {option === 'auto' ? 'Auto (mixed)' : option}
              </button>
            ))}
          </div>
        </div>
        <TimerPicker value={timerSeconds} onChange={setTimerSeconds} options={TIMER_OPTIONS} />
        <button
          type="submit"
          className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary px-7 py-3 text-lg font-semibold text-white  transition-colors hover:bg-primary-hover sm:self-start"
        >
          Start the game
        </button>
      </form>
    );
  }

  return (
    <SoloShell
      slug="rhyme-or-crime"
      name="Rhyme or Crime"
      phase={phase}
      round={Math.min(index + 1, rounds.length)}
      totalRounds={rounds.length || RHYME_TOTAL_ROUNDS}
      score={score}
      headerExtra={
        phase === 'playing' ? (
          <span
            aria-live="polite"
            className={`rounded-pill px-4 py-1.5 font-mono text-sm font-semibold ${
              remaining <= 10
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
          {results.filter((result) => result.correct).length} of {results.length} rhymes solved
          {consecutive >= 3 && ' with a streak multiplier active'}
        </p>
      }
      onPlayAgain={playAgain}
    >
      {entry && (
        <>
          <div className="rounded-lg border border-border bg-surface-raised p-4 sm:p-6 text-center shadow-sm">
            <p className="text-small font-semibold uppercase tracking-wide text-primary-deep">
              Category: {entry.category}
            </p>
            <p className="mt-2 font-display text-h2 text-ink">“{entry.prompt}”</p>
            <p className="mt-1 text-body text-ink-muted">
              Type a word that rhymes with <span className="font-semibold">{entry.prompt}</span>.
            </p>
          </div>
          <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={30}
              disabled={locked}
              placeholder="Your rhyme…"
              aria-label="Your rhyme"
              className="min-w-0 flex-1 rounded-md border border-border bg-surface-raised px-4 py-2.5 text-base text-ink transition-colors hover:border-border-strong focus:border-primary-strong focus:outline-none focus:ring-2 focus:ring-success/30"
            />
            <button
              type="submit"
              disabled={locked || !draft.trim()}
              className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary px-7 py-3 text-lg font-semibold text-white  transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-40"
            >
              Submit rhyme
            </button>
          </form>
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
              {index + 1 >= rounds.length ? 'See my score' : 'Next round'}
            </button>
          )}
        </>
      )}
    </SoloShell>
  );
}
