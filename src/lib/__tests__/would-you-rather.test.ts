import { describe, expect, it } from 'vitest';
import {
  dilemmas,
  pickDilemmas,
  summarizeSession,
  WYR_DILEMMAS_PER_SESSION,
} from '../would-you-rather';

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
