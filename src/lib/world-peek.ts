/**
 * World Peek (PLAN-SCOPE R5, M23): solo-only at launch, no daily registry
 * entry ('geo' token deferred). Seeded rounds from a lat/lon photo pool;
 * the player pins the guessed location on a self-made simplified SVG world
 * map and scores by distance. The full 200+ photo pool is content lot L7;
 * this ships against the 12-entry sample dataset.
 *
 * Never "GeoGuessr" on-page (trademark-safe): the game is "World Peek".
 */

import { pickDistinct } from './pick';

export interface WorldPeekPlace {
  place: string;
  lat: number;
  lon: number;
  /** Remote image (Wikimedia Commons Special:FilePath); content lot swaps. */
  image: string;
  credit?: { creator: string; license: string };
  region: string;
}

export interface WorldPeekRound {
  entry: WorldPeekPlace;
}

export const WORLD_PEEK_ROUNDS = 5;
/** Exact-pin threshold (km): inside this, the guess counts as exact. */
export const WORLD_PEEK_EXACT_KM = 1;
/** Exact-pin bonus added on top of the max distance score. */
export const WORLD_PEEK_EXACT_BONUS = 250;
export const WORLD_PEEK_MAX_SCORE = 1000;
/** Penalty divisor: a 1,000 km miss loses 100 pts; 10,000 km floors at 0. */
export const WORLD_PEEK_PENALTY_KM = 10;

/** Seeded rounds: same seed ⇒ same photos, same order, for everyone. */
export function pickWorldPeekRounds(
  entries: WorldPeekPlace[],
  count = WORLD_PEEK_ROUNDS,
  seed = 0
): WorldPeekRound[] {
  return pickDistinct(entries, count, seed).map((entry) => ({ entry }));
}

/** Great-circle distance in km (haversine). */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

/** Distance-based score: max 1000 minus a per-10km penalty; exact = bonus. */
export function scoreGuess(distanceKm: number): number {
  if (distanceKm <= WORLD_PEEK_EXACT_KM) {
    return WORLD_PEEK_MAX_SCORE + WORLD_PEEK_EXACT_BONUS;
  }
  return Math.max(0, WORLD_PEEK_MAX_SCORE - Math.round(distanceKm / WORLD_PEEK_PENALTY_KM));
}

/* ── Simplified SVG world map (self-made, equirectangular) ──────────────
   Continents as (lon, lat) polygons; the island maps them into the
   viewBox (x = lon + 180, y = 90 - lat). Coarse by design: a filter, not
   a cartographic product. Land/ocean colors come from CSS (light + dark). */

export type LonLat = [number, number];

export const WORLD_CONTINENTS: { name: string; points: LonLat[] }[] = [
  {
    name: 'north-america',
    points: [
      [-168, 66],
      [-150, 71],
      [-128, 70],
      [-110, 73],
      [-92, 71],
      [-75, 66],
      [-55, 53],
      [-64, 45],
      [-75, 36],
      [-81, 25],
      [-87, 30],
      [-97, 26],
      [-105, 21],
      [-93, 15],
      [-83, 9],
      [-95, 16],
      [-110, 23],
      [-117, 33],
      [-124, 42],
      [-129, 50],
      [-134, 57],
      [-145, 60],
      [-155, 58],
      [-165, 60],
      [-168, 66],
    ],
  },
  {
    name: 'south-america',
    points: [
      [-77, 12],
      [-71, 11],
      [-60, 8],
      [-50, 2],
      [-35, 7],
      [-39, -4],
      [-43, -23],
      [-48, -29],
      [-53, -34],
      [-58, -38],
      [-65, -46],
      [-70, -52],
      [-73, -50],
      [-71, -33],
      [-70, -20],
      [-76, -12],
      [-81, -5],
      [-78, 0],
      [-77, 12],
    ],
  },
  {
    name: 'africa',
    points: [
      [-17, 15],
      [-10, 31],
      [-6, 35],
      [0, 37],
      [10, 33],
      [19, 32],
      [25, 32],
      [32, 31],
      [36, 28],
      [38, 18],
      [43, 11],
      [51, 11],
      [48, 0],
      [41, -2],
      [40, -15],
      [35, -24],
      [32, -29],
      [25, -34],
      [18, -35],
      [14, -25],
      [12, -18],
      [9, -4],
      [6, 4],
      [-8, 5],
      [-13, 8],
      [-17, 15],
    ],
  },
  {
    name: 'eurasia',
    points: [
      [-10, 37],
      [-9, 43],
      [-1, 49],
      [0, 52],
      [-5, 54],
      [-4, 58],
      [1, 55],
      [5, 53],
      [9, 56],
      [13, 58],
      [18, 60],
      [24, 65],
      [28, 70],
      [34, 68],
      [42, 67],
      [50, 69],
      [60, 70],
      [70, 72],
      [80, 75],
      [92, 77],
      [105, 75],
      [118, 73],
      [132, 72],
      [145, 70],
      [158, 69],
      [172, 67],
      [180, 66],
      [179, 61],
      [168, 59],
      [160, 52],
      [148, 46],
      [140, 44],
      [132, 42],
      [124, 39],
      [122, 35],
      [120, 30],
      [115, 23],
      [109, 16],
      [104, 11],
      [100, 8],
      [103, 1],
      [109, 11],
      [114, 22],
      [120, 31],
      [127, 40],
      [132, 43],
      [138, 46],
      [145, 50],
      [152, 57],
      [158, 61],
      [150, 63],
      [140, 60],
      [132, 56],
      [126, 52],
      [118, 48],
      [112, 45],
      [106, 42],
      [100, 40],
      [95, 37],
      [90, 35],
      [85, 32],
      [80, 29],
      [72, 27],
      [66, 25],
      [58, 26],
      [52, 25],
      [48, 29],
      [45, 13],
      [52, 15],
      [57, 19],
      [60, 26],
      [66, 25],
    ],
  },
  {
    name: 'australia',
    points: [
      [114, -22],
      [122, -18],
      [130, -12],
      [136, -12],
      [142, -11],
      [146, -15],
      [150, -24],
      [153, -32],
      [146, -38],
      [138, -36],
      [130, -32],
      [124, -34],
      [116, -34],
      [114, -27],
      [114, -22],
    ],
  },
  {
    name: 'antarctica',
    points: [
      [-180, -71],
      [-140, -74],
      [-100, -72],
      [-60, -70],
      [-20, -69],
      [20, -67],
      [60, -66],
      [100, -66],
      [140, -68],
      [180, -70],
      [-180, -71],
    ],
  },
];

/** Map (lon, lat) into the 360×180 equirectangular viewBox. */
export function mapPoint(lon: number, lat: number): { x: number; y: number } {
  return { x: lon + 180, y: 90 - lat };
}

export interface GeoPoint {
  lat: number;
  lon: number;
}

/**
 * Great-circle interpolation (D061): n evenly spaced points along the
 * shortest great-circle arc between two places, endpoints included. Points
 * are returned as (lat, lon) degree pairs — the equirectangular coordinate
 * space — and follow the true great circle via spherical interpolation
 * (slerp on unit vectors), so a Leaflet polyline of these points reads as
 * the geodesic. Antipodal endpoints (every arc is valid) fall back to a
 * stable linear lat/lon interpolation.
 */
export function greatCirclePoints(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  n = 100
): GeoPoint[] {
  const count = Math.max(2, Math.floor(n));
  const toVec = (lat: number, lon: number): [number, number, number] => {
    const phi = (lat * Math.PI) / 180;
    const lambda = (lon * Math.PI) / 180;
    return [Math.cos(phi) * Math.cos(lambda), Math.cos(phi) * Math.sin(lambda), Math.sin(phi)];
  };
  const v1 = toVec(lat1, lon1);
  const v2 = toVec(lat2, lon2);
  const dot = Math.min(1, Math.max(-1, v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]));
  const theta = Math.acos(dot);
  const points: GeoPoint[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    let x: number;
    let y: number;
    let z: number;
    if (theta < 1e-9) {
      [x, y, z] = v1;
    } else if (Math.PI - theta < 1e-9) {
      // Antipodal: every great circle works; use a stable linear fallback.
      x = v1[0] + t * (v2[0] - v1[0]);
      y = v1[1] + t * (v2[1] - v1[1]);
      z = v1[2] + t * (v2[2] - v1[2]);
    } else {
      const s1 = Math.sin((1 - t) * theta) / Math.sin(theta);
      const s2 = Math.sin(t * theta) / Math.sin(theta);
      x = s1 * v1[0] + s2 * v2[0];
      y = s1 * v1[1] + s2 * v2[1];
      z = s1 * v1[2] + s2 * v2[2];
    }
    points.push({
      lat: (Math.asin(Math.min(1, Math.max(-1, z))) * 180) / Math.PI,
      lon: (Math.atan2(y, x) * 180) / Math.PI,
    });
  }
  return points;
}

/** Convert a click/press position (fractional of the rendered box) to lon/lat. */
export function pointToLonLat(fx: number, fy: number): { lon: number; lat: number } {
  return { lon: fx * 360 - 180, lat: 90 - fy * 180 };
}
