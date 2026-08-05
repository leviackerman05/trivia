import { useEffect, useState } from 'react';

/**
 * M14, round countdown with the deadline in STATE, not a ref.
 *
 * The old pattern stored the deadline in a ref and computed `remaining` at
 * render time: on the very first render of a round the ref was still unset,
 * so `remaining` computed to 0 and the timeout effect fired "Time's up!"
 * before the round could even start. With the deadline in state, the first
 * render returns the full duration and no false timeout can fire.
 *
 * Round-transition guard (owner report, 2026-08-05): when a round times out
 * and the player advances, the PREVIOUS round's expired deadline is still
 * in state for one render, so `remaining` would compute to 0 and the
 * timeout effect would fire for the NEW round before the countdown effect
 * resets the deadline. Each deadline now remembers the key it belongs to;
 * a mismatched key means the deadline is stale, so the countdown reads as
 * fresh (full duration) until the reset effect lands. One timer per round,
 * never a shared clock.
 *
 * @param active  countdown runs only while true (round playing, not locked)
 * @param seconds full round duration in seconds
 * @param key     round identity, changing it (new question index) resets
 *                the deadline, so round N+1 doesn't inherit round N's
 */
export function useCountdown(active: boolean, seconds: number, key: number | string): number {
  const [deadline, setDeadline] = useState(0);
  const [deadlineKey, setDeadlineKey] = useState(key);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) {
      return;
    }
    setDeadline(Date.now() + seconds * 1000);
    setDeadlineKey(key);
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [active, seconds, key]);

  const stale = deadlineKey !== key;
  return !stale && deadline > 0 ? Math.max(0, Math.ceil((deadline - now) / 1000)) : seconds;
}
