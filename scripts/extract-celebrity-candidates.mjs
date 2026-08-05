#!/usr/bin/env node
/**
 * extract-celebrity-candidates.mjs — RESEARCH LOT TOOL (not shipped app code).
 * Per docs/CELEBRITY-SOURCING.md §1: SPARQL extract (Wikidata, CC0) → pre-screen
 * → candidate pool for the Guess Who authoring pass. Follows the lot-script
 * pattern of scripts/sample-world-peeks.mjs (flags + review list — nothing
 * here ships at all).
 *
 * v4 (fast + complete): phase-1 ranking is BANDED by sitelink ranges
 * (>=100 / 60-99 / floor-59), so each query sorts a small set instead of a
 * global sort over thousands of people — no WDQS 60s truncation, deterministic
 * top-N. Phase-2 details are fetched ONCE per unique QID (union across
 * buckets). Both phases run under pooled concurrency (8 / 6). Same 31
 * buckets, same coverage as v3.
 *
 * Exact P106 matching with key subclass QIDs inlined (film actor Q10800557,
 * TV actor Q10798782, playback singer Q1755412, rapper Q2252262, cricketer
 * Q12299841, footballer Q937857, tennis player Q10833314 — verified against
 * the live API 2026-08-06).
 *
 * Output: docs/celebrities-candidates.json (research artifact, NOT
 * server/src/data). Pre-authoring fields: region/genre from the query bucket;
 * difficulty is a HINT (sitelink proxy) the author confirms per doc §4;
 * hairColor/facts/famousFor are NOT extracted (authoring pass, two-source
 * verification, doc §2/§5).
 *
 * Usage: node scripts/extract-celebrity-candidates.mjs
 */
import { writeFileSync } from 'node:fs';

const BASE = 'https://query.wikidata.org/sparql';
const UA = 'partybrain-research/1.0 (candidate extraction; CC0 facts)';
const THIS_YEAR = new Date().getFullYear();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const Q = {
  male: 'Q6581097',
  female: 'Q6581072',
  actor: 'Q33999',
  filmActor: 'Q10800557',
  tvActor: 'Q10798782',
  director: 'Q482980',
  singer: 'Q177220',
  singerSongwriter: 'Q488205',
  musician: 'Q639669',
  rapper: 'Q2252262',
  playbackSinger: 'Q1755412',
  athlete: 'Q2066131',
  cricketer: 'Q12299841',
  footballer: 'Q937857',
  tennisPlayer: 'Q10833314',
  basketballPlayer: 'Q3665646',
  baseballPlayer: 'Q10871364',
  americanFootballPlayer: 'Q19204627',
  politician: 'Q82955',
  businessperson: 'Q43845',
  writer: 'Q36180',
  poet: 'Q49757',
  scientist: 'Q901',
  tvPresenter: 'Q947873',
  youtuber: 'Q17125263',
  monarch: 'Q116',
  visualArtist: 'Q3391743',
  painter: 'Q1028181',
  sport: { cricket: 'Q5375', football: 'Q2736', tennis: 'Q847' },
  country: {
    US: 'Q30',
    India: 'Q668',
    UK: 'Q145',
    Canada: 'Q16',
    France: 'Q142',
    Germany: 'Q183',
    Spain: 'Q29',
    Italy: 'Q38',
    Portugal: 'Q45',
    Netherlands: 'Q55',
    Belgium: 'Q31',
    Brazil: 'Q155',
    Argentina: 'Q836',
    Japan: 'Q17',
    Mexico: 'Q96',
    Colombia: 'Q739',
    Sweden: 'Q34',
    SouthKorea: 'Q884',
    Nigeria: 'Q1033',
    Jamaica: 'Q766',
    Australia: 'Q213',
    NewZealand: 'Q664',
    Pakistan: 'Q794',
    SouthAfrica: 'Q258',
    Norway: 'Q20',
    Egypt: 'Q79',
    Barbados: 'Q244',
  },
};

/** profession: base-class priority first, then known subclasses. */
const PROFESSION_PRIORITY = [
  [Q.actor, 'Actor'],
  [Q.director, 'Film director'],
  [Q.singer, 'Singer'],
  [Q.singerSongwriter, 'Singer-songwriter'],
  [Q.musician, 'Musician'],
  [Q.rapper, 'Rapper'],
  [Q.athlete, 'Athlete'],
  [Q.cricketer, 'Cricketer'],
  [Q.footballer, 'Footballer'],
  [Q.tennisPlayer, 'Tennis player'],
  [Q.basketballPlayer, 'Basketball player'],
  [Q.baseballPlayer, 'Baseball player'],
  [Q.americanFootballPlayer, 'American football player'],
  [Q.politician, 'Politician'],
  [Q.businessperson, 'Businessperson'],
  [Q.writer, 'Writer'],
  [Q.poet, 'Poet'],
  [Q.scientist, 'Scientist'],
  [Q.tvPresenter, 'Television presenter'],
  [Q.youtuber, 'YouTuber'],
  [Q.monarch, 'Monarch'],
  [Q.visualArtist, 'Visual artist'],
  [Q.painter, 'Painter'],
];
const SUBCLASS_LABELS = {
  [Q.filmActor]: 'Actor',
  [Q.tvActor]: 'Actor',
  [Q.playbackSinger]: 'Singer',
};

const COUNTRY_LABELS = {
  [Q.country.US]: 'American',
  [Q.country.India]: 'Indian',
  [Q.country.UK]: 'British',
  [Q.country.Canada]: 'Canadian',
  [Q.country.France]: 'French',
  [Q.country.Germany]: 'German',
  [Q.country.Spain]: 'Spanish',
  [Q.country.Italy]: 'Italian',
  [Q.country.Portugal]: 'Portuguese',
  [Q.country.Netherlands]: 'Dutch',
  [Q.country.Belgium]: 'Belgian',
  [Q.country.Brazil]: 'Brazilian',
  [Q.country.Argentina]: 'Argentine',
  [Q.country.Japan]: 'Japanese',
  [Q.country.Mexico]: 'Mexican',
  [Q.country.Colombia]: 'Colombian',
  [Q.country.Sweden]: 'Swedish',
  [Q.country.SouthKorea]: 'South Korean',
  [Q.country.Nigeria]: 'Nigerian',
  [Q.country.Jamaica]: 'Jamaican',
  [Q.country.Australia]: 'Australian',
  [Q.country.NewZealand]: 'New Zealander',
  [Q.country.Pakistan]: 'Pakistani',
  [Q.country.SouthAfrica]: 'South African',
  [Q.country.Norway]: 'Norwegian',
  [Q.country.Egypt]: 'Egyptian',
  [Q.country.Barbados]: 'Barbadian',
};

const ACTOR_OCC = [Q.actor, Q.filmActor, Q.tvActor];
const MUSIC_OCC = [Q.singer, Q.singerSongwriter, Q.musician, Q.rapper, Q.playbackSinger];
const ATHLETE_OCC = [
  Q.athlete,
  Q.cricketer,
  Q.footballer,
  Q.tennisPlayer,
  Q.basketballPlayer,
  Q.baseballPlayer,
  Q.americanFootballPlayer,
];
const FOOTBALL_OCC = [Q.footballer];
const CRICKET_OCC = [Q.cricketer];
const TENNIS_OCC = [Q.tennisPlayer];

/** One candidate bucket = one (region × genre) cell. c/sport optional. */
const BUCKETS = [
  // ---------- bollywood (India, Indian-market fame) ----------
  {
    genre: 'cinema',
    region: 'bollywood',
    occ: ACTOR_OCC,
    c: [Q.country.India],
    minSl: 12,
    limit: 200,
  },
  {
    genre: 'music',
    region: 'bollywood',
    occ: MUSIC_OCC,
    c: [Q.country.India],
    minSl: 8,
    limit: 100,
  },
  {
    genre: 'sports',
    region: 'bollywood',
    occ: CRICKET_OCC,
    c: [Q.country.India],
    minSl: 8,
    limit: 80,
  },
  {
    genre: 'politics',
    region: 'bollywood',
    occ: [Q.politician],
    c: [Q.country.India],
    minSl: 10,
    limit: 40,
  },
  {
    genre: 'business',
    region: 'bollywood',
    occ: [Q.businessperson],
    c: [Q.country.India],
    minSl: 8,
    limit: 30,
  },
  {
    genre: 'literature',
    region: 'bollywood',
    occ: [Q.writer, Q.poet],
    c: [Q.country.India],
    minSl: 8,
    limit: 25,
  },
  {
    genre: 'science',
    region: 'bollywood',
    occ: [Q.scientist],
    c: [Q.country.India],
    minSl: 8,
    limit: 18,
  },
  {
    genre: 'cinema',
    region: 'bollywood',
    occ: [Q.director],
    c: [Q.country.India],
    minSl: 8,
    limit: 20,
  },
  {
    genre: 'television',
    region: 'bollywood',
    occ: [Q.tvPresenter],
    c: [Q.country.India],
    minSl: 6,
    limit: 15,
  },
  {
    genre: 'internet',
    region: 'bollywood',
    occ: [Q.youtuber],
    c: [Q.country.India],
    minSl: 5,
    limit: 15,
  },

  // ---------- hollywood (USA, US-market fame) ----------
  {
    genre: 'cinema',
    region: 'hollywood',
    occ: ACTOR_OCC,
    c: [Q.country.US],
    minSl: 40,
    limit: 150,
  },
  { genre: 'music', region: 'hollywood', occ: MUSIC_OCC, c: [Q.country.US], minSl: 30, limit: 110 },
  {
    genre: 'sports',
    region: 'hollywood',
    occ: ATHLETE_OCC,
    c: [Q.country.US],
    minSl: 25,
    limit: 50,
  },
  {
    genre: 'politics',
    region: 'hollywood',
    occ: [Q.politician],
    c: [Q.country.US],
    minSl: 25,
    limit: 18,
  },
  {
    genre: 'business',
    region: 'hollywood',
    occ: [Q.businessperson],
    c: [Q.country.US],
    minSl: 20,
    limit: 30,
  },
  {
    genre: 'television',
    region: 'hollywood',
    occ: [Q.tvPresenter],
    c: [Q.country.US],
    minSl: 25,
    limit: 10,
  },
  {
    genre: 'literature',
    region: 'hollywood',
    occ: [Q.writer],
    c: [Q.country.US],
    minSl: 25,
    limit: 10,
  },
  {
    genre: 'science',
    region: 'hollywood',
    occ: [Q.scientist],
    c: [Q.country.US],
    minSl: 20,
    limit: 10,
  },
  {
    genre: 'cinema',
    region: 'hollywood',
    occ: [Q.director],
    c: [Q.country.US],
    minSl: 25,
    limit: 10,
  },
  {
    genre: 'internet',
    region: 'hollywood',
    occ: [Q.youtuber],
    c: [Q.country.US],
    minSl: 15,
    limit: 10,
  },

  // ---------- row (rest of world) ----------
  { genre: 'cinema', region: 'row', occ: ACTOR_OCC, c: [Q.country.UK], minSl: 30, limit: 40 },
  { genre: 'cinema', region: 'row', occ: ACTOR_OCC, c: [Q.country.Canada], minSl: 25, limit: 12 },
  {
    genre: 'sports',
    region: 'row',
    occ: FOOTBALL_OCC,
    c: [
      Q.country.UK,
      Q.country.France,
      Q.country.Germany,
      Q.country.Spain,
      Q.country.Italy,
      Q.country.Portugal,
      Q.country.Netherlands,
      Q.country.Belgium,
      Q.country.Brazil,
      Q.country.Argentina,
      Q.country.Colombia,
      Q.country.Sweden,
      Q.country.Norway,
      Q.country.Egypt,
    ],
    minSl: 30,
    limit: 55,
  },
  {
    genre: 'music',
    region: 'row',
    occ: MUSIC_OCC,
    c: [
      Q.country.UK,
      Q.country.France,
      Q.country.Germany,
      Q.country.Canada,
      Q.country.Japan,
      Q.country.Mexico,
      Q.country.Brazil,
      Q.country.Argentina,
      Q.country.Colombia,
      Q.country.Australia,
      Q.country.Spain,
      Q.country.Italy,
      Q.country.Sweden,
      Q.country.SouthKorea,
      Q.country.Nigeria,
      Q.country.Jamaica,
      Q.country.Barbados,
    ],
    minSl: 25,
    limit: 80,
  },
  { genre: 'sports', region: 'row', occ: TENNIS_OCC, minSl: 25, limit: 30 },
  {
    genre: 'sports',
    region: 'row',
    occ: CRICKET_OCC,
    c: [
      Q.country.Australia,
      Q.country.UK,
      Q.country.Pakistan,
      Q.country.NewZealand,
      Q.country.SouthAfrica,
    ],
    minSl: 20,
    limit: 18,
  },
  {
    genre: 'politics',
    region: 'row',
    occ: [Q.politician],
    c: [
      Q.country.UK,
      Q.country.France,
      Q.country.Germany,
      Q.country.Japan,
      Q.country.Australia,
      Q.country.Canada,
    ],
    minSl: 25,
    limit: 14,
  },
  { genre: 'royalty', region: 'row', occ: [Q.monarch], minSl: 20, limit: 12 },
  {
    genre: 'literature',
    region: 'row',
    occ: [Q.writer],
    c: [Q.country.UK, Q.country.France, Q.country.Germany, Q.country.Japan],
    minSl: 25,
    limit: 14,
  },
  {
    genre: 'art-fashion',
    region: 'row',
    occ: [Q.visualArtist, Q.painter],
    c: [Q.country.UK, Q.country.France, Q.country.Germany, Q.country.Spain, Q.country.Mexico],
    minSl: 20,
    limit: 10,
  },
  {
    genre: 'science',
    region: 'row',
    occ: [Q.scientist],
    c: [Q.country.UK, Q.country.France, Q.country.Germany, Q.country.Canada, Q.country.Japan],
    minSl: 25,
    limit: 12,
  },
];

/** Bands: split the sitelink range so each query sorts a small set (no global sort, no truncation). */
function bandsFor(minSl) {
  if (minSl >= 60) return [{ lo: minSl }];
  return [{ lo: 100 }, { lo: 60, hi: 100 }, { lo: minSl, hi: 60 }];
}

async function querySparql(q) {
  const url = `${BASE}?query=${encodeURIComponent(q)}&format=json`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' },
        signal: AbortSignal.timeout(25000), // no fetch without a bound — a stalled query must not hang the run
      });
      if ([500, 504, 429].includes(res.status)) {
        await sleep(1000 * attempt);
        continue;
      }
      if (!res.ok) throw new Error(`WDQS ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return (await res.json()).results?.bindings ?? [];
    } catch (err) {
      if (attempt === 2) throw err;
      await sleep(1000 * attempt);
    }
  }
  return [];
}

/** Pooled map: at most `concurrency` promises in flight at once. */
async function pMap(items, fn, { concurrency = 8 } = {}) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return out;
}

const v = (b, k) => b?.[k]?.value ?? null;
const qid = (b, k) => {
  const s = v(b, k);
  return s ? s.replace('http://www.wikidata.org/entity/', '') : null;
};
const norm = (s) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
const chunk = (arr, n) =>
  Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

/** Phase 1: rank candidates by sitelinks within one band — small sort, deterministic. */
function rankQuery(b, band) {
  const occ = `VALUES ?occ { ${b.occ.map((q) => `wd:${q}`).join(' ')} }\n  ?person wdt:P106 ?occ .`;
  const country = b.c
    ? `VALUES ?c { ${b.c.map((q) => `wd:${q}`).join(' ')} }\n  ?person wdt:P27 ?c .`
    : '';
  const sport = b.sport ? `?person wdt:P641 wd:${b.sport} .` : '';
  const bandFilter = band.hi
    ? `FILTER (?sl >= ${band.lo} && ?sl < ${band.hi})`
    : `FILTER (?sl >= ${band.lo})`;
  return `
SELECT ?person ?sl WHERE {
  ?person wdt:P31 wd:Q5 .
  ${occ}
  ${country}
  ${sport}
  ?person wikibase:sitelinks ?sl .
  ${bandFilter}
}
ORDER BY DESC(?sl)
LIMIT ${b.limit}`;
}

/** Phase 2: details for ranked QIDs (VALUES-bounded, chunked — fast). */
function detailQuery(ids) {
  return `
SELECT ?person ?nameEn ?nameMul ?dob ?death ?gender ?occ ?c2 WHERE {
  VALUES ?person { ${ids.map((id) => `wd:${id}`).join(' ')} }
  OPTIONAL { ?person wdt:P569 ?dob . }
  OPTIONAL { ?person wdt:P570 ?death . }
  OPTIONAL { ?person wdt:P21 ?gender . }
  OPTIONAL { ?person wdt:P106 ?occ . }
  OPTIONAL { ?person wdt:P27 ?c2 . }
  OPTIONAL { ?person rdfs:label ?nameEn . FILTER (lang(?nameEn) = "en") }
  OPTIONAL { ?person rdfs:label ?nameMul . FILTER (lang(?nameMul) = "mul") }
}`;
}

function ageRange(dob) {
  if (!dob) return null;
  const year = Number(dob.slice(0, 4));
  if (!Number.isFinite(year)) return null;
  return `${Math.min(90, Math.max(10, Math.floor((THIS_YEAR - year) / 10) * 10))}s`;
}

/** Difficulty HINT from sitelinks (region-adjusted thresholds). Author overrides (doc §4). */
function difficultyHint(sl, region) {
  const [hi, lo] = region === 'bollywood' ? [40, 12] : [50, 15];
  return sl >= hi ? 1 : sl >= lo ? 2 : 3;
}

function resolveProfession(occSet) {
  const direct = [...occSet];
  const base = PROFESSION_PRIORITY.find(([q]) => direct.includes(q));
  if (base) return base[1];
  return SUBCLASS_LABELS[direct[0]] ?? null;
}

async function main() {
  const t0 = Date.now();
  let bucketsDone = 0;

  // ---- Phase 1: banded ranking per bucket. FLAT concurrency (4) — bands run
  // sequentially per bucket with early-stop: stop once the limit is filled.
  // (Nested pools previously fired up to 64 parallel requests → WDQS 429s.)
  const phase1 = await pMap(
    BUCKETS,
    async (b) => {
      const slById = new Map(); // insertion order = band order (band 1 > band 2 > band 3)
      const errors = [];
      for (const band of bandsFor(b.minSl)) {
        let rows;
        try {
          rows = await querySparql(rankQuery(b, band));
        } catch (err) {
          errors.push(`${b.region}/${b.genre} band${band.lo}: ${err.message}`);
          continue;
        }
        for (const r of rows) {
          const id = qid(r, 'person');
          if (!id || slById.has(id)) continue;
          slById.set(id, Number(v(r, 'sl') ?? 0));
        }
        if (slById.size >= b.limit) break; // early-stop: higher bands already filled the limit
      }
      const ids = [...slById.keys()].slice(0, b.limit);
      const done = ++bucketsDone;
      console.log(
        `  [${done}/${BUCKETS.length}] ${b.region}/${b.genre}: ranked ${slById.size} (${((Date.now() - t0) / 1000).toFixed(1)}s)`
      );
      return { b, ids, slById, ranked: slById.size, errors };
    },
    { concurrency: 4 }
  );
  const rankedTotal = phase1.reduce((n, r) => n + r.ranked, 0);
  console.log(
    `✓ phase 1: ${rankedTotal} ranked across ${BUCKETS.length} buckets (${((Date.now() - t0) / 1000).toFixed(1)}s)`
  );

  // ---- Phase 2: details ONCE per unique QID (union across buckets).
  // Small chunks (20) + per-QID retry: WDQS sometimes truncates VALUES+
  // OPTIONAL queries, silently dropping people — the retry guarantees every
  // ranked QID resolves (verified Elvis Q303 absent previously).
  const allIds = [...new Set(phase1.flatMap((r) => r.ids))];
  const byPerson = new Map();
  const missing = new Set(allIds);
  const detailChunks = chunk(allIds, 20);
  await pMap(
    detailChunks,
    async (ids) => {
      let rows = await querySparql(detailQuery(ids));
      for (const r of rows) {
        const id = qid(r, 'person');
        if (!id) continue;
        missing.delete(id);
        if (!byPerson.has(id))
          byPerson.set(id, {
            gender: null,
            occ: new Set(),
            c2: new Set(),
            dob: null,
            death: null,
            name: null,
          });
        const row = byPerson.get(id);
        row.name ??= v(r, 'nameEn') ?? v(r, 'nameMul'); // labels may be lang en OR mul (proper-name convention)
        row.dob ??= v(r, 'dob');
        row.death ??= v(r, 'death');
        const g = qid(r, 'gender');
        if (g) row.gender = g;
        const o = qid(r, 'occ');
        if (o) row.occ.add(o);
        const c = qid(r, 'c2');
        if (c) row.c2.add(c);
      }
    },
    { concurrency: 3 }
  );
  // Retry any QID still missing, one at a time (tiny query, ~guaranteed)
  let retried = 0;
  for (const id of [...missing]) {
    const rows = await querySparql(detailQuery([id]));
    for (const r of rows) {
      const rid = qid(r, 'person');
      if (rid !== id) continue;
      missing.delete(id);
      if (!byPerson.has(id))
        byPerson.set(id, {
          gender: null,
          occ: new Set(),
          c2: new Set(),
          dob: null,
          death: null,
          name: null,
        });
      const row = byPerson.get(id);
      row.name ??= v(r, 'nameEn') ?? v(r, 'nameMul'); // labels may be lang en OR mul (proper-name convention)
      row.dob ??= v(r, 'dob');
      row.death ??= v(r, 'death');
      const g = qid(r, 'gender');
      if (g) row.gender = g;
      const o = qid(r, 'occ');
      if (o) row.occ.add(o);
      const c = qid(r, 'c2');
      if (c) row.c2.add(c);
      retried++;
    }
  }
  console.log(
    `✓ phase 2: details for ${allIds.length} unique QIDs (${detailChunks.length} chunks, ${retried} single retries, ${missing.size} still missing)`
  );

  // ---- Build per-bucket candidate lists (with sitelinks from phase 1) ----
  const results = phase1.map(({ b, ids, slById }) => {
    const candidates = [];
    for (const id of ids) {
      const row = byPerson.get(id);
      if (!row) continue;
      const name = row.name;
      const gender = row.gender === Q.male ? 'm' : row.gender === Q.female ? 'f' : null;
      const sl = slById.get(id) ?? 0;
      if (!name || !gender || !row.dob) continue;
      const natId = (b.c ?? []).find((c) => row.c2.has(c)) ?? [...row.c2][0];
      candidates.push({
        name,
        gender,
        alive: !row.death,
        profession: resolveProfession(row.occ),
        nationality: COUNTRY_LABELS[natId] ?? null,
        ageRange: ageRange(row.dob),
        region: b.region,
        genre: b.genre,
        difficulty: difficultyHint(sl, b.region), // hint — author overrides (doc §4)
        sitelinks: sl,
        wikidataId: id,
      });
    }
    return { b, ids, ranked: ids.length, candidates };
  });

  // ---- Sequential merge: bucket order = genre claim priority; dedup keeps higher sitelinks ----
  const entries = [];
  const seen = new Map();
  const keptByBucket = new Map();
  results.forEach((_, idx) => keptByBucket.set(idx, 0));
  for (let bi = 0; bi < results.length; bi++) {
    for (const cand of results[bi].candidates) {
      const key = norm(cand.name);
      const existing = seen.get(key);
      if (existing && existing.sl >= cand.sitelinks) continue;
      if (existing) {
        entries[existing.index] = cand;
        existing.sl = cand.sitelinks;
        keptByBucket.set(bi, keptByBucket.get(bi) + 1);
      } else {
        seen.set(key, { sl: cand.sitelinks, index: entries.length });
        entries.push(cand);
        keptByBucket.set(bi, keptByBucket.get(bi) + 1);
      }
    }
  }

  // ---- Per-bucket report (kept after dedup) ----
  console.log('\n--- per-bucket (ranked → kept) ---');
  for (let bi = 0; bi < results.length; bi++) {
    const { b, ranked } = results[bi];
    const kept = keptByBucket.get(bi);
    const flag = kept < ranked / 2 ? '  ⚠ drop-rate high' : '';
    const trunc = ranked === b.limit ? '  (at LIMIT — may have more)' : '';
    const errs = phase1[bi].errors.length ? `  ✗ ${phase1[bi].errors.join('; ')}` : '';
    console.log(`  ${b.region}/${b.genre}: ${ranked} → ${kept}${trunc}${errs}${flag}`);
  }

  const order = { bollywood: 0, hollywood: 1, row: 2 };
  entries.sort(
    (a, b) =>
      order[a.region] - order[b.region] ||
      a.genre.localeCompare(b.genre) ||
      a.difficulty - b.difficulty ||
      b.sitelinks - a.sitelinks
  );

  const counts = {};
  for (const e of entries) {
    counts[e.region] ??= { total: 0, byGenre: {} };
    counts[e.region].total++;
    counts[e.region].byGenre[e.genre] = (counts[e.region].byGenre[e.genre] ?? 0) + 1;
  }

  const out = {
    _meta: {
      artifact: 'Guess Who candidate pool (pre-authoring) — see docs/CELEBRITY-SOURCING.md',
      generatedAt: new Date().toISOString(),
      source: 'Wikidata Query Service (CC0), SPARQL two-phase banded extraction',
      note: 'facts/famousFor/hairColor NOT extracted (hand-authored, two-source verification, doc §2/§5). difficulty is a sitelink-proxy HINT (doc §4) — author overrides. Dedup by normalized name, keeps higher sitelinks. region = fame market, not nationality (doc §3).',
    },
    counts,
    bucketCounts: results.map((r) => ({
      region: r.b.region,
      genre: r.b.genre,
      ranked: r.ranked,
      kept: keptByBucket.get(results.indexOf(r)),
      err: phase1[results.indexOf(r)].errors.join('; ') || null,
    })),
    entries,
  };

  writeFileSync('docs/celebrities-candidates.json', JSON.stringify(out, null, 1) + '\n');

  console.log(`\n=== SUMMARY (${((Date.now() - t0) / 1000).toFixed(1)}s) ===`);
  console.log(`total: ${entries.length}`);
  for (const [region, c] of Object.entries(counts)) {
    console.log(`${region}: ${c.total}  ${JSON.stringify(c.byGenre)}`);
  }
  console.log('\n=== SAMPLE (first 15) ===');
  for (const e of entries.slice(0, 15)) {
    console.log(
      `  ${e.name} | ${e.region}/${e.genre} | d${e.difficulty} | ${e.nationality} | ${e.ageRange} | sl ${e.sitelinks}`
    );
  }
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
