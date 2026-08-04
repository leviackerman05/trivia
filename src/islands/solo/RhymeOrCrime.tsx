import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from 'react';
import SoloShell from './SoloShell';
import rhymesJson from '../../data/rhymes.json';
import {
  applyMultiplier,
  judgeRhymeAnswer,
  pickRhymeRounds,
  RHYME_ROUND_SECONDS,
  RHYME_TOTAL_ROUNDS,
  type RhymeEntry,
} from '../../lib/rhyme-or-crime';

/**
 * Rhyme or Crime (M7, PRD §5.2) — type a word that rhymes with the prompt
 * AND fits the category. 60s per round, 5 rounds; +10 (with a +5 speed
 * bonus under 10s) and a streak multiplier (×2 from 3 consecutive correct,
 * ×3 from 5). The dataset encodes CMU-derived rhyming answers.
 */

const entries = rhymesJson as RhymeEntry[];

export default function RhymeOrCrime() {
  const [rounds, setRounds] = useState<RhymeEntry[]>([]);
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState('');
  const [feedback, setFeedback] = useState<{ correct: boolean; text: string } | null>(null);
  const [locked, setLocked] = useState(false);
  const [score, setScore] = useState(0);
  const [consecutive, setConsecutive] = useState(0);
  const [results, setResults] = useState<{ correct: boolean; points: number }[]>([]);
  const [phase, setPhase] = useState<'playing' | 'done'>('playing');
  const [now, setNow] = useState(() => Date.now());
  const deadlineRef = useRef(0);
  const submittedRef = useRef(false);

  const entry = rounds[index];

  useEffect(() => {
    setRounds(pickRhymeRounds(entries, RHYME_TOTAL_ROUNDS, Math.floor(Math.random() * 1000)));
  }, []);

  // Round timer (server-free; the deadline is local for solo play).
  useEffect(() => {
    if (phase !== 'playing' || !entry || locked) {
      return;
    }
    deadlineRef.current = Date.now() + RHYME_ROUND_SECONDS * 1000;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [phase, entry, locked, index]);

  const remaining = entry ? Math.max(0, Math.ceil((deadlineRef.current - now) / 1000)) : 0;

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
    if (!entry || locked || submittedRef.current) {
      return;
    }
    submittedRef.current = true;
    const remainingMs = Math.max(0, deadlineRef.current - Date.now());
    const elapsed = Math.min(RHYME_ROUND_SECONDS * 1000, RHYME_ROUND_SECONDS * 1000 - remainingMs);
    const verdict = judgeRhymeAnswer(entry, draft, elapsed);
    const nextConsecutive = verdict.correct ? consecutive + 1 : 0;
    const applied = applyMultiplier(verdict, nextConsecutive);
    setFeedback({
      correct: verdict.correct,
      text: verdict.correct
        ? `“${draft.trim()}” rhymes and fits ${entry.category}! +${applied.points} points`
        : `Not quite — try a word that rhymes with “${entry.prompt}”.`,
    });
    setConsecutive(nextConsecutive);
    setScore((previous) => previous + applied.points);
    setResults((previous) => [...previous, { correct: verdict.correct, points: applied.points }]);
    setLocked(true);
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
    submittedRef.current = false;
  }, [index, rounds.length]);

  const playAgain = () => {
    setRounds(pickRhymeRounds(entries, RHYME_TOTAL_ROUNDS, Math.floor(Math.random() * 1000)));
    setIndex(0);
    setScore(0);
    setConsecutive(0);
    setResults([]);
    setFeedback(null);
    setLocked(false);
    submittedRef.current = false;
    setPhase('playing');
  };

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
          <div className="rounded-lg border-2 border-border bg-surface-raised p-6 text-center shadow-sm">
            <p className="text-small font-semibold uppercase tracking-wide text-primary-deep">
              Category: {entry.category}
            </p>
            <p className="mt-2 font-display text-h2 text-ink">“{entry.prompt}”</p>
            <p className="mt-1 text-body text-ink-muted">
              Type a word that rhymes with <span className="font-semibold">{entry.prompt}</span> AND
              fits {entry.category}.
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
              className="min-w-0 flex-1 rounded-md border-2 border-border bg-surface-raised px-4 py-2.5 text-lg text-ink transition-colors hover:border-border-strong focus:border-primary-strong focus:outline-none focus:ring-4 focus:ring-primary/25"
            />
            <button
              type="submit"
              disabled={locked || !draft.trim()}
              className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary-strong px-7 py-3 text-lg font-semibold text-white shadow-coral transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-40"
            >
              Submit rhyme
            </button>
          </form>
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
              {index + 1 >= rounds.length ? 'See my score' : 'Next round'}
            </button>
          )}
        </>
      )}
    </SoloShell>
  );
}
