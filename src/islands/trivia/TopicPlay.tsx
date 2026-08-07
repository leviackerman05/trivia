import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '../../components/icons/Icon';
import {
  bumpTopicReplay,
  CLASSIC_TOPIC_SLUG,
  getTopicRow,
  selectTopicQuestions,
  TOPIC_QUESTIONS_PER_GAME,
} from '../../lib/trivia-topics';
import {
  dailyDateKey,
  scoreTriviaAnswer,
  TRIVIA_QUESTION_SECONDS,
  triviaQuestions,
  type TriviaQuestion,
} from '../../lib/trivia';
import { loadTopicQuestions } from './topicData';

/**
 * Topic play (TRIVIA-TOPICS §5/§6, M-T4): local-only round engine. Same
 * round language as the daily (question, 4 options, 15s, reveal, flat 10
 * pts via scoreTriviaAnswer, max 100) but NO leaderboard, no nickname, no
 * submit. The day's first set is seeded replay 0 (same for everyone that
 * day); "New questions" bumps the per-topic replay counter for a fresh
 * seeded set. Mid-game back abandons the round (no score kept).
 */

interface Props {
  slug: string;
  onExit: () => void;
}

type Phase = 'loading' | 'error' | 'playing' | 'done';

interface RoundResult {
  correct: boolean;
  points: number;
}

export default function TopicPlay({ slug, onExit }: Props) {
  const isClassic = slug === CLASSIC_TOPIC_SLUG;
  const row = isClassic ? undefined : getTopicRow(slug);
  const label = isClassic ? 'Classic / Mixed' : (row?.label ?? slug);

  const [phase, setPhase] = useState<Phase>('loading');
  const [entries, setEntries] = useState<TriviaQuestion[] | null>(null);
  const [questions, setQuestions] = useState<TriviaQuestion[]>([]);
  const [replay, setReplay] = useState(0);
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(TRIVIA_QUESTION_SECONDS);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctIndex, setCorrectIndex] = useState<number | null>(null);
  const [points, setPoints] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [totalScore, setTotalScore] = useState(0);

  const deadlineRef = useRef(0);
  const lockedRef = useRef(false);

  // Load the topic file on demand (per-topic chunk), then build the seeded
  // set. The first play of the day always seeds replay 0 — the stored
  // counter is ignored (TRIVIA-TOPICS §3).
  useEffect(() => {
    let cancelled = false;
    setPhase('loading');
    const dateKey = dailyDateKey(new Date());
    void (async () => {
      let entries: TriviaQuestion[] | null = triviaQuestions;
      if (!isClassic) {
        entries = await loadTopicQuestions(slug);
      }
      if (cancelled) {
        return;
      }
      if (!entries || entries.length === 0) {
        setPhase('error');
        return;
      }
      setEntries(entries);
      setQuestions(selectTopicQuestions(entries, slug, dateKey, 0, TOPIC_QUESTIONS_PER_GAME));
      setReplay(0);
      setIndex(0);
      setResults([]);
      setTotalScore(0);
      lockedRef.current = false;
      setSelected(null);
      setCorrectIndex(null);
      setPoints(0);
      setRemaining(TRIVIA_QUESTION_SECONDS);
      deadlineRef.current = Date.now() + TRIVIA_QUESTION_SECONDS * 1000;
      setPhase('playing');
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, isClassic]);

  /** Reveal the answer for the current question (picked or null on timeout). */
  const reveal = useCallback(
    (picked: number | null) => {
      const question = questions[index];
      if (!question) {
        return;
      }
      const secondsLeft = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      const isCorrect = picked !== null && picked === question.answer;
      const earned = scoreTriviaAnswer(secondsLeft, isCorrect);
      setSelected(picked);
      setCorrectIndex(question.answer);
      setPoints(earned);
      setResults((prev) => [...prev, { correct: isCorrect, points: earned }]);
    },
    [questions, index]
  );

  const choose = (optionIndex: number) => {
    if (lockedRef.current || phase !== 'playing') {
      return;
    }
    lockedRef.current = true;
    reveal(optionIndex);
  };

  // Countdown: ticks every 250ms; timeout auto-reveals with no answer.
  useEffect(() => {
    if (phase !== 'playing' || lockedRef.current) {
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        lockedRef.current = true;
        reveal(null);
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [phase, index, reveal]);

  const nextQuestion = () => {
    if (index + 1 >= questions.length) {
      setTotalScore(results.reduce((sum, result) => sum + result.points, 0));
      setPhase('done');
      return;
    }
    setIndex((prev) => prev + 1);
    lockedRef.current = false;
    setSelected(null);
    setCorrectIndex(null);
    setPoints(0);
    setRemaining(TRIVIA_QUESTION_SECONDS);
    deadlineRef.current = Date.now() + TRIVIA_QUESTION_SECONDS * 1000;
  };

  /** "New questions": bump the replay counter, deal a fresh seeded set. */
  const newQuestions = () => {
    if (!entries) {
      return;
    }
    const dateKey = dailyDateKey(new Date());
    const nextReplay = bumpTopicReplay(slug);
    setQuestions(
      selectTopicQuestions(entries, slug, dateKey, nextReplay, TOPIC_QUESTIONS_PER_GAME)
    );
    setReplay(nextReplay);
    setIndex(0);
    setResults([]);
    setTotalScore(0);
    lockedRef.current = false;
    setSelected(null);
    setCorrectIndex(null);
    setPoints(0);
    setRemaining(TRIVIA_QUESTION_SECONDS);
    deadlineRef.current = Date.now() + TRIVIA_QUESTION_SECONDS * 1000;
    setPhase('playing');
  };

  const dateKey = dailyDateKey(new Date());

  if (phase === 'loading') {
    return (
      <div className="flex flex-col gap-5 rounded-lg border border-border bg-surface-raised p-4 sm:p-6 shadow-sm">
        <p className="text-body text-ink-muted">Loading {label} questions…</p>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="flex flex-col gap-5 rounded-lg border border-border bg-surface-raised p-4 sm:p-6 shadow-sm">
        <p className="text-body text-ink">{label} questions aren't ready yet.</p>
        <button
          type="button"
          onClick={onExit}
          className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary px-7 py-3 text-lg font-semibold text-white transition-colors hover:bg-primary-hover sm:self-start"
        >
          Pick another topic
        </button>
      </div>
    );
  }

  if (phase === 'done') {
    const correctCount = results.filter((result) => result.correct).length;
    return (
      <div className="flex flex-col gap-5 rounded-lg border border-border bg-surface-raised p-4 sm:p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-pill bg-primary/20 px-4 py-1.5 text-xs font-semibold text-primary-deep">
            {label}
          </span>
          <span className="rounded-pill bg-success-soft px-4 py-1.5 text-xs font-semibold text-success-strong">
            {correctCount}/{results.length} correct
          </span>
          {replay > 0 && (
            <span className="rounded-pill bg-tertiary/40 px-4 py-1.5 text-xs font-semibold text-ink">
              Fresh set #{replay}
            </span>
          )}
        </div>
        <h3 className="font-display text-h2 text-ink">You scored {totalScore}</h3>
        <p className="text-body text-ink-muted">
          {totalScore === 100
            ? 'A perfect game, every answer right.'
            : `${correctCount} of ${results.length} correct, ${totalScore} of 100 points.`}
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={newQuestions}
            className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary px-7 py-3 text-lg font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            New questions · fresh set
          </button>
          <button
            type="button"
            onClick={onExit}
            className="inline-flex min-h-12 items-center justify-center rounded-pill border border-primary bg-transparent px-7 py-3 text-lg font-semibold text-primary-strong transition-colors hover:bg-primary/15"
          >
            Pick another topic
          </button>
        </div>
      </div>
    );
  }

  const question = questions[index];
  const isRevealed = selected !== null || lockedRef.current;
  return (
    <div className="rounded-lg border border-border bg-surface-raised p-4 sm:p-6 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onExit}
          aria-label="Quit this round"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-transparent text-ink transition-colors hover:bg-surface-muted"
        >
          <Icon name="x" size={18} />
        </button>
        <span className="rounded-pill bg-primary/20 px-4 py-1.5 text-xs font-semibold text-primary-deep">
          {label}
        </span>
        <span className="rounded-pill bg-tertiary/40 px-4 py-1.5 text-xs font-semibold text-ink">
          Question {index + 1} of {questions.length}
        </span>
        <span
          aria-live="polite"
          className={`ml-auto rounded-pill px-4 py-1.5 font-mono text-sm font-semibold ${
            remaining <= 5
              ? 'bg-danger-soft text-danger-strong'
              : 'bg-success-soft text-success-strong'
          }`}
        >
          {remaining}s
        </span>
      </div>

      <h3 className="mt-4 text-lg font-bold tracking-tight text-ink">{question?.question}</h3>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {question?.options.map((option, optionIndex) => {
          const isCorrectOption = optionIndex === correctIndex;
          const isPicked = optionIndex === selected;
          let classes =
            'inline-flex min-h-14 items-center justify-center rounded-md border bg-transparent px-4 py-3 text-base font-semibold transition-colors sm:px-6 sm:text-lg';
          if (isRevealed) {
            if (isCorrectOption) {
              classes += ' border-success bg-success-soft text-success-strong';
            } else if (isPicked) {
              classes += ' border-danger bg-danger-soft text-danger-strong';
            } else {
              classes += ' border-border text-ink-muted opacity-60';
            }
          } else {
            classes += ' border-primary/50 text-primary-strong hover:bg-primary/15';
          }
          return (
            <button
              key={optionIndex}
              type="button"
              disabled={isRevealed}
              onClick={() => choose(optionIndex)}
              aria-pressed={isPicked}
              className={classes}
            >
              {option}
            </button>
          );
        })}
      </div>

      {isRevealed && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-body font-semibold text-ink">
            {points > 0
              ? `+${points} points`
              : selected === null
                ? 'Time up, 0 points'
                : 'No points'}
          </span>
          <button
            type="button"
            onClick={nextQuestion}
            className="ml-auto inline-flex min-h-12 items-center justify-center rounded-pill bg-primary px-7 py-3 text-lg font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            {index + 1 >= questions.length ? 'See results' : 'Next question'}
          </button>
        </div>
      )}
      <p className="mt-3 text-small text-ink-muted">{dateKey}</p>
    </div>
  );
}
