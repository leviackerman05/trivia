import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  dailyDateKey,
  drawScoreImage,
  downloadCanvas,
  readStreak,
  registerStreak,
  soloClientKey,
} from '../../lib/solo';
import { fetchLeaderboard, submitScore, type LeaderboardEntry } from '../../lib/api';

/**
 * Solo game shell (M7) — shared presentational frame for every solo game:
 * header (round, score, daily streak), the game body, and the done view
 * (nickname → leaderboard submit → daily top-5 → share-result image →
 * play again). All persistence (streak, nickname, client key) lives here so
 * the four game islands stay focused on their own mechanics.
 */

const NICKNAME_STORAGE_KEY = 'partybrain:nickname';

export type SoloPhase = 'playing' | 'done';

interface SoloShellProps {
  slug: string;
  name: string;
  phase: SoloPhase;
  round: number;
  totalRounds: number;
  score: number;
  /** Extra status pills rendered in the header (e.g. the round timer). */
  headerExtra?: ReactNode;
  /** The game body (question + input + feedback). */
  children: ReactNode;
  /** Game-specific stats for the done view. */
  resultSummary?: ReactNode;
  onPlayAgain: () => void;
}

export default function SoloShell({
  slug,
  name,
  phase,
  round,
  totalRounds,
  score,
  headerExtra,
  children,
  resultSummary,
  onPlayAgain,
}: SoloShellProps) {
  const [streak, setStreak] = useState(() => readStreak(slug).count);
  const [nickname, setNickname] = useState(() =>
    typeof window === 'undefined' ? '' : (localStorage.getItem(NICKNAME_STORAGE_KEY) ?? '')
  );
  const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'saved' | 'failed'>(
    'idle'
  );
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [shareState, setShareState] = useState<'idle' | 'shared'>('idle');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const clientKeyRef = useRef<string | null>(null);

  const dateKey = dailyDateKey(new Date());

  // On completion: bump the streak, generate the idempotency key, load the
  // daily leaderboard so the player can see where they'd land.
  useEffect(() => {
    if (phase !== 'done') {
      return;
    }
    setStreak(registerStreak(slug).count);
    clientKeyRef.current = soloClientKey(slug, dateKey, crypto.randomUUID());
    void fetchLeaderboard(slug, 'daily', 5)
      .then((response) => setLeaderboard(response.entries))
      .catch(() => setLeaderboard([]));
  }, [phase, slug, dateKey]);

  const saveScore = useCallback(async () => {
    const trimmed = nickname.trim();
    if (!trimmed || !clientKeyRef.current || submitState === 'saved') {
      return;
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem(NICKNAME_STORAGE_KEY, trimmed);
    }
    setSubmitState('submitting');
    try {
      await submitScore({
        gameId: slug,
        playerName: trimmed,
        score,
        clientKey: clientKeyRef.current,
      });
      setSubmitState('saved');
      const response = await fetchLeaderboard(slug, 'daily', 5);
      setLeaderboard(response.entries);
    } catch {
      setSubmitState('failed');
    }
  }, [nickname, slug, score, submitState]);

  const shareResult = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    drawScoreImage(canvas, {
      gameName: name,
      score,
      playerName: nickname.trim() || 'Player',
      dateKey,
    });
    downloadCanvas(canvas, slug);
    setShareState('shared');
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-pill bg-primary/20 px-5 py-2 text-lg font-semibold text-primary-deep">
          {name}
        </span>
        {phase === 'playing' && (
          <span className="rounded-pill bg-green-100 px-4 py-1.5 text-xs font-semibold text-green-800">
            Round {round} of {totalRounds}
          </span>
        )}
        <span className="rounded-pill bg-tertiary/40 px-4 py-1.5 text-xs font-semibold text-ink">
          Score: {score}
        </span>
        {streak > 0 && (
          <span className="rounded-pill bg-amber-100 px-4 py-1.5 text-xs font-semibold text-amber-800">
            🔥 {streak}-day streak
          </span>
        )}
        {headerExtra}
      </div>

      {phase === 'playing' ? (
        <div className="flex flex-col gap-4">{children}</div>
      ) : (
        <div className="flex flex-col gap-4 rounded-lg border-2 border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="font-display text-h2 text-ink">Game over!</h2>
          <p className="text-body text-ink-muted">
            You scored <span className="font-display text-h3 text-primary-deep">{score}</span>{' '}
            points.
          </p>
          {resultSummary}

          {submitState !== 'saved' ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void saveScore();
              }}
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
            >
              <label className="flex flex-col gap-1">
                <span className="text-small font-semibold text-ink">Nickname</span>
                <input
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  maxLength={20}
                  placeholder="Your name on the leaderboard"
                  aria-label="Nickname"
                  className="min-w-0 rounded-md border-2 border-gray-200 bg-white px-4 py-2.5 text-lg text-ink transition-colors hover:border-gray-400 focus:border-primary-strong focus:outline-none focus:ring-4 focus:ring-primary/25 sm:w-72"
                />
              </label>
              <button
                type="submit"
                disabled={submitState === 'submitting' || !nickname.trim()}
                className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary-strong px-7 py-3 text-lg font-semibold text-white shadow-coral transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-40"
              >
                {submitState === 'submitting' ? 'Saving…' : 'Save my score'}
              </button>
            </form>
          ) : (
            <p role="status" className="text-small font-semibold text-green-700">
              Score saved to the daily leaderboard!
            </p>
          )}
          {submitState === 'failed' && (
            <p role="alert" className="text-small font-semibold text-red-700">
              Couldn't save right now — check the server and try again.
            </p>
          )}

          {leaderboard.length > 0 && (
            <div className="rounded-lg border-2 border-gray-100 p-4">
              <h3 className="mb-2 font-display text-h4 text-ink">Today's top scores</h3>
              <ol className="flex flex-col divide-y-2 divide-dashed divide-gray-100">
                {leaderboard.map((entry) => (
                  <li
                    key={entry.rank}
                    className="flex min-h-9 items-center justify-between px-2 text-body text-ink"
                  >
                    <span className="font-semibold">
                      {entry.rank}. {entry.playerName}
                    </span>
                    <span className="text-ink-muted">{entry.score}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={shareResult}
              className="inline-flex min-h-11 items-center justify-center rounded-pill border-3 border-primary bg-transparent px-5 text-small font-semibold text-primary-strong transition-colors hover:bg-primary/15"
            >
              {shareState === 'shared' ? 'Image downloaded ✓' : 'Share my score'}
            </button>
            <button
              type="button"
              onClick={onPlayAgain}
              className="inline-flex min-h-12 items-center justify-center rounded-pill bg-secondary px-7 py-3 text-lg font-semibold text-white shadow-teal transition-colors hover:bg-secondary-dark"
            >
              Play again
            </button>
          </div>
          <canvas ref={canvasRef} hidden aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
