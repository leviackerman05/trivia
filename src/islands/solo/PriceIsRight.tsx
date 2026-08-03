import { useCallback, useEffect, useRef, useState } from 'react';
import SoloShell from './SoloShell';
import priceProductsJson from '../../data/price-products.json';
import {
  clampPrice,
  pickPriceRounds,
  PRICE_MAX,
  PRICE_MIN,
  PRICE_TOTAL_ROUNDS,
  scorePriceGuess,
  type PriceProduct,
} from '../../lib/price-is-right';

/**
 * Price Is Right — E-commerce Edition (M7, PRD §5.8) — guess the USD price
 * of a (very real, very weird) product. Slider + number input, reveal with
 * the $ over/under, scoring 100 − |Δ|·2 (min 0), exact = 200. 5 rounds.
 * Products are emoji cards — no scraped product photos (PRD §13, D031).
 */

const products = priceProductsJson as PriceProduct[];

function formatPrice(value: number): string {
  return `$${value.toLocaleString('en-US')}`;
}

export default function PriceIsRight() {
  const [rounds, setRounds] = useState<PriceProduct[]>([]);
  const [index, setIndex] = useState(0);
  const [guess, setGuess] = useState(50);
  const [revealed, setRevealed] = useState<{ delta: number; points: number } | null>(null);
  const [score, setScore] = useState(0);
  const [results, setResults] = useState<{ correct: boolean; points: number }[]>([]);
  const [phase, setPhase] = useState<'playing' | 'done'>('playing');
  const seedRef = useRef(0);

  const product = rounds[index];

  useEffect(() => {
    seedRef.current = Math.floor(Math.random() * 1000);
    setRounds(pickPriceRounds(products, PRICE_TOTAL_ROUNDS, seedRef.current));
  }, []);

  const submit = () => {
    if (!product || revealed) {
      return;
    }
    const clamped = clampPrice(guess);
    setGuess(clamped);
    const verdict = scorePriceGuess(clamped, product.price);
    setRevealed(verdict);
    setScore((previous) => previous + verdict.points);
    setResults((previous) => [
      ...previous,
      { correct: verdict.points >= 100, points: verdict.points },
    ]);
  };

  const next = useCallback(() => {
    if (index + 1 >= rounds.length) {
      setPhase('done');
      return;
    }
    setIndex((previous) => previous + 1);
    setGuess(50);
    setRevealed(null);
  }, [index, rounds.length]);

  const playAgain = () => {
    seedRef.current = Math.floor(Math.random() * 1000);
    setRounds(pickPriceRounds(products, PRICE_TOTAL_ROUNDS, seedRef.current));
    setIndex(0);
    setGuess(50);
    setRevealed(null);
    setScore(0);
    setResults([]);
    setPhase('playing');
  };

  return (
    <SoloShell
      slug="price-is-right"
      name="Price Is Right"
      phase={phase}
      round={Math.min(index + 1, rounds.length)}
      totalRounds={rounds.length || PRICE_TOTAL_ROUNDS}
      score={score}
      resultSummary={
        <p className="text-body text-ink-muted">
          {results.filter((result) => result.points === 200).length > 0
            ? `💰 Exact guesses: ${results.filter((result) => result.points === 200).length} — the pricing oracle!`
            : `${results.filter((result) => result.correct).length} of ${results.length} within half-price`}
        </p>
      }
      onPlayAgain={playAgain}
    >
      {product && (
        <>
          <div className="rounded-lg border-2 border-gray-200 bg-white p-6 text-center shadow-sm">
            <p className="text-6xl" aria-hidden="true">
              {product.emoji}
            </p>
            <h3 className="mt-3 font-display text-h3 text-ink">{product.name}</h3>
            <p className="mx-auto mt-1 max-w-md text-body text-ink-muted">{product.description}</p>
          </div>
          <div className="rounded-lg border-2 border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label htmlFor="price-guess" className="text-body font-semibold text-ink">
                What does it cost?
              </label>
              <span className="font-mono text-2xl font-bold text-primary-deep">
                {formatPrice(clampPrice(guess))}
              </span>
            </div>
            <input
              id="price-guess"
              type="range"
              min={PRICE_MIN}
              max={PRICE_MAX}
              value={clampPrice(guess)}
              disabled={revealed !== null}
              onChange={(event) => setGuess(Number(event.target.value))}
              aria-label="Price guess in dollars"
              className="mt-4 w-full accent-[#ff6b5e]"
            />
            <input
              type="number"
              min={PRICE_MIN}
              max={PRICE_MAX}
              value={guess}
              disabled={revealed !== null}
              onChange={(event) => setGuess(Number(event.target.value))}
              aria-label="Price guess in dollars (numeric)"
              className="mt-3 w-full rounded-md border-2 border-gray-200 bg-white px-4 py-2.5 text-lg text-ink transition-colors hover:border-gray-400 focus:border-primary-strong focus:outline-none focus:ring-4 focus:ring-primary/25 sm:w-48"
            />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={revealed !== null || !Number.isFinite(guess)}
                onClick={submit}
                className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary-strong px-7 py-3 text-lg font-semibold text-white shadow-coral transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-40"
              >
                Lock it in
              </button>
              {revealed && (
                <div className="flex flex-wrap items-center gap-3">
                  <p
                    role="status"
                    className={`text-body font-bold ${
                      revealed.points === 200
                        ? 'text-green-700'
                        : revealed.delta === 0
                          ? 'text-green-700'
                          : 'text-amber-700'
                    }`}
                  >
                    It costs {formatPrice(product.price)} — you were{' '}
                    {revealed.delta === 0
                      ? 'exactly right! +200'
                      : `${formatPrice(revealed.delta)} ${guess > product.price ? 'over' : 'under'}. +${revealed.points}`}
                  </p>
                  <button
                    type="button"
                    onClick={next}
                    className="inline-flex min-h-11 items-center justify-center rounded-pill bg-secondary px-6 text-small font-semibold text-white shadow-teal transition-colors hover:bg-secondary-dark"
                  >
                    {index + 1 >= rounds.length ? 'See my score' : 'Next product'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </SoloShell>
  );
}
