#!/usr/bin/env node
/**
 * Placeguessr content pool generator (D063, PLAN-SCOPE R5).
 *
 * Same pipeline discipline as the D056 price resolver: nothing unresolved
 * ships; every output is reviewable. The game dataset (placeguessr-places.json)
 * only ever contains entries with a resolved Mapillary pano.
 *
 * Stages (each separately runnable, deterministic re-runs):
 *   --sample   S0-S2: region slate → OSM street-way sampling (member nodes
 *              of residential/primary/secondary/tertiary ways) → landmark
 *              exclusion. Writes the candidate cache.
 *   --resolve  S3:    Mapillary pano-ID lookup per candidate (~1 rps,
 *              retry + backoff; MAPILLARY_TOKEN from build env).
 *   --apply    S4:    write placeguessr-places.json (resolved entries ONLY)
 *              + scripts/.cache/ review list + per-region resolve rates.
 *
 * Default (no flag): sample → resolve → apply.
 * --full: target 2,000+ entries (40/city); default is the 50-entry sample
 * (1/city, all five regions covered).
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATASET_PATH = join(root, 'src/data/placeguessr-places.json');
const CACHE_DIR = join(root, 'scripts/.cache');
const REVIEW_PATH = join(CACHE_DIR, 'placeguessr-review.json');
const CANDIDATES_PATH = join(CACHE_DIR, 'placeguessr-candidates.json');

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.osm.ch/api/interpreter',
];
const OSM_API_MAP = 'https://api.openstreetmap.org/api/0.6/map';
const MAPILLARY_GRAPH = 'https://graph.mapillary.com/images';
const OSM_USER_AGENT = 'TriviaHub-dev/1.0 (placeguessr content pipeline)';
const RPS_DELAY_MS = 1000;
const MAX_RETRIES = 4;
const FULL_TARGET_PER_CITY = 40; // 50 cities × 40 = 2,000
const SAMPLE_PER_CITY = 1;
// OSM API map endpoint caps responses at 50k nodes; boxes start small and
// shrink on overflow so dense cities still sample.
const OSM_START_RADIUS_KM = 2;
const OSM_MIN_RADIUS_KM = 0.5;

// Once both Overpass endpoints fail (rate limit / empty), stop trying them
// for the rest of the run — the OSM API map endpoint is the reliable path.
let overpassUnavailable = false;

// ---------------------------------------------------------------------------
// S0 — region slate (D058 region quota: every region covered; ≥15 per cell
// at the full 2,000-entry target). Cities are chosen for street-level
// imagery availability — the Mapillary resolution constraint.

export const REGIONS = ['africa', 'americas', 'asia', 'europe', 'oceania'];

export const CITY_SLATE = [
  // --- africa (10) ---
  { city: 'Cape Town', country: 'ZA', region: 'africa', lat: -33.9249, lon: 18.4241, radiusKm: 4 },
  {
    city: 'Johannesburg',
    country: 'ZA',
    region: 'africa',
    lat: -26.2041,
    lon: 28.0473,
    radiusKm: 4,
  },
  { city: 'Nairobi', country: 'KE', region: 'africa', lat: -1.2921, lon: 36.8219, radiusKm: 4 },
  { city: 'Accra', country: 'GH', region: 'africa', lat: 5.6037, lon: -0.187, radiusKm: 3 },
  { city: 'Lagos', country: 'NG', region: 'africa', lat: 6.5244, lon: 3.3792, radiusKm: 4 },
  { city: 'Cairo', country: 'EG', region: 'africa', lat: 30.0444, lon: 31.2357, radiusKm: 4 },
  { city: 'Marrakesh', country: 'MA', region: 'africa', lat: 31.6295, lon: -7.9811, radiusKm: 3 },
  { city: 'Addis Ababa', country: 'ET', region: 'africa', lat: 9.03, lon: 38.74, radiusKm: 3 },
  { city: 'Kampala', country: 'UG', region: 'africa', lat: 0.3476, lon: 32.5825, radiusKm: 3 },
  { city: 'Dakar', country: 'SN', region: 'africa', lat: 14.7167, lon: -17.4677, radiusKm: 3 },
  // --- americas (10) ---
  { city: 'New York', country: 'US', region: 'americas', lat: 40.7128, lon: -74.006, radiusKm: 5 },
  {
    city: 'San Francisco',
    country: 'US',
    region: 'americas',
    lat: 37.7749,
    lon: -122.4194,
    radiusKm: 4,
  },
  {
    city: 'Mexico City',
    country: 'MX',
    region: 'americas',
    lat: 19.4326,
    lon: -99.1332,
    radiusKm: 4,
  },
  { city: 'Toronto', country: 'CA', region: 'americas', lat: 43.6532, lon: -79.3832, radiusKm: 4 },
  {
    city: 'Vancouver',
    country: 'CA',
    region: 'americas',
    lat: 49.2827,
    lon: -123.1207,
    radiusKm: 4,
  },
  {
    city: 'São Paulo',
    country: 'BR',
    region: 'americas',
    lat: -23.5505,
    lon: -46.6333,
    radiusKm: 4,
  },
  {
    city: 'Buenos Aires',
    country: 'AR',
    region: 'americas',
    lat: -34.6037,
    lon: -58.3816,
    radiusKm: 4,
  },
  { city: 'Bogotá', country: 'CO', region: 'americas', lat: 4.711, lon: -74.0721, radiusKm: 4 },
  { city: 'Lima', country: 'PE', region: 'americas', lat: -12.0464, lon: -77.0428, radiusKm: 3 },
  {
    city: 'Santiago',
    country: 'CL',
    region: 'americas',
    lat: -33.4489,
    lon: -70.6693,
    radiusKm: 3,
  },
  // --- asia (10) ---
  { city: 'Tokyo', country: 'JP', region: 'asia', lat: 35.6762, lon: 139.6503, radiusKm: 5 },
  { city: 'Bangkok', country: 'TH', region: 'asia', lat: 13.7563, lon: 100.5018, radiusKm: 4 },
  { city: 'Singapore', country: 'SG', region: 'asia', lat: 1.3521, lon: 103.8198, radiusKm: 4 },
  { city: 'Jakarta', country: 'ID', region: 'asia', lat: -6.2088, lon: 106.8456, radiusKm: 4 },
  { city: 'Manila', country: 'PH', region: 'asia', lat: 14.5995, lon: 120.9842, radiusKm: 4 },
  { city: 'Seoul', country: 'KR', region: 'asia', lat: 37.5665, lon: 126.978, radiusKm: 4 },
  { city: 'Kuala Lumpur', country: 'MY', region: 'asia', lat: 3.139, lon: 101.6869, radiusKm: 4 },
  { city: 'Delhi', country: 'IN', region: 'asia', lat: 28.6139, lon: 77.209, radiusKm: 4 },
  {
    city: 'Ho Chi Minh City',
    country: 'VN',
    region: 'asia',
    lat: 10.8231,
    lon: 106.6297,
    radiusKm: 4,
  },
  { city: 'Taipei', country: 'TW', region: 'asia', lat: 25.033, lon: 121.5654, radiusKm: 3 },
  // --- europe (10) ---
  { city: 'London', country: 'GB', region: 'europe', lat: 51.5074, lon: -0.1278, radiusKm: 5 },
  { city: 'Paris', country: 'FR', region: 'europe', lat: 48.8566, lon: 2.3522, radiusKm: 4 },
  { city: 'Berlin', country: 'DE', region: 'europe', lat: 52.52, lon: 13.405, radiusKm: 4 },
  { city: 'Madrid', country: 'ES', region: 'europe', lat: 40.4168, lon: -3.7038, radiusKm: 4 },
  { city: 'Rome', country: 'IT', region: 'europe', lat: 41.9028, lon: 12.4964, radiusKm: 4 },
  { city: 'Amsterdam', country: 'NL', region: 'europe', lat: 52.3676, lon: 4.9041, radiusKm: 3 },
  { city: 'Prague', country: 'CZ', region: 'europe', lat: 50.0755, lon: 14.4378, radiusKm: 3 },
  { city: 'Vienna', country: 'AT', region: 'europe', lat: 48.2082, lon: 16.3738, radiusKm: 3 },
  { city: 'Barcelona', country: 'ES', region: 'europe', lat: 41.3874, lon: 2.1686, radiusKm: 4 },
  { city: 'Budapest', country: 'HU', region: 'europe', lat: 47.4979, lon: 19.0402, radiusKm: 3 },
  // --- oceania (10) ---
  { city: 'Sydney', country: 'AU', region: 'oceania', lat: -33.8688, lon: 151.2093, radiusKm: 4 },
  {
    city: 'Melbourne',
    country: 'AU',
    region: 'oceania',
    lat: -37.8136,
    lon: 144.9631,
    radiusKm: 4,
  },
  { city: 'Brisbane', country: 'AU', region: 'oceania', lat: -27.4698, lon: 153.0251, radiusKm: 4 },
  { city: 'Perth', country: 'AU', region: 'oceania', lat: -31.9505, lon: 115.8605, radiusKm: 4 },
  { city: 'Adelaide', country: 'AU', region: 'oceania', lat: -34.9285, lon: 138.6007, radiusKm: 3 },
  { city: 'Hobart', country: 'AU', region: 'oceania', lat: -42.8821, lon: 147.3272, radiusKm: 3 },
  { city: 'Auckland', country: 'NZ', region: 'oceania', lat: -36.8509, lon: 174.7645, radiusKm: 4 },
  {
    city: 'Wellington',
    country: 'NZ',
    region: 'oceania',
    lat: -41.2866,
    lon: 174.7756,
    radiusKm: 3,
  },
  {
    city: 'Christchurch',
    country: 'NZ',
    region: 'oceania',
    lat: -43.5321,
    lon: 172.6362,
    radiusKm: 3,
  },
  { city: 'Honolulu', country: 'US', region: 'oceania', lat: 21.3069, lon: -157.8583, radiusKm: 3 },
];

// ---------------------------------------------------------------------------
// S2 — landmark exclusion. The blocklist is name-based (substring, folded);
// tag-based exclusions catch the rest. Exported so the dataset test can
// assert zero blocklist hits.

export const LANDMARK_BLOCKLIST = [
  'eiffel tower',
  'leaning tower',
  'pisa',
  'taj mahal',
  'statue of liberty',
  'sydney opera house',
  'big ben',
  'colosseum',
  'great wall',
  'machu picchu',
  'great pyramid',
  'sphinx',
  'stonehenge',
  'golden gate bridge',
  'sagrada',
  'notre-dame',
  'notre dame',
  'burj khalifa',
  'empire state',
  'christ the redeemer',
  'acropolis',
  'brandenburg gate',
  "st. peter's basilica",
  'tower of london',
  'mount rushmore',
  'niagara falls',
  'table mountain',
  'uluru',
  'harbour bridge',
  'london eye',
  'buckingham palace',
  'louvre',
  'alhambra',
  'kremlin',
  'hermitage',
  'parthenon',
  'angkor wat',
  'petra',
  'chichen itza',
  'stadium of light',
  'space needle',
  'wembley',
  'camp nou',
  'santuario',
];

const NOTABLE_NATURAL = new Set([
  'peak',
  'volcano',
  'cliff',
  'cave_entrance',
  'bay',
  'cape',
  'waterfall',
  'hill',
  'rock',
  'stone',
  'geyser',
]);

const NOTABLE_MAN_MADE = new Set(['tower', 'lighthouse', 'monument', 'mast', 'obelisk']);

const NOTABLE_TOURISM = new Set([
  'attraction',
  'museum',
  'viewpoint',
  'zoo',
  'aquarium',
  'gallery',
  'theme_park',
]);

/** True when an OSM node must be excluded from the game pool (S2). */
export function isLandmarkNode(node) {
  const tags = node.tags ?? {};
  if (typeof tags.tourism === 'string' && NOTABLE_TOURISM.has(tags.tourism)) {
    return true;
  }
  if (typeof tags.historic === 'string' && tags.historic.length > 0) {
    return true;
  }
  if (typeof tags.natural === 'string' && NOTABLE_NATURAL.has(tags.natural)) {
    return true;
  }
  if (typeof tags.man_made === 'string' && NOTABLE_MAN_MADE.has(tags.man_made)) {
    return true;
  }
  if (typeof tags.name === 'string') {
    const name = tags.name.toLowerCase();
    return LANDMARK_BLOCKLIST.some((token) => name.includes(token));
  }
  return false;
}

// ---------------------------------------------------------------------------
// Deterministic helpers (in-repo PRNG patterns, no new deps).

function fnv1a(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const slugify = (value) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

function bboxFor(city, radiusKm) {
  const dLat = radiusKm / 111;
  const dLon = radiusKm / (111 * Math.cos((city.lat * Math.PI) / 180));
  return {
    south: city.lat - dLat,
    west: city.lon - dLon,
    north: city.lat + dLat,
    east: city.lon + dLon,
  };
}

// ---------------------------------------------------------------------------
// S1 — OSM sampling. Street geometry lives on WAYS in OSM (nodes tagged
// highway=residential/primary/secondary/tertiary are crossings/signals), so
// each city query pulls street ways inside the box and every member node is
// a candidate coordinate. Overpass first, OSM API map endpoint fallback;
// deterministic seeded pick per city (re-runs stable).

/** Parse OSM XML (map endpoint) into a node map + way list. */
function parseOsmXml(xml) {
  const nodeMap = new Map();
  const ways = [];
  // Atomic element match: a self-closing <node .../> / <way .../> or a
  // tagged <node ...>...</node> / <way ...>...</way>. The backreference
  // keeps the lazy span from swallowing sibling elements.
  const elementPattern = /<(node|way)\b[^>]*?(?:\/>|>[\s\S]*?<\/\1>)/g;
  // \b keeps id="..." from matching inside uid="..." (the node id is
  // set BEFORE uid in the attribute list, so the uid match would win).
  const attrPattern = /\bid="(\d+)"|lat="([-\d.]+)"|lon="([-\d.]+)"/g;
  const tagPattern = /<tag k="([^"]+)" v="([^"]*)"\/>/g;
  const ndPattern = /<nd ref="(\d+)"\/>/g;
  let match;
  while ((match = elementPattern.exec(xml)) !== null) {
    const element = match[0];
    const attrs = {};
    let attr;
    attrPattern.lastIndex = 0;
    while ((attr = attrPattern.exec(element)) !== null) {
      if (attr[1] !== undefined) attrs.id = Number(attr[1]);
      else if (attr[2] !== undefined) attrs.lat = Number(attr[2]);
      else if (attr[3] !== undefined) attrs.lon = Number(attr[3]);
    }
    if (attrs.id === undefined) {
      continue;
    }
    const tags = {};
    let tagMatch;
    tagPattern.lastIndex = 0;
    while ((tagMatch = tagPattern.exec(element)) !== null) {
      tags[tagMatch[1]] = tagMatch[2];
    }
    if (match[1] === 'node') {
      if (attrs.lat === undefined || attrs.lon === undefined) {
        continue;
      }
      nodeMap.set(attrs.id, { id: attrs.id, lat: attrs.lat, lon: attrs.lon, tags });
    } else {
      const nd = [];
      let ndMatch;
      ndPattern.lastIndex = 0;
      while ((ndMatch = ndPattern.exec(element)) !== null) {
        nd.push(Number(ndMatch[1]));
      }
      ways.push({ id: attrs.id, tags, nd });
    }
  }
  return { nodeMap, ways };
}

/**
 * Collapse street ways into deduped candidate points: every member node of
 * every eligible way, landmark-excluded at both the way and node level. The
 * way's street name rides along so picks can carry a reveal label.
 */
function streetNodesFromWays(ways, nodeMap) {
  const points = [];
  const seenIds = new Set();
  for (const way of ways) {
    if (!/^(residential|primary|secondary|tertiary)$/.test(way.tags.highway ?? '')) {
      continue;
    }
    if (isLandmarkNode(way)) {
      continue;
    }
    const name = typeof way.tags.name === 'string' ? way.tags.name : null;
    for (const ref of way.nd) {
      const node = nodeMap.get(ref);
      if (!node || seenIds.has(node.id)) {
        continue;
      }
      if (isLandmarkNode(node)) {
        continue;
      }
      seenIds.add(node.id);
      points.push({ id: node.id, lat: node.lat, lon: node.lon, tags: node.tags, name });
    }
  }
  return points;
}

async function overpassStreetNodes(city, radiusKm) {
  if (overpassUnavailable) {
    return [];
  }
  const bbox = bboxFor(city, radiusKm);
  // Ways + their member nodes: `out tags` emits the ways, `>` adds members
  // to the result set, `out skel` emits them with coordinates.
  const query =
    `[out:json][timeout:30];` +
    `(way["highway"~"^(residential|primary|secondary|tertiary)$"]` +
    `(${bbox.south.toFixed(5)},${bbox.west.toFixed(5)},${bbox.north.toFixed(5)},${bbox.east.toFixed(5)}));` +
    `out tags;>;out skel;`;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(query)}`,
        });
        const text = await response.text();
        // Rate-limited instances answer with an HTML error page (HTTP 200/406
        // with a "rate_limited" remark) — treat as retryable.
        if (
          response.status === 429 ||
          response.status === 406 ||
          !response.ok ||
          text.includes('rate_limited')
        ) {
          if (attempt === MAX_RETRIES - 1) {
            throw new Error(`rate-limited on ${endpoint}`);
          }
          await sleep(RPS_DELAY_MS * 2 ** attempt * 2);
          continue;
        }
        const body = JSON.parse(text);
        const nodeMap = new Map(
          (body.elements ?? [])
            .filter((element) => element.type === 'node')
            .map((element) => [
              element.id,
              { id: element.id, lat: element.lat, lon: element.lon, tags: element.tags ?? {} },
            ])
        );
        const ways = (body.elements ?? [])
          .filter((element) => element.type === 'way')
          .map((element) => ({
            id: element.id,
            tags: element.tags ?? {},
            nd: element.nodes ?? [],
          }));
        const points = streetNodesFromWays(ways, nodeMap);
        if (points.length === 0) {
          throw new Error(`empty result on ${endpoint}`);
        }
        return points;
      } catch {
        if (attempt === MAX_RETRIES - 1) {
          overpassUnavailable = true; // both endpoints exhausted for this city
          break; // try the next endpoint
        }
        await sleep(RPS_DELAY_MS * 2 ** attempt * 2);
      }
    }
  }
  return [];
}

/** OSM API map endpoint: small boxes, shrink on the 50k-node overflow. */
async function osmApiStreetNodes(city, radiusKm) {
  let radius = Math.min(radiusKm, OSM_START_RADIUS_KM);
  while (radius >= OSM_MIN_RADIUS_KM) {
    const bbox = bboxFor(city, radius);
    const url =
      `${OSM_API_MAP}?bbox=${bbox.west.toFixed(5)},${bbox.south.toFixed(5)},` +
      `${bbox.east.toFixed(5)},${bbox.north.toFixed(5)}`;
    let response;
    let text = '';
    for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
      response = await fetch(url, { headers: { 'User-Agent': OSM_USER_AGENT } });
      text = await response.text();
      if (response.status === 429 || response.status >= 500) {
        if (attempt === MAX_RETRIES - 1) {
          throw new Error(`OSM API rate-limited for ${city.city}`);
        }
        // The OSM API limiter needs a real cooldown — back off hard (30s +).
        await sleep(30000 + RPS_DELAY_MS * 2 ** attempt);
        continue;
      }
      break;
    }
    if (text.includes('You requested too many nodes')) {
      radius /= 2;
      continue;
    }
    if (!response.ok) {
      throw new Error(`OSM API HTTP ${response.status} for ${city.city}`);
    }
    const { nodeMap, ways } = parseOsmXml(text);
    const points = streetNodesFromWays(ways, nodeMap);
    if (points.length === 0) {
      throw new Error(`no street nodes in ${city.city} box`);
    }
    return points;
  }
  return [];
}

/** S1 — sample street nodes for a city (Overpass first, OSM API fallback). */
async function fetchStreetNodes(city, radiusKm) {
  const overpass = await overpassStreetNodes(city, radiusKm);
  if (overpass.length > 0) {
    return overpass;
  }
  return osmApiStreetNodes(city, radiusKm);
}

function pickCandidates(nodes, city, count) {
  const usable = nodes.filter((node) => !isLandmarkNode(node));
  if (usable.length === 0) {
    return [];
  }
  const rand = mulberry32(fnv1a(`placeguessr:${city.city}:${city.region}`));
  const picked = [];
  const seen = new Set();
  // Deterministic shuffle-pick without replacement (bounded tries).
  const order = usable.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const swap = order[i];
    order[i] = order[j];
    order[j] = swap;
  }
  for (const index of order) {
    if (picked.length >= count) {
      break;
    }
    const node = usable[index];
    const key = `${node.lat.toFixed(5)},${node.lon.toFixed(5)}`;
    if (seen.has(key)) {
      continue; // exact-coordinate duplicates never ship twice
    }
    seen.add(key);
    picked.push({
      id: `wp-${slugify(city.city)}-${String(picked.length + 1).padStart(2, '0')}`,
      city: city.city,
      country: city.country,
      region: city.region,
      lat: node.lat,
      lon: node.lon,
      osmName: typeof node.name === 'string' ? node.name : null,
    });
  }
  return picked;
}

// ---------------------------------------------------------------------------
// S3 — Mapillary pano resolution (token-gated; ~1 rps, retry + backoff).

async function mapillaryPano(lat, lon) {
  const token = process.env.MAPILLARY_TOKEN;
  if (!token) {
    return { ok: false, reason: 'token-missing' };
  }
  const d = 0.001; // ~110 m window around the coordinate
  const url =
    `${MAPILLARY_GRAPH}?access_token=${encodeURIComponent(token)}` +
    `&fields=id&bbox=${lon - d},${lat - d},${lon + d},${lat + d}&is_pano=true&limit=5`;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.status === 429 || response.status >= 500) {
        if (attempt === MAX_RETRIES - 1) {
          return { ok: false, reason: `mapillary-http-${response.status}` };
        }
        await sleep(RPS_DELAY_MS * 2 ** attempt);
        continue;
      }
      if (!response.ok) {
        return { ok: false, reason: `mapillary-http-${response.status}` };
      }
      const body = await response.json();
      const pano = body?.data?.[0];
      if (!pano?.id) {
        return { ok: false, reason: 'no-pano' };
      }
      return { ok: true, panoId: pano.id };
    } catch {
      if (attempt === MAX_RETRIES - 1) {
        return { ok: false, reason: 'mapillary-unreachable' };
      }
      await sleep(RPS_DELAY_MS * 2 ** attempt);
    }
  }
  return { ok: false, reason: 'mapillary-unreachable' };
}

// ---------------------------------------------------------------------------

function readJsonOr(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

async function sampleStage(full) {
  mkdirSync(CACHE_DIR, { recursive: true });
  const perCity = full ? FULL_TARGET_PER_CITY : SAMPLE_PER_CITY;
  const radiusKm = full ? undefined : OSM_START_RADIUS_KM;
  // Resumable: keep existing candidates; only re-sample cities that haven't
  // reached the per-city target yet (picks are deterministic per city).
  const candidates = readJsonOr(CANDIDATES_PATH, []);
  const counts = new Map();
  for (const candidate of candidates) {
    counts.set(candidate.city, (counts.get(candidate.city) ?? 0) + 1);
  }
  for (const city of CITY_SLATE) {
    const have = counts.get(city.city) ?? 0;
    if (have >= perCity) {
      console.log(`skip ${city.city} (already ${have}/${perCity})`);
      continue;
    }
    let nodes = [];
    try {
      nodes = await fetchStreetNodes(city, radiusKm ?? city.radiusKm);
    } catch (error) {
      console.warn(`  [warn] ${city.city}: ${error instanceof Error ? error.message : error}`);
    }
    const picked = pickCandidates(nodes, city, perCity);
    candidates.push(...picked);
    counts.set(city.city, have + picked.length);
    console.log(
      `sampled ${picked.length}/${perCity} from ${nodes.length} street nodes in ${city.city} (${city.region})`
    );
    await sleep(2500); // be polite to the shared OSM quotas
  }
  writeFileSync(CANDIDATES_PATH, JSON.stringify(candidates, null, 2) + '\n');
  console.log(`candidates: ${candidates.length} (${full ? 'full' : 'sample'} mode)`);
}

async function resolveStage() {
  const candidates = readJsonOr(CANDIDATES_PATH, []);
  if (candidates.length === 0) {
    console.log('No candidates cached — run the sample stage first.');
    return;
  }
  let resolved = 0;
  for (const candidate of candidates) {
    const result = await mapillaryPano(candidate.lat, candidate.lon);
    if (result.ok) {
      candidate.panoId = result.panoId;
      candidate.resolved = true;
      resolved += 1;
    } else {
      candidate.resolved = false;
      candidate.unresolvedReason = result.reason;
    }
    await sleep(RPS_DELAY_MS); // ~1 rps pacing
  }
  writeFileSync(CANDIDATES_PATH, JSON.stringify(candidates, null, 2) + '\n');
  console.log(
    `resolve: ${resolved}/${candidates.length} (${process.env.MAPILLARY_TOKEN ? 'token present' : 'token missing'})`
  );
}

function difficultyFor(lat, lon) {
  return (fnv1a(`${lat.toFixed(6)}:${lon.toFixed(6)}`) % 3) + 1;
}

/** ISO-3166 alpha-2 → display name, for the reveal label (S0 slate only). */
const COUNTRY_NAMES = {
  ZA: 'South Africa',
  KE: 'Kenya',
  GH: 'Ghana',
  NG: 'Nigeria',
  EG: 'Egypt',
  MA: 'Morocco',
  ET: 'Ethiopia',
  UG: 'Uganda',
  SN: 'Senegal',
  US: 'United States',
  MX: 'Mexico',
  CA: 'Canada',
  BR: 'Brazil',
  AR: 'Argentina',
  CO: 'Colombia',
  PE: 'Peru',
  CL: 'Chile',
  JP: 'Japan',
  TH: 'Thailand',
  SG: 'Singapore',
  ID: 'Indonesia',
  PH: 'Philippines',
  KR: 'South Korea',
  MY: 'Malaysia',
  IN: 'India',
  VN: 'Vietnam',
  TW: 'Taiwan',
  GB: 'United Kingdom',
  FR: 'France',
  DE: 'Germany',
  ES: 'Spain',
  IT: 'Italy',
  NL: 'Netherlands',
  CZ: 'Czechia',
  AT: 'Austria',
  HU: 'Hungary',
  AU: 'Australia',
  NZ: 'New Zealand',
};

/**
 * Reveal label: street + city when the sampled way has a name, else
 * city + country. Never a monument name (S2 guarantees the source).
 */
export function placeLabel(candidate) {
  if (typeof candidate.osmName === 'string' && candidate.osmName.length > 0) {
    return `${candidate.osmName}, ${candidate.city}`;
  }
  return `${candidate.city}, ${COUNTRY_NAMES[candidate.country] ?? candidate.country}`;
}

async function applyStage() {
  const candidates = readJsonOr(CANDIDATES_PATH, []);
  const resolved = candidates.filter((candidate) => candidate.resolved === true);
  const review = { generatedAt: new Date().toISOString(), perRegion: {} };
  for (const region of REGIONS) {
    const rows = candidates.filter((candidate) => candidate.region === region);
    const ok = rows.filter((row) => row.resolved);
    review.perRegion[region] = {
      sampled: rows.length,
      resolved: ok.length,
      rate: rows.length === 0 ? 0 : Math.round((ok.length / rows.length) * 1000) / 10,
      unresolved: rows
        .filter((row) => !row.resolved)
        .map((row) => ({
          id: row.id,
          city: row.city,
          lat: row.lat,
          lon: row.lon,
          reason: row.unresolvedReason ?? 'unknown',
        })),
    };
    const rate = review.perRegion[region].rate;
    if (rate < 70) {
      console.warn(
        `⚠ ${region}: ${rate}% pano coverage (< 70%) — ${ok.length}/${rows.length} — balance the pool or revise the slate`
      );
    } else {
      console.log(`✓ ${region}: ${rate}% pano coverage (${ok.length}/${rows.length})`);
    }
  }
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(REVIEW_PATH, JSON.stringify(review, null, 2) + '\n');

  if (resolved.length === 0) {
    console.log(
      'No resolved entries — the game dataset is NOT written (nothing unresolved ships).'
    );
    return;
  }
  const entries = resolved.map((candidate) => ({
    id: candidate.id,
    place: placeLabel(candidate),
    lat: candidate.lat,
    lon: candidate.lon,
    region: candidate.region,
    difficulty: difficultyFor(candidate.lat, candidate.lon),
    panoId: candidate.panoId,
    resolved: true,
  }));
  writeFileSync(DATASET_PATH, JSON.stringify(entries, null, 2) + '\n');
  console.log(`placeguessr-places.json: ${entries.length} resolved entries shipped`);
}

// ---------------------------------------------------------------------------

const full = process.argv.includes('--full');
const mode = process.argv.find((arg) => arg.startsWith('--')) ?? '--all';

async function main() {
  if (mode === '--sample' || mode === '--all') {
    await sampleStage(full);
  }
  if (mode === '--resolve' || mode === '--all') {
    await resolveStage();
  }
  if (mode === '--apply' || mode === '--all') {
    await applyStage();
  }
  if (!['--sample', '--resolve', '--apply', '--all'].includes(mode)) {
    console.error(
      'Usage: node scripts/sample-placeguessrs.mjs [--sample|--resolve|--apply|--full]'
    );
    process.exit(1);
  }
}

// Direct-run only: importing this module (e.g. from the dataset test for
// REGIONS / LANDMARK_BLOCKLIST / placeLabel) must not run the pipeline.
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((error) => {
    console.error(
      `placeguessr pipeline failed: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  });
}
