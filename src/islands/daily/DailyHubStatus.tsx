import { useEffect, useState } from 'react';
import { dailyDateKey } from '../../lib/trivia';
import {
  getLiveDailyGames,
  playedToday,
  readDailyHistory,
  type DailyHistory,
} from '../../lib/daily';
import { readStreak } from '../../lib/solo';
import {
  claimMember,
  ensureMemberKey,
  fetchMemberMe,
  readMemberKey,
  type MemberMe,
  type MemberStreak,
} from '../../lib/member';

/**
 * Daily hub status (Phase 1.5): members see server-synced streaks, freezes,
 * personal bests, and a 7-day strip from their daily runs; guests see the
 * device-bound streak layer with a one-tap conversion ask.
 */
export default function DailyHubStatus() {
  const [dateKey, setDateKey] = useState('');
  const [history, setHistory] = useState<DailyHistory>({});
  const [member, setMember] = useState<MemberMe | null>(null);
  const [memberKey, setMemberKey] = useState<string | null>(null);
  const [claimState, setClaimState] = useState<'idle' | 'claiming' | 'failed'>('idle');

  useEffect(() => {
    setDateKey(dailyDateKey(new Date()));
    setHistory(readDailyHistory());
    const key = readMemberKey();
    setMemberKey(key);
    if (key) {
      fetchMemberMe(key)
        .then(setMember)
        .catch(() => {
          // Server unreachable: fall back to the device layer.
        });
    }
  }, []);

  const claim = () => {
    if (claimState === 'claiming') {
      return;
    }
    setClaimState('claiming');
    const key = ensureMemberKey();
    setMemberKey(key);
    claimMember(key, 'Player')
      .then(() => fetchMemberMe(key))
      .then(setMember)
      .then(() => setClaimState('idle'))
      .catch(() => setClaimState('failed'));
  };

  if (!dateKey) {
    return null;
  }

  const live = getLiveDailyGames();

  if (member) {
    const grand = member.streaks.find((streak) => streak.scope === 'grand');
    const weekDays: string[] = [];
    const today = new Date(`${dateKey}T00:00:00Z`);
    for (let offset = 6; offset >= 0; offset -= 1) {
      const day = new Date(today);
      day.setUTCDate(day.getUTCDate() - offset);
      weekDays.push(day.toISOString().slice(0, 10));
    }
    const runDays = new Set(member.recentRuns.map((run) => run.dateKey));
    const streakFor = (slug: string): MemberStreak | undefined =>
      member.streaks.find((streak) => streak.scope === slug);

    return (
      <div className="flex flex-col gap-4 rounded-lg border-2 border-border bg-surface-raised p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-h3 text-ink">Welcome back, {member.profile.nickname}</h2>
          <span className="rounded-pill bg-primary/15 px-4 py-1 text-xs font-semibold text-primary-deep">
            {dateKey}
          </span>
        </div>

        <div className="flex flex-wrap gap-3">
          <span className="rounded-pill bg-warning-soft px-4 py-1.5 text-sm font-semibold text-warning-strong">
            🔥 Grand streak: {grand?.current ?? 0} days
          </span>
          {member.profile.streakFreezes > 0 && (
            <span className="rounded-pill bg-info-soft px-4 py-1.5 text-sm font-semibold text-info-strong">
              ❄️ {member.profile.streakFreezes} streak freeze
              {member.profile.streakFreezes === 1 ? '' : 's'}
            </span>
          )}
          {member.profile.restoreUsedSeason && (
            <span className="rounded-pill bg-surface-muted px-4 py-1.5 text-sm font-semibold text-ink-muted">
              Restore used for {member.profile.restoreUsedSeason}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {live.map((game) => {
            const streak = streakFor(game.slug);
            const best = member.personalBests.find((pb) => pb.gameId === game.slug);
            return (
              <span
                key={game.slug}
                className="inline-flex items-center gap-1.5 rounded-pill bg-surface-muted px-3 py-1.5 text-xs font-semibold text-ink"
              >
                {game.emoji} {streak?.current ?? 0}-day · best {best?.bestScore ?? '-'}
              </span>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5" aria-label="Last 7 days">
          {weekDays.map((day) => (
            <span
              key={day}
              title={day}
              aria-label={`${day}: ${runDays.has(day) ? 'played' : 'not played'}`}
              className={`h-3 w-3 rounded-full ${
                runDays.has(day) ? 'bg-success-strong' : 'bg-border-strong'
              }`}
            />
          ))}
          <span className="ml-2 text-xs text-ink-muted">last 7 days</span>
        </div>
      </div>
    );
  }

  // Guest view: device-bound streaks and the one-tap conversion ask.
  const played = playedToday(history, dateKey);
  const weekDays: string[] = [];
  const today = new Date(`${dateKey}T00:00:00Z`);
  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setUTCDate(day.getUTCDate() - offset);
    weekDays.push(day.toISOString().slice(0, 10));
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border-2 border-border bg-surface-raised p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-h3 text-ink">Your day at TriviaHub</h2>
        <span className="rounded-pill bg-primary/15 px-4 py-1 text-xs font-semibold text-primary-deep">
          {dateKey}
        </span>
      </div>

      {!played.length ? (
        <p className="text-body text-ink-muted">
          Nothing played yet today. Pick a daily game above, beat your streak, and own the
          leaderboard.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {live.map((game) => {
            const done = (history[game.slug] ?? {})[dateKey] !== undefined;
            const streak = readStreak(game.slug).count;
            return (
              <span
                key={game.slug}
                className={`inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs font-semibold ${
                  done ? 'bg-success-soft text-success-strong' : 'bg-surface-muted text-ink-muted'
                }`}
              >
                {game.emoji} {done ? 'Played' : 'Open'} · {streak} day streak
              </span>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-1.5" aria-label="Last 7 days">
        {weekDays.map((day) => {
          const playedThatDay = live.some((game) => (history[game.slug] ?? {})[day] !== undefined);
          return (
            <span
              key={day}
              title={day}
              aria-label={`${day}: ${playedThatDay ? 'played' : 'not played'}`}
              className={`h-3 w-3 rounded-full ${
                playedThatDay ? 'bg-success-strong' : 'bg-border-strong'
              }`}
            />
          );
        })}
        <span className="ml-2 text-xs text-ink-muted">last 7 days</span>
      </div>

      {!memberKey && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border-2 border-dashed border-border bg-surface-muted p-4">
          <p className="text-small text-ink-muted">
            Keep your streaks and history across devices, free. No account, one tap.
          </p>
          <button
            type="button"
            onClick={claim}
            disabled={claimState === 'claiming'}
            className="inline-flex min-h-11 items-center justify-center rounded-pill bg-secondary px-5 py-2.5 text-small font-semibold text-white shadow-teal transition-colors hover:bg-secondary-dark disabled:opacity-40"
          >
            {claimState === 'claiming' ? 'Saving…' : 'Keep my progress (free)'}
          </button>
        </div>
      )}
      {claimState === 'failed' && (
        <p role="alert" className="text-small font-semibold text-danger-strong">
          Couldn't save right now. Check the server and try again.
        </p>
      )}
    </div>
  );
}
