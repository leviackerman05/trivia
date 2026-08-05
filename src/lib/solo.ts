/**
 * Shared solo-game utilities (M7), streak persistence, answer normalization
 * and fuzzy matching, leaderboard client keys, and the share-result image.
 * Pure and dependency-free so every solo game and its tests share one
 * implementation (D009).
 */

/** UTC day key used for streaks and daily leaderboards (same as server). */
export function dailyDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function yesterdayKey(todayKey: string): string {
  const date = new Date(`${todayKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return dailyDateKey(date);
}

export interface StreakState {
  count: number;
  lastDate: string;
}

const STREAK_PREFIX = 'triviahub:streak:';
/** Legacy key (pre-rebrand), read-only fallback so streaks survive. */
const STREAK_LEGACY_PREFIX = 'partybrain:streak:';

/** Shared nickname storage (pre-rebrand key read as a fallback). */
const NICKNAME_STORAGE_KEY = 'triviahub:nickname';
const NICKNAME_LEGACY_KEY = 'partybrain:nickname';

export function readNickname(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  try {
    return (
      localStorage.getItem(NICKNAME_STORAGE_KEY) ?? localStorage.getItem(NICKNAME_LEGACY_KEY) ?? ''
    );
  } catch {
    return '';
  }
}

export function writeNickname(name: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(NICKNAME_STORAGE_KEY, name);
  } catch {
    // Storage full/blocked, best-effort.
  }
}

export function readStreak(slug: string): StreakState {
  if (typeof window === 'undefined') {
    return { count: 0, lastDate: '' };
  }
  try {
    const raw =
      localStorage.getItem(`${STREAK_PREFIX}${slug}`) ??
      localStorage.getItem(`${STREAK_LEGACY_PREFIX}${slug}`);
    if (!raw) {
      return { count: 0, lastDate: '' };
    }
    const parsed = JSON.parse(raw) as StreakState;
    return {
      count: typeof parsed.count === 'number' ? parsed.count : 0,
      lastDate: typeof parsed.lastDate === 'string' ? parsed.lastDate : '',
    };
  } catch {
    return { count: 0, lastDate: '' };
  }
}

/**
 * Pure streak transition: consecutive calendar days (UTC) increment the
 * count; the same day twice is a no-op; a missed day resets to 1.
 */
export function nextStreak(previous: StreakState, today: string): StreakState {
  if (previous.lastDate === today) {
    return previous;
  }
  if (previous.lastDate === yesterdayKey(today)) {
    return { count: previous.count + 1, lastDate: today };
  }
  return { count: 1, lastDate: today };
}

/** Register a completed game for the daily streak (persists to localStorage). */
export function registerStreak(slug: string, today = dailyDateKey(new Date())): StreakState {
  const next = nextStreak(readStreak(slug), today);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`${STREAK_PREFIX}${slug}`, JSON.stringify(next));
    } catch {
      // Storage full/blocked, streaks are best-effort.
    }
  }
  return next;
}

/** Lowercase, strip punctuation/accents, collapse whitespace. */
export function normalizeAnswer(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Classic Levenshtein distance (bounded at `cap` for speed). */
export function levenshtein(a: string, b: string, cap = 3): number {
  if (Math.abs(a.length - b.length) > cap) {
    return cap + 1;
  }
  let prev = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const curr = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
    }
    prev = curr;
  }
  return prev[b.length]!;
}

/**
 * Emoji Plot acceptance (PRD §5.3): case-insensitive, ignores a leading
 * "The", accepts close answers (Levenshtein ≤ 2), and accepts a guess that
 * names the title (e.g. "harry potter" for "Harry Potter and the
 * Sorcerer's Stone").
 */
export function fuzzyMatchTitle(guess: string, title: string): boolean {
  const normalizedGuess = normalizeAnswer(guess);
  const normalizedTitle = normalizeAnswer(title);
  if (!normalizedGuess || !normalizedTitle) {
    return false;
  }
  const stripThe = (value: string) => (value.startsWith('the ') ? value.slice(4) : value);
  const guessCore = stripThe(normalizedGuess);
  const titleCore = stripThe(normalizedTitle);
  if (guessCore === titleCore) {
    return true;
  }
  if (levenshtein(guessCore, titleCore) <= 2) {
    return true;
  }
  // Partial titles: "harry potter" ⊂ "harry potter and the sorcerer's stone"
  // and the reverse (a verbose guess naming the full title).
  if (guessCore.length >= 4 && titleCore.startsWith(guessCore)) {
    return true;
  }
  if (titleCore.length >= 4 && guessCore.startsWith(titleCore)) {
    return true;
  }
  return false;
}

/** Idempotency key for a completed solo game (unique per game + day + salt). */
export function soloClientKey(slug: string, dateKey: string, salt: string): string {
  return `${slug}:${dateKey}:${salt}`;
}

/** M14, per-game round-timer preference (seconds), persisted locally. */
const TIMER_PREFIX = 'triviahub:timer:';
/** Legacy key (pre-rebrand), read-only fallback. */
const TIMER_LEGACY_PREFIX = 'partybrain:timer:';

export function readTimerSetting(slug: string, fallback: number): number {
  if (typeof window === 'undefined') {
    return fallback;
  }
  try {
    const raw =
      localStorage.getItem(`${TIMER_PREFIX}${slug}`) ??
      localStorage.getItem(`${TIMER_LEGACY_PREFIX}${slug}`);
    const parsed = raw === null ? NaN : Number(raw);
    return Number.isFinite(parsed) && parsed >= 10 && parsed <= 300 ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function saveTimerSetting(slug: string, seconds: number): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(`${TIMER_PREFIX}${slug}`, String(seconds));
  } catch {
    // Storage full/blocked, best-effort.
  }
}

/**
 * Multiple-choice option builder: the correct label plus `count - 1` random
 * distractors from the pool, shuffled (Fisher-Yates with Math.random, solo
 * games have no server authority to protect).
 */
export function buildOptions(
  correct: string,
  pool: string[],
  count = 4,
  random: () => number = Math.random
): string[] {
  const distractors = pool.filter((label) => label !== correct);
  const picks: string[] = [];
  while (picks.length < count - 1 && distractors.length > 0) {
    const index = Math.floor(random() * distractors.length);
    const [picked] = distractors.splice(index, 1);
    if (picked) {
      picks.push(picked);
    }
  }
  const options = [correct, ...picks];
  for (let i = options.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const swap = options[i]!;
    options[i] = options[j]!;
    options[j] = swap;
  }
  return options;
}

/**
 * Draw a share-result PNG on a canvas (score card) and download/share it.
 * Pure canvas 2D, no image assets, no libraries (M7 share-result image).
 */
export function drawScoreImage(
  canvas: HTMLCanvasElement,
  options: { gameName: string; score: number; playerName: string; dateKey: string }
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }
  const width = 1080;
  const height = 540;
  canvas.width = width;
  canvas.height = height;
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#ff6b5e');
  gradient.addColorStop(1, '#ff8e7a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 44px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(options.gameName, width / 2, 110);
  ctx.font = '800 140px system-ui, sans-serif';
  ctx.fillText(String(options.score), width / 2, 300);
  ctx.font = '500 36px system-ui, sans-serif';
  ctx.fillText(`${options.playerName} · ${options.dateKey}`, width / 2, 400);
  ctx.fillText('Play Trivia in Games: free party games and daily trivia online', width / 2, 480);
}

export function downloadCanvas(canvas: HTMLCanvasElement, slug: string): void {
  const link = document.createElement('a');
  link.download = `triviahub-${slug}-${dailyDateKey(new Date())}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
