#!/usr/bin/env node
/**
 * _fix-hollywood.mjs — Lot T2 dedup fix (research/discipline step).
 * The classic 525 pool contains director/actor questions my first keyword scan
 * missed. This removes two kept FE samples that duplicate classic facts and
 * reworks eight questions whose FACT (not just text) collides with classic
 * questions. Idempotent: matching is by normalized question text.
 *
 * Usage: node scripts/_fix-hollywood.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const p = 'src/data/topics/movies-hollywood.json';
const qs = JSON.parse(readFileSync(p, 'utf8'));
const norm = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// (1) drop the two kept samples that duplicate classic facts
const DROP = ['directed the film inception', 'stranded on an island with a volleyball'];

// (2) rework questions whose fact collides with a classic question
const REWORK = [
  {
    match: 'plays the joker in the dark knight',
    q: {
      topic: 'movies-hollywood',
      difficulty: 1,
      question: 'Who played the Joker in the 1989 film Batman?',
      options: ['Jack Nicholson', 'Heath Ledger', 'Joaquin Phoenix', 'Jared Leto'],
      answer: 0,
    },
  },
  {
    match: 'plays t challa in black panther',
    q: {
      topic: 'movies-hollywood',
      difficulty: 1,
      question: 'Who played the villain Killmonger in Black Panther?',
      options: ['Michael B. Jordan', 'Chadwick Boseman', "Lupita Nyong'o", 'Winston Duke'],
      answer: 0,
    },
  },
  {
    match: 'made interstellar and the dark knight trilogy',
    q: {
      topic: 'movies-hollywood',
      difficulty: 2,
      question: 'Which director made the Dark Knight trilogy and Oppenheimer?',
      options: ['Christopher Nolan', 'Denis Villeneuve', 'Ridley Scott', 'Zack Snyder'],
      answer: 0,
    },
  },
  {
    match: 'who directed pulp fiction',
    q: {
      topic: 'movies-hollywood',
      difficulty: 2,
      question: 'Who directed the Kill Bill films?',
      options: ['Quentin Tarantino', 'Robert Rodriguez', 'Guy Ritchie', 'Luc Besson'],
      answer: 0,
    },
  },
  {
    match: 'who directed the godfather',
    q: {
      topic: 'movies-hollywood',
      difficulty: 2,
      question: 'Who directed Apocalypse Now?',
      options: ['Francis Ford Coppola', 'Martin Scorsese', 'Stanley Kubrick', 'Oliver Stone'],
      answer: 0,
    },
  },
  {
    match: 'who directed schindler s list',
    q: {
      topic: 'movies-hollywood',
      difficulty: 2,
      question: 'Who directed Close Encounters of the Third Kind?',
      options: ['Steven Spielberg', 'George Lucas', 'John Carpenter', 'Steven Soderbergh'],
      answer: 0,
    },
  },
  {
    match: 'who directed the musical la la land',
    q: {
      topic: 'movies-hollywood',
      difficulty: 2,
      question: 'Who directed the biopic Bohemian Rhapsody?',
      options: ['Bryan Singer', 'Dexter Fletcher', 'Rob Reiner', 'James Mangold'],
      answer: 0,
    },
  },
  {
    match: 'who directed the 1982 family film e t',
    q: {
      topic: 'movies-hollywood',
      difficulty: 2,
      question: 'Who directed the original Raiders of the Lost Ark?',
      options: ['Steven Spielberg', 'George Lucas', 'Robert Zemeckis', 'Irvin Kershner'],
      answer: 0,
    },
  },
];

// (3) two new medium questions replace the dropped samples
const ADD = [
  {
    topic: 'movies-hollywood',
    difficulty: 2,
    question: 'Who directed the thriller Memento?',
    options: ['Christopher Nolan', 'David Fincher', 'Darren Aronofsky', 'Guy Ritchie'],
    answer: 0,
  },
  {
    topic: 'movies-hollywood',
    difficulty: 2,
    question: 'Who played the title role in The Wolf of Wall Street?',
    options: ['Leonardo DiCaprio', 'Bradley Cooper', 'Jake Gyllenhaal', 'Christian Bale'],
    answer: 0,
  },
];

let dropped = 0,
  reworked = 0;
const out = qs.filter((q) => {
  const k = norm(q.question);
  if (DROP.some((d) => k.includes(d))) {
    dropped++;
    return false;
  }
  return true;
});
for (const r of REWORK) {
  const i = out.findIndex((q) => norm(q.question).includes(r.match));
  if (i === -1) {
    console.error('REWORK MISS:', r.match);
    continue;
  }
  out[i] = r.q;
  reworked++;
}
out.push(...ADD);
writeFileSync(p, JSON.stringify(out, null, 1) + '\n');
console.log(`dropped ${dropped}, reworked ${reworked}, added ${ADD.length}, total ${out.length}`);
