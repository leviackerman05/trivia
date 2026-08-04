import { useEffect, useState } from 'react';
import { getGame } from '../lib/games';
import { readDailyHistory } from '../lib/daily';

/**
 * Recently played (Phase 0/1): the client-side play history (daily and solo
 * plays) rendered as compact links. Multiplayer history arrives with the
 * identity milestone; this is the honest local version.
 */
export default function RecentlyPlayed() {
  const [recentSlugs, setRecentSlugs] = useState<string[]>([]);

  useEffect(() => {
    const history = readDailyHistory();
    const byDate: { slug: string; date: string }[] = [];
    for (const [slug, days] of Object.entries(history)) {
      const lastDate = Object.keys(days).sort().at(-1);
      if (lastDate) {
        byDate.push({ slug, date: lastDate });
      }
    }
    byDate.sort((a, b) => b.date.localeCompare(a.date));
    setRecentSlugs(byDate.slice(0, 6).map((entry) => entry.slug));
  }, []);

  const recentGames = recentSlugs.map((slug) => getGame(slug)).filter((game) => game !== undefined);

  if (recentGames.length === 0) {
    return (
      <p className="text-body text-ink-muted">
        Nothing played yet. Finish a solo or daily game and it shows up here.
      </p>
    );
  }

  return (
    <ul className="flex flex-wrap gap-3">
      {recentGames.map((game) => (
        <li key={game.slug}>
          <a
            href={game.instantPlay ? `/game/${game.slug}` : `/game/${game.slug}`}
            className="inline-flex items-center gap-2 rounded-pill border-2 border-border bg-surface-raised px-4 py-2 text-small font-semibold text-ink transition-colors hover:border-secondary hover:text-primary-strong"
          >
            {game.name} →
          </a>
        </li>
      ))}
    </ul>
  );
}
