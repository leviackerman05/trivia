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
import { getDailyGame, recordDailyHistory } from '../../lib/daily';
import { claimMember, ensureMemberKey, readMemberKey, submitDailyRun } from '../../lib/member';
import { readNickname, writeNickname } from '../../lib/solo';
/**
 * Solo game shell (M7), shared presentational frame for every solo game:
 * header (round, score, daily streak), the game body, and the done view
 * (nickname → leaderboard submit → daily top-5 → share-result image →
 * play again). All persistence (streak, nickname, client key) lives here so
 * the four game islands stay focused on their own mechanics.
 */

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
  const [nickname, setNickname] = useState(() => readNickname());
  const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'saved' | 'failed'>(
    'idle'
  );
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [shareState, setShareState] = useState<'idle' | 'shared'>('idle');
  const [memberState, setMemberState] = useState<'guest' | 'claiming' | 'member' | 'failed'>(
    readMemberKey() ? 'member' : 'guest'
  );
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const clientKeyRef = useRef<string | null>(null);

  const dateKey = dailyDateKey(new Date());

  // On completion: bump the streak, generate the idempotency key, load the
  // daily leaderboard so the player can see where they'd land, and record
  // the local history entry for the daily hub.
  useEffect(() => {
    if (phase !== 'done') {
      return;
    }
    setStreak(registerStreak(slug).count);
    recordDailyHistory(slug, score, dateKey);
    clientKeyRef.current = soloClientKey(slug, dateKey, crypto.randomUUID());
    // Phase 1.5: members also record a server daily run (same clientKey),
    // which drives server streaks, history, and personal bests.
    const memberKey = readMemberKey();
    if (memberKey && getDailyGame(slug)?.live) {
      const key = clientKeyRef.current;
      void submitDailyRun({
        gameId: slug,
        memberKey,
        playerName: readNickname() || 'Player',
        score,
        clientKey: key,
      }).catch(() => {
        // The run is best-effort; the leaderboard save is the source of truth.
      });
    }
    void fetchLeaderboard(slug, 'daily', 5)
      .then((response) => setLeaderboard(response.entries))
      .catch(() => setLeaderboard([]));
  }, [phase, slug, dateKey, score]);

  const saveScore = useCallback(async () => {
    const trimmed = nickname.trim();
    if (!trimmed || !clientKeyRef.current || submitState === 'saved') {
      return;
    }
    if (typeof window !== 'undefined') {
      writeNickname(trimmed);
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

  /** One-tap guest to member conversion (Phase 1.5, D047). */
  const keepProgress = () => {
    if (memberState !== 'guest') {
      return;
    }
    setMemberState('claiming');
    claimMember(ensureMemberKey(), nickname.trim() || readNickname() || 'Player')
      .then(() => setMemberState('member'))
      .catch(() => setMemberState('failed'));
  };

  const isClaiming = memberState === 'claiming';

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-pill bg-primary/20 px-5 py-2 text-lg font-semibold text-primary-deep">
          {name}
        </span>
        {phase === 'playing' && (
          <span className="rounded-pill bg-success-soft px-4 py-1.5 text-xs font-semibold text-success-strong">
            Round {round} of {totalRounds}
          </span>
        )}
        <span className="rounded-pill bg-tertiary/40 px-4 py-1.5 text-xs font-semibold text-ink">
          Score: {score}
        </span>
        {streak > 0 && (
          <span className="rounded-pill bg-amber-100 px-4 py-1.5 text-xs font-semibold text-warning-strong">
            🔥 {streak}-day streak
          </span>
        )}
        {headerExtra}
      </div>

      {phase === 'playing' ? (
        <div className="flex flex-col gap-4">{children}</div>
      ) : (
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface-raised p-4 sm:p-6 shadow-sm">
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
                  className="min-w-0 rounded-md border border-border bg-surface-raised px-4 py-2.5 text-base text-ink transition-colors hover:border-border-strong focus:border-primary-strong focus:outline-none focus:ring-2 focus:ring-success/30 sm:w-72"
                />
              </label>
              <button
                type="submit"
                disabled={submitState === 'submitting' || !nickname.trim()}
                className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary px-7 py-3 text-lg font-semibold text-white  transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-40"
              >
                {submitState === 'submitting' ? 'Saving…' : 'Save my score'}
              </button>
            </form>
          ) : (
            <p role="status" className="text-small font-semibold text-success-strong">
              Score saved to the daily leaderboard!
            </p>
          )}
          {submitState === 'failed' && (
            <p role="alert" className="text-small font-semibold text-danger-strong">
              Couldn't save right now, check the server and try again.
            </p>
          )}

          {memberState === 'guest' && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border  border-border bg-surface-muted p-4">
              <p className="text-small text-ink-muted">
                Keep your streak and play history across devices, free. No account, one tap.
              </p>
              <button
                type="button"
                onClick={keepProgress}
                disabled={isClaiming}
                className="inline-flex min-h-11 items-center justify-center rounded-pill bg-secondary px-5 py-2.5 text-small font-semibold text-white  transition-colors hover:bg-secondary-dark disabled:opacity-40"
              >
                {isClaiming ? 'Saving…' : 'Keep my progress (free)'}
              </button>
            </div>
          )}
          {memberState === 'member' && (
            <p role="status" className="text-small font-semibold text-success-strong">
              Progress saved! Your streak and history are now synced.
            </p>
          )}
          {memberState === 'failed' && (
            <p role="alert" className="text-small font-semibold text-danger-strong">
              Couldn't save right now. Check the server and try again.
            </p>
          )}

          {leaderboard.length > 0 && (
            <div className="rounded-lg border border-border p-4">
              <h3 className="mb-2 text-lg font-bold tracking-tight text-ink">Today's top scores</h3>
              <ol className="flex flex-col divide-y divide-border">
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
              className="inline-flex min-h-11 items-center justify-center rounded-pill border border-primary bg-transparent px-5 text-small font-semibold text-primary-strong transition-colors hover:bg-primary/15"
            >
              {shareState === 'shared' ? 'Image downloaded ✓' : 'Share my score'}
            </button>
            <button
              type="button"
              onClick={onPlayAgain}
              className="inline-flex min-h-12 items-center justify-center rounded-pill bg-secondary px-7 py-3 text-lg font-semibold text-white  transition-colors hover:bg-secondary-dark"
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
