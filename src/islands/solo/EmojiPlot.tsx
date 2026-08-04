import { useCallback, useEffect, useState, type SyntheticEvent } from 'react';
import SoloShell from './SoloShell';
import TimerPicker from './TimerPicker';
import emojiPlotsJson from '../../data/emoji-plots.json';
import { useCountdown } from '../../lib/use-countdown';
import { readTimerSetting, saveTimerSetting } from '../../lib/solo';
import {
  EMOJI_TOTAL_QUESTIONS,
  encodeChallenge,
  judgeEmojiGuess,
  pickEmojiQuestions,
  revealedTitle,
  scoreEmojiGuess,
  type EmojiPlotEntry,
} from '../../lib/emoji-plot';
import { dailyGameSeed } from '../../lib/daily';

/**
 * Emoji Plot (M7, PRD §5.3; M14 owner fixes), decode movies and books from
 * emoji sequences. Hints are button-driven: a year hint and skribbl-style
 * progressive letter reveals; the clock starts only when the player starts.
 */

const entries = emojiPlotsJson as EmojiPlotEntry[];
const TIMER_OPTIONS = [20, 30, 40, 50];

type Phase = 'setup' | 'playing' | 'done';

interface Props {
  /** Phase A: when set, the day's content is deterministic for everyone. */
  dailyDateKey?: string;
}

export default function EmojiPlot({ dailyDateKey }: Props) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [timerSeconds, setTimerSeconds] = useState(() => readTimerSetting('emoji-plot', 30));
  const [questions, setQuestions] = useState<EmojiPlotEntry[]>([]);
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState('');
  const [feedback, setFeedback] = useState<{ correct: boolean; text: string } | null>(null);
  const [locked, setLocked] = useState(false);
  const [score, setScore] = useState(0);
  const [yearUsed, setYearUsed] = useState(false);
  const [lettersRevealed, setLettersRevealed] = useState(0);
  const [results, setResults] = useState<{ correct: boolean; points: number }[]>([]);
  const [challenge, setChallenge] = useState<{ emoji: string; title: string } | null>(null);
  const [challengeLink, setChallengeLink] = useState<string | null>(null);

  const question = questions[index];
  const remaining = useCountdown(
    phase === 'playing' && !locked && Boolean(question),
    timerSeconds,
    index
  );

  const start = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    saveTimerSetting('emoji-plot', timerSeconds);
    setQuestions(
      pickEmojiQuestions(
        entries,
        EMOJI_TOTAL_QUESTIONS,
        dailyDateKey ? dailyGameSeed(dailyDateKey, 'emoji-plot') : Math.floor(Math.random() * 1000)
      )
    );
    setIndex(0);
    setScore(0);
    setResults([]);
    setFeedback(null);
    setLocked(false);
    setYearUsed(false);
    setLettersRevealed(0);
    setDraft('');
    setPhase('playing');
  };

  // Timeout → reveal.
  useEffect(() => {
    if (phase === 'playing' && question && remaining === 0 && !locked) {
      setFeedback({ correct: false, text: `Time's up! It was “${question.title}”.` });
      setLocked(true);
    }
  }, [remaining, locked, question, phase]);

  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!question || locked) {
      return;
    }
    const guess = draft;
    if (!guess.trim()) {
      return;
    }
    const correct = judgeEmojiGuess(question, guess);
    const points = correct ? scoreEmojiGuess({ yearUsed, lettersRevealed }) : 0;
    setFeedback({
      correct,
      text: correct
        ? `“${question.title}”, +${points} points!`
        : `Not quite. It was “${question.title}”.`,
    });
    if (correct) {
      setScore((previous) => previous + points);
    }
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
    setYearUsed(false);
    setLettersRevealed(0);
    setLocked(false);
  }, [index, questions.length]);

  const playAgain = () => {
    setPhase('setup');
    setIndex(0);
    setScore(0);
    setResults([]);
    setFeedback(null);
    setYearUsed(false);
    setLettersRevealed(0);
    setLocked(false);
    setDraft('');
  };

  const buildChallenge = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!challenge || !challenge.emoji.trim() || !challenge.title.trim()) {
      return;
    }
    const encoded = encodeChallenge(challenge.emoji.trim(), challenge.title.trim());
    setChallengeLink(`${window.location.origin}/game/emoji-plot?challenge=${encoded}`);
  };

  if (phase === 'setup') {
    return (
      <form
        onSubmit={start}
        className="flex flex-col gap-5 rounded-lg border border-border bg-surface-raised p-4 sm:p-6 shadow-sm"
      >
        <h3 className="text-lg font-bold tracking-tight text-ink">Emoji Plot</h3>
        <p className="max-w-xl text-body text-ink-muted">
          Decode the movie or book from its emoji sequence. Hints are yours to take: reveal the year
          or letters of the title, each hint costs points. The clock starts when you do.
        </p>
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
        <div className="flex flex-col gap-3">
          <p className="text-body text-ink-muted">
            {results.filter((result) => result.correct).length} of {results.length} plots decoded
          </p>
          <div className="rounded-lg border  border-border p-4">
            <h3 className="text-lg font-bold tracking-tight text-ink">Create your own</h3>
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
                className="min-w-0 flex-1 rounded-md border border-border bg-surface-raised px-4 py-2.5 text-base text-ink transition-colors hover:border-border-strong focus:border-primary-strong focus:outline-none focus:ring-2 focus:ring-success/30"
              />
              <input
                value={challenge?.title ?? ''}
                onChange={(event) =>
                  setChallenge({ emoji: challenge?.emoji ?? '', title: event.target.value })
                }
                maxLength={80}
                placeholder="Harry Potter"
                aria-label="The answer title"
                className="min-w-0 flex-1 rounded-md border border-border bg-surface-raised px-4 py-2.5 text-base text-ink transition-colors hover:border-border-strong focus:border-primary-strong focus:outline-none focus:ring-2 focus:ring-success/30"
              />
              <button
                type="submit"
                className="inline-flex min-h-11 items-center justify-center rounded-pill border border-primary bg-transparent px-5 text-small font-semibold text-primary-strong transition-colors hover:bg-primary/15"
              >
                Create link
              </button>
            </form>
            {challengeLink && (
              <p
                role="status"
                className="mt-2 break-all text-small font-semibold text-success-strong"
              >
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
          <div className="rounded-lg border border-border bg-surface-raised p-4 sm:p-6 text-center shadow-sm">
            <p className="text-small font-semibold uppercase tracking-wide text-primary-deep">
              {question.kind === 'movie' ? 'Movie plot' : 'Book plot'}
            </p>
            <p
              className="mt-3 text-5xl leading-relaxed tracking-wider"
              aria-label={`Emoji sequence for ${question.title}`}
            >
              {question.emoji}
            </p>
            {lettersRevealed > 0 && (
              <p
                aria-live="polite"
                className="mt-3 font-mono text-2xl font-bold tracking-[0.2em] text-ink"
              >
                {revealedTitle(question.title, lettersRevealed)}
              </p>
            )}
            {yearUsed && (
              <p aria-live="polite" className="mt-2 text-small italic text-ink-muted">
                Hint: it's from {question.year}.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={locked || yearUsed}
              onClick={() => setYearUsed(true)}
              className="inline-flex min-h-11 items-center justify-center rounded-pill border border-border bg-surface-muted px-4 py-2 text-small font-semibold text-ink transition-colors hover:border-primary/50 disabled:pointer-events-none disabled:opacity-40"
            >
              📅 Reveal the year {yearUsed ? `(−50)` : '(−50 pts)'}
            </button>
            <button
              type="button"
              disabled={locked}
              onClick={() => setLettersRevealed((count) => count + 1)}
              className="inline-flex min-h-11 items-center justify-center rounded-pill border border-border bg-surface-muted px-4 py-2 text-small font-semibold text-ink transition-colors hover:border-primary/50 disabled:pointer-events-none disabled:opacity-40"
            >
              🔤 Reveal a letter {`(−10 pts each)`}
            </button>
          </div>
          <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={80}
              disabled={locked}
              placeholder="What's the title?"
              aria-label="Your guess"
              className="min-w-0 flex-1 rounded-md border border-border bg-surface-raised px-4 py-2.5 text-base text-ink transition-colors hover:border-border-strong focus:border-primary-strong focus:outline-none focus:ring-2 focus:ring-success/30"
            />
            <button
              type="submit"
              disabled={locked || !draft.trim()}
              className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary px-7 py-3 text-lg font-semibold text-white  transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-40"
            >
              Guess
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
              {index + 1 >= questions.length ? 'See my score' : 'Next plot'}
            </button>
          )}
        </>
      )}
    </SoloShell>
  );
}
