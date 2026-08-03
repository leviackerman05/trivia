import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from 'react';
import SoloShell from './SoloShell';
import emojiPlotsJson from '../../data/emoji-plots.json';
import {
  EMOJI_PLOT_SECONDS,
  EMOJI_TOTAL_QUESTIONS,
  encodeChallenge,
  firstLetterHint,
  hintLevelAt,
  judgeEmojiGuess,
  pickEmojiQuestions,
  scoreEmojiGuess,
  type EmojiHintLevel,
  type EmojiPlotEntry,
} from '../../lib/emoji-plot';

/**
 * Emoji Plot (M7, PRD §5.3) — decode movies and books from emoji sequences.
 * 10 questions × 30s; the year hint appears at 15s and the first letter at
 * 25s; scoring is 100 / 50 / 25 by hint level. "Create your own" builds a
 * shareable challenge link (answer base64-obfuscated).
 */

const entries = emojiPlotsJson as EmojiPlotEntry[];

export default function EmojiPlot() {
  const [questions, setQuestions] = useState<EmojiPlotEntry[]>([]);
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState('');
  const [feedback, setFeedback] = useState<{ correct: boolean; text: string } | null>(null);
  const [locked, setLocked] = useState(false);
  const [score, setScore] = useState(0);
  const [hintLevel, setHintLevel] = useState<EmojiHintLevel>('none');
  const [results, setResults] = useState<{ correct: boolean; points: number }[]>([]);
  const [phase, setPhase] = useState<'playing' | 'done'>('playing');
  // Tick state only forces re-renders so the countdown/hints refresh.
  const [, setTick] = useState(0);
  const [challenge, setChallenge] = useState<{ emoji: string; title: string } | null>(null);
  const [challengeLink, setChallengeLink] = useState<string | null>(null);
  const startedAtRef = useRef(0);
  const submittedRef = useRef(false);

  const question = questions[index];

  useEffect(() => {
    setQuestions(
      pickEmojiQuestions(entries, EMOJI_TOTAL_QUESTIONS, Math.floor(Math.random() * 1000))
    );
  }, []);

  useEffect(() => {
    if (phase !== 'playing' || !question || locked) {
      return;
    }
    startedAtRef.current = Date.now();
    const id = setInterval(() => setTick((tick) => tick + 1), 500);
    return () => clearInterval(id);
  }, [phase, question, locked, index]);

  const elapsed = question ? Date.now() - startedAtRef.current : 0;
  const remaining = question
    ? Math.max(0, Math.ceil((EMOJI_PLOT_SECONDS * 1000 - elapsed) / 1000))
    : 0;

  // Progressive hints: year at 15s, first letter at 25s.
  useEffect(() => {
    if (phase !== 'playing' || locked) {
      return;
    }
    setHintLevel(hintLevelAt(elapsed));
  }, [elapsed, phase, locked]);

  // Timeout → reveal.
  useEffect(() => {
    if (phase === 'playing' && question && remaining === 0 && !locked) {
      setFeedback({ correct: false, text: `Time's up! It was “${question.title}”.` });
      setLocked(true);
    }
  }, [remaining, locked, question, phase]);

  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!question || locked || submittedRef.current) {
      return;
    }
    submittedRef.current = true;
    const level = hintLevelAt(Math.min(elapsed, EMOJI_PLOT_SECONDS * 1000));
    const correct = judgeEmojiGuess(question, draft, level);
    const points = correct ? scoreEmojiGuess(level) : 0;
    setFeedback({
      correct,
      text: correct
        ? `“${question.title}” — +${points} points!`
        : `Not quite. It was “${question.title}”.`,
    });
    setScore((previous) => previous + points);
    setResults((previous) => [...previous, { correct, points }]);
    setLocked(true);
  };

  const next = useCallback(() => {
    if (index + 1 >= questions.length) {
      setPhase('done');
      return;
    }
    setIndex((previous) => previous + 1);
    setDraft('');
    setFeedback(null);
    setHintLevel('none');
    setLocked(false);
    submittedRef.current = false;
  }, [index, questions.length]);

  const playAgain = () => {
    setQuestions(
      pickEmojiQuestions(entries, EMOJI_TOTAL_QUESTIONS, Math.floor(Math.random() * 1000))
    );
    setIndex(0);
    setScore(0);
    setResults([]);
    setFeedback(null);
    setHintLevel('none');
    setLocked(false);
    submittedRef.current = false;
    setPhase('playing');
  };

  const buildChallenge = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!challenge || !challenge.emoji.trim() || !challenge.title.trim()) {
      return;
    }
    const encoded = encodeChallenge(challenge.emoji.trim(), challenge.title.trim());
    setChallengeLink(`${window.location.origin}/game/emoji-plot?challenge=${encoded}`);
  };

  return (
    <SoloShell
      slug="emoji-plot"
      name="Emoji Plot"
      phase={phase}
      round={Math.min(index + 1, questions.length)}
      totalRounds={questions.length || EMOJI_TOTAL_QUESTIONS}
      score={score}
      headerExtra={
        phase === 'playing' ? (
          <span
            aria-live="polite"
            className={`rounded-pill px-4 py-1.5 font-mono text-sm font-semibold ${
              remaining <= 10 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
            }`}
          >
            {remaining}s
          </span>
        ) : undefined
      }
      resultSummary={
        <div className="flex flex-col gap-3">
          <p className="text-body text-ink-muted">
            {results.filter((result) => result.correct).length} of {results.length} plots decoded
          </p>
          <div className="rounded-lg border-2 border-dashed border-gray-300 p-4">
            <h3 className="font-display text-h4 text-ink">Create your own</h3>
            <p className="mt-1 text-small text-ink-muted">
              Make an emoji plot and challenge a friend with a shareable link.
            </p>
            <form onSubmit={buildChallenge} className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                value={challenge?.emoji ?? ''}
                onChange={(event) =>
                  setChallenge({ emoji: event.target.value, title: challenge?.title ?? '' })
                }
                maxLength={40}
                placeholder="👦⚡🧙🏰"
                aria-label="Your emoji sequence"
                className="min-w-0 flex-1 rounded-md border-2 border-gray-200 bg-white px-4 py-2.5 text-lg text-ink transition-colors hover:border-gray-400 focus:border-primary-strong focus:outline-none focus:ring-4 focus:ring-primary/25"
              />
              <input
                value={challenge?.title ?? ''}
                onChange={(event) =>
                  setChallenge({ emoji: challenge?.emoji ?? '', title: event.target.value })
                }
                maxLength={80}
                placeholder="Harry Potter"
                aria-label="The answer title"
                className="min-w-0 flex-1 rounded-md border-2 border-gray-200 bg-white px-4 py-2.5 text-lg text-ink transition-colors hover:border-gray-400 focus:border-primary-strong focus:outline-none focus:ring-4 focus:ring-primary/25"
              />
              <button
                type="submit"
                className="inline-flex min-h-11 items-center justify-center rounded-pill border-3 border-primary bg-transparent px-5 text-small font-semibold text-primary-strong transition-colors hover:bg-primary/15"
              >
                Create link
              </button>
            </form>
            {challengeLink && (
              <p role="status" className="mt-2 break-all text-small font-semibold text-green-700">
                <a href={challengeLink} className="underline">
                  {challengeLink}
                </a>
              </p>
            )}
          </div>
        </div>
      }
      onPlayAgain={playAgain}
    >
      {question && (
        <>
          <div className="rounded-lg border-2 border-gray-200 bg-white p-6 text-center shadow-sm">
            <p className="text-small font-semibold uppercase tracking-wide text-primary-deep">
              {question.kind === 'movie' ? 'Movie plot' : 'Book plot'} · {question.year}
            </p>
            <p
              className="mt-3 text-5xl leading-relaxed tracking-wider"
              aria-label={`Emoji sequence for ${question.title}`}
            >
              {question.emoji}
            </p>
            {hintLevel === 'letter' && (
              <p aria-live="polite" className="mt-2 text-body font-semibold text-ink">
                First letter:{' '}
                <span className="font-mono text-xl">{firstLetterHint(question.title)}</span>
              </p>
            )}
            {hintLevel === 'year' && (
              <p aria-live="polite" className="mt-2 text-small italic text-ink-muted">
                Hint: it's from {question.year}.
              </p>
            )}
          </div>
          <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={80}
              disabled={locked}
              placeholder="What's the title?"
              aria-label="Your guess"
              className="min-w-0 flex-1 rounded-md border-2 border-gray-200 bg-white px-4 py-2.5 text-lg text-ink transition-colors hover:border-gray-400 focus:border-primary-strong focus:outline-none focus:ring-4 focus:ring-primary/25"
            />
            <button
              type="submit"
              disabled={locked || !draft.trim()}
              className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary-strong px-7 py-3 text-lg font-semibold text-white shadow-coral transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-40"
            >
              Guess
            </button>
          </form>
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
