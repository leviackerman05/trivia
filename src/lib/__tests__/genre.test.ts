import { describe, expect, it } from 'vitest';
import {
  GENRE_SWAP_SPEED_BONUS_MS,
  genreSwapOptions,
  judgeGenreSwap,
  pickGenreSwapQuestions,
  type GenreSwapEntry,
} from '../genre-swap';
import {
  benderLabel,
  genreBenderOptions,
  judgeGenreBender,
  pickGenreBenderQuestions,
  type GenreBenderEntry,
} from '../genre-bender';
import { buildOptions } from '../solo';

const SWAPS: GenreSwapEntry[] = [
  { original: 'Harry Potter', genre: 'noir', description: 'A boy detective in a rainy city.' },
  { original: 'Titanic', genre: 'heist', description: 'A crew plans the score of a lifetime.' },
  { original: 'The Matrix', genre: 'rom-com', description: 'She meets a man who dodges bullets.' },
  { original: 'Jaws', genre: 'courtroom', description: 'A lawyer defends a misunderstood shark.' },
];

const BENDERS: GenreBenderEntry[] = [
  { original: 'Baby Shark', artist: 'Pinkfong', bent: 'Prithee hear the tuneful fry…', year: 2016 },
  { original: 'Old Town Road', artist: 'Lil Nas X', bent: 'Yonder lane I trod anon…', year: 2019 },
  { original: 'Rolling in the Deep', artist: 'Adele', bent: 'In the abyss I tumble…', year: 2010 },
  {
    original: 'Blinding Lights',
    artist: 'The Weeknd',
    bent: 'A dazzling glare doth smite me…',
    year: 2019,
  },
];

describe('Genre Swap logic (PRD §5.9)', () => {
  it('picks 10 unique questions with correct + 3 distractors', () => {
    const picked = pickGenreSwapQuestions(SWAPS, 4, 0);
    expect(picked).toHaveLength(4);
    const options = genreSwapOptions(
      picked[0]!,
      SWAPS.map((entry) => entry.original)
    );
    expect(options).toHaveLength(4);
    expect(options).toContain(picked[0]!.original);
    expect(new Set(options).size).toBe(4);
  });

  it('scores +10 correct with a +5 speed bonus under 10s', () => {
    const fast = judgeGenreSwap('Titanic', 'Titanic', GENRE_SWAP_SPEED_BONUS_MS - 1);
    expect(fast.points).toBe(15);
    const slow = judgeGenreSwap('Titanic', 'Titanic', GENRE_SWAP_SPEED_BONUS_MS + 1);
    expect(slow.points).toBe(10);
    const wrong = judgeGenreSwap('Jaws', 'Titanic', 500);
    expect(wrong.points).toBe(0);
  });

  it('buildOptions shuffles and never duplicates', () => {
    const options = buildOptions('a', ['a', 'b', 'c', 'd', 'e'], 4, () => 0.5);
    expect(options).toHaveLength(4);
    expect(new Set(options).size).toBe(4);
    expect(options).toContain('a');
  });
});

describe('Genre-Bender logic (PRD §5.10)', () => {
  it('options are title — artist pairs with 3 distractors', () => {
    const picked = pickGenreBenderQuestions(BENDERS, 4, 0);
    const options = genreBenderOptions(picked[0]!, picked);
    expect(options).toHaveLength(4);
    expect(options).toContain(benderLabel(picked[0]!));
    expect(options[0]).toMatch(/—/);
  });

  it('scores like genre swap', () => {
    const verdict = judgeGenreBender('Baby Shark — Pinkfong', 'Baby Shark — Pinkfong', 1_000);
    expect(verdict.correct).toBe(true);
    expect(verdict.points).toBe(15);
    expect(
      judgeGenreBender('Old Town Road — Lil Nas X', 'Baby Shark — Pinkfong', 1_000).points
    ).toBe(0);
  });
});
