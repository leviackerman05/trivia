// One-off: validate the new datasets parse and match expected shapes/counts.
import { readFileSync } from 'node:fs';

const files = [
  [
    'server/src/data/one-line-objects.json',
    (e) => /^[a-z' -]+$/.test(e.object) && e.object.length <= 24,
  ],
  [
    'server/src/data/silhouettes.json',
    (e) =>
      /^[a-z' -]+$/.test(e.name) &&
      typeof e.path === 'string' &&
      e.path.startsWith('M') &&
      e.path.length <= 400 &&
      typeof e.genre === 'string' &&
      ['animals', 'nature', 'food', 'objects', 'places', 'space'].includes(e.genre),
  ],
  [
    'server/src/data/lyrics.json',
    (e) =>
      e.title?.length > 1 &&
      e.artist?.length > 1 &&
      e.lyric?.length >= 25 &&
      e.lyric?.length <= 300,
  ],
  [
    'server/src/data/copycat-images.json',
    (e) =>
      e.url.startsWith('https://commons.wikimedia.org/wiki/Special:FilePath/') &&
      (e.kind === 'painting' || e.kind === 'photo'),
  ],
  ['server/src/data/wyr.json', (e) => e.a !== e.b && e.a.length >= 4 && e.b.length >= 4],
  ['server/src/data/most-likely-to.json', (e) => e.prompt.length >= 6],
  [
    'server/src/data/never-have-i-ever.json',
    (e) =>
      e.statement.length >= 4 && ['boring', 'moderate', 'dirty', 'super-dirty'].includes(e.tier),
  ],
  [
    'server/src/data/this-or-that.json',
    (e) => e.a !== e.b && e.a.length >= 1 && e.b.length >= 1 && typeof e.genre === 'string',
  ],
  [
    'src/data/rhymes.json',
    (e) => e.answers.length >= 1 && e.answers.every((a) => /^[a-z]+$/.test(a)),
  ],
  ['src/data/rhyme-phonemes.json', (e) => typeof e === 'string' && e.length >= 1, { map: true }],
  [
    'src/data/emoji-plots.json',
    (e) => e.emoji.length >= 3 && e.title.length > 1 && (e.kind === 'movie' || e.kind === 'book'),
  ],
  ['src/data/timeline-events.json', (e) => typeof e.year === 'number' && e.event.length >= 3],
  [
    'src/data/sudoku-puzzles.json',
    (e) =>
      Array.isArray(e) &&
      e.length === 81 &&
      e.every((digit) => Number.isInteger(digit) && digit >= 0 && digit <= 9),
  ],
  [
    'src/data/price-products.json',
    (e) =>
      Number.isInteger(e.price) &&
      e.price >= 1 &&
      e.price <= 4000 &&
      e.description.length >= 10 &&
      (e.image === undefined || typeof e.image === 'string') &&
      (e.credit === undefined ||
        (typeof e.credit.license === 'string' &&
          (e.credit.creator === null || typeof e.credit.creator === 'string'))),
  ],
  [
    'src/data/genre-swaps.json',
    (e) => e.original.length > 1 && e.description.length >= 30 && e.description.length <= 180,
  ],
  [
    'src/data/genre-benders.json',
    (e) => e.bent.length >= 40 && e.bent.length <= 200 && typeof e.year === 'number',
  ],
  [
    'server/src/data/charades-movies.json',
    (e) =>
      e.title.length >= 2 &&
      (e.category === 'hollywood' || e.category === 'bollywood') &&
      e.title.length <= 70,
  ],
  [
    'server/src/data/celebrities.json',
    (e) =>
      e.name.length >= 3 &&
      (e.gender === 'm' || e.gender === 'f') &&
      typeof e.alive === 'boolean' &&
      e.profession.length >= 3 &&
      e.famousFor.length >= 3 &&
      Array.isArray(e.facts) &&
      e.facts.length >= 1 &&
      e.facts.every((fact) => typeof fact === 'string' && fact.length >= 10),
  ],
];

let failed = 0;
for (const [path, check, options = {}] of files) {
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'));
    if (options.map) {
      const values = Object.values(data);
      if (values.length === 0) throw new Error('empty');
      const bad = values.filter((e) => !check(e));
      console.log(`${path}: ${values.length} entries, ${bad.length} invalid`);
      if (bad.length) {
        failed += 1;
        console.log('  bad sample:', JSON.stringify(bad[0]));
      }
      continue;
    }
    if (!Array.isArray(data) || data.length === 0) throw new Error('empty');
    const bad = data.filter((e) => !check(e));
    const seen = new Set();
    const dups = data.filter((e) => {
      const key = JSON.stringify(e).toLowerCase();
      if (seen.has(key)) return true;
      seen.add(key);
      return false;
    });
    console.log(`${path}: ${data.length} entries, ${bad.length} invalid, ${dups.length} dups`);
    if (bad.length || dups.length) {
      failed += 1;
      console.log('  bad sample:', JSON.stringify(bad[0] ?? dups[0]));
    }
  } catch (error) {
    failed += 1;
    console.log(`${path}: FAILED — ${error.message}`);
  }
}
console.log(failed === 0 ? 'ALL DATASETS OK' : `${failed} FILES NEED FIXES`);
process.exit(failed === 0 ? 0 : 1);
