import { useEffect, useRef, useState } from 'react';
import SoloShell from './SoloShell';
import placesJson from '../../data/world-peek-places.json';
import {
  greatCirclePoints,
  haversineKm,
  pickWorldPeekRounds,
  scoreGuess,
  WORLD_PEEK_ROUNDS,
  type WorldPeekPlace,
  type WorldPeekRound,
} from '../../lib/world-peek';
import 'leaflet/dist/leaflet.css';

/**
 * World Peek (PLAN-SCOPE R5, M23 + D061): solo at launch. One photo per
 * round; tap the Leaflet map to pin your guess, score by distance (1000 pts
 * minus a penalty, exact pin = bonus). The reveal marks the guess and the
 * actual location, draws a dotted great-circle line, and labels the
 * distance at the midpoint — GeoGuessr-style. Default layer is Esri World
 * Imagery (satellite, attribution required) with an OSM streets toggle.
 * Photo credits render on the reveal (CC-BY/SA). Trademark-safe: never
 * "GeoGuessr" on-page.
 */

type LeafletModule = typeof import('leaflet');

const entries = placesJson as WorldPeekPlace[];

type Phase = 'setup' | 'playing' | 'done';

interface GuessPin {
  lat: number;
  lng: number;
}

interface RoundResult {
  distance: number;
  points: number;
}

export default function WorldPeek() {
  const [phase, setPhase] = useState<Phase>('setup');
  const [rounds, setRounds] = useState<WorldPeekRound[]>([]);
  const [index, setIndex] = useState(0);
  const [pin, setPin] = useState<GuessPin | null>(null);
  const [result, setResult] = useState<RoundResult | null>(null);
  const [score, setScore] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [imgError, setImgError] = useState(false);

  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const pinMarkerRef = useRef<import('leaflet').CircleMarker | null>(null);
  const roundLayersRef = useRef<import('leaflet').Layer[]>([]);
  const revealedRef = useRef(false);

  const round = rounds[index];
  const entry = round?.entry;

  // Map lifecycle (D060 contract: init once, no per-render reinit). Leaflet
  // is imported client-side so SSR never evaluates it; the playing phase
  // mounts the map element, and SoloShell unmounts it when the game ends.
  useEffect(() => {
    if (phase !== 'playing') {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        pinMarkerRef.current = null;
        roundLayersRef.current = [];
      }
      leafletRef.current = null;
      return;
    }
    const el = mapElRef.current;
    if (!el || mapRef.current) {
      return;
    }
    let cancelled = false;
    void import('leaflet').then((L) => {
      if (cancelled || mapRef.current) {
        return;
      }
      leafletRef.current = L;
      const map = L.map(el, {
        minZoom: 2, // the whole world fits; maxBounds below stops the void
        maxZoom: 18,
        maxBounds: L.latLngBounds([-85, -180], [85, 180]),
        maxBoundsViscosity: 1,
        attributionControl: true,
      });
      // [D061] Satellite default (Esri World Imagery, no key) + OSM streets
      // toggle. Esri attribution is a licensing requirement, keep verbatim.
      const satellite = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          attribution:
            'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, GIS User Community',
        }
      );
      const streets = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors',
      });
      satellite.addTo(map);
      L.control.layers({ Satellite: satellite, Streets: streets }).addTo(map);
      map.setView([20, 0], 2);

      map.on('click', (event: import('leaflet').LeafletMouseEvent) => {
        if (revealedRef.current) {
          return;
        }
        const { lat, lng } = event.latlng;
        setPin({ lat, lng });
        if (pinMarkerRef.current) {
          map.removeLayer(pinMarkerRef.current);
        }
        // Rausch pin (--color-primary #ff385c) with a white ring so it reads
        // on both satellite and streets tiles.
        pinMarkerRef.current = L.circleMarker([lat, lng], {
          radius: 8,
          weight: 2.5,
          color: '#ffffff',
          fillColor: '#ff385c',
          fillOpacity: 1,
        }).addTo(map);
      });

      mapRef.current = map;
    });
    return () => {
      cancelled = true;
    };
  }, [phase]);

  const clearRoundLayers = () => {
    const map = mapRef.current;
    if (map) {
      for (const layer of roundLayersRef.current) {
        map.removeLayer(layer);
      }
      if (pinMarkerRef.current) {
        map.removeLayer(pinMarkerRef.current);
        pinMarkerRef.current = null;
      }
    }
    roundLayersRef.current = [];
  };

  const start = () => {
    const seed = Math.floor(Math.random() * 1e9);
    setRounds(pickWorldPeekRounds(entries, WORLD_PEEK_ROUNDS, seed));
    setIndex(0);
    setScore(0);
    setResults([]);
    setPin(null);
    setResult(null);
    setImgError(false);
    revealedRef.current = false;
    setPhase('playing');
  };

  const submit = () => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!entry || !pin || result || !L || !map) {
      return;
    }
    const distance = haversineKm(entry.lat, entry.lon, pin.lat, pin.lng);
    const points = scoreGuess(distance);
    revealedRef.current = true;
    setResult({ distance, points });
    setScore((previous) => previous + points);
    setResults((previous) => [...previous, { distance, points }]);

    const guessLatLng = L.latLng(pin.lat, pin.lng);
    const actualLatLng = L.latLng(entry.lat, entry.lon);
    // Actual location: ink marker, distinct from the Rausch guess pin.
    const actualMarker = L.circleMarker(actualLatLng, {
      radius: 8,
      weight: 2.5,
      color: '#ffffff',
      fillColor: '#222222', // --color-ink
      fillOpacity: 1,
    });
    // Dotted great-circle line between guess and actual (D061).
    const arc = greatCirclePoints(pin.lat, pin.lng, entry.lat, entry.lon, 100).map((p) =>
      L.latLng(p.lat, p.lon)
    );
    const line = L.polyline(arc, {
      color: '#222222',
      weight: 2.5,
      dashArray: '4,6',
      lineCap: 'round',
    });
    // Distance label at the midpoint: self-centered pill via divIcon.
    const mid = arc[Math.floor(arc.length / 2)];
    const label = L.marker(mid, {
      interactive: false,
      icon: L.divIcon({
        className: '',
        html: `<div style="display:inline-block;transform:translate(-50%,-50%);background:#ffffff;color:#222222;border:1px solid #dddddd;border-radius:9999px;padding:4px 10px;font-size:13px;font-weight:600;box-shadow:0 2px 6px rgb(0 0 0 / 0.1);white-space:nowrap">${Math.round(
          distance
        ).toLocaleString()} km</div>`,
      }),
    });
    actualMarker.addTo(map);
    line.addTo(map);
    label.addTo(map);
    roundLayersRef.current.push(actualMarker, line, label);
    map.fitBounds(L.latLngBounds([guessLatLng, actualLatLng]), { padding: [48, 48] });
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
    revealedRef.current = false;
    clearRoundLayers();
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

          <div
            ref={mapElRef}
            aria-label="World map, tap to pin your guess"
            className="h-72 w-full overflow-hidden rounded-lg border border-border sm:h-96"
          />

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
