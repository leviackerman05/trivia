import { useEffect, useMemo, useState, type SyntheticEvent } from 'react';
import { useRoom } from './room/useRoom';
import RoomLobbyPanel from './room/RoomLobbyPanel';
import { useDrawingGame } from './useDrawingGame';
import DrawingCanvas from '../components/DrawingCanvas';
import { getGame } from '../lib/games';
import { COLOR_PALETTE, DEFAULT_BRUSH_SIZE, DEFAULT_COLOR, type CanvasTool } from '../lib/canvas';
import type { SkribblRoundSummary, SkribblScoreEntry } from '../lib/skribbl';

/**
 * Shared-canvas drawing game arena (M5) — powers Skribbl Arena, One Line One
 * Shape, Shadow Sketch, and Draw the Lyric from one island. The lobby is the
 * shared RoomLobbyPanel; round views differ per game via ARENA_CONFIGS.
 * All game state is server-authoritative via useDrawingGame.
 */

interface Props {
  gameSlug: string;
}

interface ArenaConfig {
  /** Skribbl: drawer picks 1 of 3 words. */
  wordSelect: boolean;
  /** Skribbl: host-pasted custom word list. */
  customWords: boolean;
  /** Drawer prompt presentation. */
  banner: 'lyric' | 'object' | 'silhouette' | null;
  /** One Line, One Shape: pen lifts deduct time. */
  liftWarn: boolean;
}

const ARENA_CONFIGS: Record<string, ArenaConfig> = {
  'skribbl-arena': { wordSelect: true, customWords: true, banner: null, liftWarn: false },
  'one-line-one-shape': { wordSelect: false, customWords: false, banner: 'object', liftWarn: true },
  'shadow-sketch': { wordSelect: false, customWords: false, banner: 'silhouette', liftWarn: false },
  'draw-the-lyric': { wordSelect: false, customWords: false, banner: 'lyric', liftWarn: false },
};

const BRUSH_SIZES = [2, 6, 12, 24] as const;

export default function DrawingGameArena({ gameSlug }: Props) {
  const game = getGame(gameSlug);
  const config = ARENA_CONFIGS[gameSlug] ?? ARENA_CONFIGS['skribbl-arena']!;
  const { status, error, room, messages, actions: roomActions, myName } = useRoom();
  const { game: drawing, actions: gameActions } = useDrawingGame(
    room?.code ?? null,
    myName ?? null
  );

  const [color, setColor] = useState<string>(DEFAULT_COLOR);
  const [brushSize, setBrushSize] = useState<number>(DEFAULT_BRUSH_SIZE);
  const [tool, setTool] = useState<CanvasTool>('pen');
  const [fillColor, setFillColor] = useState<string>(DEFAULT_COLOR);
  const [chatDraft, setChatDraft] = useState('');
  const [now, setNow] = useState(() => Date.now());

  const isHost = useMemo(
    () => room?.players.some((player) => player.isHost && player.connected) ?? false,
    [room]
  );
  const isDrawer = drawing.drawerName !== null && drawing.drawerName === myName;
  const inGame = room !== null && room.phase !== 'lobby';

  // Drawing-phase countdown (server deadline).
  useEffect(() => {
    if (drawing.view !== 'drawing' || drawing.endsAt === null) {
      return;
    }
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [drawing.view, drawing.endsAt]);
  const secondsLeft =
    drawing.view === 'drawing' && drawing.endsAt !== null
      ? Math.max(0, Math.ceil((drawing.endsAt - now) / 1000))
      : 0;

  const sendChatOrGuess = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = chatDraft;
    setChatDraft('');
    if (!text.trim()) {
      return;
    }
    if (drawing.view === 'drawing' && text.length <= 60) {
      void gameActions.sendGuess(text);
    } else {
      void roomActions.sendMessage(text);
    }
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
        lobbyExtras={
          config.customWords ? (
            <CustomWordsBlock
              isHost={isHost}
              onApply={(words) => gameActions.setCustomWords(words)}
            />
          ) : gameSlug === 'shadow-sketch' ? (
            <ShadowGenreBlock isHost={isHost} onSelect={gameActions.setShadowGenre} />
          ) : undefined
        }
      />
    );
  }

  const sortedScores = [...room.players]
    .map((player) => ({ name: player.name, score: drawing.scores[player.name] ?? 0 }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-pill bg-primary/20 px-5 py-2 font-mono text-lg font-semibold tracking-[0.25em] text-primary-deep">
          {room.code}
        </span>
        <span className="rounded-pill bg-success-soft px-4 py-1.5 text-xs font-semibold text-success-strong">
          Round {drawing.round} of {drawing.totalRounds}
        </span>
        {drawing.view === 'drawing' && (
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
        <span className="rounded-pill bg-tertiary/40 px-4 py-1.5 text-xs font-semibold text-ink">
          {isDrawer ? `You're drawing — ${game?.name ?? ''}` : `Drawing: ${drawing.drawerName}`}
        </span>
        <button
          type="button"
          onClick={() => roomActions.leaveRoom()}
          className="ml-auto rounded-pill border-3 border-primary bg-transparent px-4 py-2 text-small font-semibold text-primary-strong transition-colors hover:bg-primary/15"
        >
          Leave room
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-4">
          {config.wordSelect && drawing.view === 'word-select' && (
            <WordSelectView
              choices={drawing.choices}
              drawerName={drawing.drawerName}
              isDrawer={isDrawer}
              onChoose={(word) => void gameActions.chooseWord(word)}
            />
          )}

          {!config.wordSelect && drawing.view === 'word-select' && (
            <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border bg-surface-raised p-10 text-center shadow-sm">
              <p className="font-display text-h3 text-ink">Setting up the round…</p>
            </div>
          )}

          {drawing.view === 'drawing' && (
            <div className="flex flex-col gap-3">
              {/* The word sits at the top-center of the play area, skribbl-style. */}
              <HintRow config={config} drawing={drawing} />

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
                <button
                  type="button"
                  aria-label="Fill (bucket) — tap the canvas to flood-fill"
                  aria-pressed={tool === 'fill'}
                  onClick={() => {
                    setFillColor(tool === 'eraser' ? '#ffffff' : color);
                    setTool('fill');
                  }}
                  className={`inline-flex h-9 min-w-14 items-center justify-center rounded-pill border-2 px-3 text-xs font-semibold ${
                    tool === 'fill'
                      ? 'border-ink bg-secondary text-white'
                      : 'border-border bg-surface-raised text-ink hover:bg-surface-muted'
                  }`}
                >
                  Fill
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
                  onClick={() => void gameActions.undoStroke()}
                  className="rounded-pill border-2 border-border bg-surface-raised px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-muted"
                >
                  Undo
                </button>
                <button
                  type="button"
                  onClick={() => void gameActions.clearCanvas()}
                  className="rounded-pill border-2 border-danger/50 bg-danger-soft px-3 py-1.5 text-xs font-semibold text-danger-strong hover:bg-danger-soft"
                >
                  Clear
                </button>
                {isHost && (
                  <button
                    type="button"
                    onClick={() => void gameActions.endRoundNow()}
                    className="ml-auto rounded-pill border-2 border-secondary bg-secondary px-3 py-1.5 text-xs font-semibold text-white hover:bg-secondary-dark"
                  >
                    End round now
                  </button>
                )}
              </div>

              <DrawerPrompt config={config} isDrawer={isDrawer} drawing={drawing} />

              <DrawingCanvas
                strokes={drawing.strokes}
                onStroke={(stroke) => void gameActions.sendStroke(stroke)}
                onFill={(x, y) => {
                  void gameActions.sendFill(x, y, fillColor);
                  setTool('pen');
                }}
                onLift={
                  config.liftWarn && isDrawer ? () => void gameActions.strokeLift() : undefined
                }
                background={
                  config.banner === 'silhouette'
                    ? isDrawer
                      ? (drawing.drawerData.silhouette ?? undefined)
                      : (drawing.revealedSilhouette ?? undefined)
                    : undefined
                }
                enabled={isDrawer}
                color={color}
                brushSize={brushSize}
                tool={tool}
                ariaLabel={`Shared drawing canvas — ${isDrawer ? 'you are the drawer' : `waiting for ${drawing.drawerName} to draw`}`}
              />

              {config.liftWarn && isDrawer && drawing.liftWarnings > 0 && (
                <p
                  role="status"
                  className="rounded-md border-2 border-danger/50 bg-danger-soft px-4 py-2 text-small font-semibold text-danger-strong"
                >
                  Pen lifted {drawing.liftWarnings}× — 10 seconds deducted each time. Keep the line
                  continuous!
                </p>
              )}
            </div>
          )}

          {drawing.view === 'round-results' && (
            <RoundResultsView
              summary={drawing.summary}
              round={drawing.round}
              totalRounds={drawing.totalRounds}
              isHost={isHost}
              onNext={() => void gameActions.nextRound()}
            />
          )}

          {drawing.view === 'game-end' && (
            <GameEndView
              finalScores={drawing.finalScores}
              myName={myName}
              isHost={isHost}
              onRestart={() => void gameActions.restartGame()}
            />
          )}
        </div>

        <div className="flex flex-col gap-5">
          <div className="rounded-lg border-2 border-border bg-surface-raised p-5 shadow-sm">
            <h3 className="mb-2 font-display text-h4 text-ink">Scores</h3>
            <ol className="flex flex-col divide-y-2 divide-dashed divide-border">
              {sortedScores.map((entry, index) => (
                <li
                  key={entry.name}
                  className="flex min-h-11 items-center justify-between px-4 text-body text-ink"
                >
                  <span className="font-semibold">
                    {index + 1}. {entry.name}
                    {entry.name === myName && (
                      <span className="ml-2 rounded-pill bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary-deep">
                        You
                      </span>
                    )}
                  </span>
                  <span className="text-ink-muted">{entry.score}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="flex flex-col rounded-lg border-2 border-border bg-surface-raised p-5 shadow-sm">
            <h3 className="mb-2 font-display text-h4 text-ink">Room chat</h3>
            <ul
              aria-live="polite"
              className="flex max-h-64 min-h-32 flex-col gap-2 overflow-y-auto pr-1"
            >
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
                <li className="text-small text-ink-muted">Guesses go here during the round!</li>
              )}
            </ul>
            <form onSubmit={sendChatOrGuess} className="mt-3 flex gap-2">
              <input
                value={chatDraft}
                onChange={(event) => setChatDraft(event.target.value)}
                maxLength={300}
                placeholder={drawing.view === 'drawing' ? 'Type your guess…' : 'Type a message…'}
                aria-label={drawing.view === 'drawing' ? 'Guess' : 'Chat message'}
                className="min-w-0 flex-1 rounded-md border-2 border-border bg-surface-raised px-4 py-2.5 text-lg text-ink transition-colors hover:border-border-strong focus:border-primary-strong focus:outline-none focus:ring-4 focus:ring-primary/25"
              />
              <button
                type="submit"
                disabled={!chatDraft.trim()}
                className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-pill bg-secondary px-5 text-small font-semibold text-white shadow-teal transition-colors hover:bg-secondary-dark disabled:pointer-events-none disabled:opacity-40"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-md border-2 border-danger bg-danger-soft px-4 py-3 text-body text-danger-strong"
        >
          {error}
        </p>
      )}
    </div>
  );
}

/** Drawer-only prompt: lyric banner, object banner, or silhouette hint. */
function DrawerPrompt({
  config,
  isDrawer,
  drawing,
}: {
  config: ArenaConfig;
  isDrawer: boolean;
  drawing: SkribblGameStateLike;
}) {
  if (config.banner === 'lyric') {
    return isDrawer ? (
      <div className="rounded-lg border-2 border-dashed border-primary/50 bg-primary/10 px-5 py-3">
        <p className="text-small font-semibold uppercase tracking-wide text-primary-deep">
          Draw this lyric — the song title is the answer
        </p>
        <p className="mt-1 font-display text-h3 text-ink">“{drawing.drawerData.lyric}”</p>
        {drawing.drawerData.artist && (
          <p className="text-small text-ink-muted">Artist hint appears at 45s.</p>
        )}
      </div>
    ) : (
      <p className="text-small text-ink-muted">
        {drawing.drawerName} is drawing a lyric — guess the song title!
      </p>
    );
  }
  if (config.banner === 'object') {
    return isDrawer ? (
      <div className="rounded-lg border-2 border-dashed border-primary/50 bg-primary/10 px-5 py-3">
        <p className="text-small font-semibold uppercase tracking-wide text-primary-deep">
          One continuous line — don't lift the pen!
        </p>
        <p className="mt-1 font-display text-h3 text-ink">{drawing.drawerData.object}</p>
      </div>
    ) : (
      <p className="text-small text-ink-muted">
        {drawing.drawerName} is drawing with one continuous line.
      </p>
    );
  }
  if (config.banner === 'silhouette') {
    return isDrawer ? (
      <div className="rounded-lg border-2 border-dashed border-primary/50 bg-primary/10 px-5 py-3">
        <p className="text-small font-semibold uppercase tracking-wide text-primary-deep">
          Draw the details INSIDE the shadow to make it recognizable
        </p>
      </div>
    ) : (
      <p className="text-small text-ink-muted">
        {drawing.drawerName} is filling in a shadow — the silhouette is revealed at 60s.
      </p>
    );
  }
  return null;
}

type SkribblGameStateLike = {
  drawerData: {
    object: string | null;
    silhouette: string | null;
    lyric: string | null;
    artist: string | null;
  };
  drawerName: string | null;
};

/** The word (skribbl-style, top-center), artist hint, or silhouette reveal. */
function HintRow({
  config,
  drawing,
}: {
  config: ArenaConfig;
  drawing: SkribblGameStateLike & {
    firstLetter: string | null;
    lastLetter: string | null;
    artistHint: string | null;
    revealedSilhouette: string | null;
    guessFeedback: string | null;
    wordLength: number | null;
  };
}) {
  if (config.banner === 'lyric' && drawing.artistHint) {
    return (
      <p aria-live="polite" className="text-center text-body font-semibold text-ink">
        Artist hint: {drawing.artistHint}
      </p>
    );
  }
  if (config.banner === 'silhouette' && drawing.revealedSilhouette) {
    return (
      <p aria-live="polite" className="text-center text-body font-semibold text-ink">
        Silhouette revealed — everyone can see the shadow now!
      </p>
    );
  }
  return (
    <div className="flex flex-col items-center gap-2">
      {config.banner === null && (
        <p
          aria-live="polite"
          className="flex gap-2 font-mono text-4xl font-bold tracking-[0.3em] text-ink sm:text-5xl"
        >
          {Array.from({ length: drawing.wordLength ?? 0 }, (_, index) => {
            const last = (drawing.wordLength ?? 1) - 1;
            if (drawing.firstLetter && index === 0) {
              return <span key={index}>{drawing.firstLetter}</span>;
            }
            if (drawing.lastLetter && index === last && last > 0) {
              return <span key={index}>{drawing.lastLetter}</span>;
            }
            return <span key={index}>•</span>;
          })}
        </p>
      )}
      <span aria-live="polite" className="text-body text-ink-muted">
        {drawing.guessFeedback ?? 'Guess the word before the timer runs out!'}
      </span>
    </div>
  );
}

/** Drawer-only word pick (skribbl). */
function WordSelectView({
  choices,
  drawerName,
  isDrawer,
  onChoose,
}: {
  choices: string[] | null;
  drawerName: string | null;
  isDrawer: boolean;
  onChoose: (word: string) => void;
}) {
  if (!isDrawer) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border bg-surface-raised p-10 text-center shadow-sm">
        <p className="font-display text-h3 text-ink">Waiting for the drawer…</p>
        <p className="text-body text-ink-muted">{drawerName} is picking a word.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4 rounded-lg border-2 border-border bg-surface-raised p-6 shadow-sm">
      <h3 className="font-display text-h3 text-ink">Pick your word</h3>
      <p className="text-body text-ink-muted">
        Choose one of these — everyone else will try to guess it from your drawing.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {choices?.map((word) => (
          <button
            key={word}
            type="button"
            onClick={() => onChoose(word)}
            className="inline-flex min-h-16 items-center justify-center rounded-pill border-3 border-primary bg-surface-raised px-6 py-3 text-xl font-semibold text-primary-strong transition-colors hover:bg-primary/15 focus:border-primary-strong focus:outline-none focus:ring-4 focus:ring-primary/25"
          >
            {word}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Round reveal: word, who got it, drawer's cut. */
function RoundResultsView({
  summary,
  round,
  totalRounds,
  isHost,
  onNext,
}: {
  summary: SkribblRoundSummary | null;
  round: number;
  totalRounds: number;
  isHost: boolean;
  onNext: () => void;
}) {
  if (!summary) {
    return null;
  }
  return (
    <div className="flex flex-col gap-4 rounded-lg border-2 border-border bg-surface-raised p-6 shadow-sm">
      <h3 className="font-display text-h3 text-ink">
        The answer was <span className="text-primary-deep">{summary.word}</span>
      </h3>
      <div className="flex flex-col gap-2">
        {summary.correct.length === 0 ? (
          <p className="text-body text-ink-muted">
            Nobody got it this round — {summary.drawerName} drew a stumper!
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {summary.correct.map((entry) => (
              <li key={entry.playerName} className="text-body text-ink">
                <span className="font-semibold">{entry.playerName}</span> +{entry.points} points
              </li>
            ))}
          </ul>
        )}
        <p className="text-body text-ink">
          <span className="font-semibold">{summary.drawerName}</span> earns{' '}
          <span className="font-semibold">+{summary.drawerPoints}</span> as the drawer
        </p>
      </div>
      {isHost ? (
        <button
          type="button"
          onClick={onNext}
          className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary-strong px-7 py-3 text-lg font-semibold text-white shadow-coral transition-colors hover:bg-primary-hover sm:self-start"
        >
          {round >= totalRounds ? 'See final results' : 'Next round'}
        </button>
      ) : (
        <p className="text-small text-ink-muted">
          Waiting for the host — the next round starts automatically in a moment.
        </p>
      )}
    </div>
  );
}

/** Final podium. */
function GameEndView({
  finalScores,
  myName,
  isHost,
  onRestart,
}: {
  finalScores: SkribblScoreEntry[] | null;
  myName: string | null;
  isHost: boolean;
  onRestart: () => void;
}) {
  const final = finalScores ?? [];
  return (
    <div className="flex flex-col gap-4 rounded-lg border-2 border-border bg-surface-raised p-6 shadow-sm">
      <h3 className="font-display text-h2 text-ink">
        {final[0] ? `${final[0].playerName} wins!` : 'Game over'}
      </h3>
      <ol className="flex flex-col divide-y-2 divide-dashed divide-border">
        {final.map((entry, index) => (
          <li
            key={entry.playerName}
            className="flex min-h-14 items-center justify-between px-5 text-lg text-ink"
          >
            <span className="font-semibold">
              {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}{' '}
              {entry.playerName}
              {entry.playerName === myName && (
                <span className="ml-2 rounded-pill bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary-deep">
                  You
                </span>
              )}
            </span>
            <span className="text-ink-muted">{entry.score}</span>
          </li>
        ))}
      </ol>
      {isHost ? (
        <button
          type="button"
          onClick={onRestart}
          className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary-strong px-7 py-3 text-lg font-semibold text-white shadow-coral transition-colors hover:bg-primary-hover sm:self-start"
        >
          Play again
        </button>
      ) : (
        <p className="text-small text-ink-muted">Waiting for the host to start another game.</p>
      )}
    </div>
  );
}

/** M15 — Shadow Sketch host lobby control: pick the silhouette genre. */
const SHADOW_GENRES: { id: string; label: string }[] = [
  { id: 'animals', label: 'Animals' },
  { id: 'food', label: 'Food' },
  { id: 'nature', label: 'Nature' },
  { id: 'objects', label: 'Objects' },
  { id: 'places', label: 'Places' },
  { id: 'space', label: 'Space & Fantasy' },
];

function ShadowGenreBlock({
  isHost,
  onSelect,
}: {
  isHost: boolean;
  onSelect: (genre: string | null) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [genre, setGenre] = useState<string | null>(null);
  if (!isHost) {
    return null;
  }
  return (
    <div className="rounded-lg border-2 border-dashed border-border bg-surface-raised p-5 shadow-sm">
      <h3 className="font-display text-h4 text-ink">Silhouette category (host)</h3>
      <p className="mt-1 text-small text-ink-muted">
        Pick a theme — the shadows (and the drawing challenge) come from it.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={genre === null}
          onClick={() => {
            setGenre(null);
            void onSelect(null);
          }}
          className={`rounded-pill border-2 px-4 py-2 text-small font-semibold transition-colors ${
            genre === null
              ? 'border-primary bg-primary/15 text-primary-deep'
              : 'border-border bg-surface-muted text-ink-muted hover:border-primary/50 hover:text-ink'
          }`}
        >
          All categories
        </button>
        {SHADOW_GENRES.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={genre === option.id}
            onClick={() => {
              setGenre(option.id);
              void onSelect(option.id);
            }}
            className={`rounded-pill border-2 px-4 py-2 text-small font-semibold transition-colors ${
              genre === option.id
                ? 'border-primary bg-primary/15 text-primary-deep'
                : 'border-border bg-surface-muted text-ink-muted hover:border-primary/50 hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Host-only custom word list (skribbl). */
function CustomWordsBlock({
  isHost,
  onApply,
}: {
  isHost: boolean;
  onApply: (words: string[]) => Promise<{ ok: boolean; error?: string; count?: number }>;
}) {
  const [draft, setDraft] = useState('');
  const [applying, setApplying] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  if (!isHost) {
    return null;
  }

  const apply = async () => {
    const words = draft
      .split(/[\n,]+/)
      .map((word) => word.trim())
      .filter(Boolean);
    if (words.length < 3) {
      setFeedback({ kind: 'error', text: 'Enter at least 3 words.' });
      return;
    }
    setApplying(true);
    setFeedback(null);
    const result = await onApply(words);
    setApplying(false);
    if (result.ok) {
      setFeedback({
        kind: 'ok',
        text: `${result.count ?? words.length} custom words ready — applied when the game starts.`,
      });
    } else {
      setFeedback({
        kind: 'error',
        text: 'That list was rejected — use 3–200 words with letters, spaces, hyphens, or apostrophes.',
      });
    }
  };

  return (
    <div className="rounded-lg border-2 border-dashed border-border bg-surface-raised p-5 shadow-sm">
      <h3 className="font-display text-h4 text-ink">Custom words (host)</h3>
      <p className="mt-1 text-small text-ink-muted">
        Optional: paste your own word list — one per line or comma-separated — to replace the
        built-in bank.
      </p>
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        rows={3}
        maxLength={4000}
        placeholder={'pizza\nastronaut\nbanana'}
        aria-label="Custom word list"
        className="mt-3 w-full rounded-md border-2 border-border bg-surface-raised px-4 py-3 text-lg text-ink transition-colors hover:border-border-strong focus:border-primary-strong focus:outline-none focus:ring-4 focus:ring-primary/25"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={applying || !draft.trim()}
          onClick={() => void apply()}
          className="inline-flex min-h-11 items-center justify-center rounded-pill border-3 border-primary bg-transparent px-5 text-small font-semibold text-primary-strong transition-colors hover:bg-primary/15 disabled:pointer-events-none disabled:opacity-40"
        >
          {applying ? 'Applying…' : 'Apply word list'}
        </button>
        {feedback && (
          <span
            role="status"
            className={`text-small font-semibold ${
              feedback.kind === 'ok' ? 'text-success-strong' : 'text-danger-strong'
            }`}
          >
            {feedback.text}
          </span>
        )}
      </div>
    </div>
  );
}
