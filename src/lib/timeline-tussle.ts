/**
 * Timeline Tussle (M7/M14, PRD §5.7) — pure game logic. 5 rounds of 3
 * shuffled events; the player orders them (click-select on mobile). M14
 * scoring is per-card: 100 for the perfect order, otherwise ~33 per card in
 * the right position (33 / 66), so a single correct card earns partial
 * credit. Years may be BCE (negative) — sort numerically.
 */

export interface TimelineEvent {
  event: string;
  year: number;
}

export const TIMELINE_TOTAL_ROUNDS = 5;

export interface TimelineRound {
  /** The cards in the order the player must restore. */
  cards: TimelineEvent[];
  /** Indices into `cards` in chronological order. */
  correctOrder: number[];
}

export function pickTimelineRound(events: TimelineEvent[], seed = 0, cursor = 0): TimelineRound {
  const index = (seed + cursor * 3) % events.length;
  const a = events[index]!;
  const b = events[(index + 1) % events.length]!;
  const c = events[(index + 2) % events.length]!;
  const cards = [a, b, c];
  // Shuffle the display order deterministically (rotate by the round number).
  const rotation = (cursor % 3) + 1;
  const shuffled = [...cards];
  for (let step = 0; step < rotation; step += 1) {
    shuffled.push(shuffled.shift()!);
  }
  // correctOrder indexes the SHUFFLED array (what the player sees).
  const correctOrder = shuffled
    .map((card, cardIndex) => ({ cardIndex, year: card.year }))
    .sort((x, y) => x.year - y.year)
    .map((entry) => entry.cardIndex);
  return { cards: shuffled, correctOrder };
}

export function correctPositions(order: number[], correctOrder: number[]): number {
  if (order.length !== correctOrder.length) {
    return 0;
  }
  let correct = 0;
  for (let position = 0; position < order.length; position += 1) {
    if (order[position] === correctOrder[position]) {
      correct += 1;
    }
  }
  return correct;
}

/** Per-card points: 100 when everything is right, ~33 per correct card. */
export function scoreTimelineOrder(order: number[], correctOrder: number[]): number {
  const correct = correctPositions(order, correctOrder);
  if (correct === 0) {
    return 0;
  }
  return Math.round((correct / correctOrder.length) * 100);
}
