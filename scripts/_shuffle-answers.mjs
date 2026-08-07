#!/usr/bin/env node
/**
 * _shuffle-answers.mjs — authoring tool (TRIVIA-TOPICS §4.4.4).
 * Reorders each question's 4 options so the correct-answer position varies
 * naturally. Deterministic (seed = FNV-1a of topic+question) and IDEMPOTENT:
 * the correct option is swapped to a seed-derived target position, so running
 * the tool again on an already-processed file is a no-op. Same seed ⇒ same
 * output on every run.
 *
 * Usage: node scripts/_shuffle-answers.mjs <file1> [file2 ...]
 */
import { readFileSync, writeFileSync } from 'node:fs';

function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

for (const path of process.argv.slice(2)) {
  const qs = JSON.parse(readFileSync(path, 'utf8'));
  let moved = 0;
  for (const q of qs) {
    const target = Math.floor(mulberry32(hash(`${q.topic}:${q.question}`))() * 4);
    if (target === q.answer) continue;
    const tmp = q.options[q.answer];
    q.options[q.answer] = q.options[target];
    q.options[target] = tmp;
    q.answer = target;
    moved++;
  }
  writeFileSync(path, JSON.stringify(qs, null, 1) + '\n');
  console.log(`shuffled ${qs.length} questions in ${path} (${moved} repositioned)`);
}
