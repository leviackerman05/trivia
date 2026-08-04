import { useCallback, useEffect, useRef, useState } from 'react';
import SoloShell from './SoloShell';
import timelineEventsJson from '../../data/timeline-events.json';
import {
  correctPositions,
  pickTimelineRound,
  scoreTimelineOrder,
  TIMELINE_TOTAL_ROUNDS,
  type TimelineEvent,
  type TimelineRound,
} from '../../lib/timeline-tussle';

/**
 * Timeline Tussle (M7, PRD §5.7) — three shuffled historical events; tap the
 * cards in the order you think they happened (click-select works on mobile),
 * submit, get instant feedback with the years revealed. M14 scoring is
 * per-card: 100 perfect, ~33 per card in the right place (66 max for one
 * misplaced). 5 rounds.
 */

const events = timelineEventsJson as TimelineEvent[];

export default function TimelineTussle() {
  const [round, setRound] = useState<TimelineRound | null>(null);
  const [index, setIndex] = useState(0);
  const [order, setOrder] = useState<number[]>([]);
  const [revealed, setRevealed] = useState<number[] | null>(null);
  const [placed, setPlaced] = useState(0);
  const [points, setPoints] = useState(0);
  const [score, setScore] = useState(0);
  const [results, setResults] = useState<{ correct: boolean; points: number }[]>([]);
  const [phase, setPhase] = useState<'playing' | 'done'>('playing');
  const seedRef = useRef(0);

  useEffect(() => {
    seedRef.current = Math.floor(Math.random() * 1000);
    setRound(pickTimelineRound(events, seedRef.current, 0));
  }, []);

  const toggleCard = (cardIndex: number) => {
    if (revealed) {
      return;
    }
    setOrder((previous) => {
      if (previous.includes(cardIndex)) {
        return previous.filter((entry) => entry !== cardIndex);
      }
      if (previous.length >= 3) {
        return previous;
      }
      return [...previous, cardIndex];
    });
  };

  const submit = () => {
    if (!round || revealed || order.length !== 3) {
      return;
    }
    const earned = scoreTimelineOrder(order, round.correctOrder);
    const placed = correctPositions(order, round.correctOrder);
    setRevealed(round.correctOrder);
    setPoints(earned);
    setScore((previous) => previous + earned);
    setResults((previous) => [...previous, { correct: earned === 100, points: earned }]);
    setPlaced(placed);
  };

  const next = useCallback(() => {
    if (index + 1 >= TIMELINE_TOTAL_ROUNDS) {
      setPhase('done');
      return;
    }
    setIndex((previous) => previous + 1);
    setRound(pickTimelineRound(events, seedRef.current, index + 1));
    setOrder([]);
    setRevealed(null);
    setPlaced(0);
    setPoints(0);
  }, [index]);

  const playAgain = () => {
    seedRef.current = Math.floor(Math.random() * 1000);
    setRound(pickTimelineRound(events, seedRef.current, 0));
    setIndex(0);
    setOrder([]);
    setRevealed(null);
    setPlaced(0);
    setPoints(0);
    setScore(0);
    setResults([]);
    setPhase('playing');
  };

  return (
    <SoloShell
      slug="timeline-tussle"
      name="Timeline Tussle"
      phase={phase}
      round={Math.min(index + 1, TIMELINE_TOTAL_ROUNDS)}
      totalRounds={TIMELINE_TOTAL_ROUNDS}
      score={score}
      resultSummary={
        <p className="text-body text-ink-muted">
          {results.filter((result) => result.correct).length} of {results.length} perfect orders
          {results.some((result) => result.points > 0 && result.points < 100) &&
            ' — partial credit for close calls!'}
        </p>
      }
      onPlayAgain={playAgain}
    >
      {round && (
        <>
          <div className="rounded-lg border-2 border-border bg-surface-raised p-6 shadow-sm">
            <p className="font-display text-h3 text-ink">Tap the events in chronological order</p>
            <p className="mt-1 text-small text-ink-muted">
              Tap again to undo a pick — you need all three before submitting.
            </p>
            <ul className="mt-4 flex flex-col gap-3">
              {round.cards.map((card, cardIndex) => {
                const position = order.indexOf(cardIndex);
                const placed = position !== -1;
                const correct = revealed !== null && revealed[position] === cardIndex;
                const wrong = revealed !== null && !correct;
                return (
                  <li key={cardIndex}>
                    <button
                      type="button"
                      onClick={() => toggleCard(cardIndex)}
                      disabled={revealed !== null}
                      aria-pressed={placed}
                      className={`flex w-full items-center gap-4 rounded-lg border-2 px-5 py-4 text-left transition-all ${
                        correct
                          ? 'border-success bg-success-soft'
                          : wrong
                            ? 'border-danger/50 bg-danger-soft'
                            : placed
                              ? 'border-primary bg-primary/10'
                              : 'border-border bg-surface-raised hover:border-primary'
                      }`}
                    >
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-pill font-mono text-lg font-bold ${
                          placed ? 'bg-primary text-white' : 'bg-surface-muted text-ink-muted'
                        }`}
                      >
                        {placed ? position + 1 : '·'}
                      </span>
                      <span className="flex-1 text-body font-semibold text-ink">{card.event}</span>
                      {revealed !== null && (
                        <span
                          className={`font-mono text-sm font-bold ${
                            correct ? 'text-success-strong' : 'text-danger-strong'
                          }`}
                        >
                          {card.year > 0 ? card.year : `${Math.abs(card.year)} BCE`}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            {revealed ? (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <p
                  role="status"
                  className={`text-body font-bold ${
                    points === 100
                      ? 'text-success-strong'
                      : points > 0
                        ? 'text-warning-strong'
                        : 'text-danger-strong'
                  }`}
                >
                  {points === 100
                    ? 'Perfect order! +100'
                    : points > 0
                      ? `${placed} of 3 cards in place — +${points}`
                      : 'Out of order — +0'}
                </p>
                <button
                  type="button"
                  onClick={next}
                  className="ml-auto inline-flex min-h-11 items-center justify-center rounded-pill bg-secondary px-6 text-small font-semibold text-white shadow-teal transition-colors hover:bg-secondary-dark"
                >
                  {index + 1 >= TIMELINE_TOTAL_ROUNDS ? 'See my score' : 'Next round'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={order.length !== 3}
                onClick={submit}
                className="mt-4 inline-flex min-h-12 items-center justify-center rounded-pill bg-primary-strong px-7 py-3 text-lg font-semibold text-white shadow-coral transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-40"
              >
                Submit order
              </button>
            )}
          </div>
        </>
      )}
    </SoloShell>
  );
}
