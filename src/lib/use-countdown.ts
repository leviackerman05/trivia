import { useEffect, useState } from 'react';

/**
 * M14 — round countdown with the deadline in STATE, not a ref.
 *
 * The old pattern stored the deadline in a ref and computed `remaining` at
 * render time: on the very first render of a round the ref was still unset,
 * so `remaining` computed to 0 and the timeout effect fired "Time's up!"
 * before the round could even start. With the deadline in state, the first
 * render returns the full duration and no false timeout can fire.
 *
 * @param active  countdown runs only while true (round playing, not locked)
 * @param seconds full round duration in seconds
 * @param key     round identity — changing it (new question index) resets
 *                the deadline, so round N+1 doesn't inherit round N's
 */
export function useCountdown(active: boolean, seconds: number, key: number | string): number {
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) {
      return;
    }
    setDeadline(Date.now() + seconds * 1000);
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [active, seconds, key]);

  return deadline > 0 ? Math.max(0, Math.ceil((deadline - now) / 1000)) : seconds;
}
