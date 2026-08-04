#!/usr/bin/env node
/**
 * M15, add tiers to Never Have I Ever statements and genres to This or
 * That pairs, plus curated new NHIE statements for the dirty/super-dirty
 * tiers (owner request 2026-08-04). Idempotent: re-running merges cleanly.
 *
 * Tier scale: boring → moderate → dirty → super-dirty (NSFW). The default
 * game tier is "moderate"; hosts opt into dirtier content. NOTE: NSFW text
 * is a known AdSense-policy risk (see DECISIONS), the default keeps it off.
 *
 * Run: node scripts/generate-voting-datasets.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------------------
// Never Have I Ever, tier per existing statement index (0-209).
// ---------------------------------------------------------------------------
const BORING = new Set([
  0, 1, 3, 4, 5, 6, 8, 9, 10, 11, 12, 15, 16, 17, 18, 19, 20, 21, 24, 25, 27, 28, 31, 32, 34, 35,
  36, 37, 38, 39, 40, 41, 42, 43, 45, 46, 47, 48, 49, 50, 52, 53, 54, 55, 56, 57, 58, 59, 60, 65,
  66, 67, 68, 71, 72, 74, 75, 76, 77, 78, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94,
  95, 96, 97, 98, 99, 101, 102, 103, 104, 105, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119,
  120, 149, 150, 163, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 176, 177, 178, 180, 181,
  182, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201,
  202, 203, 204, 205, 206, 207, 208, 209,
]);
const DIRTY = new Set([123, 124, 125, 126, 127, 129, 130, 139, 157, 161, 162]);
// Everything else falls into MODERATE (mild mischief / dating / embarrassing).

const NEW_STATEMENTS = [
  // dirty, alcohol, dating, mild taboo
  { statement: 'drunk dialed an ex', tier: 'dirty' },
  { statement: 'had a fake ID', tier: 'dirty' },
  { statement: 'been to a party I was not invited to', tier: 'dirty' },
  { statement: 'snuck into a concert or club', tier: 'dirty' },
  { statement: 'made out with someone I met the same day', tier: 'dirty' },
  { statement: 'been on dates with two different people in one week', tier: 'dirty' },
  { statement: 'kissed someone to make someone else jealous', tier: 'dirty' },
  { statement: 'been caught checking someone out', tier: 'dirty' },
  { statement: 'stalked my crush’s new partner online', tier: 'dirty' },
  { statement: 'lied about my age to get served', tier: 'dirty' },
  { statement: 'been drunk at a family gathering', tier: 'dirty' },
  { statement: 'vaped or smoked to look cool', tier: 'dirty' },
  { statement: 'snuck out of the house at night', tier: 'dirty' },
  { statement: 'thrown a party while the parents were away', tier: 'dirty' },
  { statement: 'flirted with a server for a freebie', tier: 'dirty' },
  { statement: 'sent a flirty text to the wrong person', tier: 'dirty' },
  { statement: 'used a pick-up line that actually worked', tier: 'dirty' },
  { statement: 'taken a shot just to fit in', tier: 'dirty' },
  { statement: 'had an awkward first kiss', tier: 'dirty' },
  { statement: 'been caught staring at someone’s phone', tier: 'dirty' },
  { statement: 'gone on a date with someone my friends hated', tier: 'dirty' },
  { statement: 'had a crush on my best friend’s sibling', tier: 'dirty' },
  { statement: 'slow danced with a stranger', tier: 'dirty' },
  { statement: 'been the third wheel on purpose', tier: 'dirty' },
  { statement: 'reused a first date outfit for a second date', tier: 'dirty' },
  { statement: 'googled how to flirt', tier: 'dirty' },
  // super-dirty, NSFW (host must opt in; flagged in DECISIONS)
  { statement: 'had a one-night stand', tier: 'super-dirty' },
  { statement: 'hooked up with a coworker', tier: 'super-dirty' },
  { statement: 'had a fling with a friend’s ex', tier: 'super-dirty' },
  { statement: 'been to a strip club', tier: 'super-dirty' },
  { statement: 'played a drinking game that got out of hand', tier: 'super-dirty' },
  { statement: 'sent a risqué photo to the wrong person', tier: 'super-dirty' },
  { statement: 'been caught in a compromising position', tier: 'super-dirty' },
  { statement: 'had a dream about someone I should not have', tier: 'super-dirty' },
  { statement: 'searched for my ex at 2am', tier: 'super-dirty' },
  { statement: 'kissed someone to win a dare', tier: 'super-dirty' },
  { statement: 'lied about my body count', tier: 'super-dirty' },
  { statement: 'watched something I would never admit to', tier: 'super-dirty' },
  { statement: 'had a situationship with two people at once', tier: 'super-dirty' },
  { statement: 'been dared to do something I regret', tier: 'super-dirty' },
];

function tierOf(index) {
  if (BORING.has(index)) return 'boring';
  if (DIRTY.has(index)) return 'dirty';
  return 'moderate';
}

// ---------------------------------------------------------------------------
// This or That, genre per existing pair index (0-319).
// ---------------------------------------------------------------------------
function genreOf(index) {
  if (index <= 86) return 'food';
  if (index <= 116) return 'animals';
  if (index <= 135) return 'nature';
  if (index <= 184) return 'tech';
  if (index <= 187) return 'gaming';
  if (index <= 225) return 'entertainment';
  if (index <= 248) return 'travel';
  if (index <= 269) return 'money';
  if (index <= 289) return 'love';
  return 'lifestyle';
}

const GENRE_LABELS = {
  food: 'Food',
  animals: 'Animals',
  nature: 'Nature & Weather',
  tech: 'Tech & Social',
  gaming: 'Gaming',
  entertainment: 'Movies, Music & Shows',
  travel: 'Travel',
  money: 'Money & Shopping',
  love: 'Love & Relationships',
  lifestyle: 'Lifestyle',
};

// ---------------------------------------------------------------------------

const nhiePath = join(root, 'server/src/data/never-have-i-ever.json');
const nhie = JSON.parse(readFileSync(nhiePath, 'utf8'));
let dirtyCount = 0;
let superDirtyCount = 0;
for (const [index, entry] of nhie.entries()) {
  entry.tier = tierOf(index);
  if (entry.tier === 'dirty') dirtyCount += 1;
  if (entry.tier === 'super-dirty') superDirtyCount += 1;
}
for (const entry of NEW_STATEMENTS) {
  if (!nhie.some((e) => e.statement === entry.statement)) {
    nhie.push(entry);
    if (entry.tier === 'dirty') dirtyCount += 1;
    if (entry.tier === 'super-dirty') superDirtyCount += 1;
  }
}
writeFileSync(nhiePath, JSON.stringify(nhie, null, 2) + '\n');
const counts = { boring: 0, moderate: 0, dirty: 0, 'super-dirty': 0 };
for (const entry of nhie) counts[entry.tier] += 1;
console.log(
  `nhie: ${nhie.length} statements, ${JSON.stringify(counts)} (dirty+${dirtyCount}, super-dirty+${superDirtyCount})`
);

const totPath = join(root, 'server/src/data/this-or-that.json');
const tot = JSON.parse(readFileSync(totPath, 'utf8'));
const genreCounts = {};
for (const [index, entry] of tot.entries()) {
  entry.genre = genreOf(index);
  genreCounts[entry.genre] = (genreCounts[entry.genre] ?? 0) + 1;
}
writeFileSync(totPath, JSON.stringify(tot, null, 2) + '\n');
console.log(`tot: ${tot.length} pairs, ${JSON.stringify(genreCounts)}`);
console.log('GENRE_LABELS:', JSON.stringify(GENRE_LABELS));
