import { useState, type MouseEvent } from 'react';
import SoloShell from './SoloShell';
import placesJson from '../../data/world-peek-places.json';
import {
  haversineKm,
  mapPoint,
  pickWorldPeekRounds,
  pointToLonLat,
  scoreGuess,
  WORLD_CONTINENTS,
  WORLD_PEEK_ROUNDS,
  type WorldPeekPlace,
  type WorldPeekRound,
} from '../../lib/world-peek';

/**
 * World Peek (PLAN-SCOPE R5, M23): solo at launch. One photo per round;
 * tap the simplified SVG world map to pin your guess, score by distance
 * (1000 pts minus a penalty, exact pin = bonus). Photo credits render on
 * the reveal (CC-BY/SA). Trademark-safe: never "GeoGuessr" on-page.
 */

const entries = placesJson as WorldPeekPlace[];

type Phase = 'setup' | 'playing' | 'done';

interface Pin {
  x: number;
  y: number;
}

interface RoundResult {
  distance: number;
  points: number;
}

export default function WorldPeek() {
  const [phase, setPhase] = useState<Phase>('setup');
  const [rounds, setRounds] = useState<WorldPeekRound[]>([]);
  const [index, setIndex] = useState(0);
  const [pin, setPin] = useState<Pin | null>(null);
  const [result, setResult] = useState<RoundResult | null>(null);
  const [score, setScore] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [imgError, setImgError] = useState(false);

  const round = rounds[index];
  const entry = round?.entry;

  const start = () => {
    const seed = Math.floor(Math.random() * 1e9);
    setRounds(pickWorldPeekRounds(entries, WORLD_PEEK_ROUNDS, seed));
    setIndex(0);
    setScore(0);
    setResults([]);
    setPin(null);
    setResult(null);
    setImgError(false);
    setPhase('playing');
  };

  const placePin = (event: MouseEvent<SVGSVGElement>) => {
    if (result) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const fx = (event.clientX - rect.left) / rect.width;
    const fy = (event.clientY - rect.top) / rect.height;
    const { lon, lat } = pointToLonLat(Math.min(1, Math.max(0, fx)), Math.min(1, Math.max(0, fy)));
    setPin(mapPoint(lon, lat));
  };

  const submit = () => {
    if (!entry || !pin || result) {
      return;
    }
    const guess = pointToLonLat(pin.x / 360, pin.y / 180);
    const distance = haversineKm(entry.lat, entry.lon, guess.lat, guess.lon);
    const points = scoreGuess(distance);
    setResult({ distance, points });
    setScore((previous) => previous + points);
    setResults((previous) => [...previous, { distance, points }]);
  };

  const next = () => {
    if (index + 1 >= rounds.length) {
      setPhase('done');
      return;
    }
    setIndex((previous) => previous + 1);
    setPin(null);
    setResult(null);
    setImgError(false);
  };

  const playAgain = () => {
    setPhase('setup');
    setRounds([]);
    setResults([]);
  };

  if (phase === 'setup') {
    return (
      <div className="flex flex-col gap-5 rounded-lg border border-border bg-surface-raised p-4 sm:p-6 shadow-sm">
        <h3 className="text-lg font-bold tracking-tight text-ink">World Peek</h3>
        <p className="max-w-xl text-body text-ink-muted">
          Five photos from around the world. Tap the map to pin where you think each one was taken,
          then score by how close you land. Perfect pins earn a bonus.
        </p>
        <button
          type="button"
          onClick={start}
          className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary px-7 py-3 text-lg font-semibold text-white  transition-colors hover:bg-primary-hover sm:self-start"
        >
          Start the game
        </button>
      </div>
    );
  }

  const actual = entry ? mapPoint(entry.lon, entry.lat) : null;

  return (
    <SoloShell
      slug="world-peek"
      name="World Peek"
      phase={phase}
      round={Math.min(index + 1, rounds.length)}
      totalRounds={rounds.length || WORLD_PEEK_ROUNDS}
      score={score}
      resultSummary={
        <p className="text-body text-ink-muted">
          {results.length} of {results.length || WORLD_PEEK_ROUNDS} rounds,{' '}
          {results.filter((item) => item.distance <= 100).length} within 100 km
        </p>
      }
      onPlayAgain={playAgain}
    >
      {entry && (
        <div className="flex flex-col gap-4">
          <figure className="rounded-lg border border-border bg-surface-raised p-3 shadow-sm">
            {!imgError ? (
              <img
                src={entry.image}
                alt=""
                width={800}
                height={450}
                loading="lazy"
                decoding="async"
                onError={() => setImgError(true)}
                className="mx-auto max-h-72 rounded-lg border border-border object-contain"
              />
            ) : (
              <div className="mx-auto flex max-h-72 min-h-40 items-center justify-center rounded-lg bg-surface-muted px-6 text-center">
                <p className="text-small text-ink-muted">
                  Where in the world is this? (Photo unavailable, the clue stands.)
                </p>
              </div>
            )}
            {result && entry.credit && (
              <figcaption className="mt-2 text-center text-xs text-ink-muted">
                Photo: {entry.credit.creator}, {entry.credit.license} license
              </figcaption>
            )}
          </figure>

          <svg
            viewBox="0 0 360 180"
            role="img"
            aria-label="World map, tap to pin your guess"
            onClick={placePin}
            className="wp-map w-full touch-manipulation rounded-lg border border-border"
          >
            {WORLD_CONTINENTS.map((continent) => (
              <polygon
                key={continent.name}
                points={continent.points
                  .map(([lon, lat]) => {
                    const p = mapPoint(lon, lat);
                    return `${p.x},${p.y}`;
                  })
                  .join(' ')}
                className="wp-land"
              />
            ))}
            {result && actual && (
              <circle cx={actual.x} cy={actual.y} r={3} className="fill-ink" aria-hidden="true" />
            )}
            {pin && (
              <circle
                cx={pin.x}
                cy={pin.y}
                r={3}
                className="fill-primary"
                stroke="#fff"
                strokeWidth={1}
                aria-hidden="true"
              />
            )}
          </svg>

          {!result ? (
            <button
              type="button"
              disabled={pin === null}
              onClick={submit}
              className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary px-7 py-3 text-lg font-semibold text-white  transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-40 sm:self-start"
            >
              {pin ? 'Submit guess' : 'Tap the map to pin your guess'}
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <p
                role="status"
                className={`text-body font-bold ${
                  result.distance <= 100
                    ? 'text-success-strong'
                    : result.distance <= 2000
                      ? 'text-warning-strong'
                      : 'text-danger-strong'
                }`}
              >
                {result.distance < 1
                  ? `Spot on, it's ${entry.place}. +${result.points} points`
                  : `${Math.round(result.distance).toLocaleString()} km away, it's ${entry.place}. +${result.points} points`}
              </p>
              <button
                type="button"
                onClick={next}
                className="inline-flex min-h-12 items-center justify-center rounded-pill bg-secondary px-7 py-3 text-lg font-semibold text-white  transition-colors hover:bg-secondary-dark sm:ml-auto"
              >
                {index + 1 >= rounds.length ? 'See my score' : 'Next photo'}
              </button>
            </div>
          )}
        </div>
      )}
    </SoloShell>
  );
}
