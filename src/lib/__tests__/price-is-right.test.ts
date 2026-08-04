import { describe, expect, it } from 'vitest';
import {
  clampPrice,
  pickPriceRounds,
  PRICE_MAX,
  PRICE_MIN,
  scorePriceGuess,
  type PriceProduct,
} from '../price-is-right';

const PRODUCTS: PriceProduct[] = [
  { name: 'Banana Slicer Pro', emoji: '🍌', description: 'A curved blade.', price: 12 },
  { name: 'Gold-plated Paperclip', emoji: '📎', description: 'Fancy office supply.', price: 89 },
  { name: 'Pet Rock 2.0', emoji: '🪨', description: 'With stand.', price: 25 },
  { name: 'Smart Toaster', emoji: '🍞', description: 'It tweets.', price: 120 },
];

describe('Price Is Right logic (PRD §5.8)', () => {
  it('scores 100 − |Δ|·2 with a 0 floor and 200 for an exact guess', () => {
    expect(scorePriceGuess(12, 12)).toEqual({ points: 200, delta: 0 });
    expect(scorePriceGuess(17, 12)).toEqual({ points: 90, delta: 5 });
    expect(scorePriceGuess(8, 12)).toEqual({ points: 92, delta: 4 });
    expect(scorePriceGuess(112, 12)).toEqual({ points: 0, delta: 100 });
  });

  it('clamps guesses to the $1-$1000 range and rounds', () => {
    expect(clampPrice(-50)).toBe(PRICE_MIN);
    expect(clampPrice(50_000)).toBe(PRICE_MAX);
    expect(clampPrice(12.6)).toBe(13);
    expect(clampPrice(Number.NaN)).toBe(PRICE_MIN);
  });

  it('picks unique products per game', () => {
    const rounds = pickPriceRounds(PRODUCTS, 4, 0);
    expect(rounds).toHaveLength(4);
    expect(new Set(rounds.map((product) => product.name)).size).toBe(4);
  });
});
