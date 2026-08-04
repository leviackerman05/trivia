import { useEffect, useMemo, useRef, useState, type SyntheticEvent } from 'react';
import { useRoom } from './room/useRoom';
import RoomLobbyPanel from './room/RoomLobbyPanel';
import { useCopycatGame } from './useCopycatGame';
import DrawingCanvas, { type DrawingCanvasHandle } from '../components/DrawingCanvas';
import { getGame } from '../lib/games';
import { COLOR_PALETTE, DEFAULT_BRUSH_SIZE, DEFAULT_COLOR, type CanvasTool } from '../lib/canvas';
import { COPYCAT_AWARD_LABELS, type CopycatAward, type CopycatGameState } from '../lib/copycat';

/**
 * Copycat Challenge arena (M5) — the one drawing game without a shared
 * canvas. Flow: 5s image reveal → private canvas (90s) → gallery → vote
 * (Most Recognizable / Funniest / Most Abstract) → awards ceremony.
 * All phase and vote state is server-authoritative via useCopycatGame.
 */

interface Props {
  gameSlug: string;
}

const BRUSH_SIZES = [2, 6, 12, 24] as const;

export default function CopycatArena({ gameSlug }: Props) {
  const game = getGame(gameSlug);
  const { status, error, room, messages, actions: roomActions, myName } = useRoom();
  const { game: copycat, actions: gameActions } = useCopycatGame(
    room?.code ?? null,
    myName ?? null
  );

  const [color, setColor] = useState<string>(DEFAULT_COLOR);
  const [brushSize, setBrushSize] = useState<number>(DEFAULT_BRUSH_SIZE);
  const [tool, setTool] = useState<CanvasTool>('pen');
  const [chatDraft, setChatDraft] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const canvasRef = useRef<DrawingCanvasHandle | null>(null);

  const isHost = useMemo(
    () => room?.players.some((player) => player.isHost && player.connected) ?? false,
    [room]
  );
  const inGame = room !== null && room.phase !== 'lobby';

  // Phase countdown (server deadline).
  useEffect(() => {
    if (
      copycat.view !== 'image-reveal' &&
      copycat.view !== 'drawing' &&
      copycat.view !== 'voting'
    ) {
      return;
    }
    if (copycat.endsAt === null) {
      return;
    }
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [copycat.view, copycat.endsAt]);
  const secondsLeft =
    copycat.endsAt !== null &&
    (copycat.view === 'image-reveal' || copycat.view === 'drawing' || copycat.view === 'voting')
      ? Math.max(0, Math.ceil((copycat.endsAt - now) / 1000))
      : 0;

  const submit = async () => {
    const dataUrl = canvasRef.current?.toDataURL() ?? '';
    if (!dataUrl) {
      return;
    }
    await gameActions.submitDrawing(dataUrl);
  };

  if (!room) {
    return (
      <RoomLobbyPanel
        game={game}
        status={status}
        error={error}
        room={room}
        messages={messages}
        actions={roomActions}
        isHost={isHost}
        gamePlayable={game?.playable === true}
      />
    );
  }

  if (!inGame) {
    return (
      <RoomLobbyPanel
        game={game}
        status={status}
        error={error}
        room={room}
        messages={messages}
        actions={roomActions}
        isHost={isHost}
        gamePlayable={game?.playable === true}
      />
    );
  }

  const submitDisabled = copycat.submitted || copycat.view !== 'drawing';

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-pill bg-primary/20 px-5 py-2 font-mono text-lg font-semibold tracking-[0.25em] text-primary-deep">
          {room.code}
        </span>
        <span className="rounded-pill bg-success-soft px-4 py-1.5 text-xs font-semibold text-success-strong">
          {copycat.view === 'image-reveal' && 'Memorize this!'}
          {copycat.view === 'drawing' && 'Draw it from memory'}
          {copycat.view === 'gallery' && 'Gallery'}
          {copycat.view === 'voting' && 'Vote for the best'}
          {copycat.view === 'results' && 'Awards ceremony'}
        </span>
        {(copycat.view === 'image-reveal' ||
          copycat.view === 'drawing' ||
          copycat.view === 'voting') && (
          <span
            aria-live="polite"
            className={`rounded-pill px-4 py-1.5 font-mono text-sm font-semibold ${
              secondsLeft <= 10
                ? 'bg-danger-soft text-danger-strong'
                : 'bg-success-soft text-success-strong'
            }`}
          >
            {secondsLeft}s
          </span>
        )}
        <button
          type="button"
          onClick={() => roomActions.leaveRoom()}
          className="ml-auto rounded-pill border-3 border-primary bg-transparent px-4 py-2 text-small font-semibold text-primary-strong transition-colors hover:bg-primary/15"
        >
          Leave room
        </button>
      </div>

      {copycat.view === 'image-reveal' && copycat.image && (
        <div className="flex flex-col items-center gap-4 rounded-lg border-2 border-border bg-surface-raised p-6 shadow-sm">
          <h2 className="font-display text-h2 text-ink">Memorize this!</h2>
          {!copycat.imageLoaded ? (
            <div
              role="status"
              className="flex min-h-64 w-full max-w-2xl flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-surface-muted p-8 text-center"
            >
              <span className="text-4xl" aria-hidden="true">
                🖼️
              </span>
              <p className="font-display text-h3 text-ink">Loading the image…</p>
              <p className="text-small text-ink-muted">
                The timer starts as soon as every player has it — no more missing the reveal.
              </p>
            </div>
          ) : (
            <>
              <p className="text-body text-ink-muted">
                {copycat.image.kind === 'painting' ? 'A famous painting' : 'An iconic photo'} —{' '}
                <span className="font-semibold text-primary-deep">{copycat.image.title}</span>. It
                disappears in {secondsLeft}s — then draw it from memory.
              </p>
              <img
                src={copycat.image.url}
                alt={copycat.image.title}
                className="max-h-96 rounded-lg border-2 border-border object-contain shadow-sm"
              />
            </>
          )}
        </div>
      )}

      {copycat.view === 'drawing' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {COLOR_PALETTE.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={`Color ${swatch}`}
                aria-pressed={color === swatch && tool === 'pen'}
                onClick={() => {
                  setColor(swatch);
                  setTool('pen');
                }}
                className={`h-9 w-9 rounded-full border-2 transition-transform hover:scale-110 ${
                  color === swatch && tool === 'pen' ? 'scale-110 border-ink' : 'border-border'
                }`}
                style={{ backgroundColor: swatch }}
              />
            ))}
            <button
              type="button"
              aria-label="Eraser"
              aria-pressed={tool === 'eraser'}
              onClick={() => setTool('eraser')}
              className={`inline-flex h-9 min-w-14 items-center justify-center rounded-pill border-2 px-3 text-xs font-semibold ${
                tool === 'eraser'
                  ? 'border-ink bg-secondary text-white'
                  : 'border-border bg-surface-raised text-ink hover:bg-surface-muted'
              }`}
            >
              Eraser
            </button>
            <span className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
            {BRUSH_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                aria-label={`Brush size ${size}`}
                aria-pressed={brushSize === size}
                onClick={() => setBrushSize(size)}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-pill border-2 ${
                  brushSize === size
                    ? 'border-ink bg-primary/15'
                    : 'border-border bg-surface-raised hover:bg-surface-muted'
                }`}
              >
                <span
                  className="rounded-full bg-ink"
                  style={{ width: size * 1.6, height: size * 1.6 }}
                  aria-hidden="true"
                />
              </button>
            ))}
            <span className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
            <button
              type="button"
              onClick={() => gameActions.removeStroke(copycat.strokes.at(-1)?.strokeId ?? '')}
              className="rounded-pill border-2 border-border bg-surface-raised px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-muted"
            >
              Undo
            </button>
            <button
              type="button"
              onClick={() => gameActions.clearCanvas()}
              className="rounded-pill border-2 border-danger/50 bg-danger-soft px-3 py-1.5 text-xs font-semibold text-danger-strong hover:bg-danger-soft"
            >
              Clear
            </button>
            <button
              type="button"
              disabled={submitDisabled}
              onClick={() => void submit()}
              className="ml-auto inline-flex min-h-11 items-center justify-center rounded-pill bg-secondary px-6 text-small font-semibold text-white shadow-teal transition-colors hover:bg-secondary-dark disabled:pointer-events-none disabled:opacity-40"
            >
              {copycat.submitted ? 'Submitted ✓' : 'Submit my drawing'}
            </button>
          </div>
          <DrawingCanvas
            ref={canvasRef}
            strokes={copycat.strokes}
            onStroke={(stroke) => gameActions.addStroke(stroke)}
            enabled
            color={color}
            brushSize={brushSize}
            tool={tool}
            ariaLabel="Your private Copycat canvas — your drawing is only shared when you submit it"
          />
          {copycat.feedback && (
            <p
              role="status"
              className="rounded-md border-2 border-success/50 bg-success-soft px-4 py-2 text-small font-semibold text-success-strong"
            >
              {copycat.feedback}
            </p>
          )}
        </div>
      )}

      {(copycat.view === 'gallery' || copycat.view === 'voting') && (
        <GalleryView copycat={copycat} myName={myName} onVote={gameActions.castVote} />
      )}

      {copycat.view === 'results' && <AwardsView copycat={copycat} />}

      {error && (
        <p
          role="alert"
          className="rounded-md border-2 border-danger bg-danger-soft px-4 py-3 text-body text-danger-strong"
        >
          {error}
        </p>
      )}
      <ChatBox
        messages={messages}
        draft={chatDraft}
        setDraft={setChatDraft}
        onSend={(event) => {
          event.preventDefault();
          const text = chatDraft;
          setChatDraft('');
          if (text.trim()) {
            void roomActions.sendMessage(text);
          }
        }}
      />
    </div>
  );
}

/** Gallery + voting share the same grid; voting adds the award buttons. */
function GalleryView({
  copycat,
  myName,
  onVote,
}: {
  copycat: CopycatGameState;
  myName: string | null;
  onVote: (category: CopycatAward, target: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [enlarged, setEnlarged] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-h3 text-ink">The gallery</h2>
        <p className="text-body text-ink-muted">
          {copycat.view === 'gallery'
            ? "Everyone's drawings, revealed. Voting starts in a moment…"
            : 'Vote for the most recognizable, the funniest, and the most abstract.'}
        </p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {copycat.drawings.map((drawing) => (
          <li
            key={drawing.playerName}
            className="flex flex-col gap-2 rounded-lg border-2 border-border bg-surface-raised p-3 shadow-sm"
          >
            <button
              type="button"
              onClick={() => setEnlarged(drawing.image)}
              className="overflow-hidden rounded-md border-2 border-border bg-surface-raised transition-transform hover:scale-[1.02]"
              aria-label={`Enlarge ${drawing.playerName}'s drawing`}
            >
              <img
                src={drawing.image}
                alt={`${drawing.playerName}'s copycat drawing`}
                className="aspect-[8/5] w-full object-contain"
              />
            </button>
            <p className="text-center text-small font-semibold text-ink">
              {drawing.playerName}
              {drawing.playerName === myName && (
                <span className="ml-2 rounded-pill bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary-deep">
                  You
                </span>
              )}
            </p>
            {copycat.view === 'voting' && (
              <div className="flex flex-col gap-1.5">
                {(Object.keys(COPYCAT_AWARD_LABELS) as CopycatAward[]).map((category) => {
                  const mine = copycat.myVotes[category];
                  const votedThis = mine !== undefined;
                  const disabled = votedThis || drawing.playerName === myName;
                  return (
                    <button
                      key={category}
                      type="button"
                      disabled={disabled}
                      onClick={() => void onVote(category, drawing.playerName)}
                      className={`rounded-pill border-2 px-3 py-1.5 text-xs font-semibold transition-colors ${
                        mine === drawing.playerName
                          ? 'border-primary bg-primary/20 text-primary-deep'
                          : disabled
                            ? 'border-border bg-surface-muted text-ink-muted opacity-60'
                            : 'border-border bg-surface-raised text-ink hover:bg-primary/10'
                      }`}
                    >
                      {mine === drawing.playerName
                        ? `✓ ${COPYCAT_AWARD_LABELS[category]}`
                        : COPYCAT_AWARD_LABELS[category]}
                    </button>
                  );
                })}
              </div>
            )}
          </li>
        ))}
      </ul>
      {copycat.view === 'voting' && <LiveTally copycat={copycat} />}
      {enlarged && (
        <button
          type="button"
          aria-label="Close enlarged drawing"
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-ink/80 p-4"
          onClick={() => setEnlarged(null)}
        >
          <img
            src={enlarged}
            alt="Enlarged drawing"
            className="max-h-[85vh] max-w-full rounded-lg border-4 border-white bg-surface-raised object-contain shadow-xl"
          />
        </button>
      )}
    </div>
  );
}

/** Live vote tallies per category (updates arrive on every cast vote). */
function LiveTally({ copycat }: { copycat: CopycatGameState }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border-2 border-border bg-surface-raised p-5 shadow-sm">
      <h3 className="font-display text-h4 text-ink">Live tallies</h3>
      {(Object.keys(COPYCAT_AWARD_LABELS) as CopycatAward[]).map((category) => {
        const votes = copycat.tallies[category] ?? [];
        const total = votes.reduce((sum, row) => sum + row.count, 0);
        return (
          <div key={category} className="flex flex-col gap-1">
            <p className="text-small font-semibold text-ink">
              {COPYCAT_AWARD_LABELS[category]}{' '}
              <span className="font-normal text-ink-muted">
                ({total} vote{total === 1 ? '' : 's'})
              </span>
            </p>
            {votes.length === 0 ? (
              <p className="text-small text-ink-muted">No votes yet.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {votes.map((row) => (
                  <div key={row.playerName} className="flex items-center gap-2">
                    <span className="w-24 truncate text-small text-ink">{row.playerName}</span>
                    <div className="h-3 flex-1 overflow-hidden rounded-pill bg-surface-muted">
                      <div
                        className="h-full rounded-pill bg-primary transition-all duration-300"
                        style={{
                          width: total === 0 ? '0%' : `${(row.count / total) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="w-8 text-right text-small font-semibold text-ink-muted">
                      {row.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Awards ceremony — one podium per award category. */
function AwardsView({ copycat }: { copycat: CopycatGameState }) {
  const awards = copycat.awards ?? [];
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-h2 text-ink">🏆 Awards ceremony</h2>
        <p className="text-body text-ink-muted">The room has spoken.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {awards.map((award) => (
          <div
            key={award.category}
            className="flex flex-col gap-3 rounded-lg border-2 border-border bg-surface-raised p-5 text-center shadow-sm"
          >
            <p className="text-small font-semibold uppercase tracking-wide text-primary-deep">
              {COPYCAT_AWARD_LABELS[award.category]}
            </p>
            {award.winner ? (
              <p className="font-display text-h3 text-ink">👑 {award.winner}</p>
            ) : (
              <p className="font-display text-h3 text-ink-muted">No votes</p>
            )}
            <ol className="flex flex-col gap-1">
              {award.votes.map((row) => (
                <li key={row.playerName} className="text-small text-ink">
                  <span className="font-semibold">{row.playerName}</span>{' '}
                  <span className="text-ink-muted">
                    — {row.count} vote{row.count === 1 ? '' : 's'}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
      <p className="text-small text-ink-muted">
        Play again from the lobby — the host can restart the room.
      </p>
    </div>
  );
}

function ChatBox({
  messages,
  draft,
  setDraft,
  onSend,
}: {
  messages: { kind: string; playerName: string; message: string; at: number }[];
  draft: string;
  setDraft: (value: string) => void;
  onSend: (event: SyntheticEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="flex flex-col rounded-lg border-2 border-border bg-surface-raised p-5 shadow-sm">
      <h3 className="mb-2 font-display text-h4 text-ink">Room chat</h3>
      <ul aria-live="polite" className="flex max-h-48 min-h-24 flex-col gap-2 overflow-y-auto pr-1">
        {messages.map((message, index) => (
          <li
            key={index}
            className={`text-body ${message.kind === 'system' ? 'text-small italic text-ink-muted' : 'text-ink'}`}
          >
            <span className="font-semibold">{message.playerName}: </span>
            {message.message}
          </li>
        ))}
        {messages.length === 0 && (
          <li className="text-small text-ink-muted">
            No chatting during the drawing phase — save it for the gallery!
          </li>
        )}
      </ul>
      <form onSubmit={onSend} className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={300}
          placeholder="Type a message…"
          aria-label="Chat message"
          className="min-w-0 flex-1 rounded-md border-2 border-border bg-surface-raised px-4 py-2.5 text-lg text-ink transition-colors hover:border-border-strong focus:border-primary-strong focus:outline-none focus:ring-4 focus:ring-primary/25"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-pill bg-secondary px-5 text-small font-semibold text-white shadow-teal transition-colors hover:bg-secondary-dark disabled:pointer-events-none disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
