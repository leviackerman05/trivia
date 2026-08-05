import { hashString, seededRandom, type TriviaQuestion } from './daily-seed.js';

/**
 * [R7] Room-side trivia answer randomization (server Phase B, D055).
 *
 * The trivia deck is shuffled once per game start, seeded by the room code,
 * so the correct-option position differs per room and never repeats in the
 * same position across games of the same code. The answer index is remapped
 * to the shuffled position of the original correct option and lives only in
 * the server session — the round-start payload never includes it.
 *
 * Deterministic per room code (same code ⇒ same deck order); dailies are
 * untouched (they shuffle client-side via `src/lib/pick.ts`).
 */

/** Seeded Fisher-Yates (mulberry32). Never mutates the input. */
export function shuffleOptions<T>(options: readonly T[], seed: number): T[] {
  const random = seededRandom(seed);
  const shuffled = [...options];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const swap = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = swap;
  }
  return shuffled;
}

/**
 * Shuffle a trivia deck for a room: every question's options are shuffled
 * with the per-question seed `hashString(roomCode + ':' + qIndex)` and the
 * answer is remapped to the shuffled position of the original correct
 * option (`shuffled.options[shuffled.answer] === original.options[original.answer]`).
 * Questions with any option count shuffle generically; an empty deck is
 * returned unchanged.
 */
export function shuffleTriviaDeck(questions: TriviaQuestion[], roomCode: string): TriviaQuestion[] {
  if (questions.length === 0) {
    return questions;
  }
  return questions.map((question, qIndex) => {
    const options = shuffleOptions(question.options, hashString(`${roomCode}:${qIndex}`));
    const correct = question.options[question.answer]!;
    return { ...question, options, answer: options.indexOf(correct) };
  });
}
