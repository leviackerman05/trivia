import { useCallback, useEffect, useRef, useState } from 'react';
import SoloShell from '../solo/SoloShell';
import DrawingCanvas from '../../components/DrawingCanvas';
import drawingPromptsJson from '../../data/daily-drawing-prompts.json';
import { dailyGameSeed } from '../../lib/daily';
import { dailyDateKey } from '../../lib/trivia';
import {
  pickDailyPrompt,
  type DrawingPrompt,
  type DrawingSubmissionDto,
} from '../../lib/daily-drawing';
import {
  COLOR_PALETTE,
  DEFAULT_BRUSH_SIZE,
  DEFAULT_COLOR,
  DRAWING_UPLOAD_MAX_BYTES,
  MAX_BRUSH_SIZE,
  MIN_BRUSH_SIZE,
  exportCanvasPng,
  removeStrokeById,
  type Stroke,
} from '../../lib/canvas';
import {
  fetchDrawingGallery,
  flagDrawingSubmission,
  uploadDrawingSubmission,
  voteDrawingSubmission,
} from '../../lib/api';
import { ensureMemberKey, readMemberKey } from '../../lib/member';
import { readNickname } from '../../lib/solo';

/**
 * Daily Drawing — "Prompt of the Day" (DAILY-DESIGN §3.4 + §4.3).
 * prompt → drawing → done. The done view is the SoloShell result frame
 * (flat 100) with the gallery as resultSummary: upload (idempotent, retry
 * on failure), votes-desc gallery (top 20 + "Show more" to 50), vote,
 * flag, and a "yours" marker. No timer in v1.
 */

const entries = drawingPromptsJson as DrawingPrompt[];

const VISIBLE_GALLERY_ITEMS = 20;
const MAX_GALLERY_ITEMS = 50;
const DIFFICULTY_LABELS: Record<number, string> = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };
const CONSTRAINT_LABELS: Record<string, string> = { no_text: 'No text', no_letters: 'No letters' };

type Phase = 'prompt' | 'drawing' | 'done';
type UploadState = 'idle' | 'uploading' | 'saved' | 'failed';

interface Props {
  /** Phase A: when set, the day's content is deterministic for everyone. */
  dailyDateKey?: string;
}

export default function DrawingDaily({ dailyDateKey: dateKeyProp }: Props) {
  const dateKey = dateKeyProp ?? dailyDateKey(new Date());
  const seed = dailyGameSeed(dateKey, 'drawing');
  const prompt = pickDailyPrompt(entries, seed);
  const promptIndex = seed % entries.length;

  const [phase, setPhase] = useState<Phase>('prompt');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [color, setColor] = useState<string>(DEFAULT_COLOR);
  const [brushSize, setBrushSize] = useState(DEFAULT_BRUSH_SIZE);
  const [submitting, setSubmitting] = useState(false);
  const [tooDetailed, setTooDetailed] = useState(false);
  const [exportError, setExportError] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [submissions, setSubmissions] = useState<DrawingSubmissionDto[]>([]);
  const [visibleCount, setVisibleCount] = useState(VISIBLE_GALLERY_ITEMS);
  const [reported, setReported] = useState<Set<string>>(new Set());

  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const dataUrlRef = useRef<string | null>(null);

  // Critical ordering (DAILY-DESIGN §4.3): the memberKey must exist before
  // SoloShell's done-effect reads readMemberKey() — React runs child
  // effects before parent effects, so creating it at mount guarantees the
  // server run + streak/PB pipeline fires for everyone.
  useEffect(() => {
    ensureMemberKey();
  }, []);

  const commitStroke = useCallback((stroke: Stroke) => {
    setStrokes((previous) => [...previous, stroke]);
    setTooDetailed(false);
    setExportError(false);
  }, []);

  const undo = () => {
    if (strokes.length === 0) {
      return;
    }
    const last = strokes[strokes.length - 1]!;
    setStrokes((previous) => removeStrokeById(previous, last.strokeId));
  };

  const clear = () => {
    setStrokes([]);
    setTooDetailed(false);
    setExportError(false);
  };

  const runUpload = useCallback(
    async (dataUrl: string) => {
      setUploadState('uploading');
      try {
        await uploadDrawingSubmission({
          memberKey: ensureMemberKey(),
          playerName: readNickname() || 'Player',
          dateKey,
          promptIndex,
          image: dataUrl,
        });
        setUploadState('saved');
      } catch {
        setUploadState('failed');
      }
    },
    [dateKey, promptIndex]
  );

  const refreshGallery = useCallback(async () => {
    try {
      const response = await fetchDrawingGallery({
        dateKey,
        promptIndex,
        memberKey: readMemberKey() ?? undefined,
      });
      setSubmissions(response.submissions);
    } catch {
      setSubmissions([]);
    }
  }, [dateKey, promptIndex]);

  // Upload path (done-effect): the data URL was captured at submit time
  // (the canvas is unmounted in the done phase). A 200 duplicate is saved.
  useEffect(() => {
    if (phase !== 'done') {
      return;
    }
    const dataUrl = dataUrlRef.current;
    if (!dataUrl) {
      setUploadState('failed');
      return;
    }
    let cancelled = false;
    void runUpload(dataUrl).then(() => {
      if (!cancelled) {
        void refreshGallery();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [phase, runUpload, refreshGallery]);

  // Gallery: fetch on mount of the done view, reset the pagination cap.
  useEffect(() => {
    if (phase !== 'done') {
      return;
    }
    let cancelled = false;
    setVisibleCount(VISIBLE_GALLERY_ITEMS);
    void refreshGallery().then(() => {
      if (!cancelled) {
        setVisibleCount(VISIBLE_GALLERY_ITEMS);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [phase, refreshGallery]);

  const startDrawing = () => {
    setPhase('drawing');
  };

  const submitDrawing = async () => {
    if (strokes.length === 0 || submitting) {
      return;
    }
    setSubmitting(true);
    setExportError(false);
    try {
      const canvas = canvasHostRef.current?.querySelector('canvas');
      if (!canvas) {
        throw new Error('canvas not found');
      }
      const { dataUrl, bytes } = await exportCanvasPng(canvas);
      if (bytes > DRAWING_UPLOAD_MAX_BYTES) {
        // Rare at 1024 px: the upload is never attempted oversized.
        setTooDetailed(true);
        return;
      }
      dataUrlRef.current = dataUrl;
      setPhase('done');
    } catch {
      setExportError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const retryUpload = () => {
    const dataUrl = dataUrlRef.current;
    if (!dataUrl) {
      setPhase('drawing');
      return;
    }
    void runUpload(dataUrl);
  };

  const vote = async (id: string) => {
    const memberKey = readMemberKey();
    if (!memberKey) {
      return;
    }
    // Optimistic bump, then the JSON re-fetch settles (images are cached).
    setSubmissions((previous) =>
      previous.map((submission) =>
        submission.id === id
          ? { ...submission, votes: submission.votes + 1, voted: true }
          : submission
      )
    );
    try {
      await voteDrawingSubmission(id, memberKey);
    } catch {
      // The re-fetch below reverts the optimistic bump.
    }
    void refreshGallery();
  };

  const flag = async (id: string) => {
    const memberKey = readMemberKey();
    if (!memberKey || reported.has(id)) {
      return;
    }
    const reason = window.prompt('Reason (optional)', '')?.trim() || undefined;
    try {
      await flagDrawingSubmission(id, memberKey, reason);
      setReported((previous) => new Set(previous).add(id));
    } catch {
      // Flag is best-effort; the row stays visible.
    }
  };

  if (phase === 'prompt') {
    return (
      <div className="flex flex-col gap-5 rounded-lg border border-border bg-surface-raised p-4 sm:p-6 shadow-sm">
        <h3 className="text-lg font-bold tracking-tight text-ink">Daily Drawing</h3>
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface-muted p-6 text-center">
          <span aria-hidden="true" className="text-6xl">
            {prompt.emoji}
          </span>
          <p className="font-display text-h3 text-ink">{prompt.prompt}</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="rounded-pill bg-primary/20 px-4 py-1.5 text-sm font-semibold text-primary-deep">
              {prompt.category}
            </span>
            <span className="rounded-pill bg-tertiary/40 px-4 py-1.5 text-sm font-semibold text-ink">
              {DIFFICULTY_LABELS[prompt.difficulty] ?? prompt.difficulty}
            </span>
            {(prompt.constraints ?? []).map((constraint) => (
              <span
                key={constraint}
                className="rounded-pill bg-amber-100 px-4 py-1.5 text-sm font-semibold text-warning-strong"
              >
                {CONSTRAINT_LABELS[constraint] ?? constraint}
              </span>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={startDrawing}
          className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary px-7 py-3 text-lg font-semibold text-white  transition-colors hover:bg-primary-hover sm:self-start"
        >
          Start drawing
        </button>
      </div>
    );
  }

  if (phase === 'drawing') {
    return (
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface-raised p-4 sm:p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-bold tracking-tight text-ink">
            {prompt.emoji} {prompt.prompt}
          </h3>
          <span className="rounded-pill bg-tertiary/40 px-4 py-1.5 text-sm font-semibold text-ink">
            {strokes.length > 0 ? `${strokes.length} strokes` : 'Blank canvas'}
          </span>
        </div>

        <div ref={canvasHostRef}>
          <DrawingCanvas
            strokes={strokes}
            onStroke={commitStroke}
            enabled
            color={color}
            brushSize={brushSize}
            tool="pen"
            ariaLabel="Drawing canvas for today's prompt"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-1.5" aria-label="Colors">
            {COLOR_PALETTE.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={`Color ${swatch}`}
                aria-pressed={color === swatch}
                onClick={() => setColor(swatch)}
                className={`h-8 w-8 rounded-full border transition-transform hover:scale-110 ${
                  color === swatch ? 'border-ink ring-2 ring-primary/60' : 'border-border'
                }`}
                style={{ backgroundColor: swatch }}
              />
            ))}
          </div>

          <label className="flex items-center gap-2 text-small font-semibold text-ink">
            Brush
            <input
              type="range"
              min={MIN_BRUSH_SIZE}
              max={MAX_BRUSH_SIZE}
              value={brushSize}
              onChange={(event) => setBrushSize(Number(event.target.value))}
              className="w-28 accent-primary"
              aria-label="Brush size"
            />
            <span className="w-6 text-right tabular-nums text-ink-muted">{brushSize}</span>
          </label>

          <button
            type="button"
            onClick={undo}
            disabled={strokes.length === 0}
            className="inline-flex min-h-11 items-center justify-center rounded-pill border border-border bg-surface-muted px-4 py-2 text-small font-semibold text-ink transition-colors hover:border-primary/50 disabled:pointer-events-none disabled:opacity-40"
          >
            ↩ Undo
          </button>
          <button
            type="button"
            onClick={clear}
            disabled={strokes.length === 0}
            className="inline-flex min-h-11 items-center justify-center rounded-pill border border-border bg-surface-muted px-4 py-2 text-small font-semibold text-ink transition-colors hover:border-primary/50 disabled:pointer-events-none disabled:opacity-40"
          >
            Clear
          </button>
        </div>

        {(tooDetailed || exportError) && (
          <p
            role="alert"
            className="rounded-md border border-danger/50 bg-danger-soft px-4 py-2 text-body font-semibold text-danger-strong"
          >
            {tooDetailed
              ? 'Drawing too detailed — simplify it and submit again.'
              : "Couldn't export your drawing — try again."}
          </p>
        )}

        <button
          type="button"
          onClick={() => void submitDrawing()}
          disabled={strokes.length === 0 || submitting}
          className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary px-7 py-3 text-lg font-semibold text-white  transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-40 sm:self-start"
        >
          {submitting ? 'Preparing…' : 'Submit drawing'}
        </button>
      </div>
    );
  }

  return (
    <SoloShell
      slug="drawing"
      name="Daily Drawing"
      phase="done"
      round={1}
      totalRounds={1}
      score={100}
      resultSummary={
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-border p-4">
            <h3 className="text-lg font-bold tracking-tight text-ink">Today's prompt</h3>
            <p className="mt-1 text-body text-ink">
              {prompt.emoji} {prompt.prompt}
            </p>
          </div>

          {uploadState === 'uploading' && (
            <p role="status" className="text-small font-semibold text-ink-muted">
              Uploading your drawing…
            </p>
          )}
          {uploadState === 'saved' && (
            <p role="status" className="text-small font-semibold text-success-strong">
              Your drawing is in today's gallery.
            </p>
          )}
          {uploadState === 'failed' && (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-3 rounded-md border border-danger/50 bg-danger-soft px-4 py-2"
            >
              <p className="text-small font-semibold text-danger-strong">
                Upload didn't go through — retry.
              </p>
              <button
                type="button"
                onClick={retryUpload}
                className="inline-flex min-h-9 items-center justify-center rounded-pill bg-danger px-4 py-1.5 text-small font-semibold text-white transition-colors hover:bg-danger-dark"
              >
                Retry upload
              </button>
            </div>
          )}

          <div>
            <h3 className="mb-2 text-lg font-bold tracking-tight text-ink">Today's gallery</h3>
            {submissions.length === 0 ? (
              <p className="text-body text-ink-muted">No drawings yet — be the first!</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                {submissions.slice(0, visibleCount).map((submission) => (
                  <li
                    key={submission.id}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start"
                  >
                    <img
                      src={submission.image}
                      alt={`Drawing by ${submission.playerName}`}
                      loading="lazy"
                      className="w-full max-w-56 rounded-md border border-border bg-white"
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <p className="flex flex-wrap items-center gap-2 text-body font-semibold text-ink">
                        {submission.playerName}
                        {submission.mine && (
                          <span className="rounded-pill bg-primary/20 px-3 py-1 text-xs font-semibold text-primary-deep">
                            yours
                          </span>
                        )}
                      </p>
                      <p className="text-small text-ink-muted">{submission.votes} votes</p>
                      <div className="flex flex-wrap gap-2">
                        {!submission.mine && (
                          <button
                            type="button"
                            onClick={() => void vote(submission.id)}
                            disabled={submission.voted}
                            className="inline-flex min-h-9 items-center justify-center rounded-pill border border-primary bg-transparent px-4 py-1.5 text-small font-semibold text-primary-strong transition-colors hover:bg-primary/15 disabled:pointer-events-none disabled:opacity-40"
                          >
                            {submission.voted ? 'Voted ✓' : '▲ Vote'}
                          </button>
                        )}
                        {!submission.mine && (
                          <button
                            type="button"
                            onClick={() => void flag(submission.id)}
                            disabled={reported.has(submission.id)}
                            className="inline-flex min-h-9 items-center justify-center rounded-pill border border-border bg-surface-muted px-4 py-1.5 text-small font-semibold text-ink-muted transition-colors hover:border-danger/50 hover:text-danger-strong disabled:pointer-events-none disabled:opacity-40"
                          >
                            {reported.has(submission.id) ? 'Reported' : 'Report'}
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {visibleCount < submissions.length && (
              <button
                type="button"
                onClick={() =>
                  setVisibleCount((count) =>
                    Math.min(count + VISIBLE_GALLERY_ITEMS, MAX_GALLERY_ITEMS)
                  )
                }
                className="mt-3 inline-flex min-h-11 items-center justify-center rounded-pill border border-border bg-surface-muted px-5 py-2 text-small font-semibold text-ink transition-colors hover:border-primary/50"
              >
                Show more
              </button>
            )}
          </div>

          <p className="text-small text-ink-muted">
            Report inappropriate drawings — anything offensive is hidden after 3 reports.
          </p>
        </div>
      }
      onPlayAgain={() => {
        setStrokes([]);
        setUploadState('idle');
        dataUrlRef.current = null;
        setSubmissions([]);
        setReported(new Set());
        setPhase('prompt');
      }}
    >
      <p className="text-body text-ink-muted">
        You drew today's prompt — 100 points for completing the challenge.
      </p>
    </SoloShell>
  );
}
