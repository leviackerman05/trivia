import { useCallback, useState } from 'react';
import SoloShell from '../solo/SoloShell';
import musicJson from '../../data/daily-music.json';
import { dailyGameSeed } from '../../lib/daily';
import { dailyDateKey } from '../../lib/trivia';
import { MUSIC_ROUNDS_PER_DAY, pickMusicRounds, type MusicRound } from '../../lib/music';
import { DECADE_PRESETS, filterByDecade } from '../../lib/decade';
import DecadeChips from '../../components/DecadeChips';

/**
 * Daily Music — "Name That Song" (DAILY-DESIGN §3.3).
 * 10 rounds; the clue strip is emoji + year + BPM (no audio, no lyrics, no
 * album art — licensing walls). 4 title options; feedback names song +
 * artist; 100 per correct.
 */

const entries = musicJson as Parameters<typeof pickMusicRounds>[0];

type Phase = 'setup' | 'playing' | 'done';
type RoundState = 'answering' | 'revealed';

interface Props {
  /** Phase A: when set, the day's content is deterministic for everyone. */
  dailyDateKey?: string;
}

export default function MusicDaily({ dailyDateKey: dateKeyProp }: Props) {
  const dateKey = dateKeyProp ?? dailyDateKey(new Date());
  const [phase, setPhase] = useState<Phase>('setup');
  const [decade, setDecade] = useState<number | null>(null);
  const [rounds, setRounds] = useState<MusicRound[]>([]);
  const [index, setIndex] = useState(0);
  const [roundState, setRoundState] = useState<RoundState>('answering');
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [feedback, setFeedback] = useState<{ correct: boolean; text: string } | null>(null);

  const round = rounds[index];

  // [R8] empty-decade guard: a preset renders only when its filtered pool
  // can fill a full round; "All" always renders.
  const availablePresets = DECADE_PRESETS.filter(
    (preset) =>
      preset === null ||
      filterByDecade(entries, preset, (entry) => entry.year).length >= MUSIC_ROUNDS_PER_DAY
  );

  const start = () => {
    // [R8] filter BEFORE seeding: same (day, filter) ⇒ same rounds.
    const pool = filterByDecade(entries, decade, (entry) => entry.year);
    setRounds(pickMusicRounds(pool, MUSIC_ROUNDS_PER_DAY, dailyGameSeed(dateKey, 'music')));
    setIndex(0);
    setScore(0);
    setCorrect(0);
    setFeedback(null);
    setRoundState('answering');
    setPhase('playing');
  };

  const answer = (optionIndex: number) => {
    if (!round || roundState === 'revealed') {
      return;
    }
    const wasCorrect = optionIndex === round.answer;
    if (wasCorrect) {
      setScore((previous) => previous + 100);
      setCorrect((previous) => previous + 1);
    }
    setFeedback({ correct: wasCorrect, text: `${round.title} — ${round.artist}` });
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
        <h3 className="text-lg font-bold tracking-tight text-ink">Daily Music</h3>
        <p className="max-w-xl text-body text-ink-muted">
          Name that song from emoji, year, and BPM clues. Ten rounds, four options each, no audio
          needed — just music knowledge.
        </p>
        {/* [R8] decade filter on the setup card, before Start. */}
        <DecadeChips presets={availablePresets} value={decade} onChange={setDecade} />
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
      slug="music"
      name="Daily Music"
      phase={phase}
      round={Math.min(index + 1, rounds.length)}
      totalRounds={rounds.length}
      score={score}
      correctCount={correct}
      totalCount={rounds.length}
      resultSummary={
        <p className="text-body text-ink-muted">
          {correct} of {rounds.length} songs named
        </p>
      }
      onPlayAgain={playAgain}
    >
      {round && (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-border bg-surface-raised p-4 sm:p-6 text-center shadow-sm">
            <p
              className="text-5xl leading-relaxed tracking-wider"
              aria-label={`Clues for round ${index + 1}`}
            >
              {round.emoji}
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <span className="rounded-pill bg-primary/20 px-4 py-1.5 text-sm font-semibold text-primary-deep">
                From {round.year}
              </span>
              <span className="rounded-pill bg-tertiary/40 px-4 py-1.5 text-sm font-semibold text-ink">
                {round.bpm} BPM
              </span>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {round.options.map((option, optionIndex) => (
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
              {index + 1 >= rounds.length ? 'See my score' : 'Next song'}
            </button>
          )}
        </div>
      )}
    </SoloShell>
  );
}
