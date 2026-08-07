import { useEffect, useState } from 'react';
import Icon from '../../components/icons/Icon';
import { dailyGames, readDailyHistory, type DailyHistory } from '../../lib/daily';
import { fetchMemberMe, readMemberKey, type MemberMe } from '../../lib/member';

/**
 * Daily archive (Phase 1.5): members see server-synced play history (last 90
 * days per game); guests see the device-bound history layer. Server history
 * survives browser clears, which is the point of membership.
 */
export default function DailyArchive() {
  const [history, setHistory] = useState<DailyHistory>({});
  const [member, setMember] = useState<MemberMe | null>(null);
  const [memberKey, setMemberKey] = useState<string | null>(null);

  useEffect(() => {
    const key = readMemberKey();
    setMemberKey(key);
    if (key) {
      fetchMemberMe(key)
        .then(setMember)
        .catch(() => setHistory(readDailyHistory()));
      return;
    }
    setHistory(readDailyHistory());
  }, []);

  const runsByGame = new Map<string, { dateKey: string; score: number }[]>();
  if (member) {
    for (const run of member.recentRuns) {
      const entries = runsByGame.get(run.gameId) ?? [];
      entries.push({ dateKey: run.dateKey, score: run.score });
      runsByGame.set(run.gameId, entries);
    }
  }

  const withPlays = member
    ? dailyGames.filter((game) => (runsByGame.get(game.slug) ?? []).length > 0)
    : dailyGames.filter((game) => Object.keys(history[game.slug] ?? {}).length > 0);

  if (withPlays.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border  border-border bg-surface-raised px-6 py-12 text-center">
        <span aria-hidden="true" className="text-5xl">
          📅
        </span>
        <h2 className="text-lg font-bold tracking-tight text-ink">No daily plays recorded yet</h2>
        <p className="max-w-md text-body text-ink-muted">
          Finish a daily game and your score for each day appears here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {member && memberKey && (
        <p className="text-small text-ink-muted">
          Synced to your member profile{member ? ` as ${member.profile.nickname}` : ''}. Clears on
          the server survive browser resets.
        </p>
      )}
      {withPlays.map((game) => {
        const days = member
          ? (runsByGame.get(game.slug) ?? []).sort((a, b) => b.dateKey.localeCompare(a.dateKey))
          : Object.entries(history[game.slug] ?? ({} as Record<string, number>))
              .map(([dateKey, score]) => ({ dateKey, score }))
              .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
        return (
          <section key={game.slug} aria-label={`${game.name} history`}>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold tracking-tight text-ink">
              <Icon name={game.emoji} size={18} className="text-ink-muted" />
              {game.name}
            </h2>
            <table className="w-full max-w-xl text-left text-small">
              <thead>
                <tr className="border-b-2 border-border text-xs uppercase tracking-wide text-ink-muted">
                  <th scope="col" className="pb-2 pr-4 font-semibold">
                    Date
                  </th>
                  <th scope="col" className="pb-2 font-semibold">
                    Score
                  </th>
                </tr>
              </thead>
              <tbody>
                {days.map((day) => (
                  <tr key={day.dateKey} className="border-b border-border">
                    <td className="py-2 pr-4 text-ink">{day.dateKey}</td>
                    <td className="py-2 font-mono font-semibold text-ink">{day.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}
