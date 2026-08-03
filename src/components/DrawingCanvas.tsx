import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import {
  applyStroke,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  replayStrokes,
  type CanvasTool,
  type Stroke,
} from '../lib/canvas';

/**
 * Shared drawing surface (DECISIONS D009 — reused by every drawing game).
 *
 * - Fixed logical 800×500 coordinate space, scaled responsively via CSS —
 *   stroke coordinates are resolution-independent, so replays look identical
 *   on any device (pointer events are mapped through getBoundingClientRect).
 * - Pointer events unify mouse/touch/pen (touch-action: none).
 * - The authoritative stroke log lives in the parent; the canvas repaints
 *   from it (coalesced to one repaint per animation frame).
 * - Local segments are painted immediately for zero-lag drawing, then
 *   committed through onStroke so the log (and remote clients) stay in sync.
 */

interface DrawingCanvasProps {
  strokes: Stroke[];
  onStroke?: (stroke: Stroke) => void;
  /** Called once per canvas tap while the fill tool is active. */
  onFill?: (x: number, y: number) => void;
  enabled: boolean;
  color: string;
  brushSize: number;
  tool: CanvasTool;
  ariaLabel?: string;
}

export default function DrawingCanvas({
  strokes,
  onStroke,
  onFill,
  enabled,
  color,
  brushSize,
  tool,
  ariaLabel = 'Drawing canvas',
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeRef = useRef<{ strokeId: string; prevX: number; prevY: number } | null>(null);
  const propsRef = useRef({ enabled, color, brushSize, tool, onStroke, onFill });
  propsRef.current = { enabled, color, brushSize, tool, onStroke, onFill };

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
        replayStrokes(ctx, strokes);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [strokes]);

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
    activeRef.current = null;
  };

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={ariaLabel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endStroke}
      onPointerCancel={endStroke}
      className={`w-full rounded-lg border-2 border-gray-200 bg-white ${
        enabled ? 'cursor-crosshair' : 'cursor-not-allowed'
      }`}
      style={{ aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}`, touchAction: 'none' }}
    />
  );
}
