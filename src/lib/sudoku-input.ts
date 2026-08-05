/**
 * [R9] DOM-free keyboard helpers for the sudoku grid. `src/lib/sudoku.ts`
 * stays byte-identical; these helpers back the native-keyboard input cells.
 */

/**
 * 1–9 from a raw input value, 0 for empty/invalid. A multi-char paste keeps
 * the last digit ('12' → 2, '1x2' → 2); letters and '0' yield 0.
 */
export function sanitizeDigitInput(raw: string): number {
  for (let i = raw.length - 1; i >= 0; i -= 1) {
    const char = raw[i]!;
    if (char >= '1' && char <= '9') {
      return Number(char);
    }
  }
  return 0;
}

export type ArrowKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown';

/**
 * Next cell index for a 9×9 grid with wrap: left/right move ±1 within the
 * row (mod 9), up/down move ±9 rows (mod 81).
 */
export function nextCellIndex(current: number, key: ArrowKey): number {
  const row = Math.floor(current / 9);
  const col = current % 9;
  switch (key) {
    case 'ArrowLeft':
      return row * 9 + ((col + 8) % 9);
    case 'ArrowRight':
      return row * 9 + ((col + 1) % 9);
    case 'ArrowUp':
      return ((row + 8) % 9) * 9 + col;
    case 'ArrowDown':
      return ((row + 1) % 9) * 9 + col;
  }
}
