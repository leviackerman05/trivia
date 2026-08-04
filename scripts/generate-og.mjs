/**
 * OG image generator (PRD §6.2, auto-generated template with game name +
 * TriviaHub wordmark). Build-time only: renders public/og/{slug}.png at
 * 1200x630 from the BounceBox template.
 *
 * Runs automatically before `astro build` (package.json "prebuild") and
 * manually via `pnpm og:generate`. Generated files are gitignored.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(root, 'public', 'og');

const catalog = JSON.parse(await readFile(join(root, 'src', 'data', 'games.json'), 'utf-8'));

const FONT_DIR = join(root, 'node_modules', '@fontsource');
const fonts = [
  {
    name: 'Inter',
    data: await readFile(join(FONT_DIR, 'inter', 'files', 'inter-latin-400-normal.woff')),
    weight: 400,
    style: 'normal',
  },
  {
    name: 'Inter',
    data: await readFile(join(FONT_DIR, 'inter', 'files', 'inter-latin-800-normal.woff')),
    weight: 800,
    style: 'normal',
  },
];

const FAMILY_LABELS = {
  drawing: 'Drawing Game',
  voting: 'Voting Game',
  solo: 'Solo Game',
  special: 'Party Classic',
  quiz: 'Quiz',
};

function logoMark() {
  return React.createElement(
    'div',
    {
      style: {
        width: 64,
        height: 64,
        borderRadius: 14,
        backgroundColor: '#F38020',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      },
    },
    React.createElement('div', {
      style: { width: 38, height: 38, borderRadius: 9999, backgroundColor: '#FFFFFF' },
    }),
    React.createElement('div', {
      style: {
        position: 'absolute',
        width: 20,
        height: 20,
        borderRadius: 9999,
        backgroundColor: '#F38020',
      },
    }),
    React.createElement('div', {
      style: {
        position: 'absolute',
        top: 4,
        right: 7,
        width: 10,
        height: 10,
        borderRadius: 9999,
        backgroundColor: '#3B82F6',
      },
    }),
    React.createElement('div', {
      style: {
        position: 'absolute',
        bottom: 6,
        left: 9,
        width: 8,
        height: 8,
        borderRadius: 9999,
        backgroundColor: '#FFAC00',
      },
    })
  );
}

function template({ name, tagline, family }) {
  const nameSize = name.length > 24 ? 52 : name.length > 16 ? 64 : 88;
  const familyLabel = FAMILY_LABELS[family] ?? 'Party Game';

  return React.createElement(
    'div',
    {
      style: {
        width: 1200,
        height: 630,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#09090B',
        fontFamily: 'Inter',
        padding: '64px 80px',
        position: 'relative',
        overflow: 'hidden',
      },
    },
    React.createElement('div', {
      style: {
        position: 'absolute',
        top: -100,
        right: -100,
        width: 340,
        height: 340,
        borderRadius: 9999,
        backgroundColor: 'rgba(243,128,32,0.12)',
      },
    }),
    React.createElement('div', {
      style: {
        position: 'absolute',
        top: 44,
        right: 130,
        width: 44,
        height: 44,
        borderRadius: 9999,
        backgroundColor: '#FFAC00',
      },
    }),
    React.createElement('div', {
      style: {
        position: 'absolute',
        top: 110,
        right: 300,
        width: 22,
        height: 22,
        borderRadius: 9999,
        backgroundColor: '#3B82F6',
      },
    }),
    React.createElement(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: 16 } },
      logoMark(),
      React.createElement(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            fontFamily: 'Inter',
            fontWeight: 800,
            fontSize: 40,
            color: '#FAFAFA',
          },
        },
        'Trivia',
        React.createElement('span', { style: { color: '#F38020' } }, 'Hub')
      )
    ),
    React.createElement('div', { style: { flex: 1 } }),
    React.createElement(
      'div',
      {
        style: {
          alignSelf: 'flex-start',
          display: 'flex',
          alignItems: 'center',
          padding: '8px 24px',
          borderRadius: 8,
          backgroundColor: 'rgba(243,128,32,0.15)',
          border: '1px solid rgba(243,128,32,0.4)',
          color: '#F6994F',
          fontSize: 22,
          fontWeight: 600,
        },
      },
      familyLabel
    ),
    React.createElement(
      'div',
      {
        style: {
          fontFamily: 'Inter',
          fontWeight: 800,
          fontSize: nameSize,
          color: '#FAFAFA',
          lineHeight: 1.15,
          letterSpacing: '-0.02em',
          marginTop: 18,
          maxWidth: 1000,
        },
      },
      name
    ),
    React.createElement(
      'div',
      {
        style: {
          fontSize: 28,
          color: '#A1A1AA',
          lineHeight: 1.45,
          marginTop: 16,
          maxWidth: 880,
        },
      },
      tagline
    ),
    React.createElement('div', { style: { flex: 1 } }),
    React.createElement(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: 10, color: '#71717A', fontSize: 24 } },
      React.createElement('div', {
        style: { width: 12, height: 12, borderRadius: 9999, backgroundColor: '#F38020' },
      }),
      React.createElement('div', {
        style: { width: 12, height: 12, borderRadius: 9999, backgroundColor: '#3B82F6' },
      }),
      React.createElement('div', {
        style: { width: 12, height: 12, borderRadius: 9999, backgroundColor: '#FFAC00' },
      }),
      'playtriviahub.com'
    )
  );
}

async function renderOgImage(entry, fileName) {
  const svg = await satori(template(entry), {
    width: 1200,
    height: 630,
    fonts,
  });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
  await writeFile(join(OUT_DIR, fileName), png);
}

await mkdir(OUT_DIR, { recursive: true });

const entries = [
  ...catalog.map((game) => ({
    name: game.name,
    tagline: game.tagline,
    family: game.family,
    fileName: `${game.slug}.png`,
  })),
  {
    name: 'TriviaHub',
    tagline: '19 free party games, daily trivia, and multiplayer fun',
    family: 'special',
    fileName: 'home.png',
  },
  {
    name: 'TriviaHub',
    tagline: '19 free party games, daily trivia, and multiplayer fun',
    family: 'special',
    fileName: 'default.png',
  },
];

for (const entry of entries) {
  await renderOgImage(entry, entry.fileName);
  console.log(`✓ public/og/${entry.fileName}`);
}

console.log(`Generated ${entries.length} OG images.`);
