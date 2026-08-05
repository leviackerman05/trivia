#!/usr/bin/env node
/**
 * World Peek pano resolution (D062), build-time only — no runtime network.
 *
 * Reads the coordinate pool (src/data/world-peek-places.json) and resolves
 * each everyday place to the nearest Mapillary panoramic image via the
 * graph API, writing src/data/world-peek-panos.json:
 *   { [placeId]: { panoId, distanceM } }
 *
 * Requirements:
 *   - MAPILLARY_TOKEN (or PUBLIC_MAPILLARY_TOKEN) in the environment or .env
 *     (free client token: mapillary.com/dashboard/developers).
 *   - Without a token the script writes an empty map and exits 1 so the
 *     authoring step is loud (the D056 review-gate pattern): the game shows
 *     a "panoramas pending" state until panos are resolved.
 *
 * Deterministic: candidates are sorted by (distance, id) before the pick,
 * so the same coordinate pool always resolves the same pano — the D050
 * "same seed ⇒ same pano" contract. Rate-limit friendly: ~400ms between
 * requests.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PLACES_PATH = join(root, 'src/data/world-peek-places.json');
const PANOS_PATH = join(root, 'src/data/world-peek-panos.json');
const ENV_PATH = join(root, '.env');

// Max distance for a usable pano (~2 city blocks).
const MAX_DISTANCE_M = 250;
// Half-width of the search bbox in degrees (~0.004° ≈ 440 m).
const BBOX_HALF = 0.004;
const REQUEST_GAP_MS = 400;

// Minimal .env loader (dotenv-free, project has no deps for this).
function loadEnv() {
  if (!existsSync(ENV_PATH)) {
    return;
  }
  for (const line of readFileSync(ENV_PATH, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+)\s*$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function searchNear(accessToken, lon, lat) {
  const bbox = [lon - BBOX_HALF, lat - BBOX_HALF, lon + BBOX_HALF, lat + BBOX_HALF].join(',');
  const url =
    'https://graph.mapillary.com/search' +
    `?fields=id,is_pano,is_primary,computed_geometry&bbox=${bbox}&limit=100` +
    `&access_token=${encodeURIComponent(accessToken)}`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'trivia-site/1.0 (world-peek resolve)' },
  });
  if (!response.ok) {
    throw new Error(`Mapillary search HTTP ${response.status}`);
  }
  const data = await response.json();
  return data.data ?? [];
}

function distanceM(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

loadEnv();
const accessToken =
  process.env.MAPILLARY_TOKEN ??
  process.env.PUBLIC_MAPILLARY_TOKEN ??
  process.env.VITE_MAPILLARY_TOKEN;

if (!accessToken) {
  console.error(
    'resolve-world-peek-panos: MAPILLARY_TOKEN is not set. Add it to .env ' +
      '(free client token from mapillary.com/dashboard/developers), then re-run. ' +
      'Writing an empty pano map; the game will show "panoramas pending" until resolved.'
  );
  writeFileSync(PANOS_PATH, '{}');
  process.exit(1);
}

const places = JSON.parse(readFileSync(PLACES_PATH, 'utf8'));
const resolved = {};
const unresolved = [];

for (const place of places) {
  let candidates;
  try {
    candidates = await searchNear(accessToken, place.lon, place.lat);
  } catch (error) {
    console.warn(`  [warn] ${place.id}: ${error.message}`);
    unresolved.push(place.id);
    await sleep(REQUEST_GAP_MS);
    continue;
  }

  const scored = candidates
    .filter((image) => image.is_pano === true)
    .map((image) => {
      const [lon, lat] = image.computed_geometry?.coordinates ?? [NaN, NaN];
      return {
        panoId: image.id,
        lat,
        lon,
        isPrimary: image.is_primary === true,
        distance: distanceM(place.lat, place.lon, lat, lon),
      };
    })
    .filter((candidate) => Number.isFinite(candidate.distance))
    .sort(
      (a, b) =>
        a.distance - b.distance ||
        Number(b.isPrimary) - Number(a.isPrimary) ||
        a.panoId.localeCompare(b.panoId)
    );

  const best = scored.find((candidate) => candidate.distance <= MAX_DISTANCE_M);
  if (best) {
    resolved[place.id] = { panoId: best.panoId, distanceM: Math.round(best.distance) };
    console.log(`  ✓ ${place.id}: pano ${best.panoId} at ${Math.round(best.distance)} m`);
  } else {
    unresolved.push(place.id);
    console.warn(
      `  ✗ ${place.id}: no pano within ${MAX_DISTANCE_M} m (${scored[0]?.distance ? Math.round(scored[0].distance) + ' m nearest' : 'no coverage'})`
    );
  }
  await sleep(REQUEST_GAP_MS);
}

writeFileSync(PANOS_PATH, JSON.stringify(resolved, null, 2) + '\n');
console.log(`\nResolved ${Object.keys(resolved).length}/${places.length} places -> ${PANOS_PATH}`);
if (unresolved.length > 0) {
  console.log(`Unresolved (flagged at authoring): ${unresolved.join(', ')}`);
  process.exitCode = 1;
}
