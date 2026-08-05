import { describe, expect, it } from 'vitest';
import placesJson from '../../data/world-peek-places.json';
import {
  greatCirclePoints,
  haversineKm,
  mapPoint,
  pickWorldPeekRounds,
  pointToLonLat,
  scoreGuess,
  WORLD_PEEK_EXACT_BONUS,
  WORLD_PEEK_MAX_SCORE,
  WORLD_PEEK_ROUNDS,
  type WorldPeekPlace,
} from '../world-peek';

const entries = placesJson as WorldPeekPlace[];

describe('World Peek dataset (sample, 12 entries; full pool = content lot L7)', () => {
  it('has 12+ entries with valid coordinates and regions', () => {
    expect(entries.length).toBeGreaterThanOrEqual(12);
    for (const entry of entries) {
      expect(entry.lat).toBeGreaterThanOrEqual(-90);
      expect(entry.lat).toBeLessThanOrEqual(90);
      expect(entry.lon).toBeGreaterThanOrEqual(-180);
      expect(entry.lon).toBeLessThanOrEqual(180);
      expect(entry.region.trim().length).toBeGreaterThan(0);
      expect(entry.image.startsWith('https://')).toBe(true);
    }
  });

  it('places are unique', () => {
    expect(new Set(entries.map((entry) => entry.place)).size).toBe(entries.length);
  });
});

describe('pickWorldPeekRounds (seeded)', () => {
  it('is deterministic for the same seed and picks distinct entries', () => {
    const first = pickWorldPeekRounds(entries, WORLD_PEEK_ROUNDS, 42);
    const second = pickWorldPeekRounds(entries, WORLD_PEEK_ROUNDS, 42);
    expect(first).toEqual(second);
    expect(first).toHaveLength(WORLD_PEEK_ROUNDS);
    expect(new Set(first.map((round) => round.entry.place)).size).toBe(WORLD_PEEK_ROUNDS);
  });

  it('differs across seeds and returns fewer rounds on a small pool', () => {
    expect(pickWorldPeekRounds(entries, 5, 1)[0]!.entry.place).not.toBe(
      pickWorldPeekRounds(entries, 5, 2)[0]!.entry.place
    );
    const tiny = entries.slice(0, 3);
    expect(pickWorldPeekRounds(tiny, 5, 0)).toHaveLength(3);
  });
});

describe('haversineKm', () => {
  it('returns ~0 for the same point', () => {
    expect(haversineKm(48.8584, 2.2945, 48.8584, 2.2945)).toBeLessThan(1);
  });

  it('approximates known city distances', () => {
    // Paris -> Rome is roughly 1,105 km.
    const parisRome = haversineKm(48.8566, 2.3522, 41.9028, 12.4964);
    expect(parisRome).toBeGreaterThan(1000);
    expect(parisRome).toBeLessThan(1250);
    // Paris -> New York is roughly 5,830 km.
    const parisNy = haversineKm(48.8566, 2.3522, 40.7128, -74.006);
    expect(parisNy).toBeGreaterThan(5400);
    expect(parisNy).toBeLessThan(6400);
  });
});

describe('scoreGuess (1000 pts minus distance penalty, exact = bonus)', () => {
  it('pays the bonus for an exact pin', () => {
    expect(scoreGuess(0)).toBe(WORLD_PEEK_MAX_SCORE + WORLD_PEEK_EXACT_BONUS);
    expect(scoreGuess(0.5)).toBe(WORLD_PEEK_MAX_SCORE + WORLD_PEEK_EXACT_BONUS);
  });

  it('decays with distance and floors at zero', () => {
    expect(scoreGuess(100)).toBe(WORLD_PEEK_MAX_SCORE - 10);
    expect(scoreGuess(1000)).toBe(WORLD_PEEK_MAX_SCORE - 100);
    expect(scoreGuess(10000)).toBe(0);
    expect(scoreGuess(50000)).toBe(0);
  });
});

describe('greatCirclePoints (D061 great-circle interpolation)', () => {
  it('returns n points with exact endpoints', () => {
    // Paris -> Sydney
    const points = greatCirclePoints(48.8566, 2.3522, -33.8688, 151.2093, 100);
    expect(points).toHaveLength(100);
    expect(points[0]).toEqual({ lat: 48.8566, lon: 2.3522 });
    const last = points[points.length - 1]!;
    expect(last.lat).toBeCloseTo(-33.8688, 5);
    expect(last.lon).toBeCloseTo(151.2093, 5);
  });

  it('midpoint is roughly halfway along the great circle', () => {
    const points = greatCirclePoints(48.8566, 2.3522, -33.8688, 151.2093, 101);
    const mid = points[50]!;
    const d1 = haversineKm(48.8566, 2.3522, mid.lat, mid.lon);
    const d2 = haversineKm(-33.8688, 151.2093, mid.lat, mid.lon);
    expect(Math.abs(d1 - d2)).toBeLessThan(1); // equidistant to both ends
    const total = haversineKm(48.8566, 2.3522, -33.8688, 151.2093);
    expect(d1).toBeCloseTo(total / 2, 0); // half the Paris-Sydney distance
  });

  it('crosses the antimeridian on the short arc, not through lon 0', () => {
    // 179E -> 179W on the equator: the short great circle is 2° across the
    // ±180 meridian, so every intermediate longitude stays near ±180.
    const points = greatCirclePoints(0, 179, 0, -179, 101);
    for (const p of points) {
      expect(Math.abs(p.lon)).toBeGreaterThan(178);
    }
    expect(Math.abs(Math.abs(points[50]!.lon) - 180)).toBeLessThan(1);
  });

  it('polyline length approximates the great-circle distance', () => {
    const points = greatCirclePoints(48.8566, 2.3522, -33.8688, 151.2093, 100);
    let sum = 0;
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1]!;
      const b = points[i]!;
      sum += haversineKm(a.lat, a.lon, b.lat, b.lon);
    }
    const total = haversineKm(48.8566, 2.3522, -33.8688, 151.2093);
    expect(sum).toBeCloseTo(total, 0);
  });
});

describe('map projection helpers', () => {
  it('maps lon/lat into the 360x180 box and back', () => {
    const p = mapPoint(0, 0);
    expect(p.x).toBe(180);
    expect(p.y).toBe(90);
    const roundTrip = pointToLonLat(0.5, 0.5);
    expect(roundTrip.lon).toBe(0);
    expect(roundTrip.lat).toBe(0);
  });

  it('round-trips a corner', () => {
    const { lon, lat } = pointToLonLat(0, 0);
    expect(lon).toBe(-180);
    expect(lat).toBe(90);
  });

  it('round-trips the island pin flow exactly (regression: lat was negated)', () => {
    // Mirrors WorldPeek.tsx submit: pin = mapPoint(lon, lat), then
    // guess = pointToLonLat(pin.x / 360, pin.y / 180). The bug used
    // "1 - pin.y / 180", which negated the latitude (Paris -> -48.8).
    const samples: [number, number][] = [
      [2.3522, 48.8566], // Paris
      [151.2093, -33.8688], // Sydney
      [-74.006, 40.7128], // New York
      [0, 0], // equator/prime meridian
    ];
    for (const [lon, lat] of samples) {
      const pin = mapPoint(lon, lat);
      const guess = pointToLonLat(pin.x / 360, pin.y / 180);
      expect(guess.lon).toBeCloseTo(lon, 5);
      expect(guess.lat).toBeCloseTo(lat, 5);
    }
  });
});
