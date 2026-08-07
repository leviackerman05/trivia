import { useState } from 'react';
import Icon from '../../components/icons/Icon';
import { CLASSIC_TOPIC_SLUG, topicRegistry, type TopicRegistryRow } from '../../lib/trivia-topics';
import { availableTopicSlugs } from './topicData';
import TopicPlay from './TopicPlay';
import TriviaSolo from '../TriviaSolo';

/**
 * Trivia topic hub (TRIVIA-TOPICS §6, M-T3/M-T4): the daily block renders
 * FIRST (the untouched TriviaSolo island, framed exactly as the page did),
 * then the "Pick a topic" grid. While a topic is being played the daily
 * block is hidden (owner request) — TopicPlay takes the whole section. The
 * classic tile (S7) plays 10 from the existing 525-pool under slug
 * `classic`; launch topics with a question file are playable, the rest show
 * "coming soon". Playability comes from the build-time glob keys — no topic
 * files are fetched to render the grid.
 */

type RegionFilter = 'all' | 'US' | 'IN' | 'global';

const REGION_LABELS: Record<RegionFilter, string> = {
  all: 'All',
  US: 'US',
  IN: 'India',
  global: 'Global',
};

/** [AIRBNB] d5/d8 card surface, replicated for the daily block (Card.astro
 * is an Astro component and can't render inside a React island). */
const CARD_CLASS =
  'rounded-lg bg-surface-raised p-4 sm:p-6 border border-border shadow-sm transition-all duration-150 hover:shadow-md';

export default function TopicHub() {
  const [active, setActive] = useState<string | null>(null);
  const [region, setRegion] = useState<RegionFilter>('all');

  const playable = new Set(availableTopicSlugs());
  const rows = topicRegistry.filter((row) => row.launch);
  const visible = region === 'all' ? rows : rows.filter((row) => row.region === region);

  return (
    <div className="flex flex-col gap-8">
      {/* Daily block — renders first, exactly as the page rendered it
          (zero changes to TriviaSolo). Hidden while a topic is active
          (kept mounted so an in-progress daily round isn't lost). */}
      <section aria-label="Daily trivia" className={`flex-col gap-4 ${active ? 'hidden' : 'flex'}`}>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-pill border border-primary/40 bg-primary/15 px-3.5 py-1.5 text-xs font-semibold text-primary-strong">
            Instant play
          </span>
          <h2 className="text-lg font-bold tracking-tight text-ink">Play now, no room needed</h2>
        </div>
        <div className={CARD_CLASS}>
          <TriviaSolo />
        </div>
      </section>

      {active ? (
        <TopicPlay slug={active} onExit={() => setActive(null)} />
      ) : (
        <section aria-label="Topic trivia" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-h2 text-ink">Pick a topic</h2>
            <div className="ml-auto flex flex-wrap gap-1.5">
              {(Object.keys(REGION_LABELS) as RegionFilter[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={region === value}
                  onClick={() => setRegion(value)}
                  className={`rounded-pill border px-4 py-1.5 text-small font-semibold transition-colors ${
                    region === value
                      ? 'border-primary bg-primary/15 text-primary-deep'
                      : 'border-border bg-surface-raised text-ink hover:bg-surface-muted'
                  }`}
                >
                  {REGION_LABELS[value]}
                </button>
              ))}
            </div>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <li>
              <ClassicTile onPlay={() => setActive(CLASSIC_TOPIC_SLUG)} />
            </li>
            {visible.map((row) => (
              <li key={row.slug}>
                <TopicTile
                  row={row}
                  playable={playable.has(row.slug)}
                  onPlay={() => setActive(row.slug)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** S7: the classic tile — 10 from the existing 525-pool, same rotation. */
function ClassicTile({ onPlay }: { onPlay: () => void }) {
  return (
    <button
      type="button"
      onClick={onPlay}
      className="group flex h-full w-full flex-col gap-3 rounded-lg border border-border bg-surface-raised p-4 text-left shadow-sm transition-all hover:border-primary hover:shadow-md sm:p-5"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-muted text-ink transition-colors group-hover:bg-primary/15 group-hover:text-primary-deep">
        <Icon name="question" size={24} />
      </span>
      <span className="text-base font-semibold text-ink">Classic / Mixed</span>
      <span className="mt-auto text-small text-ink-muted">all 10 categories</span>
    </button>
  );
}

function TopicTile({
  row,
  playable,
  onPlay,
}: {
  row: TopicRegistryRow;
  playable: boolean;
  onPlay: () => void;
}) {
  return (
    <button
      type="button"
      onClick={playable ? onPlay : undefined}
      disabled={!playable}
      aria-label={playable ? `Play ${row.label}` : `${row.label}, coming soon`}
      className={`group flex h-full w-full flex-col gap-3 rounded-lg border border-border bg-surface-raised p-4 text-left shadow-sm transition-all sm:p-5 ${
        playable ? 'hover:border-primary hover:shadow-md' : 'cursor-default opacity-60'
      }`}
    >
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-lg transition-colors ${
          playable
            ? 'bg-surface-muted text-ink group-hover:bg-primary/15 group-hover:text-primary-deep'
            : 'bg-surface-muted text-ink-muted'
        }`}
      >
        <Icon name={row.icon} size={24} />
      </span>
      <span className={`text-base font-semibold ${playable ? 'text-ink' : 'text-ink-muted'}`}>
        {row.label}
      </span>
      <span className="mt-auto flex flex-wrap items-center gap-2 text-small text-ink-muted">
        {playable ? (
          <span>{REGION_LABELS[row.region]}</span>
        ) : (
          <span className="rounded-pill bg-surface-muted px-2.5 py-0.5 font-semibold text-ink-muted">
            Coming soon
          </span>
        )}
        <span
          className="ml-auto flex items-center gap-0.5"
          role="img"
          aria-label={`Difficulty ${row.difficulty} of 3`}
        >
          {[1, 2, 3].map((step) => (
            <span
              key={step}
              className={`h-3 w-1.5 rounded-full ${step <= row.difficulty ? 'bg-primary' : 'bg-border'}`}
            />
          ))}
        </span>
      </span>
    </button>
  );
}
