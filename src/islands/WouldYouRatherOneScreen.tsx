import { useState } from 'react';
import {
  pickDilemmas,
  summarizeSession,
  WYR_DILEMMAS_PER_SESSION,
  type Dilemma,
} from '../lib/would-you-rather';

/**
 * Would You Rather, one-screen instant play (owner request 2026-08-04).
 * Co-located scorekeeper mode: one shared screen, pass the phone around the
 * room, tap A or B for each vote, watch the live tally swing. Local state
 * only, no room, no backend.
 */

type Phase = 'intro' | 'voting' | 'done';

interface DilemmaVotes {
  dilemma: Dilemma;
  a: number;
  b: number;
}

export default function WouldYouRatherOneScreen() {
  const [phase, setPhase] = useState<Phase>('intro');
  const [dilemmas, setDilemmas] = useState<Dilemma[]>([]);
  const [index, setIndex] = useState(0);
  const [votes, setVotes] = useState<DilemmaVotes[]>([]);

  const start = () => {
    setDilemmas(pickDilemmas());
    setIndex(0);
    setVotes([]);
    setPhase('voting');
  };

  const castVote = (side: 'a' | 'b') => {
    const dilemma = dilemmas[index];
    if (!dilemma) {
      return;
    }
    setVotes((prev) => {
      const next = [...prev];
      const current = next[index] ?? { dilemma, a: 0, b: 0 };
      current[side] += 1;
      next[index] = current;
      return next;
    });
  };

  const current = votes[index];
  const totalVotes = current ? current.a + current.b : 0;
  const percentA = totalVotes === 0 ? 50 : Math.round((current.a / totalVotes) * 100);

  if (phase === 'intro') {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-pill bg-primary/20 px-4 py-1.5 text-xs font-semibold text-primary-deep">
            One screen
          </span>
          <span className="rounded-pill bg-tertiary/40 px-4 py-1.5 text-xs font-semibold text-ink">
            {WYR_DILEMMAS_PER_SESSION} dilemmas
          </span>
        </div>
        <p className="max-w-2xl text-body text-ink-muted">
          Put this screen where everyone can see it. Read each dilemma out loud, then tap{' '}
          <span className="font-semibold text-ink">A</span> or{' '}
          <span className="font-semibold text-ink">B</span> once per vote, pass the phone around the
          room and watch the tally swing. No room, no accounts, just opinions.
        </p>
        <button
          type="button"
          onClick={start}
          className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary px-7 py-3 text-lg font-semibold text-white  transition-colors hover:bg-primary-hover sm:self-start"
        >
          Start
        </button>
      </div>
    );
  }

  if (phase === 'done') {
    const summary = summarizeSession(
      votes.reduce((sum, vote) => sum + vote.a, 0),
      votes.reduce((sum, vote) => sum + vote.b, 0),
      votes.length
    );
    const aWins = votes.filter((vote) => vote.a > vote.b).length;
    const bWins = votes.filter((vote) => vote.b > vote.a).length;
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-pill bg-success-soft px-4 py-1.5 text-xs font-semibold text-success-strong">
            {summary.votes} votes across {summary.dilemmas} dilemmas
          </span>
          <span className="rounded-pill bg-primary/20 px-4 py-1.5 text-xs font-semibold text-primary-deep">
            Room verdict: {summary.verdict}
          </span>
        </div>
        <h3 className="font-display text-h2 text-ink">The room chose</h3>
        <ul className="flex flex-col gap-2">
          <li className="flex items-center gap-3 rounded-md bg-blue-50 px-4 py-3 text-body text-ink">
            <span className="font-semibold text-blue-700">Option A</span>
            <span className="ml-auto font-semibold">{summary.pickA} votes</span>
            <span className="w-14 text-right text-ink-muted">{aWins} dilemmas won</span>
          </li>
          <li className="flex items-center gap-3 rounded-md bg-red-50 px-4 py-3 text-body text-ink">
            <span className="font-semibold text-danger-strong">Option B</span>
            <span className="ml-auto font-semibold">{summary.pickB} votes</span>
            <span className="w-14 text-right text-ink-muted">{bWins} dilemmas won</span>
          </li>
        </ul>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={start}
            className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary px-7 py-3 text-lg font-semibold text-white  transition-colors hover:bg-primary-hover"
          >
            Play again
          </button>
          <button
            type="button"
            onClick={() => setPhase('intro')}
            className="inline-flex min-h-12 items-center justify-center rounded-pill border border-primary bg-transparent px-7 py-3 text-lg font-semibold text-primary-strong transition-colors hover:bg-primary/15"
          >
            Back to start
          </button>
        </div>
      </div>
    );
  }

  const dilemma = dilemmas[index];
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-pill bg-primary/20 px-4 py-1.5 text-xs font-semibold text-primary-deep">
          Dilemma {index + 1} of {dilemmas.length}
        </span>
        <span
          aria-live="polite"
          className="ml-auto rounded-pill bg-tertiary/40 px-4 py-1.5 text-xs font-semibold text-ink"
        >
          {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
        </span>
      </div>

      <h3 className="text-lg font-bold tracking-tight text-ink">
        Would you rather… <span className="text-primary-deep">{dilemma?.a}</span> or{' '}
        <span className="text-primary-deep">{dilemma?.b}</span>?
      </h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => castVote('a')}
          className="inline-flex min-h-20 items-center justify-center rounded-lg border border-secondary bg-secondary px-6 py-4 text-lg font-semibold text-white transition-colors hover:bg-secondary-dark focus:outline-none focus:ring-2 focus:ring-success/30"
        >
          A
        </button>
        <button
          type="button"
          onClick={() => castVote('b')}
          className="inline-flex min-h-20 items-center justify-center rounded-lg border border-danger-strong bg-danger-strong px-6 py-4 text-lg font-semibold text-white transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-success/30"
        >
          B
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <div
          role="img"
          aria-label={`Live tally, option A ${percentA}%, option B ${100 - percentA}%`}
          className="flex h-10 w-full"
        >
          <div
            className="flex items-center justify-center bg-secondary text-sm font-semibold text-white transition-all duration-300"
            style={{ width: `${percentA}%` }}
          >
            {totalVotes > 0 && `${percentA}%`}
          </div>
          <div
            className="flex items-center justify-center bg-danger-strong text-sm font-semibold text-white transition-all duration-300"
            style={{ width: `${100 - percentA}%` }}
          >
            {totalVotes > 0 && `${100 - percentA}%`}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-small text-ink-muted">
          Tap <span className="font-semibold text-ink">A</span> or{' '}
          <span className="font-semibold text-ink">B</span> for every vote, pass the phone around
          the room.
        </p>
        <button
          type="button"
          onClick={() => {
            if (index + 1 >= dilemmas.length) {
              setPhase('done');
            } else {
              setIndex((prev) => prev + 1);
            }
          }}
          className="inline-flex min-h-12 items-center justify-center rounded-pill bg-secondary px-7 py-3 text-lg font-semibold text-white  transition-colors hover:bg-secondary-dark"
        >
          {index + 1 >= dilemmas.length ? 'See results' : 'Next dilemma'}
        </button>
      </div>
    </div>
  );
}
