/**
 * Shared canvas primitives (DECISIONS D009 — built once for all drawing games).
 * Pure, serializable stroke model + replay helpers. The DrawingCanvas
 * component renders; game adapters own the authoritative stroke log.
 * The server mirror validates inbound payloads (server/src/lib/validation.ts);
 * field lockstep is covered by the socket integration test.
 */

export type CanvasTool = 'pen' | 'eraser' | 'fill';

/**
 * One entry of the stroke log (PRD §8.2 draw-stroke payload + additive
 * strokeId). `type` is additive: "pen" (default) draws a segment from
 * (prevX, prevY) to (x, y); "fill" flood-fills the connected region at
 * (x, y) with the stroke color (segment fields are ignored for fills).
 */
export interface Stroke {
  /** Client-generated stroke group id — undo removes the whole stroke. */
  strokeId: string;
  type?: 'pen' | 'fill';
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  color: string;
  brushSize: number;
  tool: CanvasTool;
}

/** Logical canvas size — stroke coordinates are resolution-independent. */
export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 500;

export const MIN_BRUSH_SIZE = 2;
export const MAX_BRUSH_SIZE = 40;

/** Classic 12-color palette (drawer toolbar). */
export const COLOR_PALETTE = [
  '#000000',
  '#7f7f7f',
  '#880015',
  '#ed1c24',
  '#ff7f27',
  '#fff200',
  '#22b14c',
  '#00a2e8',
  '#3f48cc',
  '#a349a4',
  '#ffaec9',
  '#b97a57',
] as const;

export const DEFAULT_COLOR = COLOR_PALETTE[0];
export const DEFAULT_BRUSH_SIZE = 4;

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

/**
 * Flood fill the connected same-color region at logical (x, y) with the
 * given hex color. Operates on the physical bitmap (the context is dpr-
 * scaled, so getImageData ignores the transform) — the dpr is derived from
 * the canvas backing size vs the logical size.
 */
export function floodFill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string
): void {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const dpr = width / CANVAS_WIDTH;
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const px = Math.min(width - 1, Math.max(0, Math.round(x * dpr)));
  const py = Math.min(height - 1, Math.max(0, Math.round(y * dpr)));
  const startIndex = (py * width + px) * 4;
  const target = [
    data[startIndex]!,
    data[startIndex + 1]!,
    data[startIndex + 2]!,
    data[startIndex + 3]!,
  ];
  const [r, g, b] = hexToRgb(color);
  if (target[0] === r && target[1] === g && target[2] === b && target[3] === 255) {
    return; // already the fill color
  }
  const stack: Array<[number, number]> = [[px, py]];
  while (stack.length > 0) {
    const [cx, cy] = stack.pop()!;
    const index = (cy * width + cx) * 4;
    if (
      data[index] !== target[0] ||
      data[index + 1] !== target[1] ||
      data[index + 2] !== target[2] ||
      data[index + 3] !== target[3]
    ) {
      continue;
    }
    data[index] = r;
    data[index + 1] = g;
    data[index + 2] = b;
    data[index + 3] = 255;
    if (cx > 0) stack.push([cx - 1, cy]);
    if (cx < width - 1) stack.push([cx + 1, cy]);
    if (cy > 0) stack.push([cx, cy - 1]);
    if (cy < height - 1) stack.push([cx, cy + 1]);
  }
  ctx.putImageData(image, 0, 0);
}

/** Draw one log entry: a pen/eraser segment, or a flood fill. */
export function applyStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  if (stroke.type === 'fill') {
    floodFill(ctx, stroke.x, stroke.y, stroke.color);
    return;
  }
  ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.brushSize;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(stroke.prevX, stroke.prevY);
  ctx.lineTo(stroke.x, stroke.y);
  ctx.stroke();
}

/** Full repaint from the authoritative stroke log (white canvas first). */
export function replayStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[]): void {
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  for (const stroke of strokes) {
    applyStroke(ctx, stroke);
  }
}

/** Remove every segment of one stroke (undo). */
export function removeStrokeById(strokes: Stroke[], strokeId: string): Stroke[] {
  return strokes.filter((stroke) => stroke.strokeId !== strokeId);
}
