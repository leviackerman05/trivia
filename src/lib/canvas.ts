/**
 * Shared canvas primitives (DECISIONS D009, built once for all drawing games).
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
  /** Client-generated stroke group id, undo removes the whole stroke. */
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

/** Logical canvas size, stroke coordinates are resolution-independent. */
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
 * scaled, so getImageData ignores the transform), the dpr is derived from
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
export function replayStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  background?: string
): void {
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  if (background) {
    drawSilhouette(ctx, background);
  }
  for (const stroke of strokes) {
    applyStroke(ctx, stroke);
  }
}

interface PathBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Approximate bounding box of an uppercase-only SVG path (the silhouette
 * dataset is normalized to a 0-100 coordinate space). Control points are
 * included, which only adds a small margin to the fit. Lowercase commands
 * (relative) are not part of the dataset and are skipped defensively.
 */
export function pathBBox(path: string): PathBox | null {
  const tokens = path.match(/[A-Z]|-?\d*\.?\d+(?:[eE][+-]?\d+)?/g) ?? [];
  let index = 0;
  const next = (): number => {
    const value = parseFloat(tokens[index]);
    index += 1;
    return value;
  };
  let x = 0;
  let y = 0;
  let box: PathBox | null = null;
  const point = (px: number, py: number): void => {
    x = px;
    y = py;
    if (!box) {
      box = { minX: px, minY: py, maxX: px, maxY: py };
    } else {
      box.minX = Math.min(box.minX, px);
      box.minY = Math.min(box.minY, py);
      box.maxX = Math.max(box.maxX, px);
      box.maxY = Math.max(box.maxY, py);
    }
  };
  while (index < tokens.length) {
    const command = tokens[index];
    index += 1;
    switch (command) {
      case 'M': {
        point(next(), next());
        break;
      }
      case 'L':
      case 'T': {
        point(next(), next());
        break;
      }
      case 'H': {
        point(next(), y);
        break;
      }
      case 'V': {
        point(x, next());
        break;
      }
      case 'C':
      case 'S': {
        const c1x = next();
        const c1y = next();
        const c2x = next();
        const c2y = next();
        point(c1x, c1y);
        point(c2x, c2y);
        point(next(), next());
        break;
      }
      case 'Q': {
        point(next(), next());
        point(next(), next());
        break;
      }
      case 'A': {
        next();
        next();
        next();
        next();
        next();
        point(next(), next());
        break;
      }
      case 'Z': {
        break;
      }
      default: {
        // Unknown/lowercase command, stop parsing defensively.
        index = tokens.length;
      }
    }
  }
  return box;
}

/**
 * Shadow Sketch: render a faint silhouette behind the strokes. The SVG path
 * is scaled to fit the logical canvas (aspect-preserving, centered) so the
 * same path renders identically on every device.
 */
export function drawSilhouette(ctx: CanvasRenderingContext2D, path: string): void {
  // Path2D is a browser API, SSR and Node test envs skip the rendering.
  if (typeof Path2D === 'undefined') {
    return;
  }
  let path2d: Path2D;
  try {
    path2d = new Path2D(path);
  } catch {
    return; // Unparsable path, draw nothing.
  }
  const box = pathBBox(path);
  if (!box || box.maxX - box.minX <= 0 || box.maxY - box.minY <= 0) {
    return;
  }
  const pad = 8;
  const boxWidth = box.maxX - box.minX;
  const boxHeight = box.maxY - box.minY;
  const scale = Math.min(
    (CANVAS_WIDTH - pad * 2) / boxWidth,
    (CANVAS_HEIGHT - pad * 2) / boxHeight
  );
  const offsetX = (CANVAS_WIDTH - boxWidth * scale) / 2 - box.minX * scale;
  const offsetY = (CANVAS_HEIGHT - boxHeight * scale) / 2 - box.minY * scale;
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.09)';
  ctx.fill(path2d);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.lineWidth = 1.5 / scale;
  ctx.lineJoin = 'round';
  ctx.stroke(path2d);
  ctx.restore();
}

/** Remove every segment of one stroke (undo). */
export function removeStrokeById(strokes: Stroke[], strokeId: string): Stroke[] {
  return strokes.filter((stroke) => stroke.strokeId !== strokeId);
}
