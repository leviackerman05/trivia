#!/usr/bin/env node
/**
 * L12 expansion, part 2 — MERGE (GUESS-WHO-DESIGN §6.3 + §5 gates).
 * Combines the backfilled 202, the enriched candidates (scripts/tmp/enrich-*),
 * and the authored supplements into the final server/src/data/celebrities.json.
 *
 * Also applies:
 *  - near-duplicate drops (one person = one entry; CELEBRITY-SOURCING §4)
 *  - alive/profession/nationality corrections the enrichment pass flagged
 *  - ageRange corrections (from the enrichment pass; candidates' Wikidata
 *    ageRanges were unreliable, mostly a junk "90s" stamp)
 *  - the difficulty-mix enforcement fallback (sitelink proxy, doc §4): if the
 *    v1 tier balance misses, demote the lowest-sitelink tier-1s / promote the
 *    lowest-sitelink tier-2s, transparently, before the gate test runs.
 *
 * Usage: node scripts/merge-celebrities.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const SRC = (p) => new URL(`./${p}`, import.meta.url);
const read = (p) => JSON.parse(readFileSync(SRC(p), 'utf8'));

const existing = read('../server/src/data/celebrities.json');
const selection = read('./tmp/selection.json');
const supplements = read('./tmp/supplements.json');
const extraSupplements = existsSync(new URL('./tmp/extra-supplements-2.json', import.meta.url))
  ? read('./tmp/extra-supplements-2.json')
  : [];
const enrichFiles = [
  './tmp/enrich-b-cinema.json',
  './tmp/enrich-b-sports-music.json',
  './tmp/enrich-b-rest.json',
  './tmp/enrich-h-cinema.json',
  './tmp/enrich-h-rest.json',
  './tmp/enrich-row.json',
];
const enrich = Object.assign({}, ...enrichFiles.map((f) => read(f)));

/** One person = one entry: candidate rows that duplicate existing people. */
const DROP = new Set(['Elizabeth II', 'Napoleon', 'Ronaldo', 'Mahendra Singh Dhoni']);

/** Garbled pool names resolved by the enrichment pass (display name = the
 * real person the facts describe). */
const RENAME = {
  'Saima Raina': 'Samay Raina',
  'Vidya Iyer': 'Vidya Vox',
  'Sambhavana Sheth': 'Sambhavna Seth',
};

/** Alive-flag corrections flagged by the enrichment pass. */
const ALIVE_FIX = {
  'Asha Bhosle': true,
  Dharmendra: true,
  'Zubeen Garg': true,
  'James Watson': true,
  'Dick Cheney': true,
};

/** Profession corrections flagged by the enrichment pass (scrambled bucket
 * metadata — the extract script's P106 field is unreliable). */
const PROFESSION_FIX = {
  'Stephen Crane': 'Author',
  'Elie Wiesel': 'Author',
  'Charles Sherrington': 'Physiologist',
  'Subrahmanyam Jaishankar': 'Diplomat',
  'Kavalam Madhava Panikkar': 'Historian',
  'Bhagwan Das': 'Philosopher',
  'Smita Nair Jain': 'Casting Director',
  'PVR Raja': 'Composer',
  'Salman Rushdie': 'Author',
  'Abhishek Bachchan': 'Actor',
  'Jaya Bachchan': 'Actress',
  'A. R. Rahman': 'Composer',
  Sridevi: 'Actress',
  'Mallika Sherawat': 'Actress',
  Nargis: 'Actress',
  Madhubala: 'Actress',
  'Meena Kumari': 'Actress',
  Nutan: 'Actress',
  'Parveen Babi': 'Actress',
  'Kangana Ranaut': 'Actress',
  'Sushant Singh Rajput': 'Actor',
  "Ileana D'Cruz": 'Actress',
  'Shivangi Joshi': 'Actress',
  'Rajesh Khanna': 'Actor',
  'Dev Anand': 'Actor',
  'Vinod Khanna': 'Actor',
  'Sunil Dutt': 'Actor',
  'Shashi Kapoor': 'Actor',
  'Om Puri': 'Actor',
  'Amrish Puri': 'Actor',
  'Rishi Kapoor': 'Actor',
  'Ahmed Deedat': 'Speaker',
  'Sushmita Banerjee': 'Author',
  'Kalpana Lajmi': 'Director',
  'K. Balachander': 'Director',
  'Albert Camus': 'Writer',
};

/** Difficulty corrections from the spot-check pass. */
const DIFFICULTY_FIX = {
  'Albert Camus': 2,
  'The Great Khali': 3,
  'Padma Lakshmi': 2,
  'Zubeen Garg': 3,
  'Sushmita Banerjee': 3,
};

/** ageRange corrections from the enrichment pass (batch values were junk).
 * Keyed by candidate display name; values = correct decade (age at death
 * for deceased, current age for living, matching the existing file's
 * convention). */
const AGERANGE_FIX = {
  // b-cinema batch (30)
  'Raj Kapoor': '60s',
  Sridevi: '50s',
  'A. R. Rahman': '50s',
  'Mallika Sherawat': '40s',
  'Rishi Kapoor': '60s',
  Nargis: '50s',
  'Amrish Puri': '70s',
  'Mohammed Rafi': '50s',
  Madhubala: '30s',
  'Om Puri': '60s',
  Jayalalithaa: '60s',
  'Meena Kumari': '30s',
  'Shashi Kapoor': '70s',
  'Rajesh Khanna': '60s',
  'Dev Anand': '80s',
  'Vinod Khanna': '70s',
  'Sunil Dutt': '70s',
  'Shammi Kapoor': '70s',
  'Parveen Babi': '50s',
  Nutan: '50s',
  'Kangana Ranaut': '30s',
  'Sushant Singh Rajput': '30s',
  "Ileana D'Cruz": '30s',
  'Kishore Kumar': '50s',
  'Shivangi Joshi': '30s',
  'Ahmed Deedat': '80s',
  'Sushmita Banerjee': '40s',
  'K. Balachander': '80s',
  'Kalpana Lajmi': '60s',
  'Bhagwan Das': '80s',
  // b-sports-music batch (15)
  'Bishan Singh Bedi': '70s',
  'Digvijaysinhji Ranjitsinhji': '70s',
  'Mansoor Ali Khan Pataudi': '70s',
  'Peter Paul Fernandes': '70s',
  'Amir Khusrau': '70s',
  'Kazi Nazrul Islam': '70s',
  'Jiah Khan': '20s',
  'M. S. Subbulakshmi': '80s',
  Mukesh: '50s',
  'S. P. Balasubrahmanyam': '70s',
  'Jagjit Singh': '70s',
  'Bhupen Hazarika': '80s',
  'Bhimsen Joshi': '80s',
  'Mehmood Ali': '70s',
  'Dr. Rajkumar': '70s',
  // row batch (54)
  'Albert Camus': '40s',
  'George VI': '50s',
  'Franz Beckenbauer': '70s',
  'Douglas Bader': '70s',
  'C. Aubrey Smith': '80s',
  'Steve Bloomer': '60s',
  'Anthony Wilding': '30s',
  'William Webb Ellis': '60s',
  'Ted Drake': '80s',
  'Charles Gmelin': '70s',
  'Miles Dempsey': '70s',
  'Ralph H. Fowler': '50s',
  'Terence Rattigan': '60s',
  'Frédéric Chopin': '30s',
  'Rafael Orozco Maestre': '30s',
  'Bob Marley': '30s',
  'Hebe Camargo': '80s',
  'Édith Piaf': '40s',
  'Federico García Lorca': '30s',
  'Romain Rolland': '70s',
  'Alain Delon': '80s',
  'Douglas Adams': '40s',
  'Amy Winehouse': '20s',
  Napoleon: '50s',
  'Victor Hugo': '80s',
  'Charles de Gaulle': '70s',
  'Margaret Thatcher': '80s',
  'Rosa Luxemburg': '40s',
  'John Maynard Keynes': '60s',
  'Alexander the Great': '30s',
  'Genghis Khan': '60s',
  'Qin Shi Huang': '40s',
  Charlemagne: '70s',
  'Louis XIV of France': '70s',
  'Marcus Aurelius': '50s',
  Victoria: '80s',
  Akbar: '60s',
  'Le Corbusier': '70s',
  'Sarah Bernhardt': '70s',
  'Francisco Goya': '80s',
  'Henri Matisse': '80s',
  'José Martí': '40s',
  'Henri de Toulouse-Lautrec': '30s',
  'Zaha Hadid': '60s',
  'Martin Heidegger': '80s',
  'Paul Dirac': '80s',
  'Max Born': '80s',
  'Hermann von Helmholtz': '70s',
  'Frédéric Joliot-Curie': '50s',
  'René Descartes': '50s',
  'Oscar Wilde': '40s',
  'George Orwell': '40s',
  'J. R. R. Tolkien': '80s',
  'James Joyce': '50s',
};

/** Genre corrections: the extract script's P106 bucket misfiled some
 * non-actors into cinema. Primary fame domain per CELEBRITY-SOURCING §3. */
const GENRE_FIX = {
  'Asha Bhosle': 'music',
  'Zakir Hussain': 'music',
  'Zubeen Garg': 'music',
  'The Great Khali': 'sports',
  Jayalalithaa: 'politics',
  'Padma Lakshmi': 'television',
  'Subrahmanyam Jaishankar': 'politics',
  'Albert Camus': 'literature',
  'Salman Rushdie': 'literature',
  'Elie Wiesel': 'literature',
  'Stephen Crane': 'literature',
  'Charles Sherrington': 'science',
  'Kavalam Madhava Panikkar': 'literature',
  'Ahmed Deedat': 'politics',
  'Sushmita Banerjee': 'literature',
  'K. Balachander': 'cinema',
  'Kalpana Lajmi': 'cinema',
  'Bhagwan Das': 'literature',
};

/** Authored replacements for the dropped near-dupes (keeps region floors). */
const REPLACEMENTS = [
  {
    name: 'Prince Harry',
    gender: 'm',
    alive: true,
    profession: 'Royal',
    nationality: 'British',
    ageRange: '40s',
    hairColor: 'red',
    famousFor: 'British royal, Invictus Games',
    region: 'row',
    genre: 'royalty',
    difficulty: 2,
    facts: [
      'Is the younger son of King Charles III',
      'Founded the Invictus Games for wounded veterans',
      'Served in the British Army for ten years',
    ],
  },
  {
    name: 'Saina Nehwal',
    gender: 'f',
    alive: true,
    profession: 'Badminton Player',
    nationality: 'Indian',
    ageRange: '30s',
    hairColor: 'black',
    famousFor: 'Olympic badminton bronze',
    region: 'bollywood',
    genre: 'sports',
    difficulty: 2,
    facts: [
      'Won Olympic bronze in badminton at London 2012',
      'Was the first Indian to win a BWF Super Series title',
      "Was ranked world No. 1 in women's singles",
    ],
  },
];

/** Difficulty-mix enforcement (v1 floors): t1 ≤ 40%, t3 ≥ 15%. Falls back to
 * the sitelink proxy when the author-assigned tiers miss the balance. */
function enforceBalance(entries) {
  const total = entries.length;
  const byTier = (list) =>
    list.reduce((acc, e) => ((acc[e.difficulty] = (acc[e.difficulty] ?? 0) + 1), acc), {
      1: 0,
      2: 0,
      3: 0,
    });
  let tiers = byTier(entries);
  const t1Cap = Math.floor(total * 0.4);
  const t3Floor = Math.ceil(total * 0.15);
  const log = [];
  if (tiers[1] > t1Cap) {
    const excess = tiers[1] - t1Cap;
    const candidates = entries
      .filter((e) => e.difficulty === 1 && e.sitelinks !== undefined)
      .sort((a, b) => a.sitelinks - b.sitelinks);
    for (const entry of candidates.slice(0, excess)) {
      entry.difficulty = 2;
      log.push(`t1→t2 (proxy fallback): ${entry.name}`);
    }
  }
  tiers = byTier(entries);
  if (tiers[3] < t3Floor) {
    const need = t3Floor - tiers[3];
    const candidates = entries
      .filter((e) => e.difficulty === 2 && e.sitelinks !== undefined)
      .sort((a, b) => a.sitelinks - b.sitelinks);
    for (const entry of candidates.slice(0, need)) {
      entry.difficulty = 3;
      log.push(`t2→t3 (proxy fallback): ${entry.name}`);
    }
  }
  return { tiers: byTier(entries), log };
}

// --- assemble ---------------------------------------------------------------
const norm = (name) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const out = [];
const seen = new Set();
const add = (entry) => {
  if (seen.has(entry.name)) {
    throw new Error(`Duplicate after merge: ${entry.name}`);
  }
  seen.add(entry.name);
  out.push(entry);
};

// Supplements that duplicate existing/candidate people are skipped (the
// candidate row wins — same person, same region/genre, already enriched).
const existingKeys = new Set(existing.map((e) => norm(e.name)));
const candidateKeys = new Set(selection.map((c) => norm(c.name)));

for (const entry of existing) add(entry);
for (const entry of supplements) {
  if (existingKeys.has(norm(entry.name)) || candidateKeys.has(norm(entry.name))) {
    console.log('skip supplement (duplicates pool):', entry.name);
    continue;
  }
  add(entry);
}
for (const entry of extraSupplements) {
  if (existingKeys.has(norm(entry.name)) || candidateKeys.has(norm(entry.name))) {
    console.log('skip supplement (duplicates pool):', entry.name);
    continue;
  }
  add(entry);
}
for (const entry of REPLACEMENTS) {
  if (existingKeys.has(norm(entry.name))) {
    console.log('skip replacement (already in base):', entry.name);
    continue;
  }
  add(entry);
}

const missing = [];
for (const cand of selection) {
  if (DROP.has(cand.name)) continue;
  const key = RENAME[cand.name] ?? cand.name;
  const enriched = enrich[cand.name];
  if (!enriched) {
    missing.push(cand.name);
    continue;
  }
  add({
    name: key,
    gender: cand.gender,
    alive: ALIVE_FIX[cand.name] ?? cand.alive,
    profession: PROFESSION_FIX[cand.name] ?? enriched.profession ?? cand.profession,
    nationality: enriched.nationality ?? cand.nationality,
    ageRange: enriched.ageRange ?? AGERANGE_FIX[cand.name] ?? cand.ageRange,
    hairColor: enriched.hairColor,
    famousFor: enriched.famousFor,
    facts: enriched.facts,
    region: cand.region,
    genre: GENRE_FIX[cand.name] ?? cand.genre,
    difficulty: DIFFICULTY_FIX[cand.name] ?? enriched.difficulty,
    ...(cand.sitelinks !== undefined ? { sitelinks: cand.sitelinks } : {}),
  });
}

if (missing.length > 0) {
  console.error(`MISSING ENRICHMENT for ${missing.length} candidates:`);
  for (const name of missing) console.error('  -', name);
  process.exit(1);
}

// --- validate ---------------------------------------------------------------
const GENRES = [
  'music',
  'cinema',
  'television',
  'sports',
  'politics',
  'business',
  'science',
  'technology',
  'literature',
  'internet',
  'art-fashion',
  'royalty',
];
const errors = [];
for (const e of out) {
  if (typeof e.name !== 'string' || !e.name) errors.push(`${e.name}: name`);
  if (!/^[mf]$/.test(e.gender ?? '')) errors.push(`${e.name}: gender`);
  if (typeof e.alive !== 'boolean') errors.push(`${e.name}: alive`);
  if (!e.profession) errors.push(`${e.name}: profession`);
  if (!e.nationality) errors.push(`${e.name}: nationality`);
  if (!/^\d+s$/.test(e.ageRange ?? '')) errors.push(`${e.name}: ageRange ${e.ageRange}`);
  if (!e.hairColor) errors.push(`${e.name}: hairColor`);
  if (!e.famousFor || e.famousFor.split(',').filter((s) => s.trim()).length > 5)
    errors.push(`${e.name}: famousFor`);
  if (
    !Array.isArray(e.facts) ||
    e.facts.length < 3 ||
    e.facts.some((f) => typeof f !== 'string' || !f.trim())
  )
    errors.push(`${e.name}: facts`);
  if (e.facts && e.facts.some((f) => f.includes('—'))) errors.push(`${e.name}: em dash in fact`);
  if (!['bollywood', 'hollywood', 'row'].includes(e.region)) errors.push(`${e.name}: region`);
  if (!GENRES.includes(e.genre)) errors.push(`${e.name}: genre`);
  if (![1, 2, 3].includes(e.difficulty)) errors.push(`${e.name}: difficulty`);
}
if (errors.length) {
  console.error(`VALIDATION FAILED (${errors.length}):`);
  for (const err of errors.slice(0, 40)) console.error('  -', err);
  process.exit(1);
}

// --- balance + write --------------------------------------------------------
const { tiers, log } = enforceBalance(out);
if (log.length) console.log('difficulty fallback adjustments:', log.length);

const writeTarget = SRC('../server/src/data/celebrities.json');
writeFileSync(writeTarget, JSON.stringify(out, null, 2) + '\n');

// --- report -----------------------------------------------------------------
const byRegion = (list) =>
  list.reduce((acc, e) => ((acc[e.region] = (acc[e.region] ?? 0) + 1), acc), {});
const byGenre = (list) =>
  list.reduce((acc, e) => ((acc[e.genre] = (acc[e.genre] ?? 0) + 1), acc), {});
const total = out.length;
console.log(`Wrote ${total} entries.`);
console.log('region:', JSON.stringify(byRegion(out)));
console.log('genre:', JSON.stringify(byGenre(out)));
console.log(
  'difficulty:',
  JSON.stringify(tiers),
  `(t1 ${((tiers[1] / total) * 100).toFixed(1)}%, t3 ${((tiers[3] / total) * 100).toFixed(1)}%)`
);
const alive = out.filter((e) => e.alive).length;
console.log(
  `gender: f ${out.filter((e) => e.gender === 'f').length} (${((out.filter((e) => e.gender === 'f').length / total) * 100).toFixed(1)}%), m ${out.filter((e) => e.gender === 'm').length}`
);
console.log(
  `alive ${alive}, deceased ${total - alive} (${(((total - alive) / total) * 100).toFixed(1)}%)`
);
