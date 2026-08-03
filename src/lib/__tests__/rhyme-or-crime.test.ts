import { describe, expect, it } from 'vitest';
import {
  applyMultiplier,
  judgeRhymeAnswer,
  pickRhymeRounds,
  streakMultiplier,
  type RhymeEntry,
} from '../rhyme-or-crime';

const ENTRIES: RhymeEntry[] = [
  { prompt: 'witch', category: 'Fruits', answers: ['peach'] },
  { prompt: 'cheese', category: 'Fruits', answers: ['peas', 'keys'] },
  { prompt: 'cat', category: 'Animals', answers: ['bat', 'rat'] },
  { prompt: 'jar', category: 'Foods', answers: ['bar'] },
  { prompt: 'moon', category: 'Body Parts', answers: ['tune'] },
];

describe('Rhyme or Crime logic (PRD §5.2)', () => {
  it('judges answers case/space-insensitively against the dataset', () => {
    const verdict = judgeRhymeAnswer(ENTRIES[0]!, '  Peach ', 5_000);
    expect(verdict.correct).toBe(true);
    expect(verdict.basePoints).toBe(15); // +10 + 5 speed bonus
    const slow = judgeRhymeAnswer(ENTRIES[0]!, 'peach', 20_000);
    expect(slow.basePoints).toBe(10);
    const wrong = judgeRhymeAnswer(ENTRIES[0]!, 'orange', 5_000);
    expect(wrong.correct).toBe(false);
    expect(wrong.points).toBe(0);
  });

  it('streak multiplier: ×2 from 3 consecutive, ×3 from 5', () => {
    expect(streakMultiplier(2)).toBe(1);
    expect(streakMultiplier(3)).toBe(2);
    expect(streakMultiplier(4)).toBe(2);
    expect(streakMultiplier(5)).toBe(3);
    const verdict = applyMultiplier(
      { correct: true, reveal: 'peach', basePoints: 15, streakMultiplier: 1, points: 15 },
      5
    );
    expect(verdict.points).toBe(45);
    // Wrong answers never multiply.
    const miss = applyMultiplier(
      { correct: false, reveal: 'peach', basePoints: 0, streakMultiplier: 1, points: 0 },
      5
    );
    expect(miss.streakMultiplier).toBe(1);
  });

  it('picks unique rounds without repeating entries', () => {
    const rounds = pickRhymeRounds(ENTRIES, 5, 0);
    expect(rounds).toHaveLength(5);
    expect(new Set(rounds.map((entry) => entry.prompt)).size).toBe(5);
  });
});
