import { useEffect, useState } from 'react';
import { dailyDateKey } from '../../lib/trivia';
import {
  getLiveDailyGames,
  playedToday,
  readDailyHistory,
  type DailyHistory,
} from '../../lib/daily';
import {
  claimMember,
  ensureMemberKey,
  fetchMemberMe,
  readMemberKey,
  type MemberMe,
} from '../../lib/member';
import Icon from '../../components/icons/Icon';

/**
 * Daily hub status ([R15] one-liner, CEO fix batch 2026-08-05): ONE line,
 * no container. Members see the grand streak + today's progress; guests see
 * today's progress plus the one-tap conversion CTA. The per-game streak
 * rows (multi-scope pills) are gone, per-game streaks live in each game's
 * own header (SoloShell). Member pipeline untouched.
 */
export default function DailyHubStatus() {
  const [dateKey, setDateKey] = useState('');
  const [history, setHistory] = useState<DailyHistory>({});
  const [member, setMember] = useState<MemberMe | null>(null);
  const [claimState, setClaimState] = useState<'idle' | 'claiming' | 'failed'>('idle');

  useEffect(() => {
    setDateKey(dailyDateKey(new Date()));
    setHistory(readDailyHistory());
    const key = readMemberKey();
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
  const total = live.length;
  const memberPlayedToday = member
    ? member.recentRuns.filter((run) => run.dateKey === dateKey).length
    : playedToday(history, dateKey).length;

  // [R15] one grand streak only; guests have no server streak scope yet.
  const grandStreak = member?.streaks.find((streak) => streak.scope === 'grand')?.current ?? 0;

  const line = member
    ? grandStreak > 0
      ? `${grandStreak}-day streak · ${memberPlayedToday} of ${total} challenges played today`
      : `Play 1 of ${total} challenges today to start a streak`
    : `${memberPlayedToday} of ${total} challenges played today`;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <p className="text-small font-medium text-ink">
        {grandStreak > 0 && (
          <Icon
            name="flame"
            size={14}
            className="mr-1 inline-block align-[-2px] text-primary-strong"
          />
        )}
        {line}
      </p>
      {!member && (
        <button
          type="button"
          onClick={claim}
          disabled={claimState === 'claiming'}
          className="inline-flex min-h-11 items-center justify-center rounded-pill bg-secondary px-5 py-2.5 text-small font-semibold text-white  transition-colors hover:bg-secondary-dark disabled:opacity-40"
        >
          {claimState === 'claiming' ? 'Saving…' : 'Keep my progress (free)'}
        </button>
      )}
      {claimState === 'failed' && (
        <p role="alert" className="text-small font-semibold text-danger-strong">
          Couldn't save right now. Check the server and try again.
        </p>
      )}
    </div>
  );
}
