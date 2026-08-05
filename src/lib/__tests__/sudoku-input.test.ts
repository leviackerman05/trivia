import { describe, expect, it } from 'vitest';
import { nextCellIndex, sanitizeDigitInput } from '../sudoku-input';

describe('sanitizeDigitInput (R9)', () => {
  it('returns 0 for empty input', () => {
    expect(sanitizeDigitInput('')).toBe(0);
  });

  it('returns 0 for letters, symbols, and zero', () => {
    expect(sanitizeDigitInput('abc')).toBe(0);
    expect(sanitizeDigitInput('x')).toBe(0);
    expect(sanitizeDigitInput('0')).toBe(0);
    expect(sanitizeDigitInput('!?')).toBe(0);
  });

  it('keeps the last digit from a multi-char paste', () => {
    expect(sanitizeDigitInput('12')).toBe(2);
    expect(sanitizeDigitInput('1x2')).toBe(2);
    expect(sanitizeDigitInput('1234')).toBe(4);
  });

  it('returns a plain digit as-is', () => {
    expect(sanitizeDigitInput('1')).toBe(1);
    expect(sanitizeDigitInput('5')).toBe(5);
    expect(sanitizeDigitInput('9')).toBe(9);
  });
});

describe('nextCellIndex (R9)', () => {
  it('wraps left/right within a row', () => {
    expect(nextCellIndex(0, 'ArrowLeft')).toBe(8);
    expect(nextCellIndex(8, 'ArrowRight')).toBe(0);
    expect(nextCellIndex(10, 'ArrowLeft')).toBe(9);
    expect(nextCellIndex(10, 'ArrowRight')).toBe(11);
  });

  it('wraps up/down across rows', () => {
    expect(nextCellIndex(0, 'ArrowUp')).toBe(72);
    expect(nextCellIndex(72, 'ArrowDown')).toBe(0);
    expect(nextCellIndex(9, 'ArrowUp')).toBe(0);
    expect(nextCellIndex(80, 'ArrowDown')).toBe(8);
    expect(nextCellIndex(10, 'ArrowUp')).toBe(1);
    expect(nextCellIndex(10, 'ArrowDown')).toBe(19);
  });
});
