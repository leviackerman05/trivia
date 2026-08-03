import { useCallback, useEffect, useRef, useState } from 'react';
import SoloShell from './SoloShell';
import genreSwapsJson from '../../data/genre-swaps.json';
import {
  GENRE_SWAP_SECONDS,
  GENRE_SWAP_TOTAL_QUESTIONS,
  genreSwapOptions,
  judgeGenreSwap,
  pickGenreSwapQuestions,
  type GenreSwapEntry,
} from '../../lib/genre-swap';

/**
 * Genre Swap (M8, PRD §5.9) — a famous movie plot rewritten in a wildly
 * wrong genre; pick the original from four options. 10 questions × 20s,
 * +10 correct with a +5 speed bonus under 10s.
 */

const entries = genreSwapsJson as GenreSwapEntry[];
const allOriginals = entries.map((entry) => entry.original);

export default function GenreSwap() {
  const [questions, setQuestions] = useState<GenreSwapEntry[]>([]);
  const [index, setIndex] = useState(0);
  const [options, setOptions] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{ correct: boolean; text: string } | null>(null);
  const [locked, setLocked] = useState(false);
  const [score, setScore] = useState(0);
  const [results, setResults] = useState<{ correct: boolean; points: number }[]>([]);
  const [phase, setPhase] = useState<'playing' | 'done'>('playing');
  const [, setTick] = useState(0);
  const deadlineRef = useRef(0);
  const lockedRef = useRef(false);

  const question = questions[index];

  useEffect(() => {
    const seed = Math.floor(Math.random() * 1000);
    const picked = pickGenreSwapQuestions(entries, GENRE_SWAP_TOTAL_QUESTIONS, seed);
    setQuestions(picked);
    if (picked[0]) {
      setOptions(genreSwapOptions(picked[0], allOriginals));
    }
  }, []);

  useEffect(() => {
    if (phase !== 'playing' || !question || locked) {
      return;
    }
    deadlineRef.current = Date.now() + GENRE_SWAP_SECONDS * 1000;
    const id = setInterval(() => setTick((tick) => tick + 1), 500);
    return () => clearInterval(id);
  }, [phase, question, locked, index]);

  const remaining = question
    ? Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000))
    : 0;

  useEffect(() => {
    if (phase === 'playing' && question && remaining === 0 && !locked) {
      setFeedback({
        correct: false,
        text: `Time's up! It was “${question.original}” (as a ${question.genre.toLowerCase()} tale).`,
      });
      setLocked(true);
      lockedRef.current = true;
    }
  }, [remaining, locked, question, phase]);

  const choose = (picked: string) => {
    if (!question || locked || lockedRef.current) {
      return;
    }
    lockedRef.current = true;
    const remainingMs = Math.max(0, deadlineRef.current - Date.now());
    const elapsed = Math.min(GENRE_SWAP_SECONDS * 1000, GENRE_SWAP_SECONDS * 1000 - remainingMs);
    const verdict = judgeGenreSwap(picked, question.original, elapsed);
    setFeedback({
      correct: verdict.correct,
      text: verdict.correct
        ? `“${question.original}” — +${verdict.points} points!`
        : `Not quite — it was “${question.original}”.`,
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
    setOptions(nextQuestion ? genreSwapOptions(nextQuestion, allOriginals) : []);
    setFeedback(null);
    setLocked(false);
    lockedRef.current = false;
  }, [index, questions]);

  const playAgain = () => {
    const seed = Math.floor(Math.random() * 1000);
    const picked = pickGenreSwapQuestions(entries, GENRE_SWAP_TOTAL_QUESTIONS, seed);
    setQuestions(picked);
    setOptions(picked[0] ? genreSwapOptions(picked[0], allOriginals) : []);
    setIndex(0);
    setScore(0);
    setResults([]);
    setFeedback(null);
    setLocked(false);
    lockedRef.current = false;
    setPhase('playing');
  };

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
              remaining <= 5 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
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
          <div className="rounded-lg border-2 border-gray-200 bg-white p-6 shadow-sm">
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
                  className={`min-h-14 rounded-lg border-3 px-5 py-3 text-left text-lg font-semibold transition-all disabled:cursor-default ${
                    isCorrect
                      ? 'border-green-400 bg-green-50 text-green-800'
                      : 'border-gray-200 bg-white text-ink hover:border-primary hover:bg-primary/5'
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
              className={`rounded-md border-2 px-4 py-2 text-body font-semibold ${
                feedback.correct
                  ? 'border-green-300 bg-green-50 text-green-700'
                  : 'border-red-300 bg-red-50 text-red-700'
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
              {index + 1 >= questions.length ? 'See my score' : 'Next plot'}
            </button>
          )}
        </>
      )}
    </SoloShell>
  );
}
