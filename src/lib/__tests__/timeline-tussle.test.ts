import { describe, expect, it } from 'vitest';
import { pickTimelineRound, scoreTimelineOrder, type TimelineEvent } from '../timeline-tussle';

const EVENTS: TimelineEvent[] = [
  { event: 'Moon Landing', year: 1969 },
  { event: 'Fall of Berlin Wall', year: 1989 },
  { event: 'First iPhone', year: 2007 },
  { event: 'Writing invented', year: -3200 },
  { event: 'Pyramids built', year: -2560 },
  { event: 'Wheel invented', year: -3500 },
];

describe('Timeline Tussle logic (PRD §5.7)', () => {
  it('builds a shuffled round with the correct chronological order', () => {
    const round = pickTimelineRound(EVENTS, 0, 0);
    expect(round.cards).toHaveLength(3);
    // Years are increasing along correctOrder.
    const years = round.correctOrder.map((cardIndex) => round.cards[cardIndex]!.year);
    expect(years).toEqual([...years].sort((a, b) => a - b));
  });

  it('handles BCE years (negative) numerically', () => {
    const round = pickTimelineRound(EVENTS, 3, 0); // starts at the BCE cluster
    const years = round.correctOrder.map((cardIndex) => round.cards[cardIndex]!.year);
    expect(years).toEqual([...years].sort((a, b) => a - b));
    expect(years.every((year) => year < 0)).toBe(true);
  });

  it('M14: per-card scoring, 100 perfect, ~33 per card in place, 0 otherwise', () => {
    const correct = [0, 1, 2];
    expect(scoreTimelineOrder([0, 1, 2], correct)).toBe(100);
    expect(scoreTimelineOrder([1, 0, 2], correct)).toBe(33); // one card in place
    expect(scoreTimelineOrder([2, 1, 0], correct)).toBe(33); // only the middle
    expect(scoreTimelineOrder([0, 2, 1], correct)).toBe(33); // only the first
    expect(scoreTimelineOrder([2, 0, 1], correct)).toBe(0); // full rotation
    expect(scoreTimelineOrder([1, 2, 0], correct)).toBe(0); // full rotation
    expect(scoreTimelineOrder([0, 2], correct)).toBe(0); // incomplete
  });
});
