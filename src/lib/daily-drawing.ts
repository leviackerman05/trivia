/**
 * Daily Drawing — "Prompt of the Day" (DAILY-DESIGN §3.4).
 *
 * One prompt per day, picked by a single deterministic index. The gallery
 * is server-persisted user content (server/src/routes/drawing.ts); this
 * module also carries the gallery client DTOs that src/lib/api.ts uses.
 * Pure functions only, no network.
 */

export interface DrawingPrompt {
  prompt: string;
  emoji: string;
  category: string;
  difficulty: 1 | 2 | 3;
  /** Enforceable constraints rendered as chips (DAILY-SCOPE §2.4). */
  constraints?: Array<'no_text' | 'no_letters'>;
}

/**
 * Deterministic single prompt: entries[seed % entries.length]. Same seed ⇒
 * same prompt for everyone that day (DAILY-DESIGN §3.4, scope §1.1).
 */
export function pickDailyPrompt(entries: DrawingPrompt[], seed: number): DrawingPrompt {
  return entries[seed % entries.length]!;
}

/** Gallery row as served by GET /api/drawing/submissions (§4.2). */
export interface DrawingSubmissionDto {
  id: string;
  playerName: string;
  image: string;
  votes: number;
  mine: boolean;
  voted: boolean;
}

/** Gallery read model: votes-desc submissions with the visible total. */
export interface DrawingGalleryResponse {
  submissions: DrawingSubmissionDto[];
  total: number;
}
