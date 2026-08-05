import { useEffect, useRef, useState } from 'react';
import SoloShell from './SoloShell';
import Icon from '../../components/icons/Icon';
import placesJson from '../../data/world-peek-places.json';
import panosJson from '../../data/world-peek-panos.json';
import {
  greatCirclePoints,
  haversineKm,
  pickWorldPeekRounds,
  scoreGuess,
  WORLD_PEEK_ROUNDS,
  type WorldPeekPlace,
  type WorldPeekPanoMap,
  type WorldPeekRound,
} from '../../lib/world-peek';
import leafletCssUrl from 'leaflet/dist/leaflet.css?url';
import mapillaryCssUrl from 'mapillary-js/dist/mapillary.css?url';

/**
 * World Peek (PLAN-SCOPE R5 + D061/D062/D063): solo geography game with a
 * GeoGuessr composition. Each round: a full-bleed 360° Mapillary panorama
 * to study (LOOK), then a light-tile Leaflet map with the pano shrunk to a
 * corner inset (PIN), and the reveal draws the dotted great-circle line +
 * km label (D061). Pano ids are resolved at build time (D062); the viewer
 * and the map are lazy-loaded client-side (SSR-safe). The dark theme
 * doesn't apply here: the map is light by design (CartoDB Positron).
 * Trademark-safe: never "GeoGuessr" on-page.
 */

type LeafletModule = typeof import('leaflet');
type Viewer = import('mapillary-js').Viewer;

const entries = placesJson as WorldPeekPlace[];
const panos = panosJson as WorldPeekPanoMap;
// Astro exposes PUBLIC_* env vars to the client; the resolver script reads
// the same token from MAPILLARY_TOKEN / PUBLIC_MAPILLARY_TOKEN in .env.
const MAPILLARY_TOKEN = import.meta.env.PUBLIC_MAPILLARY_TOKEN as string | undefined;

/** Rounds only ever pick from places with a resolved pano (D062). */
const playableEntries = entries.filter((entry) => panos[entry.id]?.panoId);

type Phase = 'setup' | 'look' | 'pin' | 'reveal' | 'done';
type PanoStatus = 'idle' | 'loading' | 'ready' | 'error';

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
  const [showImage, setShowImage] = useState(false);
  const [panoStatus, setPanoStatus] = useState<PanoStatus>('idle');

  const panoElRef = useRef<HTMLDivElement | null>(null);
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const panoLoadedRef = useRef(false);
  const pinMarkerRef = useRef<import('leaflet').CircleMarker | null>(null);
  const roundLayersRef = useRef<import('leaflet').Layer[]>([]);
  const revealedRef = useRef(false);

  const round = rounds[index];
  const entry = round?.entry;
  const panoId = entry ? panos[entry.id]?.panoId : undefined;
  const panoVisible = !!entry && !!panoId;

  /* ── Leaflet map: init once, kept alive across rounds (no flicker). ── */
  useEffect(() => {
    if (phase !== 'pin' && phase !== 'reveal') {
      return; // keep the instance alive while hidden behind LOOK
    }
    const el = mapElRef.current;
    if (!el || mapRef.current) {
      return;
    }
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = leafletCssUrl;
      document.head.appendChild(link);
    }
    let cancelled = false;
    void (async () => {
      const L = await import('leaflet');
      if (cancelled || mapRef.current) {
        return;
      }
      leafletRef.current = L;
      const map = L.map(el, {
        minZoom: 2, // the whole world fits; maxBounds stops the void
        maxZoom: 18,
        maxBounds: L.latLngBounds([-85, -180], [85, 180]),
        maxBoundsViscosity: 1,
        attributionControl: false,
        zoomControl: true,
      });
      // [D063] Light theme default (CartoDB Positron); satellite is an
      // optional toggle, default OFF. Attribution sits bottom-left so the
      // pano inset (bottom-right) never covers it.
      const light = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      });
      const satellite = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          attribution:
            'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, GIS User Community',
        }
      );
      light.addTo(map);
      L.control.attribution({ position: 'bottomleft' }).addTo(map);
      L.control.layers({ Light: light, Satellite: satellite }).addTo(map);
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
        // Rausch pin (--color-primary #ff385c), white ring so it reads on
        // both light and satellite tiles.
        pinMarkerRef.current = L.circleMarker([lat, lng], {
          radius: 8,
          weight: 2.5,
          color: '#ffffff',
          fillColor: '#ff385c',
          fillOpacity: 1,
        }).addTo(map);
      });

      mapRef.current = map;
      map.invalidateSize();
    })();
    return () => {
      cancelled = true;
    };
  }, [phase]);

  /* ── 360° viewer: one instance per round (D062), destroyed on change. ── */
  useEffect(() => {
    if (phase === 'setup' || phase === 'done') {
      return;
    }
    if (!entry || !panoId || !MAPILLARY_TOKEN) {
      setPanoStatus('error');
      return;
    }
    const el = panoElRef.current;
    if (!el) {
      return;
    }
    if (!document.getElementById('mapillary-css')) {
      const link = document.createElement('link');
      link.id = 'mapillary-css';
      link.rel = 'stylesheet';
      link.href = mapillaryCssUrl;
      document.head.appendChild(link);
    }
    let cancelled = false;
    let viewer: Viewer | null = null;
    let resizeObserver: ResizeObserver | null = null;
    panoLoadedRef.current = false;
    setPanoStatus('loading');
    const timer = window.setTimeout(() => {
      if (!cancelled && !panoLoadedRef.current) {
        setPanoStatus('error');
      }
    }, 20000);
    // mapillary-js won't start loading until the container has a real
    // size; if the LOOK overlay reports 0×0 at mount (fixed-context
    // timing), the image never fetches and the round times out. Wait a
    // few frames for a measurable container before constructing.
    const waitForSize = (maxFrames = 10): Promise<void> =>
      new Promise((resolve) => {
        const tick = (frame: number) => {
          if (cancelled) {
            return;
          }
          if ((el.clientWidth > 0 && el.clientHeight > 0) || frame >= maxFrames) {
            resolve();
            return;
          }
          requestAnimationFrame(() => tick(frame + 1));
        };
        tick(0);
      });

    void import('mapillary-js')
      .then(async ({ Viewer: MapillaryViewer }) => {
        if (cancelled) {
          return;
        }
        await waitForSize();
        if (cancelled) {
          return;
        }
        try {
          viewer = new MapillaryViewer({
            container: el,
            imageId: panoId,
            accessToken: MAPILLARY_TOKEN,
            trackResize: true,
          });
          viewerRef.current = viewer;
          // The pano container changes size across LOOK/PIN swaps and
          // device rotation; a ResizeObserver keeps the three.js canvas
          // honest instead of relying on phase-based resize calls.
          resizeObserver = new ResizeObserver(() => viewer?.resize());
          resizeObserver.observe(el);
          viewer.on('load', () => {
            panoLoadedRef.current = true;
            setPanoStatus('ready');
          });
          // GeoGuessr-style exploration (owner 2026-08-05): direction
          // arrows + sequence + spatial let the player walk connected
          // panoramas to gather clues before pinning. Object tags are
          // hidden; the answer remains the START pano (entry coords).
          viewer.deactivateComponent('tag');
        } catch {
          setPanoStatus('error');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPanoStatus('error');
        }
      });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      resizeObserver?.disconnect();
      if (viewer) {
        viewer.remove();
      }
      if (viewerRef.current === viewer) {
        viewerRef.current = null;
      }
    };
  }, [entry?.id]);

  /* Keep the viewer + map sized to their containers across state swaps. */
  useEffect(() => {
    if (phase === 'pin' || phase === 'reveal') {
      viewerRef.current?.resize();
      mapRef.current?.invalidateSize();
    }
  }, [phase, showImage]);

  /* LOOK is full-bleed: lock body scroll so the fixed overlay can't be
     pushed by the page behind it (GeoGuessr-style, D063). */
  useEffect(() => {
    if (phase !== 'look') {
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [phase]);

  /* Tear down the heavy instances when the play area unmounts. */
  useEffect(() => {
    if (phase === 'setup' || phase === 'done') {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      viewerRef.current?.remove();
      viewerRef.current = null;
      pinMarkerRef.current = null;
      roundLayersRef.current = [];
      leafletRef.current = null;
      panoLoadedRef.current = false;
    }
  }, [phase]);

  useEffect(
    () => () => {
      mapRef.current?.remove();
      viewerRef.current?.remove();
    },
    []
  );

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
    setRounds(pickWorldPeekRounds(playableEntries, WORLD_PEEK_ROUNDS, seed));
    setIndex(0);
    setScore(0);
    setResults([]);
    setPin(null);
    setResult(null);
    setShowImage(false);
    setPanoStatus('idle');
    revealedRef.current = false;
    setPhase('look');
  };

  const continueToPin = () => {
    setShowImage(false);
    setPhase('pin');
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
    // Dotted great-circle line between guess and actual (D061), Rausch.
    const arc = greatCirclePoints(pin.lat, pin.lng, entry.lat, entry.lon, 100).map((p) =>
      L.latLng(p.lat, p.lon)
    );
    const line = L.polyline(arc, {
      color: '#ff385c', // --color-primary (Rausch)
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
    setPhase('reveal');
  };

  const next = () => {
    if (index + 1 >= rounds.length) {
      setPhase('done');
      return;
    }
    setIndex((previous) => previous + 1);
    setPin(null);
    setResult(null);
    setShowImage(false);
    setPanoStatus('idle');
    revealedRef.current = false;
    clearRoundLayers();
    setPhase('look');
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
          Five 360° panoramas from everyday places around the world. Look around, then pin the spot
          on the map. The closer you land, the more points you score.
        </p>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-pill bg-surface-muted px-3 py-1 text-xs font-semibold text-ink">
            360° views
          </span>
          <span className="rounded-pill bg-surface-muted px-3 py-1 text-xs font-semibold text-ink">
            {entries.length}+ places
          </span>
          <span className="rounded-pill bg-surface-muted px-3 py-1 text-xs font-semibold text-ink">
            No monuments
          </span>
        </div>
        {playableEntries.length > 0 ? (
          <button
            type="button"
            onClick={start}
            className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary px-7 py-3 text-lg font-semibold text-white  transition-colors hover:bg-primary-hover sm:self-start"
          >
            Start the game
          </button>
        ) : (
          <p className="text-small text-ink-muted">
            Panoramas are being prepared. Add a Mapillary token and run pnpm resolve:world-peek.
          </p>
        )}
      </div>
    );
  }

  const panoWrapCls =
    phase === 'look'
      ? 'absolute inset-0'
      : showImage
        ? 'absolute inset-0 z-30 bg-surface'
        : // [D063] mobile: bottom-sheet panel; desktop (sm+): corner inset.
          'absolute inset-x-3 bottom-3 z-20 h-36 overflow-hidden rounded-lg border border-border shadow-lg sm:inset-x-auto sm:right-3 sm:h-48 sm:w-72';

  return (
    <SoloShell
      slug="world-peek"
      name="World Peek"
      phase={phase === 'done' ? 'done' : 'playing'}
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
          <div
            className={
              phase === 'look'
                ? 'fixed inset-0 z-40 h-dvh overflow-hidden bg-surface'
                : 'relative h-[58dvh] min-h-80 overflow-hidden rounded-lg border border-border sm:h-[calc(100dvh-13rem)]'
            }
          >
            {/* Light-tile Leaflet map (hidden behind the full-bleed pano in LOOK). */}
            <div
              ref={mapElRef}
              aria-label="World map, tap to place your guess"
              className={phase === 'look' ? 'absolute inset-0 hidden' : 'absolute inset-0 z-0'}
            />

            {/* Mapillary 360° viewer container (kept mounted for the round). */}
            <div
              ref={panoElRef}
              className={panoWrapCls}
              role={phase === 'look' ? 'button' : undefined}
              tabIndex={phase === 'look' ? 0 : undefined}
              aria-label={
                phase === 'look'
                  ? '360° view of this round location. Look around, then show the map.'
                  : undefined
              }
              onClick={phase === 'look' ? continueToPin : undefined}
              onKeyDown={
                phase === 'look'
                  ? (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        continueToPin();
                      }
                    }
                  : undefined
              }
            />
            {panoVisible && panoStatus !== 'ready' && (
              <div
                className={`${
                  phase === 'look' ? 'absolute inset-0 z-10' : 'absolute inset-0 z-10'
                } flex items-center justify-center bg-surface-muted px-6 text-center`}
              >
                <p className="text-small text-ink-muted">
                  {panoStatus === 'loading'
                    ? 'Loading the view…'
                    : "The panorama couldn't load for this round."}
                </p>
              </div>
            )}

            {phase === 'look' && (
              <>
                <div className="absolute left-3 top-3 z-40 flex items-center gap-2 rounded-pill bg-surface-raised/90 px-4 py-2 shadow-sm">
                  <span className="text-xs font-semibold text-ink">
                    Round {Math.min(index + 1, rounds.length)} of {rounds.length}
                  </span>
                  <span className="text-xs font-semibold text-ink-muted">Score: {score}</span>
                </div>
                <div className="absolute inset-x-0 bottom-0 z-40 flex flex-col items-center gap-3 bg-gradient-to-t from-black/30 to-transparent px-4 pb-6 pt-24">
                  <p className="text-center text-small font-medium text-white">
                    Drag to look around, pinch to zoom.
                  </p>
                  <button
                    type="button"
                    onClick={continueToPin}
                    className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary px-7 py-3 text-lg font-semibold text-white  transition-colors hover:bg-primary-hover"
                  >
                    I've looked — show the map
                  </button>
                </div>
              </>
            )}

            {(phase === 'pin' || phase === 'reveal') && (
              <button
                type="button"
                onClick={() => setShowImage((visible) => !visible)}
                aria-expanded={showImage}
                aria-label={showImage ? 'Hide the 360° view' : 'Show the 360° view over the map'}
                className="absolute right-3 top-3 z-40 inline-flex min-h-12 items-center gap-2 rounded-md bg-surface-raised px-4 text-small font-semibold text-ink shadow-sm transition-colors hover:bg-surface-muted"
              >
                <Icon name={showImage ? 'x' : 'globe'} size={18} />
                {showImage ? 'Hide image' : 'Show image'}
              </button>
            )}
          </div>

          {phase === 'pin' && (
            <button
              type="button"
              disabled={pin === null}
              onClick={submit}
              className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary px-7 py-3 text-lg font-semibold text-white  transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-40 sm:self-start"
            >
              {pin ? 'Submit guess' : 'Tap the map to pin your guess'}
            </button>
          )}

          {phase === 'reveal' && (
            <div className="flex flex-wrap items-center gap-3">
              <p
                role="status"
                className={`text-body font-bold ${
                  result!.distance <= 100
                    ? 'text-success-strong'
                    : result!.distance <= 2000
                      ? 'text-warning-strong'
                      : 'text-danger-strong'
                }`}
              >
                {result!.distance < 1
                  ? `Spot on, it's ${entry.place}. +${result!.points} points`
                  : `${Math.round(result!.distance).toLocaleString()} km away, it's ${entry.place}. +${result!.points} points`}
              </p>
              <button
                type="button"
                onClick={next}
                className="inline-flex min-h-12 items-center justify-center rounded-pill bg-secondary px-7 py-3 text-lg font-semibold text-white  transition-colors hover:bg-secondary-dark sm:ml-auto"
              >
                {index + 1 >= rounds.length ? 'See my score' : 'Next view'}
              </button>
            </div>
          )}
        </div>
      )}
    </SoloShell>
  );
}
