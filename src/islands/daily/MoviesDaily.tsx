import { useCallback, useState } from 'react';
import SoloShell from '../solo/SoloShell';
import moviesJson from '../../data/daily-movies.json';
import { dailyGameSeed } from '../../lib/daily';
import { dailyDateKey } from '../../lib/trivia';
import { MOVIE_ROUNDS_PER_DAY, pickMovieRounds, type MovieRound } from '../../lib/movies';

/**
 * Daily Movies — "Real or Fake?" (DAILY-DESIGN §3.2).
 * 10 synopsis rounds; the player judges Real vs Fake. Feedback names the
 * film + year on both outcomes; 100 per correct, 0 per wrong.
 */

const entries = moviesJson as Parameters<typeof pickMovieRounds>[0];

type Phase = 'setup' | 'playing' | 'done';
type RoundState = 'answering' | 'revealed';

interface Props {
  /** Phase A: when set, the day's content is deterministic for everyone. */
  dailyDateKey?: string;
}

export default function MoviesDaily({ dailyDateKey: dateKeyProp }: Props) {
  const dateKey = dateKeyProp ?? dailyDateKey(new Date());
  const [phase, setPhase] = useState<Phase>('setup');
  const [rounds, setRounds] = useState<MovieRound[]>([]);
  const [index, setIndex] = useState(0);
  const [roundState, setRoundState] = useState<RoundState>('answering');
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [feedback, setFeedback] = useState<{ correct: boolean; text: string } | null>(null);

  const round = rounds[index];

  const start = () => {
    setRounds(pickMovieRounds(entries, MOVIE_ROUNDS_PER_DAY, dailyGameSeed(dateKey, 'movies')));
    setIndex(0);
    setScore(0);
    setCorrect(0);
    setFeedback(null);
    setRoundState('answering');
    setPhase('playing');
  };

  const answer = (side: 'real' | 'fake') => {
    if (!round || roundState === 'revealed') {
      return;
    }
    const wasCorrect = round.shown === side;
    if (wasCorrect) {
      setScore((previous) => previous + 100);
      setCorrect((previous) => previous + 1);
    }
    setFeedback({
      correct: wasCorrect,
      text: wasCorrect
        ? `Yes — ${round.entry.title}, ${round.entry.year}`
        : `No — it was ${round.entry.title}, ${round.entry.year}`,
    });
    setRoundState('revealed');
  };

  const next = useCallback(() => {
    if (index + 1 >= rounds.length) {
      setPhase('done');
      return;
    }
    setIndex((previous) => previous + 1);
    setFeedback(null);
    setRoundState('answering');
  }, [index, rounds.length]);

  const playAgain = () => {
    start();
  };

  if (phase === 'setup') {
    return (
      <div className="flex flex-col gap-5 rounded-lg border border-border bg-surface-raised p-4 sm:p-6 shadow-sm">
        <h3 className="text-lg font-bold tracking-tight text-ink">Daily Movie</h3>
        <p className="max-w-xl text-body text-ink-muted">
          Ten synopses — some real, some invented. Spot the made-up plots, 100 points per correct
          call.
        </p>
        <button
          type="button"
          onClick={start}
          className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary px-7 py-3 text-lg font-semibold text-white  transition-colors hover:bg-primary-hover sm:self-start"
        >
          Start the challenge
        </button>
      </div>
    );
  }

  return (
    <SoloShell
      slug="movies"
      name="Daily Movie"
      phase={phase}
      round={Math.min(index + 1, rounds.length)}
      totalRounds={rounds.length}
      score={score}
      correctCount={correct}
      totalCount={rounds.length}
      resultSummary={
        <p className="text-body text-ink-muted">
          {correct} of {rounds.length} plots correctly judged
        </p>
      }
      onPlayAgain={playAgain}
    >
      {round && (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-border bg-surface-raised p-4 sm:p-6 shadow-sm">
            <p className="text-small font-semibold uppercase tracking-wide text-primary-deep">
              Real or fake?
            </p>
            <p className="mt-3 text-body leading-relaxed text-ink">“{round.text}”</p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={roundState === 'revealed'}
              onClick={() => answer('real')}
              className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary px-7 py-3 text-lg font-semibold text-white  transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-40"
            >
              🎬 Real
            </button>
            <button
              type="button"
              disabled={roundState === 'revealed'}
              onClick={() => answer('fake')}
              className="inline-flex min-h-12 items-center justify-center rounded-pill bg-secondary px-7 py-3 text-lg font-semibold text-white  transition-colors hover:bg-secondary-dark disabled:pointer-events-none disabled:opacity-40"
            >
              🚫 Fake
            </button>
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

          {roundState === 'revealed' && (
            <button
              type="button"
              onClick={next}
              className="inline-flex min-h-12 items-center justify-center rounded-pill bg-secondary px-7 py-3 text-lg font-semibold text-white  transition-colors hover:bg-secondary-dark sm:self-start"
            >
              {index + 1 >= rounds.length ? 'See my score' : 'Next synopsis'}
            </button>
          )}
        </div>
      )}
    </SoloShell>
  );
}
