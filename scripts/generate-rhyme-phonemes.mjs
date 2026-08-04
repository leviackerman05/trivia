#!/usr/bin/env node
/**
 * M14 rhyme-key generator, builds src/data/rhyme-phonemes.json from the
 * public-domain CMU Pronouncing Dictionary (https://github.com/cmusphinx/cmudict).
 *
 * A word's RHYME KEY is the final stressed vowel plus everything after it
 * (stress digits stripped). Two words rhyme when their rhyme keys match:
 * PIE → P AY1 → "ay", HI → HH AY1 → "ay" → rhyme. This lets Rhyme or Crime
 * accept ANY rhyming word ("hi" for "pie"), not just the dataset's answer
 * list, without shipping the full 134k-word dictionary, only ~3.5k common
 * words + every prompt/answer in the dataset.
 *
 * Usage: node scripts/generate-rhyme-phonemes.mjs <cmudict.dict> [words.txt]
 * - words.txt: one common word per line (optional; defaults to all prompts
 *   + answers + a built-in common list).
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dictPath = process.argv[2];
if (!dictPath) {
  console.error('usage: node scripts/generate-rhyme-phonemes.mjs <cmudict.dict> [words.txt]');
  process.exit(1);
}

/** Parse a CMU line: "WORD(2)  PHONEMES..." → [word, phonemes[]]. */
function parseDictLine(line) {
  const cleaned = line.replace(/\([0-9]+\)/, '').trim();
  if (!cleaned || cleaned.startsWith(';;;')) {
    return null;
  }
  const [word, ...phonemes] = cleaned.split(/\s+/);
  if (!word || phonemes.length === 0) {
    return null;
  }
  return [word.toLowerCase(), phonemes];
}

/**
 * Rhyme key: from the last stressed vowel (1/2) to the end, digits stripped.
 * Words with no marked stress fall back to the last vowel phoneme.
 */
function rhymeKey(phonemes) {
  let start = -1;
  for (let i = phonemes.length - 1; i >= 0; i -= 1) {
    if (/[0-9]/.test(phonemes[i]) && !phonemes[i].endsWith('0')) {
      start = i;
      break;
    }
  }
  if (start === -1) {
    for (let i = phonemes.length - 1; i >= 0; i -= 1) {
      if (/^[AEIOU]/.test(phonemes[i])) {
        start = i;
        break;
      }
    }
  }
  if (start === -1) {
    return null;
  }
  return phonemes
    .slice(start)
    .map((p) => p.replace(/[0-9]/g, '').toLowerCase())
    .join(' ');
}

// 1. Parse the dictionary.
const keys = new Map();
for (const line of readFileSync(dictPath, 'utf8').split('\n')) {
  const parsed = parseDictLine(line);
  if (!parsed) {
    continue;
  }
  const [word, phonemes] = parsed;
  if (!keys.has(word)) {
    const key = rhymeKey(phonemes);
    if (key) {
      keys.set(word, key);
    }
  }
}
console.log(`parsed ${keys.size} dictionary words`);

// 2. Collect the wanted words: every prompt/answer in the dataset first…
const wanted = new Set();
const rhymesPath = join(root, 'src/data/rhymes.json');
if (existsSync(rhymesPath)) {
  const entries = JSON.parse(readFileSync(rhymesPath, 'utf8'));
  for (const entry of entries) {
    wanted.add(String(entry.prompt).toLowerCase());
    for (const answer of entry.answers ?? []) {
      wanted.add(String(answer).toLowerCase());
    }
  }
}
// …then the common-word list (kept at the top of the file order matters.
// entries are emitted in dictionary order, so the set is just for lookup).
// Only clean alphabetic words from the top of the frequency list, the tail
// of web-frequency lists is spam, and symbols/abbreviations don't rhyme.
const wordsPath = process.argv[3];
const commonWords = wordsPath
  ? readFileSync(wordsPath, 'utf8')
      .split('\n')
      .map((w) => w.trim().toLowerCase())
      .filter((w) => /^[a-z]+$/.test(w))
      .slice(0, 4000)
  : [];
for (const word of commonWords) {
  wanted.add(word);
}

// 3. Emit the map (common words first, capped so the island bundle stays
// well inside the 300 KB budget).
const output = {};
let emitted = 0;
const cap = 2500;
for (const word of commonWords) {
  if (emitted >= cap) {
    break;
  }
  const key = keys.get(word);
  if (key && !output[word]) {
    output[word] = key;
    emitted += 1;
  }
}
// Dataset words are always included, even past the cap.
for (const word of wanted) {
  const key = keys.get(word);
  if (key) {
    output[word] = key;
  } else {
    console.warn(`no phonemes for dataset word: "${word}"`);
  }
}

const outPath = join(root, 'src/data/rhyme-phonemes.json');
writeFileSync(outPath, `${JSON.stringify(output)}\n`);
console.log(`wrote ${Object.keys(output).length} words -> ${outPath}`);
