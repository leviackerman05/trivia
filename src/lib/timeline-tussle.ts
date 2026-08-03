/**
 * Timeline Tussle (M7, PRD §5.7) — pure game logic. 5 rounds of 3 shuffled
 * events; the player orders them (click-select on mobile); scoring is
 * 100 for the perfect order, 50 when exactly one pair is swapped, 0
 * otherwise. Years may be BCE (negative) — sort numerically.
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

export function scoreTimelineOrder(order: number[], correctOrder: number[]): number {
  if (order.length !== correctOrder.length) {
    return 0;
  }
  if (order.every((cardIndex, position) => cardIndex === correctOrder[position])) {
    return 100;
  }
  // Exactly one swapped adjacent pair: the rest are in place.
  let misplaced = 0;
  for (let position = 0; position < order.length; position += 1) {
    if (order[position] !== correctOrder[position]) {
      misplaced += 1;
    }
  }
  return misplaced === 2 ? 50 : 0;
}
