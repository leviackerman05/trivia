import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type Ref,
} from 'react';
import {
  applyStroke,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  replayStrokes,
  type CanvasTool,
  type Stroke,
} from '../lib/canvas';

/**
 * Shared drawing surface (DECISIONS D009, reused by every drawing game).
 *
 * - Fixed logical 800×500 coordinate space, scaled responsively via CSS.
 *   stroke coordinates are resolution-independent, so replays look identical
 *   on any device (pointer events are mapped through getBoundingClientRect).
 * - Pointer events unify mouse/touch/pen (touch-action: none).
 * - The authoritative stroke log lives in the parent; the canvas repaints
 *   from it (coalesced to one repaint per animation frame).
 * - Local segments are painted immediately for zero-lag drawing, then
 *   committed through onStroke so the log (and remote clients) stay in sync.
 */

/** Imperative handle: flatten the current canvas (Copycat private submit). */
export interface DrawingCanvasHandle {
  toDataURL: (type?: string) => string;
}

interface DrawingCanvasProps {
  strokes: Stroke[];
  onStroke?: (stroke: Stroke) => void;
  /** Called once per canvas tap while the fill tool is active. */
  onFill?: (x: number, y: number) => void;
  /**
   * One Line, One Shape: called when a drawing stroke ends (pointer up).
   * Every lift of the pen deducts round time (server-authoritative).
   */
  onLift?: () => void;
  /**
   * Shadow Sketch: faint SVG silhouette path rendered behind the strokes
   * (drawer sees it during drawing; everyone sees it after the reveal).
   */
  background?: string;
  enabled: boolean;
  color: string;
  brushSize: number;
  tool: CanvasTool;
  ariaLabel?: string;
  /** React 19 ref-as-prop: exposes toDataURL for private canvas export. */
  ref?: Ref<DrawingCanvasHandle>;
}

export default function DrawingCanvas({
  strokes,
  onStroke,
  onFill,
  onLift,
  background,
  enabled,
  color,
  brushSize,
  tool,
  ariaLabel = 'Drawing canvas',
  ref,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeRef = useRef<{ strokeId: string; prevX: number; prevY: number } | null>(null);
  const propsRef = useRef({ enabled, color, brushSize, tool, onStroke, onFill, onLift });
  propsRef.current = { enabled, color, brushSize, tool, onStroke, onFill, onLift };
  const backgroundRef = useRef(background);
  backgroundRef.current = background;

  useImperativeHandle(
    ref,
    () => ({
      toDataURL: (type = 'image/png') => canvasRef.current?.toDataURL(type) ?? '',
    }),
    []
  );

  // One-time setup: physical pixel size (devicePixelRatio) + coordinate scale.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
    canvas.width = CANVAS_WIDTH * dpr;
    canvas.height = CANVAS_HEIGHT * dpr;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
  }, []);

  // Repaint from the authoritative log (coalesced to one repaint per frame).
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        replayStrokes(ctx, strokes, backgroundRef.current);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [strokes, background]);

  const pointFromEvent = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * CANVAS_WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * CANVAS_HEIGHT;
    return {
      x: Math.min(CANVAS_WIDTH, Math.max(0, x)),
      y: Math.min(CANVAS_HEIGHT, Math.max(0, y)),
    };
  }, []);

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!propsRef.current.enabled) {
      return;
    }
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const point = pointFromEvent(event);
    // Fill tool: one tap = one flood fill, then the caller switches tools.
    if (propsRef.current.tool === 'fill') {
      propsRef.current.onFill?.(point.x, point.y);
      return;
    }
    canvas.setPointerCapture(event.pointerId);
    activeRef.current = { strokeId: crypto.randomUUID(), prevX: point.x, prevY: point.y };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const active = activeRef.current;
    if (!active) {
      return;
    }
    const point = pointFromEvent(event);
    const {
      enabled,
      color: activeColor,
      brushSize: activeBrush,
      tool: activeTool,
      onStroke: emit,
    } = propsRef.current;
    if (!enabled) {
      return;
    }
    const segment: Stroke = {
      strokeId: active.strokeId,
      x: point.x,
      y: point.y,
      prevX: active.prevX,
      prevY: active.prevY,
      color: activeColor,
      brushSize: activeBrush,
      tool: activeTool,
    };
    // Paint locally now (zero lag), then commit to the authoritative log.
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      applyStroke(ctx, segment);
    }
    emit?.(segment);
    active.prevX = point.x;
    active.prevY = point.y;
  };

  const endStroke = () => {
    if (activeRef.current !== null) {
      // One Line, One Shape: every finished stroke = one pen lift.
      propsRef.current.onLift?.();
    }
    activeRef.current = null;
  };

  // The silhouette changes (reveal) without touching the stroke log.
  // repaint immediately so the background is visible to everyone.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        replayStrokes(ctx, strokes, backgroundRef.current);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [background]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={ariaLabel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endStroke}
      onPointerCancel={endStroke}
      className={`w-full rounded-lg border border-border bg-white ${
        enabled ? 'cursor-crosshair' : 'cursor-not-allowed'
      }`}
      style={{ aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}`, touchAction: 'none' }}
    />
  );
}
