import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from 'react';
import {
  dailyDateKey,
  scoreTriviaAnswer,
  selectDailyQuestions,
  triviaClientKey,
  TRIVIA_QUESTION_SECONDS,
  type TriviaQuestion,
} from '../lib/trivia';
import { SERVER_URL, submitScore } from '../lib/api';

/**
 * Trivia — instant solo play (PRD §5.15, owner request 2026-08-04).
 * Plays the seeded daily challenge: the same 10 questions for everyone on
 * the same UTC day, 15s per question, speed bonus scoring, score submitted
 * to the global leaderboard with an idempotent clientKey.
 */

type Phase = 'setup' | 'playing' | 'done';

interface QuestionResult {
  category: string;
  correct: boolean;
  points: number;
}

const NICKNAME_STORAGE_KEY = 'partybrain:nickname';

export default function TriviaSolo() {
  const [phase, setPhase] = useState<Phase>('setup');
  const [nickname, setNickname] = useState(() =>
    typeof window === 'undefined' ? '' : (localStorage.getItem(NICKNAME_STORAGE_KEY) ?? '')
  );
  const [dateKey, setDateKey] = useState('');
  /** Server-seeded daily questions (M8); falls back to local selection. */
  const [dailyQuestions, setDailyQuestions] = useState<TriviaQuestion[] | null>(null);
  const [questions, setQuestions] = useState<TriviaQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(TRIVIA_QUESTION_SECONDS);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctIndex, setCorrectIndex] = useState<number | null>(null);
  const [points, setPoints] = useState(0);
  const [results, setResults] = useState<QuestionResult[]>([]);
  const [totalScore, setTotalScore] = useState(0);
  const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'saved' | 'failed'>(
    'idle'
  );

  const deadlineRef = useRef(0);
  const lockedRef = useRef(false);
  const clientKeyRef = useRef<string | null>(null);

  useEffect(() => {
    setDateKey(dailyDateKey(new Date()));
  }, []);

  // M8: the server seeds the daily challenge (same 10 questions for everyone);
  // keep the local deterministic selection as the offline fallback.
  useEffect(() => {
    let cancelled = false;
    fetch(`${SERVER_URL}/api/daily-challenge`)
      .then((response) => (response.ok ? response.json() : null))
      .then(
        (
          body: { challenges?: { gameId: string; data: { questions?: TriviaQuestion[] } }[] } | null
        ) => {
          if (cancelled) {
            return;
          }
          const challenge = body?.challenges?.find((entry) => entry.gameId === 'trivia');
          const seeded = challenge?.data?.questions;
          if (Array.isArray(seeded) && seeded.length > 0) {
            setDailyQuestions(seeded);
          }
        }
      )
      .catch(() => {
        // Offline/static preview — the local seed is fine.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const startGame = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = nickname.trim();
    if (!name) {
      return;
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem(NICKNAME_STORAGE_KEY, name);
    }
    setQuestions(dailyQuestions ?? selectDailyQuestions(new Date()));
    setIndex(0);
    setResults([]);
    setTotalScore(0);
    setSubmitState('idle');
    lockedRef.current = false;
    setSelected(null);
    setCorrectIndex(null);
    setPoints(0);
    setRemaining(TRIVIA_QUESTION_SECONDS);
    deadlineRef.current = Date.now() + TRIVIA_QUESTION_SECONDS * 1000;
    setPhase('playing');
  };

  /** Reveal the answer for the current question (picked = option index or null on timeout). */
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
      setResults((prev) => [
        ...prev,
        { category: question.category, correct: isCorrect, points: earned },
      ]);
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
      // `results` already includes the current question (reveal appends it).
      finish(results);
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

  /** Persist the final score once per completed game (idempotent clientKey). */
  const finish = (finalResults: QuestionResult[]) => {
    const score = finalResults.reduce((sum, result) => sum + result.points, 0);
    setTotalScore(score);
    setPhase('done');
    const playerName = nickname.trim() || 'Player';
    const clientKey = triviaClientKey(dateKey, playerName, crypto.randomUUID());
    clientKeyRef.current = clientKey;
    setSubmitState('submitting');
    submitScore({ gameId: 'trivia', playerName, score, clientKey })
      .then(() => setSubmitState('saved'))
      .catch(() => setSubmitState('failed'));
  };

  const retrySubmit = () => {
    const key = clientKeyRef.current;
    if (!key) {
      return;
    }
    setSubmitState('submitting');
    submitScore({
      gameId: 'trivia',
      playerName: nickname.trim() || 'Player',
      score: totalScore,
      clientKey: key,
    })
      .then(() => setSubmitState('saved'))
      .catch(() => setSubmitState('failed'));
  };

  const bestCategory = () => {
    const perCategory = new Map<string, { correct: number; total: number }>();
    for (const result of results) {
      const entry = perCategory.get(result.category) ?? { correct: 0, total: 0 };
      entry.total += 1;
      if (result.correct) {
        entry.correct += 1;
      }
      perCategory.set(result.category, entry);
    }
    let best: { category: string; correct: number } | null = null;
    for (const [category, entry] of perCategory) {
      if (!best || entry.correct > best.correct) {
        best = { category, correct: entry.correct };
      }
    }
    return best;
  };

  if (phase === 'setup') {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-pill bg-primary/20 px-4 py-1.5 text-xs font-semibold text-primary-deep">
            Daily challenge
          </span>
          <span className="rounded-pill bg-tertiary/40 px-4 py-1.5 text-xs font-semibold text-ink">
            {dateKey}
          </span>
        </div>
        <p className="max-w-2xl text-body text-ink-muted">
          {TRIVIA_QUESTION_SECONDS} seconds per question, {questions.length || 10} questions, speed
          bonus scoring. Same questions for everyone today — the leaderboard is the prize.
        </p>
        <form onSubmit={startGame} className="flex max-w-md flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-small font-semibold text-ink">Your nickname</span>
            <input
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              maxLength={20}
              placeholder="e.g. QuizWhiz"
              className="rounded-md border-2 border-gray-200 bg-white px-4 py-3 text-lg text-ink transition-colors hover:border-gray-400 focus:border-primary-strong focus:outline-none focus:ring-4 focus:ring-primary/25"
            />
          </label>
          <button
            type="submit"
            disabled={!nickname.trim()}
            className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary-strong px-7 py-3 text-lg font-semibold text-white shadow-coral transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-40"
          >
            Start the daily challenge
          </button>
        </form>
      </div>
    );
  }

  if (phase === 'done') {
    const best = bestCategory();
    const correctCount = results.filter((result) => result.correct).length;
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-pill bg-primary/20 px-4 py-1.5 text-xs font-semibold text-primary-deep">
            {dateKey}
          </span>
          <span className="rounded-pill bg-green-100 px-4 py-1.5 text-xs font-semibold text-green-800">
            {correctCount}/{results.length} correct
          </span>
        </div>
        <h3 className="font-display text-h2 text-ink">You scored {totalScore}</h3>
        {best && (
          <p className="text-body text-ink-muted">
            Best category: <span className="font-semibold text-ink">{best.category}</span> (
            {best.correct} correct)
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          {submitState === 'submitting' && (
            <span className="text-small text-ink-muted">Saving your score…</span>
          )}
          {submitState === 'saved' && (
            <span className="rounded-pill bg-green-100 px-4 py-1.5 text-xs font-semibold text-green-800">
              Score saved to the leaderboard
            </span>
          )}
          {submitState === 'failed' && (
            <button
              type="button"
              onClick={retrySubmit}
              className="rounded-pill border-3 border-primary bg-transparent px-4 py-2 text-small font-semibold text-primary-strong transition-colors hover:bg-primary/15"
            >
              Score not saved — tap to retry
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setPhase('setup')}
            className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary-strong px-7 py-3 text-lg font-semibold text-white shadow-coral transition-colors hover:bg-primary-hover"
          >
            Play again
          </button>
        </div>
      </div>
    );
  }

  const question = questions[index];
  const isRevealed = selected !== null || lockedRef.current;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-pill bg-primary/20 px-4 py-1.5 text-xs font-semibold text-primary-deep">
          Question {index + 1} of {questions.length}
        </span>
        <span className="rounded-pill bg-tertiary/40 px-4 py-1.5 text-xs font-semibold text-ink">
          {question?.category}
        </span>
        <span
          aria-live="polite"
          className={`ml-auto rounded-pill px-4 py-1.5 font-mono text-sm font-semibold ${
            remaining <= 5 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
          }`}
        >
          {remaining}s
        </span>
      </div>

      <h3 className="font-display text-h3 text-ink">{question?.question}</h3>

      <div className="grid gap-3 sm:grid-cols-2">
        {question?.options.map((option, optionIndex) => {
          const isCorrectOption = optionIndex === correctIndex;
          const isPicked = optionIndex === selected;
          let classes =
            'inline-flex min-h-14 items-center justify-center rounded-pill border-3 bg-transparent px-6 py-3 text-lg font-semibold transition-colors';
          if (isRevealed) {
            if (isCorrectOption) {
              classes += ' border-green-600 bg-green-100 text-green-900';
            } else if (isPicked) {
              classes += ' border-red-500 bg-red-100 text-red-800';
            } else {
              classes += ' border-gray-200 text-ink-muted opacity-60';
            }
          } else {
            classes +=
              ' border-primary/50 text-primary-strong hover:bg-primary/15 focus:border-primary-strong focus:outline-none focus:ring-4 focus:ring-primary/25';
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
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-body font-semibold text-ink">
            {points > 0
              ? `+${points} points`
              : selected === null
                ? 'Time up — 0 points'
                : 'No points'}
          </span>
          <button
            type="button"
            onClick={nextQuestion}
            className="ml-auto inline-flex min-h-12 items-center justify-center rounded-pill bg-primary-strong px-7 py-3 text-lg font-semibold text-white shadow-coral transition-colors hover:bg-primary-hover"
          >
            {index + 1 >= questions.length ? 'See results' : 'Next question'}
          </button>
        </div>
      )}
    </div>
  );
}
