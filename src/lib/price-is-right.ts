/**
 * Price Is Right — E-commerce Edition (M7, PRD §5.8) — pure game logic.
 * 5 rounds; guess the USD price of a product; scoring is
 * 100 − |Δ|·2 (min 0), and an exact guess is worth 200.
 *
 * Products are emoji cards instead of product photos (PRD §13 content
 * licensing — no scraped images; D031).
 */

export interface PriceProduct {
  name: string;
  emoji: string;
  description: string;
  price: number;
}

export const PRICE_MIN = 1;
export const PRICE_MAX = 1000;
export const PRICE_TOTAL_ROUNDS = 5;

export function pickPriceRounds(
  products: PriceProduct[],
  count = PRICE_TOTAL_ROUNDS,
  seed = 0
): PriceProduct[] {
  const pool = [...products];
  const rounds: PriceProduct[] = [];
  let cursor = seed;
  while (rounds.length < count && pool.length > 0) {
    const index = cursor % pool.length;
    rounds.push(pool[index]!);
    pool.splice(index, 1);
    cursor += 1;
  }
  return rounds;
}

export function clampPrice(guess: number): number {
  if (!Number.isFinite(guess)) {
    return PRICE_MIN;
  }
  return Math.min(PRICE_MAX, Math.max(PRICE_MIN, Math.round(guess)));
}

export function scorePriceGuess(guess: number, actual: number): { points: number; delta: number } {
  const clamped = clampPrice(guess);
  const delta = Math.abs(clamped - actual);
  if (delta === 0) {
    return { points: 200, delta: 0 };
  }
  return { points: Math.max(0, 100 - delta * 2), delta };
}
