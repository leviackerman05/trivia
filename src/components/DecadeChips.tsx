/**
 * [R8] Decade preset chip row for the setup cards. The parent pre-computes
 * `presets` with the empty-decade guard (a preset only renders when the
 * filtered pool can fill a full round), so there are no dead buttons.
 */

interface DecadeChipsProps {
  /** Rendered presets; `null` = All (always first, always available). */
  presets: (number | null)[];
  value: number | null;
  onChange: (decade: number | null) => void;
}

function label(decade: number | null): string {
  return decade === null ? 'All' : `${decade}s`;
}

export default function DecadeChips({ presets, value, onChange }: DecadeChipsProps) {
  return (
    <div role="group" aria-label="Filter by decade" className="flex flex-wrap items-center gap-2">
      {presets.map((decade) => {
        const selected = value === decade;
        return (
          <button
            key={decade === null ? 'all' : decade}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(decade)}
            className={`rounded-pill border px-4 py-2 text-small font-medium transition-colors ${
              selected
                ? 'border-primary bg-primary/15 text-primary-deep'
                : 'border-border bg-surface-raised text-ink hover:border-primary/50'
            }`}
          >
            {label(decade)}
          </button>
        );
      })}
    </div>
  );
}
