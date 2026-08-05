import { describe, expect, it } from 'vitest';
import {
  applyStroke,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  COLOR_PALETTE,
  DEFAULT_COLOR,
  DRAWING_DATA_URL_MAX_CHARS,
  DRAWING_EXPORT_MAX_DIM,
  DRAWING_UPLOAD_MAX_BYTES,
  fitWithinMaxDim,
  floodFill,
  pathBBox,
  removeStrokeById,
  replayStrokes,
  type Stroke,
} from '../canvas';

/** Minimal 2D context stub, records calls so pure canvas logic is testable. */
function fakeContext() {
  const calls: string[] = [];
  const ctx = {
    canvas: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
    globalCompositeOperation: 'source-over',
    strokeStyle: '',
    lineWidth: 0,
    lineCap: '',
    lineJoin: '',
    fillStyle: '',
    beginPath: () => calls.push('beginPath'),
    moveTo: (x: number, y: number) => calls.push(`moveTo ${x} ${y}`),
    lineTo: (x: number, y: number) => calls.push(`lineTo ${x} ${y}`),
    stroke: () => calls.push('stroke'),
    fillRect: (x: number, y: number, w: number, h: number) =>
      calls.push(`fillRect ${x} ${y} ${w} ${h}`),
    clearRect: () => calls.push('clearRect'),
    getImageData: () => ({ data: new Uint8ClampedArray(CANVAS_WIDTH * CANVAS_HEIGHT * 4) }),
    putImageData: () => calls.push('putImageData'),
  };
  return { ctx, calls } as unknown as { ctx: CanvasRenderingContext2D; calls: string[] };
}

/**
 * Bitmap-backed context for flood-fill tests: a white 800×500 buffer with
 * copy-in/copy-out getImageData/putImageData semantics (like a real canvas).
 */
function bitmapContext() {
  const width = CANVAS_WIDTH;
  const height = CANVAS_HEIGHT;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255;
    data[i + 3] = 255;
  }
  const ctx = {
    canvas: { width, height },
    globalCompositeOperation: 'source-over',
    strokeStyle: '',
    lineWidth: 0,
    lineCap: '',
    lineJoin: '',
    fillStyle: '',
    beginPath: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    stroke: () => undefined,
    fillRect: () => undefined,
    clearRect: () => undefined,
    getImageData: () => ({ data: new Uint8ClampedArray(data) }),
    putImageData: (image: ImageData) => {
      data.set(image.data);
    },
    setPixel: (x: number, y: number, r: number, g: number, b: number) => {
      const index = (y * width + x) * 4;
      data[index] = r;
      data[index + 1] = g;
      data[index + 2] = b;
      data[index + 3] = 255;
    },
    getPixel: (x: number, y: number): [number, number, number, number] => {
      const index = (y * width + x) * 4;
      return [data[index]!, data[index + 1]!, data[index + 2]!, data[index + 3]!];
    },
  };
  return ctx as unknown as CanvasRenderingContext2D & {
    setPixel: (x: number, y: number, r: number, g: number, b: number) => void;
    getPixel: (x: number, y: number) => [number, number, number, number];
  };
}

const stroke = (overrides: Partial<Stroke> = {}): Stroke => ({
  strokeId: 's1',
  x: 20,
  y: 30,
  prevX: 10,
  prevY: 20,
  color: '#000000',
  brushSize: 4,
  tool: 'pen',
  ...overrides,
});

describe('canvas primitives', () => {
  it('applies pen strokes with round caps and the stroke color', () => {
    const { ctx, calls } = fakeContext();
    applyStroke(ctx, stroke());
    expect(calls).toContain('beginPath');
    expect(calls).toContain('moveTo 10 20');
    expect(calls).toContain('lineTo 20 30');
    expect(calls).toContain('stroke');
    expect(ctx.strokeStyle).toBe('#000000');
    expect(ctx.lineWidth).toBe(4);
    expect(ctx.lineCap).toBe('round');
    expect(ctx.lineJoin).toBe('round');
  });

  it('eraser strokes erase to transparent (destination-out)', () => {
    const { ctx } = fakeContext();
    applyStroke(ctx, stroke({ tool: 'eraser' }));
    expect(ctx.globalCompositeOperation).toBe('destination-out');
  });

  it('replays the full log on a white canvas', () => {
    const { ctx, calls } = fakeContext();
    replayStrokes(ctx, [
      stroke(),
      stroke({ x: 40, y: 50, prevX: 30, prevY: 40, color: '#ed1c24' }),
    ]);
    expect(calls.filter((call) => call === 'stroke')).toHaveLength(2);
    expect(calls).toContain('fillRect 0 0 800 500');
    expect(ctx.fillStyle).toBe('#ffffff');
    expect(ctx.globalCompositeOperation).toBe('source-over');
  });

  it('removeStrokeById drops every segment of one stroke group', () => {
    const strokes = [
      stroke({ strokeId: 'a' }),
      stroke({ strokeId: 'b' }),
      stroke({ strokeId: 'b', x: 99 }),
    ];
    const remaining = removeStrokeById(strokes, 'b');
    expect(remaining).toEqual([stroke({ strokeId: 'a' })]);
  });

  it('exposes the fixed logical canvas size and a 12-color palette', () => {
    expect(CANVAS_WIDTH).toBe(800);
    expect(CANVAS_HEIGHT).toBe(500);
    expect(COLOR_PALETTE).toHaveLength(12);
    expect(DEFAULT_COLOR).toBe(COLOR_PALETTE[0]);
  });
});

describe('silhouette path bounds (Shadow Sketch)', () => {
  it('computes a bounding box for absolute SVG paths', () => {
    // heart silhouette from the dataset (0-100 space)
    const box = pathBBox(
      'M50 32 C50 22 38 14 28 22 C18 30 19 42 28 50 L50 70 L72 50 C81 42 82 30 72 22 C62 14 50 22 50 32 Z'
    );
    expect(box).not.toBeNull();
    expect(box!.minX).toBeCloseTo(18, 0);
    expect(box!.maxX).toBeCloseTo(82, 0);
    expect(box!.minY).toBeCloseTo(14, 0);
    expect(box!.maxY).toBeCloseTo(70, 0);
  });

  it('handles H/V commands and returns null for empty paths', () => {
    const box = pathBBox('M47 16 H53 V84 H47 Z M16 47 H84 V53 H16 Z');
    expect(box).not.toBeNull();
    expect(box!.minX).toBe(16);
    expect(box!.maxX).toBe(84);
    expect(box!.minY).toBe(16);
    expect(box!.maxY).toBe(84);
    expect(pathBBox('')).toBeNull();
    expect(pathBBox('ZZZZ')).toBeNull();
  });

  it('replays strokes with a background without crashing in Node (Path2D absent)', () => {
    const { ctx, calls } = fakeContext();
    replayStrokes(ctx, [stroke()], 'M50 32 Z');
    expect(calls).toContain('fillRect 0 0 800 500');
  });
});

describe('drawing export fit (DAILY-DESIGN §4.1)', () => {
  it('preserves aspect and caps the longest side at maxDim', () => {
    const fit = fitWithinMaxDim(2000, 1250, DRAWING_EXPORT_MAX_DIM);
    expect(Math.max(fit.width, fit.height)).toBeLessThanOrEqual(DRAWING_EXPORT_MAX_DIM);
    expect(fit.width / fit.height).toBeCloseTo(2000 / 1250, 5);
  });

  it('never upscales smaller canvases', () => {
    expect(fitWithinMaxDim(800, 500, DRAWING_EXPORT_MAX_DIM)).toEqual({ width: 800, height: 500 });
    expect(fitWithinMaxDim(1024, 640, 1024)).toEqual({ width: 1024, height: 640 });
    expect(fitWithinMaxDim(100, 100, 1024)).toEqual({ width: 100, height: 100 });
  });

  it('fits portrait canvases on the height', () => {
    const fit = fitWithinMaxDim(500, 2000, DRAWING_EXPORT_MAX_DIM);
    expect(fit.height).toBe(DRAWING_EXPORT_MAX_DIM);
    expect(fit.width).toBe(256);
  });

  it('returns degenerate sizes untouched', () => {
    expect(fitWithinMaxDim(0, 500, 1024)).toEqual({ width: 0, height: 500 });
  });

  it('exposes the client mirror of the server caps', () => {
    expect(DRAWING_EXPORT_MAX_DIM).toBe(1024);
    expect(DRAWING_UPLOAD_MAX_BYTES).toBe(1_000_000);
    expect(DRAWING_DATA_URL_MAX_CHARS).toBe(1_400_000);
  });
});

describe('flood fill', () => {
  it('fills the connected region up to a boundary and leaves the other side alone', () => {
    const ctx = bitmapContext();
    // A vertical black wall at x=100 splits the white canvas in two.
    for (let y = 0; y < CANVAS_HEIGHT; y += 1) {
      ctx.setPixel(100, y, 0, 0, 0);
    }
    floodFill(ctx, 50, 250, '#ff0000');
    expect(ctx.getPixel(10, 250)).toEqual([255, 0, 0, 255]); // filled left of the wall
    expect(ctx.getPixel(99, 250)).toEqual([255, 0, 0, 255]);
    expect(ctx.getPixel(100, 250)).toEqual([0, 0, 0, 255]); // wall untouched
    expect(ctx.getPixel(200, 250)).toEqual([255, 255, 255, 255]); // right side untouched
  });

  it('is a no-op when the target pixel already matches the fill color', () => {
    const ctx = bitmapContext();
    floodFill(ctx, 50, 50, '#ffffff');
    expect(ctx.getPixel(50, 50)).toEqual([255, 255, 255, 255]);
  });

  it('clamps out-of-bounds taps and fills from the edge', () => {
    const ctx = bitmapContext();
    floodFill(ctx, -50, -50, '#3f48cc');
    expect(ctx.getPixel(0, 0)).toEqual([63, 72, 204, 255]);
    expect(ctx.getPixel(799, 499)).toEqual([63, 72, 204, 255]); // whole canvas
  });

  it('applies fills through applyStroke and replay (fill entries in the log)', () => {
    const ctx = bitmapContext();
    replayStrokes(ctx, [stroke({ type: 'fill', x: 50, y: 50, color: '#22b14c' })]);
    expect(ctx.getPixel(100, 100)).toEqual([34, 177, 76, 255]);
    expect(ctx.globalCompositeOperation).toBe('source-over');
  });
});
