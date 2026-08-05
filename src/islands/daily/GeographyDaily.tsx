import { useCallback, useState } from 'react';
import SoloShell from '../solo/SoloShell';
import geographyJson from '../../data/daily-geography.json';
import { dailyGameSeed } from '../../lib/daily';
import { dailyDateKey } from '../../lib/trivia';
import {
  GEOGRAPHY_ROUNDS_PER_DAY,
  pickGeographyRounds,
  type GeographyEntry,
} from '../../lib/geography';

/**
 * Daily Geography — "Where in the World?" (DAILY-DESIGN §3.1).
 * 10 photo rounds; a wrong guess shows the hint and allows one retry
 * (50 pts); first-try correct is 100; second wrong is 0. The credit line
 * renders only on reveal, and only for CC-BY / CC-BY-SA images.
 */

const entries = geographyJson as GeographyEntry[];

type Phase = 'setup' | 'playing' | 'done';
type RoundState = 'answering' | 'hint' | 'revealed';

interface Props {
  /** Phase A: when set, the day's content is deterministic for everyone. */
  dailyDateKey?: string;
}

export default function GeographyDaily({ dailyDateKey: dateKeyProp }: Props) {
  const dateKey = dateKeyProp ?? dailyDateKey(new Date());
  const [phase, setPhase] = useState<Phase>('setup');
  const [rounds, setRounds] = useState<GeographyEntry[]>([]);
  const [index, setIndex] = useState(0);
  const [roundState, setRoundState] = useState<RoundState>('answering');
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);

  const entry = rounds[index];

  const start = () => {
    setRounds(
      pickGeographyRounds(entries, GEOGRAPHY_ROUNDS_PER_DAY, dailyGameSeed(dateKey, 'geography'))
    );
    setIndex(0);
    setScore(0);
    setCorrect(0);
    setRoundState('answering');
    setPhase('playing');
  };

  /** One tap on an option: first try 100, after the hint 50, second wrong 0. */
  const answer = (optionIndex: number) => {
    if (!entry || roundState === 'revealed') {
      return;
    }
    if (optionIndex === entry.answer) {
      const points = roundState === 'hint' ? 50 : 100;
      setScore((previous) => previous + points);
      setCorrect((previous) => previous + 1);
      setRoundState('revealed');
    } else if (roundState === 'answering') {
      setRoundState('hint');
    } else {
      setRoundState('revealed');
    }
  };

  const next = useCallback(() => {
    if (index + 1 >= rounds.length) {
      setPhase('done');
      return;
    }
    setIndex((previous) => previous + 1);
    setRoundState('answering');
  }, [index, rounds.length]);

  const playAgain = () => {
    start();
  };

  if (phase === 'setup') {
    return (
      <div className="flex flex-col gap-5 rounded-lg border border-border bg-surface-raised p-4 sm:p-6 shadow-sm">
        <h3 className="text-lg font-bold tracking-tight text-ink">Daily Geography</h3>
        <p className="max-w-xl text-body text-ink-muted">
          Ten photos from around the world — name each place from four options. A wrong guess shows
          a hint and earns one retry at half points.
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
      slug="geography"
      name="Daily Geography"
      phase={phase}
      round={Math.min(index + 1, rounds.length)}
      totalRounds={rounds.length}
      score={score}
      correctCount={correct}
      totalCount={rounds.length}
      resultSummary={
        <p className="text-body text-ink-muted">
          {correct} of {rounds.length} places found
        </p>
      }
      onPlayAgain={playAgain}
    >
      {entry && (
        <div
          className="flex flex-col gap-4"
          aria-label={`Where in the world? Round ${index + 1} of ${rounds.length}`}
        >
          <div className="overflow-hidden rounded-lg border border-border bg-surface-raised shadow-sm">
            {/* Empty alt on purpose: a descriptive alt would leak the answer to
                screen-reader users; the four options are the real question. */}
            <img
              src={entry.url}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="aspect-[16/10] w-full object-cover"
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {entry.options.map((option, optionIndex) => (
              <button
                key={option}
                type="button"
                disabled={roundState === 'revealed'}
                onClick={() => answer(optionIndex)}
                className="min-h-12 rounded-md border border-border bg-surface-raised px-4 py-3 text-left text-body font-semibold text-ink transition-colors hover:border-primary/50 hover:bg-primary/10 disabled:pointer-events-none disabled:opacity-60"
              >
                {option}
              </button>
            ))}
          </div>

          {roundState === 'hint' && (
            <p
              role="status"
              className="rounded-md border border-border bg-surface-muted px-4 py-2 text-body text-ink-muted"
            >
              💡 Hint: {entry.hint}
            </p>
          )}

          {roundState === 'revealed' && (
            <div className="flex flex-col gap-2 rounded-md border border-border bg-surface-raised px-4 py-3">
              <p role="status" className="text-body font-semibold text-ink">
                It was {entry.place}.
              </p>
              {entry.credit &&
                (entry.credit.license === 'by' || entry.credit.license === 'by-sa') && (
                  <p className="text-small text-ink-muted">
                    Photo: {entry.credit.creator} (CC-{entry.credit.license})
                  </p>
                )}
              <button
                type="button"
                onClick={next}
                className="inline-flex min-h-12 items-center justify-center rounded-pill bg-secondary px-7 py-3 text-lg font-semibold text-white  transition-colors hover:bg-secondary-dark sm:self-start"
              >
                {index + 1 >= rounds.length ? 'See my score' : 'Next place'}
              </button>
            </div>
          )}
        </div>
      )}
    </SoloShell>
  );
}
