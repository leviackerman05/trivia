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
 * Price Is Right — E-commerce Edition (M7, PRD §5.8; M14 owner fixes) —
 * guess the USD price of a (very real, very weird) product. M14: no slider,
 * just the numeric input, and the listing copy is quoted as a marketplace
 * excerpt. Scoring 100 − |Δ|·2 (min 0), exact = 200. 5 rounds.
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
          <div className="rounded-lg border-2 border-border bg-surface-raised p-6 text-center shadow-sm">
            {product.image ? (
              <img
                src={product.image}
                alt={product.name}
                loading="lazy"
                className="mx-auto max-h-56 rounded-lg border-2 border-border object-contain"
              />
            ) : (
              <p className="text-6xl" aria-hidden="true">
                {product.emoji}
              </p>
            )}
            <h3 className="mt-3 font-display text-h3 text-ink">{product.name}</h3>
            {product.credit && (
              <p className="mt-2 text-xs text-ink-muted">
                Photo: {product.credit.creator ?? 'Wikimedia Commons'} ·{' '}
                {product.credit.license.toUpperCase()}
              </p>
            )}
          </div>
          <div className="rounded-lg border-2 border-border bg-surface-raised p-6 shadow-sm">
            <p className="text-small font-semibold uppercase tracking-wide text-primary-deep">
              📦 From the listing
            </p>
            <p className="mt-2 text-body italic text-ink-muted">“{product.description}”</p>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <label htmlFor="price-guess" className="text-body font-semibold text-ink">
                What does it cost?
              </label>
              <span className="font-mono text-2xl font-bold text-primary-deep">
                {formatPrice(clampPrice(guess))}
              </span>
            </div>
            <input
              id="price-guess"
              type="number"
              min={PRICE_MIN}
              max={PRICE_MAX}
              value={Number.isFinite(guess) ? guess : ''}
              disabled={revealed !== null}
              onChange={(event) =>
                setGuess(event.target.value === '' ? NaN : Number(event.target.value))
              }
              aria-label="Price guess in dollars"
              className="mt-3 w-full rounded-md border-2 border-border bg-surface-raised px-4 py-2.5 text-lg text-ink transition-colors hover:border-border-strong focus:border-primary-strong focus:outline-none focus:ring-4 focus:ring-primary/25 sm:w-56"
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
                        ? 'text-success-strong'
                        : revealed.delta === 0
                          ? 'text-success-strong'
                          : 'text-warning-strong'
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
