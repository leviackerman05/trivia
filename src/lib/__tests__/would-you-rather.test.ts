import { describe, expect, it } from 'vitest';
import {
  dilemmas,
  pickDilemmas,
  shuffleDilemma,
  summarizeSession,
  WYR_DILEMMAS_PER_SESSION,
} from '../would-you-rather';
import { seededRandom } from '../trivia';

describe('would-you-rather dataset (src/data/would-you-rather.json)', () => {
  it('has at least 30 valid dilemmas', () => {
    expect(dilemmas.length).toBeGreaterThanOrEqual(30);
    for (const dilemma of dilemmas) {
      expect(dilemma.a.trim().length).toBeGreaterThan(3);
      expect(dilemma.b.trim().length).toBeGreaterThan(3);
      expect(dilemma.a).not.toBe(dilemma.b);
    }
  });
});

describe('pickDilemmas', () => {
  it('returns the requested count of distinct dilemmas', () => {
    const picked = pickDilemmas();
    expect(picked).toHaveLength(WYR_DILEMMAS_PER_SESSION);
    expect(new Set(picked).size).toBe(WYR_DILEMMAS_PER_SESSION);
  });

  it('never exceeds the dataset size', () => {
    const picked = pickDilemmas(1000);
    expect(picked.length).toBe(dilemmas.length);
  });
});

describe('shuffleDilemma (R7)', () => {
  const dilemma = { a: 'pizza', b: 'tacos' };

  it('keeps both options, just reordered', () => {
    const shuffled = shuffleDilemma(dilemma);
    expect(new Set([shuffled.a, shuffled.b])).toEqual(new Set(['pizza', 'tacos']));
  });

  it('presents both A-first and B-first over repeated rounds', () => {
    let aFirst = 0;
    let bFirst = 0;
    for (let i = 0; i < 60; i += 1) {
      const shuffled = shuffleDilemma(dilemma);
      if (shuffled.a === 'pizza') {
        aFirst += 1;
      } else {
        bFirst += 1;
      }
    }
    expect(aFirst).toBeGreaterThan(0);
    expect(bFirst).toBeGreaterThan(0);
  });

  it('is deterministic under a seeded random', () => {
    expect(shuffleDilemma(dilemma, seededRandom(1))).toEqual(
      shuffleDilemma(dilemma, seededRandom(1))
    );
  });
});

describe('summarizeSession', () => {
  it('computes totals and a verdict from vote counts', () => {
    const summary = summarizeSession(7, 3, 10);
    expect(summary.votes).toBe(10);
    expect(summary.dilemmas).toBe(10);
    expect(summary.pickA).toBe(7);
    expect(summary.pickB).toBe(3);
    expect(summary.verdict).toBe('A-lister');
  });

  it('verdict flips for B-heavy rooms and stays balanced in the middle', () => {
    expect(summarizeSession(2, 8, 10).verdict).toBe('B-sider');
    expect(summarizeSession(5, 5, 10).verdict).toBe('Balanced brain');
    expect(summarizeSession(0, 0, 0).verdict).toBe('Balanced brain');
  });
});
