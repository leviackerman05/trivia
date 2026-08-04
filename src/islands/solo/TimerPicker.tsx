/**
 * M14, adjustable round timer for solo games. Preset chips (30/40/50/60/70
 * by default); the choice persists per game via localStorage (solo.ts) and
 * is applied BEFORE the game starts (the island's setup phase), so the
 * clock only ever starts when the player actually begins playing.
 */

interface TimerPickerProps {
  value: number;
  onChange: (seconds: number) => void;
  options?: number[];
}

export default function TimerPicker({
  value,
  onChange,
  options = [30, 40, 50, 60, 70],
}: TimerPickerProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-small font-semibold text-ink" id="timer-picker-label">
        Round timer
      </span>
      <div role="group" aria-labelledby="timer-picker-label" className="flex flex-wrap gap-2">
        {options.map((seconds) => (
          <button
            key={seconds}
            type="button"
            aria-pressed={value === seconds}
            onClick={() => onChange(seconds)}
            className={`inline-flex min-h-11 min-w-16 items-center justify-center rounded-pill border px-4 py-2 text-small font-semibold transition-colors ${
              value === seconds
                ? 'border-primary bg-primary/15 text-primary-deep'
                : 'border-border bg-surface-muted text-ink-muted hover:border-primary/50 hover:text-ink'
            }`}
          >
            {seconds}s
          </button>
        ))}
      </div>
    </div>
  );
}
