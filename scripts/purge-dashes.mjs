/**
 * Em/en dash purge (writing standard 2026-08-04): rewrites a spaced em dash
 * as a comma, a line-leading em dash as a bullet, and en dashes as hyphens.
 * Kept in-repo so the standard can be re-applied if legacy content returns.
 *
 * Dashes are written as unicode escapes so this file never contains them.
 *
 * Usage: node scripts/purge-dashes.mjs <file...>
 * Safe to re-run: it is idempotent once dashes are gone.
 */
import { readFile, writeFile } from 'node:fs/promises';

const files = process.argv.slice(2);
const EM = '\u2014';
const EN = '\u2013';

function purge(text) {
  let out = text;
  out = out.replace(new RegExp(` ${EM} `, 'g'), ', ');
  out = out.replace(new RegExp(`^${EM} `, 'gm'), '- ');
  out = out.replace(new RegExp(` ${EM}$`, 'gm'), '.');
  out = out.replace(new RegExp(EM, 'g'), ' - ');
  out = out.replace(new RegExp(EN, 'g'), '-');
  // Clean punctuation collisions the comma rewrite can create.
  out = out.replace(/\. ,/g, '. ');
  out = out.replace(/\? ,/g, '? ');
  out = out.replace(/! ,/g, '! ');
  out = out.replace(/, ,/g, ', ');
  out = out.replace(/ ,/g, ',');
  return out;
}

for (const file of files) {
  const before = await readFile(file, 'utf8');
  const after = purge(before);
  if (after !== before) {
    await writeFile(file, after);
    console.log(`purged ${file}`);
  } else {
    console.log(`clean ${file}`);
  }
}
