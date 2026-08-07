/**
 * [Persistent room membership] Shown while an automatic rejoin attempt is
 * in flight, so the create/join lobby never flashes during a refresh or
 * navigation back into a room. Pure presentation.
 */
export default function RoomRejoining() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface-raised px-6 py-10 text-center shadow-sm">
      <p className="text-body text-ink-muted">Rejoining room…</p>
    </div>
  );
}
