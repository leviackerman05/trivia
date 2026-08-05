#!/usr/bin/env node
/**
 * Placeguessr pano resolution (D062), build-time only — no runtime network.
 *
 * Reads the coordinate pool (src/data/placeguessr-places.json) and resolves
 * each everyday place to the nearest Mapillary panoramic image via the
 * graph API, writing src/data/placeguessr-panos.json:
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
const PLACES_PATH = join(root, 'src/data/placeguessr-places.json');
const PANOS_PATH = join(root, 'src/data/placeguessr-panos.json');
const ENV_PATH = join(root, '.env');

// Max distance for a usable pano (~2 city blocks).
// Half-width of the search bbox in degrees. Mapillary's /images bbox
// caps the area (0.004° half was rejected with HTTP 400 "reduce the
// amount of data"); 0.001° half (~220 m) is verified working.
// Fallback ladder: rung 0 stays tight (≤250 m), rung 1 widens to
// ~440 m and accepts panos up to 500 m away.
const BBOX_RUNGS = [
  { half: 0.001, maxDistanceM: 250 },
  { half: 0.002, maxDistanceM: 500 },
  { half: 0.003, maxDistanceM: 800 },
];
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
  for (const rung of BBOX_RUNGS) {
    const bbox = [lon - rung.half, lat - rung.half, lon + rung.half, lat + rung.half].join(',');
    const url =
      'https://graph.mapillary.com/images' +
      `?fields=id,is_pano,is_primary,computed_geometry&bbox=${bbox}&limit=100&is_pano=true`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'trivia-site/1.0 (placeguessr resolve)',
        Authorization: `OAuth ${accessToken}`,
      },
    });
    if (!response.ok) {
      continue; // rung rejected (bbox too wide) — try the next
    }
    const data = await response.json();
    const panos = data.data ?? [];
    if (panos.length === 0) {
      continue;
    }
    const nearest = panos
      .map((pano) => ({
        pano,
        distanceM: distanceM(
          lat,
          lon,
          pano.computed_geometry?.coordinates?.[1],
          pano.computed_geometry?.coordinates?.[0]
        ),
      }))
      .filter((item) => Number.isFinite(item.distanceM) && item.distanceM <= rung.maxDistanceM)
      .sort(
        (a, b) =>
          a.distanceM - b.distanceM ||
          Number(b.pano.is_primary === true) - Number(a.pano.is_primary === true)
      )[0];
    if (nearest) {
      return nearest;
    }
  }
  return null;
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
    'resolve-placeguessr-panos: MAPILLARY_TOKEN is not set. Add it to .env ' +
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
  let nearest;
  try {
    nearest = await searchNear(accessToken, place.lon, place.lat);
  } catch (error) {
    console.warn(`  [warn] ${place.id}: ${error.message}`);
    unresolved.push(place.id);
    await sleep(REQUEST_GAP_MS);
    continue;
  }

  if (nearest) {
    resolved[place.id] = { panoId: nearest.pano.id, distanceM: Math.round(nearest.distanceM) };
    console.log(`  ✓ ${place.id}: pano ${nearest.pano.id} at ${Math.round(nearest.distanceM)} m`);
  } else {
    unresolved.push(place.id);
    console.warn(
      `  ✗ ${place.id}: no pano within ${BBOX_RUNGS[BBOX_RUNGS.length - 1].maxDistanceM} m (no coverage)`
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
