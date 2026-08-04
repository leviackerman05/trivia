/**
 * In-memory sliding-window rate limiter (per-IP buckets for REST routes and
 * socket actions). Single-instance topology (D016) makes in-memory state
 * correct; swap for Redis-backed when multi-instance lands.
 */

export class RateLimiter {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly windowMs: number,
    private readonly max: number
  ) {}

  /** Returns true when the request is allowed, false when rate-limited. */
  consume(key: string, now = Date.now()): boolean {
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    if (bucket.count >= this.max) {
      return false;
    }
    bucket.count += 1;
    return true;
  }

  /** Drop expired buckets; clears everything when the map grows unbounded. */
  sweep(now = Date.now()): void {
    if (this.buckets.size > 10_000) {
      this.buckets.clear();
      return;
    }
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }
}

/** Key factory: per-IP buckets from an Express-style request. */
export function ipKey(ip: string | undefined, action: string): string {
  return `${action}:${ip ?? 'unknown'}`;
}

export interface Limiters {
  roomCreate: RateLimiter;
  joinRoom: RateLimiter;
  chat: RateLimiter;
  guess: RateLimiter;
  drawStroke: RateLimiter;
  scoreSubmit: RateLimiter;
  dailySubmit: RateLimiter;
  memberClaim: RateLimiter;
}

/** Production defaults (per IP per minute). Tune with real traffic. */
export function createDefaultLimiters(): Limiters {
  return {
    roomCreate: new RateLimiter(60_000, 10),
    joinRoom: new RateLimiter(60_000, 20),
    chat: new RateLimiter(60_000, 60),
    // Guesses are chat-frequency; strokes are high-frequency (one drawer, capped server-side).
    guess: new RateLimiter(60_000, 60),
    drawStroke: new RateLimiter(60_000, 6_000),
    scoreSubmit: new RateLimiter(60_000, 30),
    // Phase 1.5: daily runs are one per game per day; 30/min per IP is generous.
    dailySubmit: new RateLimiter(60_000, 30),
    memberClaim: new RateLimiter(60_000, 10),
  };
}
