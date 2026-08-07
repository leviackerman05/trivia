#!/usr/bin/env node
/**
 * L12 owner change (2026-08-06): segregate the `cinema` genre into
 *   cinema-bollywood  (region bollywood)
 *   cinema-hollywood  (region hollywood)
 *   cinema            (region row — the rest-of-world film market)
 * so the lobby's single genre row can offer Bollywood and Hollywood
 * separately now that the region picker is gone. The row `cinema` cell is
 * topped up to the 20-entry gate floor with newly authored world-cinema
 * entries. Idempotent: only entries still carrying genre `cinema` move.
 *
 * Usage: node scripts/reclassify-cinema.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = new URL('../server/src/data/celebrities.json', import.meta.url);
const data = JSON.parse(readFileSync(FILE, 'utf8'));

const NEW_WORLD_CINEMA = [
  {
    name: 'Benedict Cumberbatch',
    gender: 'm',
    alive: true,
    profession: 'Actor',
    nationality: 'British',
    ageRange: '40s',
    hairColor: 'brown',
    famousFor: 'Sherlock, Doctor Strange',
    facts: [
      'Plays Doctor Strange in the Marvel films',
      'Starred as Sherlock Holmes on TV',
      'Was born in London',
    ],
    region: 'row',
    genre: 'cinema',
    difficulty: 2,
  },
  {
    name: 'Tom Hiddleston',
    gender: 'm',
    alive: true,
    profession: 'Actor',
    nationality: 'British',
    ageRange: '40s',
    hairColor: 'brown',
    famousFor: 'Loki',
    facts: [
      'Plays Loki in the Marvel films',
      'Studied at the Royal Academy of Dramatic Art',
      'Was in the cast of the series The Night Manager',
    ],
    region: 'row',
    genre: 'cinema',
    difficulty: 2,
  },
  {
    name: 'Daniel Craig',
    gender: 'm',
    alive: true,
    profession: 'Actor',
    nationality: 'British',
    ageRange: '50s',
    hairColor: 'blonde',
    famousFor: 'James Bond',
    facts: [
      'Played James Bond in five films',
      'Was born in Chester, England',
      'Also starred in Knives Out',
    ],
    region: 'row',
    genre: 'cinema',
    difficulty: 2,
  },
  {
    name: 'Ralph Fiennes',
    gender: 'm',
    alive: true,
    profession: 'Actor',
    nationality: 'British',
    ageRange: '60s',
    hairColor: 'gray',
    famousFor: "Voldemort, Schindler's List",
    facts: [
      'Played Voldemort in the Harry Potter films',
      "Was nominated for an Oscar for Schindler's List",
      'Is from Suffolk, England',
    ],
    region: 'row',
    genre: 'cinema',
    difficulty: 3,
  },
  {
    name: 'Colin Firth',
    gender: 'm',
    alive: true,
    profession: 'Actor',
    nationality: 'British',
    ageRange: '60s',
    hairColor: 'gray',
    famousFor: "The King's Speech",
    facts: [
      "Won an Oscar for The King's Speech",
      'Played Mr. Darcy in Pride and Prejudice',
      'Is from Hampshire, England',
    ],
    region: 'row',
    genre: 'cinema',
    difficulty: 3,
  },
  {
    name: 'Judi Dench',
    gender: 'f',
    alive: true,
    profession: 'Actress',
    nationality: 'British',
    ageRange: '90s',
    hairColor: 'gray',
    famousFor: 'M in James Bond',
    facts: [
      'Played M in the James Bond films',
      'Won an Oscar for Shakespeare in Love',
      'Is a Dame of the British Empire',
    ],
    region: 'row',
    genre: 'cinema',
    difficulty: 2,
  },
  {
    name: 'Helena Bonham Carter',
    gender: 'f',
    alive: true,
    profession: 'Actress',
    nationality: 'British',
    ageRange: '50s',
    hairColor: 'black',
    famousFor: 'Harry Potter, The Crown',
    facts: [
      'Played Bellatrix Lestrange in Harry Potter',
      'Was nominated for two Oscars',
      'Appeared in the series The Crown',
    ],
    region: 'row',
    genre: 'cinema',
    difficulty: 3,
  },
  {
    name: 'Ian McKellen',
    gender: 'm',
    alive: true,
    profession: 'Actor',
    nationality: 'British',
    ageRange: '80s',
    hairColor: 'white',
    famousFor: 'Gandalf, Magneto',
    facts: [
      'Played Gandalf in The Lord of the Rings',
      'Also plays Magneto in the X-Men films',
      'Is a leading stage actor in Britain',
    ],
    region: 'row',
    genre: 'cinema',
    difficulty: 1,
  },
  {
    name: 'Javier Bardem',
    gender: 'm',
    alive: true,
    profession: 'Actor',
    nationality: 'Spanish',
    ageRange: '50s',
    hairColor: 'brown',
    famousFor: 'No Country for Old Men',
    facts: [
      'Won an Oscar for No Country for Old Men',
      'Is from Las Palmas, Spain',
      'Is married to actress Penélope Cruz',
    ],
    region: 'row',
    genre: 'cinema',
    difficulty: 3,
  },
  {
    name: 'Penélope Cruz',
    gender: 'f',
    alive: true,
    profession: 'Actress',
    nationality: 'Spanish',
    ageRange: '50s',
    hairColor: 'black',
    famousFor: 'Vicky Cristina Barcelona',
    facts: [
      'Won an Oscar for Vicky Cristina Barcelona',
      'Was the first Spanish actress to win an Oscar',
      'Is from Madrid, Spain',
    ],
    region: 'row',
    genre: 'cinema',
    difficulty: 3,
  },
  {
    name: 'Marion Cotillard',
    gender: 'f',
    alive: true,
    profession: 'Actress',
    nationality: 'French',
    ageRange: '40s',
    hairColor: 'brown',
    famousFor: 'La Vie en Rose',
    facts: [
      'Won an Oscar for La Vie en Rose',
      'Is from Paris, France',
      'Also starred in Inception',
    ],
    region: 'row',
    genre: 'cinema',
    difficulty: 3,
  },
  {
    name: 'Gong Li',
    gender: 'f',
    alive: true,
    profession: 'Actress',
    nationality: 'Chinese',
    ageRange: '60s',
    hairColor: 'black',
    famousFor: 'Memoirs of a Geisha, Raise the Red Lantern',
    facts: [
      'Is one of the most famous Chinese actresses',
      'Starred in Memoirs of a Geisha',
      "Was a regular in director Zhang Yimou's films",
    ],
    region: 'row',
    genre: 'cinema',
    difficulty: 3,
  },
];

const names = new Set(data.map((entry) => entry.name));
const seen = new Set();
for (const entry of data) {
  if (entry.genre === 'cinema' && entry.region === 'bollywood') {
    entry.genre = 'cinema-bollywood';
  } else if (entry.genre === 'cinema' && entry.region === 'hollywood') {
    entry.genre = 'cinema-hollywood';
  }
  seen.add(entry.name);
}
let added = 0;
for (const entry of NEW_WORLD_CINEMA) {
  if (names.has(entry.name)) {
    console.log('skip existing:', entry.name);
    continue;
  }
  data.push(entry);
  added += 1;
}

writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n');

const byGenre = data.reduce((acc, e) => ((acc[e.genre] = (acc[e.genre] ?? 0) + 1), acc), {});
const byRegion = data.reduce((acc, e) => ((acc[e.region] = (acc[e.region] ?? 0) + 1), acc), {});
console.log(`Reclassified; added ${added} world-cinema entries. Total ${data.length}.`);
console.log('genre:', JSON.stringify(byGenre));
console.log('region:', JSON.stringify(byRegion));
