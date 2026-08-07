import { describe, expect, it } from 'vitest';
import emojiPlotsJson from '../../data/emoji-plots.json';
import {
  dailyGameSeed,
  getDailyGame,
  getLiveDailyGames,
  getPlannedDailyGames,
  playedToday,
  type DailyHistory,
} from '../daily';
import { EMOJI_TOTAL_QUESTIONS, pickEmojiQuestions } from '../emoji-plot';
import { ICON_PATHS } from '../icons';

describe('daily registry (Phase A + M19 + R18/R20)', () => {
  it('exposes 6 live daily games with unique slugs', () => {
    const live = getLiveDailyGames();
    expect(live).toHaveLength(6);
    expect(new Set(live.map((game) => game.slug)).size).toBe(live.length);
  });

  it('ships wordle live with its category (R20; chess reverted by D067)', () => {
    expect(getDailyGame('wordle')).toMatchObject({ category: 'word', live: true });
    expect(getDailyGame('chess')).toBeUndefined();
  });

  it('every live game icon key exists in the in-repo icon set', () => {
    for (const game of getLiveDailyGames()) {
      expect(ICON_PATHS[game.emoji as keyof typeof ICON_PATHS], game.slug).toBeDefined();
    }
  });

  it('has zero planned games (all six are live)', () => {
    expect(getPlannedDailyGames()).toHaveLength(0);
  });

  it('resolves every daily slug to a registry entry', () => {
    for (const game of getLiveDailyGames()) {
      expect(getDailyGame(game.slug)).toBeDefined();
    }
  });
});

describe('dailyGameSeed (Phase A, D050)', () => {
  it('is deterministic for the same date and game', () => {
    expect(dailyGameSeed('2026-08-04', 'emoji-plot')).toBe(
      dailyGameSeed('2026-08-04', 'emoji-plot')
    );
  });

  it('changes with the date and with the game', () => {
    expect(dailyGameSeed('2026-08-04', 'emoji-plot')).not.toBe(
      dailyGameSeed('2026-08-05', 'emoji-plot')
    );
    expect(dailyGameSeed('2026-08-04', 'emoji-plot')).not.toBe(
      dailyGameSeed('2026-08-04', 'genre-swap')
    );
  });

  it('produces stable daily content: same seed, same questions', () => {
    const entries = emojiPlotsJson as Parameters<typeof pickEmojiQuestions>[0];
    const seed = dailyGameSeed('2026-08-04', 'emoji-plot');
    const first = pickEmojiQuestions(entries, EMOJI_TOTAL_QUESTIONS, seed);
    const second = pickEmojiQuestions(entries, EMOJI_TOTAL_QUESTIONS, seed);
    expect(first).toEqual(second);
  });

  it('produces different content across days', () => {
    const entries = emojiPlotsJson as Parameters<typeof pickEmojiQuestions>[0];
    const monday = pickEmojiQuestions(
      entries,
      EMOJI_TOTAL_QUESTIONS,
      dailyGameSeed('2026-08-03', 'emoji-plot')
    );
    const tuesday = pickEmojiQuestions(
      entries,
      EMOJI_TOTAL_QUESTIONS,
      dailyGameSeed('2026-08-04', 'emoji-plot')
    );
    expect(monday.map((entry) => entry.title)).not.toEqual(tuesday.map((entry) => entry.title));
  });
});

describe('playedToday (Phase 0/1)', () => {
  it('lists only games with a score for the given day', () => {
    const history: DailyHistory = {
      trivia: { '2026-08-04': 90 },
      sudoku: { '2026-08-03': 200 },
    };
    expect(playedToday(history, '2026-08-04')).toEqual(['trivia']);
    expect(playedToday(history, '2026-08-03')).toEqual(['sudoku']);
    expect(playedToday(history, '2026-08-05')).toEqual([]);
  });
});
